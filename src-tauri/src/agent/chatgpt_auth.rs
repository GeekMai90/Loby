//! [INPUT]: 依赖 OpenAI ChatGPT Device OAuth、落笔应用内 credential store、reqwest 与 tokio 并发原语
//! [OUTPUT]: 向 renderer 提供不泄露 token 的连接流程，向 ChatGPT subscription 对话与图片 Provider 提供自动刷新的访问上下文和计划类型
//! [POS]: 本地 AI agent 领域的 ChatGPT 账号身份适配器，只拥有 OAuth 生命周期，不拥有 Agent Loop 或模型请求
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::credentials::{delete_secret, has_secret, read_provider_secret, save_secret};
use base64::{
    engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD},
    Engine as _,
};
use reqwest::{header, Client, Response, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

const CREDENTIAL_OWNER: &str = "chatgpt-subscription";
// OpenAI Codex 使用的 public installed-app client id；若未来获得 Loby 专属 client id，可通过环境变量替换。
const DEFAULT_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE_URL: &str = "https://auth.openai.com";
const DEVICE_VERIFICATION_URL: &str = "https://auth.openai.com/codex/device";
const DEVICE_REDIRECT_URI: &str = "https://auth.openai.com/deviceauth/callback";
const AUTH_CLAIMS_NAMESPACE: &str = "https://api.openai.com/auth";
const DEFAULT_FLOW_EXPIRES_IN: u64 = 600;
const REFRESH_SKEW_SECONDS: u64 = 300;

static REFRESH_LOCK: OnceLock<AsyncMutex<()>> = OnceLock::new();

#[derive(Default)]
pub(crate) struct ChatGptDeviceFlowState(Mutex<BTreeMap<String, PendingDeviceFlow>>);

struct PendingDeviceFlow {
    device_auth_id: String,
    user_code: String,
    interval: u64,
    started_at: Instant,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptDeviceAuthorization {
    flow_id: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptConnection {
    connected: bool,
    email: String,
    plan_type: String,
}

#[derive(Debug, Clone)]
pub(super) struct ChatGptAccess {
    pub(super) token: String,
    pub(super) account_id: String,
    pub(super) plan_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredTokenBundle {
    access_token: String,
    refresh_token: String,
    #[serde(default)]
    id_token: String,
    expires_at: u64,
    account_id: String,
    #[serde(default)]
    plan_type: String,
    #[serde(default)]
    email: String,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_auth_id: String,
    user_code: String,
    interval: Value,
}

#[derive(Deserialize)]
struct DeviceTokenResponse {
    authorization_code: String,
    code_verifier: String,
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: Option<u64>,
}

#[tauri::command]
pub(crate) async fn start_chatgpt_device_flow(
    state: State<'_, ChatGptDeviceFlowState>,
) -> Result<ChatGptDeviceAuthorization, String> {
    let response = Client::new()
        .post(format!("{AUTH_BASE_URL}/api/accounts/deviceauth/usercode"))
        .header(header::USER_AGENT, user_agent())
        .json(&serde_json::json!({ "client_id": client_id() }))
        .send()
        .await
        .map_err(|_| "无法连接 ChatGPT 授权服务，请检查网络后重试。".to_string())?;
    let code: DeviceCodeResponse = response_json(response, "启动 ChatGPT 登录").await?;
    if code.device_auth_id.trim().is_empty() || code.user_code.trim().is_empty() {
        return Err("ChatGPT 返回了无效的设备授权信息。".to_string());
    }
    let flow_id = Uuid::new_v4().to_string();
    let interval = parse_interval(&code.interval).clamp(1, 30);
    let mut pending = state
        .0
        .lock()
        .map_err(|_| "无法保存 ChatGPT 临时授权状态。".to_string())?;
    pending
        .retain(|_, flow| flow.started_at.elapsed() < Duration::from_secs(DEFAULT_FLOW_EXPIRES_IN));
    pending.insert(
        flow_id.clone(),
        PendingDeviceFlow {
            device_auth_id: code.device_auth_id,
            user_code: code.user_code.clone(),
            interval,
            started_at: Instant::now(),
        },
    );
    Ok(ChatGptDeviceAuthorization {
        flow_id,
        user_code: code.user_code,
        verification_uri: DEVICE_VERIFICATION_URL.to_string(),
        expires_in: DEFAULT_FLOW_EXPIRES_IN,
    })
}

#[tauri::command]
pub(crate) async fn complete_chatgpt_device_flow(
    state: State<'_, ChatGptDeviceFlowState>,
    flow_id: String,
) -> Result<ChatGptConnection, String> {
    if flow_id.trim().is_empty() || flow_id.len() > 128 {
        return Err("ChatGPT 设备授权信息无效。".to_string());
    }
    let flow = state
        .0
        .lock()
        .map_err(|_| "无法读取 ChatGPT 临时授权状态。".to_string())?
        .remove(flow_id.trim())
        .ok_or_else(|| "ChatGPT 登录已经结束或过期，请重新连接。".to_string())?;
    let remaining =
        Duration::from_secs(DEFAULT_FLOW_EXPIRES_IN).saturating_sub(flow.started_at.elapsed());
    let deadline = Instant::now() + remaining;
    while Instant::now() < deadline {
        tokio::time::sleep(Duration::from_secs(flow.interval + 3)).await;
        let response = Client::new()
            .post(format!("{AUTH_BASE_URL}/api/accounts/deviceauth/token"))
            .header(header::USER_AGENT, user_agent())
            .json(&serde_json::json!({
                "device_auth_id": flow.device_auth_id,
                "user_code": flow.user_code
            }))
            .send()
            .await
            .map_err(|_| "等待 ChatGPT 授权时网络连接中断，请重试。".to_string())?;
        if matches!(
            response.status(),
            StatusCode::FORBIDDEN | StatusCode::NOT_FOUND
        ) {
            continue;
        }
        let device_token: DeviceTokenResponse =
            response_json(response, "完成 ChatGPT 设备授权").await?;
        let bundle = exchange_authorization_code(
            &device_token.authorization_code,
            &device_token.code_verifier,
        )
        .await?;
        save_bundle(&bundle)?;
        return Ok(connection_from_bundle(&bundle));
    }
    Err("ChatGPT 登录等待超时，请重新连接。".to_string())
}

#[tauri::command]
pub(crate) fn get_chatgpt_connection() -> Result<ChatGptConnection, String> {
    if has_secret(CREDENTIAL_OWNER)? {
        Ok(connection_from_bundle(&read_bundle()?))
    } else {
        Ok(disconnected())
    }
}

#[tauri::command]
pub(crate) fn disconnect_chatgpt() -> Result<(), String> {
    delete_secret(CREDENTIAL_OWNER)
}

pub(super) async fn access() -> Result<ChatGptAccess, String> {
    let bundle = read_bundle().map_err(|_| "ChatGPT 登录已失效，请重新连接。".to_string())?;
    if token_is_fresh(&bundle) {
        return access_from_bundle(bundle);
    }
    let _guard = refresh_lock().lock().await;
    let bundle = read_bundle().map_err(|_| "ChatGPT 登录已失效，请重新连接。".to_string())?;
    let bundle = if token_is_fresh(&bundle) {
        bundle
    } else {
        refresh_bundle(&bundle).await?
    };
    access_from_bundle(bundle)
}

async fn exchange_authorization_code(
    authorization_code: &str,
    code_verifier: &str,
) -> Result<StoredTokenBundle, String> {
    let response = Client::new()
        .post(format!("{AUTH_BASE_URL}/oauth/token"))
        .header(header::USER_AGENT, user_agent())
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", authorization_code),
            ("redirect_uri", DEVICE_REDIRECT_URI),
            ("client_id", client_id().as_str()),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|_| "交换 ChatGPT 登录凭证时网络连接中断。".to_string())?;
    let token: OAuthTokenResponse = response_json(response, "交换 ChatGPT 登录凭证").await?;
    bundle_from_response(token, None)
}

async fn refresh_bundle(previous: &StoredTokenBundle) -> Result<StoredTokenBundle, String> {
    let response = Client::new()
        .post(format!("{AUTH_BASE_URL}/oauth/token"))
        .header(header::USER_AGENT, user_agent())
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", previous.refresh_token.as_str()),
            ("client_id", client_id().as_str()),
        ])
        .send()
        .await
        .map_err(|_| "刷新 ChatGPT 登录时网络连接中断。".to_string())?;
    let token: OAuthTokenResponse = response_json(response, "刷新 ChatGPT 登录").await?;
    let next = bundle_from_response(token, Some(previous))?;
    save_bundle(&next)?;
    Ok(next)
}

fn bundle_from_response(
    response: OAuthTokenResponse,
    previous: Option<&StoredTokenBundle>,
) -> Result<StoredTokenBundle, String> {
    let access_token = response
        .access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "ChatGPT 授权响应缺少访问凭证。".to_string())?;
    let refresh_token = response
        .refresh_token
        .filter(|value| !value.trim().is_empty())
        .or_else(|| previous.map(|bundle| bundle.refresh_token.clone()))
        .ok_or_else(|| "ChatGPT 授权响应缺少刷新凭证。".to_string())?;
    let id_token = response
        .id_token
        .filter(|value| !value.trim().is_empty())
        .or_else(|| previous.map(|bundle| bundle.id_token.clone()))
        .unwrap_or_default();
    let claims = jwt_claims(&id_token)
        .or_else(|| jwt_claims(&access_token))
        .unwrap_or(Value::Null);
    let auth_claims = claims.get(AUTH_CLAIMS_NAMESPACE).and_then(Value::as_object);
    let account_id = auth_claims
        .and_then(|claims| claims.get("chatgpt_account_id"))
        .and_then(Value::as_str)
        .or_else(|| claims.get("chatgpt_account_id").and_then(Value::as_str))
        .map(str::to_string)
        .or_else(|| previous.map(|bundle| bundle.account_id.clone()))
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "ChatGPT 授权响应缺少账号标识。".to_string())?;
    let plan_type = auth_claims
        .and_then(|claims| claims.get("chatgpt_plan_type"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| previous.map(|bundle| bundle.plan_type.clone()))
        .unwrap_or_default();
    let email = claims
        .get("email")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| previous.map(|bundle| bundle.email.clone()))
        .unwrap_or_default();
    Ok(StoredTokenBundle {
        access_token,
        refresh_token,
        id_token,
        expires_at: now_epoch_seconds() + response.expires_in.unwrap_or(3600),
        account_id,
        plan_type,
        email,
    })
}

