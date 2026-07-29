//! [INPUT]: 依赖 GitHub App Device Flow、用户安装/仓库 API、secret store 与 tokio 轮询/并发原语
//! [OUTPUT]: 向发布 facade 提供本地即时连接状态、显式远程刷新、GitHub 浏览器连接、断开连接及带短期缓存的可发布仓库快照
//! [POS]: 发布领域的 GitHub 身份适配器，使用已保存凭证即时恢复设置目录，只有显式刷新、仓库设置和真实发布才访问远端
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::secret_store::{delete_secret_group, has_secret, read_secret, save_secret_group};
use reqwest::{header, Client, Response, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;

const GITHUB_API: &str = "https://api.github.com";
const GITHUB_ACCOUNT: &str = "default";
const GITHUB_REFRESH_ACCOUNT: &str = "refresh";
const GITHUB_SNAPSHOT_TTL: Duration = Duration::from_secs(60);
const DEFAULT_GITHUB_APP_CLIENT_ID: &str = "Iv23liG8q6xWFMAogbEh";
const DEFAULT_GITHUB_APP_SLUG: &str = "loby-writing";

static GITHUB_SNAPSHOT_CACHE: OnceLock<Mutex<Option<CachedGitHubSnapshot>>> = OnceLock::new();
static GITHUB_SNAPSHOT_REFRESH: OnceLock<AsyncMutex<()>> = OnceLock::new();

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

#[derive(Clone)]
struct GitHubSnapshot {
    user: GitHubUser,
    installations: Vec<GitHubInstallation>,
    repositories: Vec<GitHubRepository>,
}

struct CachedGitHubSnapshot {
    value: GitHubSnapshot,
    cached_at: Instant,
}

struct ValidatedGitHubAccess {
    token: String,
    user: GitHubUser,
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
            return refresh_connection().await;
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

pub(super) fn connection() -> Result<GitHubConnection, String> {
    let has_saved_access = has_secret("github", GITHUB_ACCOUNT)?;
    if !has_saved_access {
        invalidate_snapshot_cache();
        return Ok(connection_from_local_state(false, None));
    }

    Ok(connection_from_local_state(true, read_cached_snapshot()?))
}

pub(super) async fn refresh_connection() -> Result<GitHubConnection, String> {
    if !has_secret("github", GITHUB_ACCOUNT)? {
        invalidate_snapshot_cache();
        return Ok(connection_from_local_state(false, None));
    }

    let snapshot = refresh_github_snapshot().await?;
    Ok(connection_from_snapshot(snapshot))
}

fn connection_from_local_state(
    has_saved_access: bool,
    snapshot: Option<GitHubSnapshot>,
) -> GitHubConnection {
    if !has_saved_access {
        return GitHubConnection {
            connected: false,
            login: String::new(),
            avatar_url: String::new(),
            installation_count: 0,
            repository_count: 0,
            installation_url: installation_url(),
            manage_url: String::new(),
        };
    }

    snapshot
        .map(connection_from_snapshot)
        .unwrap_or_else(|| GitHubConnection {
            connected: true,
            login: String::new(),
            avatar_url: String::new(),
            installation_count: 0,
            repository_count: 0,
            installation_url: installation_url(),
            manage_url: "https://github.com/settings/installations".to_string(),
        })
}

fn connection_from_snapshot(snapshot: GitHubSnapshot) -> GitHubConnection {
    let manage_url = if snapshot.installations.len() == 1 {
        snapshot.installations[0].html_url.clone()
    } else {
        "https://github.com/settings/installations".to_string()
    };
    GitHubConnection {
        connected: true,
        login: snapshot.user.login,
        avatar_url: snapshot.user.avatar_url,
        installation_count: snapshot.installations.len(),
        repository_count: snapshot.repositories.len(),
        installation_url: installation_url(),
        manage_url,
    }
}

pub(super) async fn repositories() -> Result<Vec<GitHubRepository>, String> {
    Ok(github_snapshot().await?.repositories)
}

pub(super) fn disconnect() -> Result<(), String> {
    delete_secret_group("github", &[GITHUB_ACCOUNT, GITHUB_REFRESH_ACCOUNT])?;
    invalidate_snapshot_cache();
    Ok(())
}

pub(super) async fn access_token() -> Result<String, String> {
    Ok(validated_access().await?.token)
}

struct GitHubContext {
    token: String,
    user: GitHubUser,
    installations: Vec<GitHubInstallation>,
}

async fn load_context() -> Result<GitHubContext, String> {
    let access = validated_access().await?;
    let client = Client::new();
    let installations = api_json::<InstallationsResponse>(
        github_request(
            client.get(format!("{GITHUB_API}/user/installations?per_page=100")),
            &access.token,
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
        token: access.token,
        user: access.user,
        installations,
    })
}

async fn github_snapshot() -> Result<GitHubSnapshot, String> {
    if let Some(snapshot) = read_fresh_snapshot()? {
        return Ok(snapshot);
    }
    let _refresh = snapshot_refresh_lock().lock().await;
    if let Some(snapshot) = read_fresh_snapshot()? {
        return Ok(snapshot);
    }
    load_and_cache_github_snapshot().await
}

async fn refresh_github_snapshot() -> Result<GitHubSnapshot, String> {
    let _refresh = snapshot_refresh_lock().lock().await;
    load_and_cache_github_snapshot().await
}

async fn load_and_cache_github_snapshot() -> Result<GitHubSnapshot, String> {
    let context = load_context().await?;
    let repositories =
        repositories_for_installations(&context.token, &context.installations).await?;
    let snapshot = GitHubSnapshot {
        user: context.user,
        installations: context.installations,
        repositories,
    };
    let mut cache = snapshot_cache()
        .lock()
        .map_err(|_| "无法保存 GitHub 仓库缓存。".to_string())?;
    *cache = Some(CachedGitHubSnapshot {
        value: snapshot.clone(),
        cached_at: Instant::now(),
    });
    Ok(snapshot)
}

fn read_cached_snapshot() -> Result<Option<GitHubSnapshot>, String> {
    let cache = snapshot_cache()
        .lock()
        .map_err(|_| "无法读取 GitHub 仓库缓存。".to_string())?;
    Ok(cache.as_ref().map(|snapshot| snapshot.value.clone()))
}

fn read_fresh_snapshot() -> Result<Option<GitHubSnapshot>, String> {
    let cache = snapshot_cache()
        .lock()
        .map_err(|_| "无法读取 GitHub 仓库缓存。".to_string())?;
    Ok(cache
        .as_ref()
        .filter(|snapshot| snapshot_is_fresh(snapshot.cached_at))
        .map(|snapshot| snapshot.value.clone()))
}

fn snapshot_is_fresh(cached_at: Instant) -> bool {
    cached_at.elapsed() < GITHUB_SNAPSHOT_TTL
}

fn invalidate_snapshot_cache() {
    let Ok(mut cache) = snapshot_cache().lock() else {
        return;
    };
    *cache = None;
}

fn snapshot_cache() -> &'static Mutex<Option<CachedGitHubSnapshot>> {
    GITHUB_SNAPSHOT_CACHE.get_or_init(|| Mutex::new(None))
}

fn snapshot_refresh_lock() -> &'static AsyncMutex<()> {
    GITHUB_SNAPSHOT_REFRESH.get_or_init(|| AsyncMutex::new(()))
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

async fn validated_access() -> Result<ValidatedGitHubAccess, String> {
    let token = read_secret("github", GITHUB_ACCOUNT)?;
    if let Some(user) = user_for_token(&token).await? {
        return Ok(ValidatedGitHubAccess { token, user });
    }
    let token = refresh_access_token().await?;
    let user = user_for_token(&token)
        .await?
        .ok_or_else(|| "GitHub 连接已失效，请重新连接。".to_string())?;
    Ok(ValidatedGitHubAccess { token, user })
}

async fn user_for_token(token: &str) -> Result<Option<GitHubUser>, String> {
    let response = github_request(Client::new().get(format!("{GITHUB_API}/user")), token)
        .send()
        .await
        .map_err(|_| "无法验证 GitHub 连接，请检查网络后重试。".to_string())?;
    if response.status() == StatusCode::UNAUTHORIZED {
        return Ok(None);
    }
    api_json::<GitHubUser>(response, "验证 GitHub 连接")
        .await
        .map(Some)
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
    let result = if let Some(refresh_token) = refresh_token.filter(|value| !value.trim().is_empty())
    {
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
    };
    if result.is_ok() {
        invalidate_snapshot_cache();
    }
    result
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
        let connection = connection_from_local_state(false, None);
        let value = serde_json::to_value(connection).unwrap();
        assert!(value.get("accessToken").is_none());
        assert!(value.get("refreshToken").is_none());
        assert_eq!(value["connected"], false);
    }

    #[test]
    fn saved_connection_is_available_without_remote_snapshot() {
        let connection = connection_from_local_state(true, None);

        assert!(connection.connected);
        assert!(connection.login.is_empty());
        assert_eq!(connection.installation_count, 0);
        assert_eq!(connection.repository_count, 0);
        assert_eq!(
            connection.manage_url,
            "https://github.com/settings/installations"
        );
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

    #[test]
    fn repository_snapshot_expires_after_the_short_ttl() {
        assert!(snapshot_is_fresh(Instant::now()));
        assert!(!snapshot_is_fresh(
            Instant::now() - GITHUB_SNAPSHOT_TTL - Duration::from_secs(1)
        ));
    }
}
