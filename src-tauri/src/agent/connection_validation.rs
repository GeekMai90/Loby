//! [INPUT]: 依赖 Provider 凭证、ChatGPT OAuth 访问上下文、Provider HTTP 传输政策与兼容 Endpoint 归一化
//! [OUTPUT]: 向 renderer 提供不触发生成请求的 AI 连接有效性验证命令
//! [POS]: 本地 AI agent 领域的连接诊断边界，只验证服务可达性与凭证授权，不拥有凭证生命周期或模型目录状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::{chatgpt_auth, credentials::read_provider_secret, provider_http, providers};
use reqwest::header;
use std::time::Duration;

const VALIDATION_TIMEOUT: Duration = Duration::from_secs(20);
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models";
const ANTHROPIC_MODELS_URL: &str = "https://api.anthropic.com/v1/models";
const CHATGPT_MODELS_URL: &str = "https://chatgpt.com/backend-api/codex/models";
const QWEN_MODELS_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1/models";
const MINIMAX_MODELS_URL: &str = "https://api.minimaxi.com/v1/models";
const DEEPSEEK_MODELS_URL: &str = "https://api.deepseek.com/models";
const KIMI_MODELS_URL: &str = "https://api.moonshot.cn/v1/models";

#[tauri::command]
pub(crate) async fn validate_agent_connection(
    provider: String,
    base_url: Option<String>,
) -> Result<String, String> {
    let provider = providers::normalize_provider(&provider)?;
    let client = provider_http::http_client()?;
    let (request, provider_label) = match provider.as_str() {
        "chatgpt-subscription" => {
            let access = chatgpt_auth::access().await?;
            let request = client
                .get(CHATGPT_MODELS_URL)
                .query(&[("client_version", env!("CARGO_PKG_VERSION"))])
                .bearer_auth(access.token)
                .header("ChatGPT-Account-Id", access.account_id)
                .header("originator", "loby");
            (request, "ChatGPT")
        }
        "openai-api" => {
            let secret = read_provider_secret(&provider)?;
            (client.get(OPENAI_MODELS_URL).bearer_auth(secret), "OpenAI")
        }
        "anthropic-api" => {
            let secret = read_provider_secret(&provider)?;
            let request = client
                .get(ANTHROPIC_MODELS_URL)
                .header("x-api-key", secret)
                .header("anthropic-version", "2023-06-01");
            (request, "Anthropic")
        }
        "qwen-api" => fixed_bearer_models_request(client, &provider, QWEN_MODELS_URL, "千问")?,
        "minimax-api" => {
            fixed_bearer_models_request(client, &provider, MINIMAX_MODELS_URL, "MiniMax")?
        }
        "deepseek-api" => {
            fixed_bearer_models_request(client, &provider, DEEPSEEK_MODELS_URL, "DeepSeek")?
        }
        "kimi-api" => fixed_bearer_models_request(client, &provider, KIMI_MODELS_URL, "Kimi")?,
        "openai-compatible" => {
            let base_url = base_url.unwrap_or_default();
            let endpoint = compatible_models_url(&base_url)?;
            let secret = read_provider_secret(&provider)?;
            (client.get(endpoint).bearer_auth(secret), "自定义服务商")
        }
        _ => return Err("不支持验证该 AI 连接。".to_string()),
    };

    provider_http::send_provider_request(
        request
            .timeout(VALIDATION_TIMEOUT)
            .header(header::ACCEPT, "application/json"),
        provider_label,
    )
    .await
    .map_err(|error| error.to_string())?;

    Ok(format!("{provider_label} 已接受当前凭证。"))
}

fn fixed_bearer_models_request(
    client: &reqwest::Client,
    provider: &str,
    endpoint: &str,
    label: &'static str,
) -> Result<(reqwest::RequestBuilder, &'static str), String> {
    let secret = read_provider_secret(provider)?;
    Ok((client.get(endpoint).bearer_auth(secret), label))
}

fn compatible_models_url(base_url: &str) -> Result<String, String> {
    Ok(format!(
        "{}/models",
        providers::normalize_compatible_url(base_url)?
    ))
}

#[cfg(test)]
mod tests {
    use super::compatible_models_url;

    #[test]
    fn compatible_models_url_normalizes_version_root() {
        assert_eq!(
            compatible_models_url("https://api.example.com").unwrap(),
            "https://api.example.com/v1/models"
        );
        assert_eq!(
            compatible_models_url("https://api.example.com/v1/").unwrap(),
            "https://api.example.com/v1/models"
        );
    }

    #[test]
    fn compatible_models_url_rejects_missing_endpoint() {
        assert_eq!(
            compatible_models_url("").unwrap_err(),
            "请先配置 OpenAI-compatible API Base URL。"
        );
    }
}
