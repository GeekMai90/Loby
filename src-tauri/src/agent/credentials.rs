//! [INPUT]: 依赖 keyring 系统安全存储与受限的开发环境变量
//! [OUTPUT]: 向 Agent Provider/MCP 提供凭证保存、读取、状态查询和删除命令，绝不返回秘密到 renderer
//! [POS]: 本地 AI agent 领域的原生凭证边界，把账号状态与真实 token/API key 严格分离
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::AgentCredentialStatus;

const KEYRING_SERVICE: &str = "com.geekmai.loby.agent";
const MAX_SECRET_BYTES: usize = 32 * 1024;

#[tauri::command]
pub(crate) fn save_agent_credential(provider: String, secret: String) -> Result<(), String> {
    let provider = normalize_credential_owner(&provider)?;
    validate_secret(&secret)?;
    entry(&provider)?
        .set_password(secret.trim())
        .map_err(|error| credential_error("保存", error))
}

#[tauri::command]
pub(crate) fn delete_agent_credential(provider: String) -> Result<(), String> {
    let provider = normalize_credential_owner(&provider)?;
    match entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(credential_error("删除", error)),
    }
}

#[tauri::command]
pub(crate) fn get_agent_credential_status(
    provider: String,
) -> Result<AgentCredentialStatus, String> {
    let provider = normalize_credential_owner(&provider)?;
    let configured = environment_secret(&provider).is_some()
        || match entry(&provider)?.get_password() {
            Ok(secret) => !secret.trim().is_empty(),
            Err(keyring::Error::NoEntry) => false,
            Err(error) => return Err(credential_error("读取", error)),
        };
    Ok(AgentCredentialStatus {
        provider,
        configured,
    })
}

pub(super) fn read_provider_secret(provider: &str) -> Result<String, String> {
    let provider = normalize_credential_owner(provider)?;
    if let Some(secret) = environment_secret(&provider) {
        return Ok(secret);
    }
    entry(&provider)?
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => {
                format!("尚未配置 {} 凭证。", provider_display_name(&provider))
            }
            other => credential_error("读取", other),
        })
}

fn entry(owner: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, owner).map_err(|error| credential_error("初始化", error))
}

fn normalize_credential_owner(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();
    let valid = matches!(
        normalized.as_str(),
        "openai-api"
            | "anthropic-api"
            | "openai-compatible"
            | "chatgpt-subscription"
            | "tavily-search"
    ) || normalized
        .strip_prefix("mcp:")
        .is_some_and(valid_identifier);
    if valid {
        Ok(normalized)
    } else {
        Err("不支持的 AI 或 MCP 凭证标识。".to_string())
    }
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 96
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

fn validate_secret(secret: &str) -> Result<(), String> {
    let secret = secret.trim();
    if secret.is_empty() {
        return Err("凭证不能为空。".to_string());
    }
    if secret.len() > MAX_SECRET_BYTES || secret.chars().any(|character| character == '\0') {
        return Err("凭证格式无效。".to_string());
    }
    Ok(())
}

fn environment_secret(provider: &str) -> Option<String> {
    let name = match provider {
        "openai-api" => "OPENAI_API_KEY",
        "anthropic-api" => "ANTHROPIC_API_KEY",
        "openai-compatible" => "LOBY_OPENAI_COMPATIBLE_API_KEY",
        "tavily-search" => "TAVILY_API_KEY",
        _ => return None,
    };
    std::env::var(name)
        .ok()
        .map(|secret| secret.trim().to_string())
        .filter(|secret| !secret.is_empty())
}

fn provider_display_name(provider: &str) -> &'static str {
    match provider {
        "openai-api" => "OpenAI API",
        "anthropic-api" => "Anthropic API",
        "openai-compatible" => "OpenAI-compatible API",
        "chatgpt-subscription" => "ChatGPT 订阅",
        "tavily-search" => "Tavily Search",
        _ => "MCP",
    }
}

fn credential_error(action: &str, error: keyring::Error) -> String {
    format!("无法在系统安全存储中{action}凭证：{error}")
}

#[cfg(test)]
mod tests {
    use super::{normalize_credential_owner, validate_secret};

    #[test]
    fn credential_owner_rejects_unscoped_or_unsafe_values() {
        assert!(normalize_credential_owner("openai-api").is_ok());
        assert!(normalize_credential_owner("mcp:research_server").is_ok());
        assert!(normalize_credential_owner("mcp:../escape").is_err());
        assert!(normalize_credential_owner("unknown-provider").is_err());
    }

    #[test]
    fn secret_validation_never_accepts_blank_or_nul_values() {
        assert!(validate_secret("sk-example").is_ok());
        assert!(validate_secret("   ").is_err());
        assert!(validate_secret("token\0suffix").is_err());
    }
}
