//! [INPUT]: 依赖 GitHub App Device Flow、用户安装/仓库 API、secret store 与 tokio 轮询计时
//! [OUTPUT]: 向发布 facade 提供 GitHub 浏览器连接、自动刷新、断开连接、连接状态与可发布仓库查询
//! [POS]: 发布领域的 GitHub 身份适配器，拥有用户授权生命周期，不拥有 Hugo 转换与 Git object 提交
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::secret_store::{delete_secret_group, has_secret, read_secret, save_secret_group};
use reqwest::{header, Client, Response, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::State;

const GITHUB_API: &str = "https://api.github.com";
const GITHUB_ACCOUNT: &str = "default";
const GITHUB_REFRESH_ACCOUNT: &str = "refresh";
const DEFAULT_GITHUB_APP_CLIENT_ID: &str = "Iv23liG8q6xWFMAogbEh";
const DEFAULT_GITHUB_APP_SLUG: &str = "loby-writing";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubDeviceAuthorization {
    flow_id: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
}

#[derive(Default)]
pub(crate) struct GitHubDeviceFlowState(Mutex<BTreeMap<String, PendingDeviceFlow>>);

struct PendingDeviceFlow {
    device_code: String,
    expires_in: u64,
    interval: u64,
    started_at: Instant,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubConnection {
    connected: bool,
    login: String,
    avatar_url: String,
    installation_count: usize,
    repository_count: usize,
    installation_url: String,
    manage_url: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubRepository {
    full_name: String,
    private: bool,
    default_branch: String,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Clone, Deserialize)]
struct GitHubUser {
    login: String,
    avatar_url: String,
}

#[derive(Deserialize)]
struct InstallationsResponse {
    installations: Vec<GitHubInstallation>,
}

#[derive(Clone, Deserialize)]
struct GitHubInstallation {
    id: u64,
    html_url: String,
    permissions: BTreeMap<String, String>,
}

#[derive(Deserialize)]
struct RepositoriesResponse {
    repositories: Vec<RepositoryResponse>,
}

#[derive(Deserialize)]
struct RepositoryResponse {
    full_name: String,
    private: bool,
    default_branch: String,
    archived: bool,
    disabled: bool,
    permissions: Option<RepositoryPermissions>,
}

#[derive(Deserialize)]
struct RepositoryPermissions {
    push: bool,
}

pub(super) async fn start_device_flow(
    state: State<'_, GitHubDeviceFlowState>,
) -> Result<GitHubDeviceAuthorization, String> {
    let client_id = github_client_id()?;
    let response = Client::new()
        .post("https://github.com/login/device/code")
        .header(header::ACCEPT, "application/json")
        .form(&[("client_id", client_id.as_str())])
        .send()
        .await
        .map_err(|_| "无法连接 GitHub 授权服务，请检查网络后重试。".to_string())?;
    let code: DeviceCodeResponse = response_json(response, "启动 GitHub 授权").await?;
    if code.device_code.trim().is_empty() || code.user_code.trim().is_empty() {
        return Err("GitHub 返回了无效的设备授权信息。".to_string());
    }
    let flow_id = format!("{:x}", Sha256::digest(code.device_code.as_bytes()))[..32].to_string();
    let mut pending = state
        .0
        .lock()
        .map_err(|_| "无法保存 GitHub 临时授权状态。".to_string())?;
    pending.retain(|_, flow| flow.started_at.elapsed() < Duration::from_secs(flow.expires_in));
    pending.insert(
        flow_id.clone(),
        PendingDeviceFlow {
            device_code: code.device_code,
            expires_in: code.expires_in,
            interval: code.interval.max(1),
            started_at: Instant::now(),
        },
    );
    Ok(GitHubDeviceAuthorization {
        flow_id,
        user_code: code.user_code,
        verification_uri: code.verification_uri,
        expires_in: code.expires_in,
    })
}

pub(super) async fn complete_device_flow(
    state: State<'_, GitHubDeviceFlowState>,
    flow_id: String,
) -> Result<GitHubConnection, String> {
    let client_id = github_client_id()?;
    if flow_id.trim().is_empty() || flow_id.len() > 128 {
        return Err("GitHub 设备授权信息无效。".to_string());
    }
    let flow = state
        .0
        .lock()
        .map_err(|_| "无法读取 GitHub 临时授权状态。".to_string())?
        .remove(flow_id.trim())
        .ok_or_else(|| "GitHub 授权已经结束或过期，请重新连接。".to_string())?;
    let remaining = Duration::from_secs(flow.expires_in.clamp(30, 900))
        .saturating_sub(flow.started_at.elapsed());
    let deadline = Instant::now() + remaining;
    let mut poll_interval = flow.interval.clamp(1, 30);
    while Instant::now() < deadline {
        tokio::time::sleep(Duration::from_secs(poll_interval)).await;
        let response = Client::new()
            .post("https://github.com/login/oauth/access_token")
            .header(header::ACCEPT, "application/json")
            .form(&[
                ("client_id", client_id.as_str()),
                ("device_code", flow.device_code.as_str()),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|_| "等待 GitHub 授权时网络连接中断，请重试。".to_string())?;
        let token: TokenResponse = response_json(response, "完成 GitHub 授权").await?;
        if let Some(access_token) = token.access_token.filter(|value| !value.trim().is_empty()) {
            save_tokens(&access_token, token.refresh_token.as_deref())?;
            return connection().await;
        }
        match token.error.as_deref() {
            Some("authorization_pending") | None => continue,
            Some("slow_down") => {
                poll_interval = (poll_interval + 5).min(30);
            }
            Some("access_denied") => return Err("你取消了 GitHub 授权。".to_string()),
            Some("expired_token") => return Err("GitHub 授权码已过期，请重新连接。".to_string()),
            Some("device_flow_disabled") => {
                return Err("落笔的 GitHub Device Flow 尚未启用。".to_string())
            }
            Some(_) => {
                return Err(token
                    .error_description
                    .unwrap_or_else(|| "GitHub 授权失败，请重新连接。".to_string()))
            }
        }
    }
    Err("GitHub 授权等待超时，请重新连接。".to_string())
}

pub(super) async fn connection() -> Result<GitHubConnection, String> {
    let installation_url = installation_url();
    if !has_secret("github", GITHUB_ACCOUNT)? {
        return Ok(GitHubConnection {
            connected: false,
            login: String::new(),
            avatar_url: String::new(),
            installation_count: 0,
            repository_count: 0,
            installation_url,
            manage_url: String::new(),
        });
    }
    let context = load_context().await?;
    let repositories =
        repositories_for_installations(&context.token, &context.installations).await?;
    let manage_url = if context.installations.len() == 1 {
        context.installations[0].html_url.clone()
    } else {
        "https://github.com/settings/installations".to_string()
    };
    Ok(GitHubConnection {
        connected: true,
        login: context.user.login,
        avatar_url: context.user.avatar_url,
        installation_count: context.installations.len(),
        repository_count: repositories.len(),
        installation_url,
        manage_url,
    })
}

pub(super) async fn repositories() -> Result<Vec<GitHubRepository>, String> {
    let context = load_context().await?;
    repositories_for_installations(&context.token, &context.installations).await
}

pub(super) fn disconnect() -> Result<(), String> {
    delete_secret_group("github", &[GITHUB_ACCOUNT, GITHUB_REFRESH_ACCOUNT])
}

pub(super) async fn access_token() -> Result<String, String> {
    valid_access_token().await
}

struct GitHubContext {
    token: String,
    user: GitHubUser,
    installations: Vec<GitHubInstallation>,
}

async fn load_context() -> Result<GitHubContext, String> {
    let token = valid_access_token().await?;
    let client = Client::new();
    let user = api_json::<GitHubUser>(
        github_request(client.get(format!("{GITHUB_API}/user")), &token)
            .send()
            .await
            .map_err(|_| "无法读取 GitHub 账户信息。".to_string())?,
        "读取 GitHub 账户",
    )
    .await?;
    let installations = api_json::<InstallationsResponse>(
        github_request(
            client.get(format!("{GITHUB_API}/user/installations?per_page=100")),
            &token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub App 仓库权限。".to_string())?,
        "读取 GitHub App 仓库权限",
    )
    .await?
    .installations
    .into_iter()
    .filter(|installation| {
        installation.permissions.get("contents").map(String::as_str) == Some("write")
    })
    .collect();
    Ok(GitHubContext {
        token,
        user,
        installations,
    })
}

async fn repositories_for_installations(
    token: &str,
    installations: &[GitHubInstallation],
) -> Result<Vec<GitHubRepository>, String> {
    let client = Client::new();
    let mut repositories = BTreeMap::<String, GitHubRepository>::new();
    for installation in installations {
        for page in 1..=100 {
            let response = api_json::<RepositoriesResponse>(
                github_request(
                    client.get(format!(
                        "{GITHUB_API}/user/installations/{}/repositories?per_page=100&page={page}",
                        installation.id
                    )),
                    token,
                )
                .send()
                .await
                .map_err(|_| "无法读取 GitHub 仓库列表。".to_string())?,
                "读取 GitHub 仓库列表",
            )
            .await?;
            let count = response.repositories.len();
            for repository in response.repositories {
                if repository.archived
                    || repository.disabled
                    || !repository
                        .permissions
                        .is_some_and(|permissions| permissions.push)
                {
                    continue;
                }
                repositories.insert(
                    repository.full_name.to_ascii_lowercase(),
                    GitHubRepository {
                        full_name: repository.full_name,
                        private: repository.private,
                        default_branch: repository.default_branch,
                    },
                );
            }
            if count < 100 {
                break;
            }
        }
    }
    let mut repositories = repositories.into_values().collect::<Vec<_>>();
    repositories.sort_by_key(|repository| repository.full_name.to_ascii_lowercase());
    Ok(repositories)
}

async fn valid_access_token() -> Result<String, String> {
    let token = read_secret("github", GITHUB_ACCOUNT)?;
    let response = github_request(Client::new().get(format!("{GITHUB_API}/user")), &token)
        .send()
        .await
        .map_err(|_| "无法验证 GitHub 连接，请检查网络后重试。".to_string())?;
    if response.status().is_success() {
        return Ok(token);
    }
    if response.status() != StatusCode::UNAUTHORIZED {
        return Err(api_error("验证 GitHub 连接", response).await);
    }
    refresh_access_token().await
}

async fn refresh_access_token() -> Result<String, String> {
    let refresh_token = read_secret("github", GITHUB_REFRESH_ACCOUNT)
        .map_err(|_| "GitHub 连接已失效，请重新连接。".to_string())?;
    let client_id = github_client_id()?;
    let response = Client::new()
        .post("https://github.com/login/oauth/access_token")
        .header(header::ACCEPT, "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "刷新 GitHub 连接时网络中断，请重试。".to_string())?;
    let token: TokenResponse = response_json(response, "刷新 GitHub 连接").await?;
    let access_token = token
        .access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            token
                .error_description
                .unwrap_or_else(|| "GitHub 连接已失效，请重新连接。".to_string())
        })?;
    save_tokens(&access_token, token.refresh_token.as_deref())?;
    Ok(access_token)
}

fn save_tokens(access_token: &str, refresh_token: Option<&str>) -> Result<(), String> {
    if let Some(refresh_token) = refresh_token.filter(|value| !value.trim().is_empty()) {
        save_secret_group(
            "github",
            &[
                (GITHUB_ACCOUNT, access_token),
                (GITHUB_REFRESH_ACCOUNT, refresh_token),
            ],
        )
    } else {
        delete_secret_group("github", &[GITHUB_REFRESH_ACCOUNT])?;
        save_secret_group("github", &[(GITHUB_ACCOUNT, access_token)])
    }
}

fn github_client_id() -> Result<String, String> {
    std::env::var("LOBY_GITHUB_CLIENT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            (!DEFAULT_GITHUB_APP_CLIENT_ID.is_empty())
                .then(|| DEFAULT_GITHUB_APP_CLIENT_ID.to_string())
        })
        .ok_or_else(|| "落笔尚未配置 GitHub App Client ID。".to_string())
}

fn github_app_slug() -> String {
    std::env::var("LOBY_GITHUB_APP_SLUG")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_GITHUB_APP_SLUG.to_string())
}

fn installation_url() -> String {
    format!(
        "https://github.com/apps/{}/installations/new",
        github_app_slug()
    )
}

fn github_request(builder: reqwest::RequestBuilder, token: &str) -> reqwest::RequestBuilder {
    builder
        .bearer_auth(token)
        .header(header::ACCEPT, "application/vnd.github+json")
        .header(header::USER_AGENT, "Loby")
        .header("X-GitHub-Api-Version", "2022-11-28")
}

async fn api_json<T: DeserializeOwned>(response: Response, action: &str) -> Result<T, String> {
    let status = response.status();
    let payload = response
        .text()
        .await
        .map_err(|_| format!("{action}时无法读取 GitHub 响应。"))?;
    if !status.is_success() {
        return Err(api_error_payload(action, status.as_u16(), &payload));
    }
    serde_json::from_str(&payload).map_err(|_| format!("{action}时 GitHub 返回了无效响应。"))
}

async fn response_json<T: DeserializeOwned>(response: Response, action: &str) -> Result<T, String> {
    api_json(response, action).await
}

async fn api_error(action: &str, response: Response) -> String {
    let status = response.status().as_u16();
    let payload = response.text().await.unwrap_or_default();
    api_error_payload(action, status, &payload)
}

fn api_error_payload(action: &str, status: u16, payload: &str) -> String {
    let message = serde_json::from_str::<Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("message")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| "未知错误".to_string());
    match status {
        401 => "GitHub 连接已失效，请重新连接。".to_string(),
        403 => "落笔没有足够的 GitHub 仓库权限。".to_string(),
        _ => format!("{action}失败（GitHub {status}）：{message}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installation_url_uses_the_public_app_slug() {
        assert!(installation_url().starts_with("https://github.com/apps/"));
        assert!(installation_url().ends_with("/installations/new"));
    }

    #[test]
    fn disconnected_connection_never_exposes_credentials() {
        let connection = GitHubConnection {
            connected: false,
            login: String::new(),
            avatar_url: String::new(),
            installation_count: 0,
            repository_count: 0,
            installation_url: installation_url(),
            manage_url: String::new(),
        };
        let value = serde_json::to_value(connection).unwrap();
        assert!(value.get("accessToken").is_none());
        assert!(value.get("refreshToken").is_none());
        assert_eq!(value["connected"], false);
    }

    #[test]
    fn device_authorization_never_serializes_the_provider_device_code() {
        let authorization = GitHubDeviceAuthorization {
            flow_id: "local-flow".to_string(),
            user_code: "ABCD-EFGH".to_string(),
            verification_uri: "https://github.com/login/device".to_string(),
            expires_in: 900,
        };
        let value = serde_json::to_value(authorization).unwrap();
        assert_eq!(value["flowId"], "local-flow");
        assert!(value.get("deviceCode").is_none());
        assert!(value.get("interval").is_none());
    }
}
