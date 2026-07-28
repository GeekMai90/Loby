//! [INPUT]: 依赖 reqwest/tokio/httpdate 的 HTTP、超时与响应头能力
//! [OUTPUT]: 向 Provider adapter 提供连接复用、响应启动超时、安全请求重试、Retry-After 解析与本地化类型错误
//! [POS]: Loby Agent Provider 的传输政策层，优先识别账单等业务失败并只重试真实瞬态错误，不向界面泄露 Provider 原始账号信息
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use reqwest::{header::HeaderMap, RequestBuilder, Response, StatusCode};
use serde_json::Value;
use std::fmt;
use std::sync::OnceLock;
use std::time::{Duration, SystemTime};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const RESPONSE_START_TIMEOUT: Duration = Duration::from_secs(180);
const RESPONSE_BODY_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_REQUEST_ATTEMPTS: usize = 3;
const MAX_AUTOMATIC_RETRY_DELAY: Duration = Duration::from_secs(15);
const BASE_RETRY_DELAY_MS: u64 = 400;

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProviderFailureKind {
    Authentication,
    Billing,
    RateLimited,
    Overloaded,
    ContextWindow,
    ModelUnavailable,
    InvalidRequest,
    Network,
    Timeout,
    Protocol,
}

#[derive(Debug)]
pub(super) struct ProviderFailure {
    provider: String,
    kind: ProviderFailureKind,
    status: Option<u16>,
    _detail: String,
    retry_after: Option<Duration>,
}

impl fmt::Display for ProviderFailure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let retry_hint = self
            .retry_after
            .filter(|delay| !delay.is_zero())
            .map(|delay| format!("，建议 {} 秒后重试", delay.as_secs().max(1)))
            .unwrap_or_default();
        let summary = match self.kind {
            ProviderFailureKind::Authentication => {
                format!(
                    "{} 凭证无效或已经失效，请到 AI 设置中重新连接",
                    self.provider
                )
            }
            ProviderFailureKind::Billing => {
                format!("{} 账户余额不足，请充值或检查套餐与账单设置", self.provider)
            }
            ProviderFailureKind::RateLimited => {
                format!("{} 当前请求过多{}", self.provider, retry_hint)
            }
            ProviderFailureKind::Overloaded => {
                format!("{} 当前繁忙，请稍后重试", self.provider)
            }
            ProviderFailureKind::ContextWindow => format!(
                "发送给 {} 的内容超过模型上下文限制，请减少附件、缩短文稿上下文或新建对话",
                self.provider
            ),
            ProviderFailureKind::ModelUnavailable => {
                format!(
                    "{} 不支持当前模型，请在 AI 设置中重新选择模型",
                    self.provider
                )
            }
            ProviderFailureKind::InvalidRequest => {
                format!(
                    "{} 无法接受当前请求，请检查所选模型、Endpoint 或请求内容",
                    self.provider
                )
            }
            ProviderFailureKind::Network => {
                format!("无法连接 {}，请检查网络或 Endpoint 设置", self.provider)
            }
            ProviderFailureKind::Timeout => format!(
                "{} 在 {} 秒内没有继续响应；原请求可能仍由服务端处理，请确认后再重试",
                self.provider,
                RESPONSE_START_TIMEOUT.as_secs()
            ),
            ProviderFailureKind::Protocol => {
                format!(
                    "{} 返回了无法处理的响应，请验证连接或稍后重试",
                    self.provider
                )
            }
        };
        let status = self
            .status
            .map(|status| format!("（HTTP {status}）"))
            .unwrap_or_default();
        write!(formatter, "{summary}{status}。")
    }
}

pub(super) fn http_client() -> Result<&'static reqwest::Client, String> {
    if let Some(client) = HTTP_CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .tcp_keepalive(Duration::from_secs(30))
        .pool_idle_timeout(Duration::from_secs(90))
        .user_agent("Loby/0.1")
        .build()
        .map_err(|error| error.to_string())?;
    let _ = HTTP_CLIENT.set(client);
    HTTP_CLIENT
        .get()
        .ok_or_else(|| "无法初始化 Provider 网络客户端。".to_string())
}