fn access_from_bundle(bundle: StoredTokenBundle) -> Result<ChatGptAccess, String> {
    if bundle.access_token.trim().is_empty() || bundle.account_id.trim().is_empty() {
        return Err("ChatGPT 登录已失效，请重新连接。".to_string());
    }
    Ok(ChatGptAccess {
        token: bundle.access_token,
        account_id: bundle.account_id,
        plan_type: bundle.plan_type,
    })
}

fn token_is_fresh(bundle: &StoredTokenBundle) -> bool {
    bundle.expires_at > now_epoch_seconds() + REFRESH_SKEW_SECONDS
}

fn save_bundle(bundle: &StoredTokenBundle) -> Result<(), String> {
    let serialized =
        serde_json::to_string(bundle).map_err(|_| "无法序列化 ChatGPT 登录凭证。".to_string())?;
    save_secret(CREDENTIAL_OWNER, &serialized)
}

fn read_bundle() -> Result<StoredTokenBundle, String> {
    let serialized = read_provider_secret(CREDENTIAL_OWNER)?;
    serde_json::from_str(&serialized).map_err(|_| "ChatGPT 登录凭证已损坏。".to_string())
}

fn connection_from_bundle(bundle: &StoredTokenBundle) -> ChatGptConnection {
    ChatGptConnection {
        connected: true,
        email: bundle.email.clone(),
        plan_type: bundle.plan_type.clone(),
    }
}