pub(super) async fn send_provider_request(
    request: RequestBuilder,
    provider: &str,
) -> Result<Response, ProviderFailure> {
    let template = request.try_clone().ok_or_else(|| ProviderFailure {
        provider: provider.to_string(),
        kind: ProviderFailureKind::Protocol,
        status: None,
        _detail: "请求内容无法安全重试。".to_string(),
        retry_after: None,
    })?;

    for attempt in 0..MAX_REQUEST_ATTEMPTS {
        let next = template.try_clone().ok_or_else(|| ProviderFailure {
            provider: provider.to_string(),
            kind: ProviderFailureKind::Protocol,
            status: None,
            _detail: "请求内容无法安全重试。".to_string(),
            retry_after: None,
        })?;
        let response = tokio::time::timeout(RESPONSE_START_TIMEOUT, next.send()).await;
        match response {
            Err(_) => {
                return Err(ProviderFailure {
                    provider: provider.to_string(),
                    kind: ProviderFailureKind::Timeout,
                    status: None,
                    _detail: String::new(),
                    retry_after: None,
                });
            }
            Ok(Err(error)) if error.is_connect() && attempt + 1 < MAX_REQUEST_ATTEMPTS => {
                tokio::time::sleep(exponential_delay(attempt)).await;
            }
            Ok(Err(error)) => {
                return Err(ProviderFailure {
                    provider: provider.to_string(),
                    kind: ProviderFailureKind::Network,
                    status: error.status().map(|status| status.as_u16()),
                    _detail: bounded_detail(&error.to_string()),
                    retry_after: None,
                });
            }
            Ok(Ok(response)) if response.status().is_success() => return Ok(response),
            Ok(Ok(response)) => {
                let retry_after = retry_after_delay(response.headers(), SystemTime::now());
                let status = response.status();
                let failure = response_failure(provider, response, retry_after).await;
                if attempt + 1 < MAX_REQUEST_ATTEMPTS
                    && is_automatically_retryable_failure(failure.kind)
                {
                    if let Some(delay) = automatic_retry_delay(status, retry_after, attempt) {
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                }
                return Err(failure);
            }
        }
    }
    unreachable!("bounded Provider retry loop always returns")
}

pub(super) async fn read_json_response(
    response: Response,
    provider: &str,
) -> Result<Value, ProviderFailure> {
    match tokio::time::timeout(RESPONSE_BODY_TIMEOUT, response.json::<Value>()).await {
        Err(_) => Err(ProviderFailure {
            provider: provider.to_string(),
            kind: ProviderFailureKind::Timeout,
            status: None,
            _detail: "响应正文读取超时。".to_string(),
            retry_after: None,
        }),
        Ok(Err(error)) => Err(ProviderFailure {
            provider: provider.to_string(),
            kind: ProviderFailureKind::Protocol,
            status: error.status().map(|status| status.as_u16()),
            _detail: bounded_detail(&error.to_string()),
            retry_after: None,
        }),
        Ok(Ok(value)) => Ok(value),
    }
}

async fn response_failure(
    provider: &str,
    response: Response,
    retry_after: Option<Duration>,
) -> ProviderFailure {
    let status = response.status();
    let payload = tokio::time::timeout(RESPONSE_BODY_TIMEOUT, response.text())
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default();
    let value = serde_json::from_str::<Value>(&payload).unwrap_or(Value::Null);
    let detail = provider_error_detail(&value, &payload);
    ProviderFailure {
        provider: provider.to_string(),
        kind: classify_failure(status, &value),
        status: Some(status.as_u16()),
        _detail: detail,
        retry_after,
    }
}

fn classify_failure(status: StatusCode, value: &Value) -> ProviderFailureKind {
    let code = provider_error_code(value).to_ascii_lowercase();
    let message = provider_error_message(value).to_ascii_lowercase();
    if status == StatusCode::PAYMENT_REQUIRED || indicates_billing_failure(&code, &message) {
        ProviderFailureKind::Billing
    } else if matches!(status, StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN) {
        ProviderFailureKind::Authentication
    } else if status == StatusCode::REQUEST_TIMEOUT {
        ProviderFailureKind::Timeout
    } else if status == StatusCode::TOO_MANY_REQUESTS
        || code.contains("rate_limit")
        || code.contains("too_many_requests")
    {
        ProviderFailureKind::RateLimited
    } else if code.contains("context_length")
        || code.contains("max_tokens")
        || message.contains("context window")
        || message.contains("too many tokens")
    {
        ProviderFailureKind::ContextWindow
    } else if status == StatusCode::NOT_FOUND
        || code.contains("model_not_found")
        || message.contains("model") && message.contains("not found")
    {
        ProviderFailureKind::ModelUnavailable
    } else if status.is_server_error()
        || code.contains("overloaded")
        || code.contains("unavailable")
    {
        ProviderFailureKind::Overloaded
    } else if status.is_client_error() {
        ProviderFailureKind::InvalidRequest
    } else {
        ProviderFailureKind::Protocol
    }
}

fn indicates_billing_failure(code: &str, message: &str) -> bool {
    const BILLING_MARKERS: [&str; 8] = [
        "insufficient_balance",
        "insufficient balance",
        "insufficient_quota",
        "quota exceeded",
        "payment_required",
        "billing",
        "recharge",
        "credit balance",
    ];
    BILLING_MARKERS
        .iter()
        .any(|marker| code.contains(marker) || message.contains(marker))
}

fn provider_error_code(value: &Value) -> &str {
    value["error"]["code"]
        .as_str()
        .or_else(|| value["error"]["type"].as_str())
        .or_else(|| value["code"].as_str())
        .unwrap_or_default()
}

fn provider_error_message(value: &Value) -> &str {
    value["error"]["message"]
        .as_str()
        .or_else(|| value["message"].as_str())
        .unwrap_or_default()
}

fn provider_error_detail(value: &Value, payload: &str) -> String {
    let detail = provider_error_message(value);
    if detail.is_empty() {
        bounded_detail(payload)
    } else {
        bounded_detail(detail)
    }
}

fn bounded_detail(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(300)
        .collect()
}

fn automatic_retry_delay(
    status: StatusCode,
    retry_after: Option<Duration>,
    attempt: usize,
) -> Option<Duration> {
    if !is_retryable_status(status) {
        return None;
    }
    if let Some(delay) = retry_after {
        return (delay <= MAX_AUTOMATIC_RETRY_DELAY).then_some(delay);
    }
    Some(exponential_delay(attempt))
}

fn is_automatically_retryable_failure(kind: ProviderFailureKind) -> bool {
    matches!(
        kind,
        ProviderFailureKind::RateLimited
            | ProviderFailureKind::Overloaded
            | ProviderFailureKind::Timeout
    )
}

fn is_retryable_status(status: StatusCode) -> bool {
    matches!(
        status,
        StatusCode::REQUEST_TIMEOUT
            | StatusCode::TOO_MANY_REQUESTS
            | StatusCode::INTERNAL_SERVER_ERROR
            | StatusCode::BAD_GATEWAY
            | StatusCode::SERVICE_UNAVAILABLE
            | StatusCode::GATEWAY_TIMEOUT
    )
}

fn exponential_delay(attempt: usize) -> Duration {
    Duration::from_millis(BASE_RETRY_DELAY_MS.saturating_mul(1_u64 << attempt.min(5)))
}

fn retry_after_delay(headers: &HeaderMap, now: SystemTime) -> Option<Duration> {
    let value = headers
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim();
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }
    let retry_at = httpdate::parse_http_date(value).ok()?;
    Some(retry_at.duration_since(now).unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;
    use serde_json::json;

    #[test]
    fn retries_only_transient_statuses_with_a_small_bounded_delay() {
        assert!(automatic_retry_delay(StatusCode::TOO_MANY_REQUESTS, None, 0).is_some());
        assert!(automatic_retry_delay(StatusCode::BAD_GATEWAY, None, 1).is_some());
        assert!(automatic_retry_delay(StatusCode::UNAUTHORIZED, None, 0).is_none());
        assert!(automatic_retry_delay(
            StatusCode::TOO_MANY_REQUESTS,
            Some(Duration::from_secs(60)),
            0
        )
        .is_none());
    }

    #[test]
    fn parses_retry_after_seconds_without_trusting_unbounded_values() {
        let mut headers = HeaderMap::new();
        headers.insert(reqwest::header::RETRY_AFTER, HeaderValue::from_static("3"));
        assert_eq!(
            retry_after_delay(&headers, SystemTime::UNIX_EPOCH),
            Some(Duration::from_secs(3))
        );
    }

    #[test]
    fn classifies_errors_into_actionable_writing_assistant_failures() {
        assert_eq!(
            classify_failure(
                StatusCode::BAD_REQUEST,
                &json!({ "error": { "code": "context_length_exceeded" } })
            ),
            ProviderFailureKind::ContextWindow
        );
        assert_eq!(
            classify_failure(StatusCode::TOO_MANY_REQUESTS, &Value::Null),
            ProviderFailureKind::RateLimited
        );
        assert_eq!(
            classify_failure(StatusCode::UNAUTHORIZED, &Value::Null),
            ProviderFailureKind::Authentication
        );
        assert_eq!(
            classify_failure(
                StatusCode::TOO_MANY_REQUESTS,
                &json!({
                    "error": {
                        "message": "Your account org-example <ak-example> is suspended due to insufficient balance, please recharge your account"
                    }
                })
            ),
            ProviderFailureKind::Billing
        );
        assert_eq!(
            classify_failure(StatusCode::PAYMENT_REQUIRED, &Value::Null),
            ProviderFailureKind::Billing
        );
    }

    #[test]
    fn error_display_localizes_known_failures_without_exposing_provider_account_details() {
        let failure = ProviderFailure {
            provider: "Kimi".to_string(),
            kind: ProviderFailureKind::Billing,
            status: Some(429),
            _detail:
                "Your account org-example <ak-example> is suspended due to insufficient balance"
                    .to_string(),
            retry_after: None,
        };
        let message = failure.to_string();
        assert_eq!(
            message,
            "Kimi 账户余额不足，请充值或检查套餐与账单设置（HTTP 429）。"
        );
        assert!(!message.contains("org-example"));
        assert!(!message.contains("ak-example"));
        assert!(!message.contains("insufficient balance"));
        assert!(!is_automatically_retryable_failure(failure.kind));

        let deepseek_failure = ProviderFailure {
            provider: "DeepSeek".to_string(),
            kind: classify_failure(StatusCode::PAYMENT_REQUIRED, &Value::Null),
            status: Some(402),
            _detail: "Insufficient Balance".to_string(),
            retry_after: None,
        };
        assert_eq!(
            deepseek_failure.to_string(),
            "DeepSeek 账户余额不足，请充值或检查套餐与账单设置（HTTP 402）。"
        );
    }
}