fn disconnected() -> ChatGptConnection {
    ChatGptConnection {
        connected: false,
        email: String::new(),
        plan_type: String::new(),
    }
}

fn jwt_claims(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let decoded = URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| URL_SAFE.decode(payload))
        .ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn parse_interval(value: &Value) -> u64 {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|value| value.parse().ok()))
        .unwrap_or(5)
}

fn now_epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn refresh_lock() -> &'static AsyncMutex<()> {
    REFRESH_LOCK.get_or_init(|| AsyncMutex::new(()))
}

fn client_id() -> String {
    std::env::var("LOBY_CHATGPT_CLIENT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string())
}

fn user_agent() -> String {
    format!("Loby/{}", env!("CARGO_PKG_VERSION"))
}

async fn response_json<T: DeserializeOwned>(response: Response, action: &str) -> Result<T, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(match status {
            StatusCode::UNAUTHORIZED => "ChatGPT 登录已失效，请重新连接。".to_string(),
            StatusCode::FORBIDDEN => "当前 ChatGPT 账号没有可用的 Codex 订阅权限。".to_string(),
            _ => format!("{action}失败（ChatGPT {}）。", status.as_u16()),
        });
    }
    response
        .json::<T>()
        .await
        .map_err(|_| format!("{action}时 ChatGPT 返回了无效响应。"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_authorization_never_exposes_device_secret() {
        let value = serde_json::to_value(ChatGptDeviceAuthorization {
            flow_id: "local-flow".to_string(),
            user_code: "ABCD-EFGH".to_string(),
            verification_uri: DEVICE_VERIFICATION_URL.to_string(),
            expires_in: 600,
        })
        .unwrap();
        assert_eq!(value["flowId"], "local-flow");
        assert!(value.get("deviceAuthId").is_none());
        assert!(value.get("accessToken").is_none());
    }

    #[test]
    fn jwt_claims_extract_only_local_display_metadata() {
        let payload = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&serde_json::json!({
                "email": "writer@example.com",
                AUTH_CLAIMS_NAMESPACE: {
                    "chatgpt_account_id": "account-1",
                    "chatgpt_plan_type": "plus"
                }
            }))
            .unwrap(),
        );
        let claims = jwt_claims(&format!("header.{payload}.signature")).unwrap();
        assert_eq!(claims["email"], "writer@example.com");
        assert_eq!(claims[AUTH_CLAIMS_NAMESPACE]["chatgpt_plan_type"], "plus");
    }

    #[test]
    fn connection_never_serializes_tokens_or_account_id() {
        let connection = ChatGptConnection {
            connected: true,
            email: "writer@example.com".to_string(),
            plan_type: "plus".to_string(),
        };
        let value = serde_json::to_value(connection).unwrap();
        assert!(value.get("accessToken").is_none());
        assert!(value.get("refreshToken").is_none());
        assert!(value.get("accountId").is_none());
    }

    #[test]
    fn access_token_claims_are_a_fallback_when_id_token_is_absent() {
        let payload = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&serde_json::json!({
                AUTH_CLAIMS_NAMESPACE: { "chatgpt_account_id": "account-from-access" }
            }))
            .unwrap(),
        );
        let bundle = bundle_from_response(
            OAuthTokenResponse {
                access_token: Some(format!("header.{payload}.signature")),
                refresh_token: Some("refresh".to_string()),
                id_token: None,
                expires_in: Some(3600),
            },
            None,
        )
        .unwrap();
        assert_eq!(bundle.account_id, "account-from-access");
    }
}
