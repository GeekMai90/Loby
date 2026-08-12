//! [INPUT]: 依赖用户平台 app-config 目录、受限开发环境变量、serde 与原子本地文件写入
//! [OUTPUT]: 向 Agent Provider/MCP 提供应用内凭证保存、读取、状态查询、删除与旧版独立搜索凭证清理，绝不返回秘密到 renderer
//! [POS]: 本地 AI agent 的原生凭证边界；不访问系统 Keychain，凭证只进入当前用户私有的落笔应用数据
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::AgentCredentialStatus;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

const STORE_VERSION: u8 = 2;
const MAX_SECRET_BYTES: usize = 32 * 1024;
static STORE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentSecretStore {
    version: u8,
    secrets: BTreeMap<String, String>,
}

impl Default for AgentSecretStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            secrets: BTreeMap::new(),
        }
    }
}

#[tauri::command]
pub(crate) fn save_agent_credential(provider: String, secret: String) -> Result<(), String> {
    save_secret(&provider, &secret)
}

#[tauri::command]
pub(crate) fn delete_agent_credential(provider: String) -> Result<(), String> {
    delete_secret(&provider)
}

#[tauri::command]
pub(crate) fn get_agent_credential_status(
    provider: String,
) -> Result<AgentCredentialStatus, String> {
    let provider = normalize_credential_owner(&provider)?;
    let configured = has_secret(&provider)?;
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
    read_secret_at(&store_path()?, &provider)
        .map_err(|_| missing_provider_credential_message(&provider))
}

pub(super) fn save_secret(owner: &str, secret: &str) -> Result<(), String> {
    let owner = normalize_credential_owner(owner)?;
    validate_secret(secret)?;
    save_secret_at(&store_path()?, &owner, secret.trim())
}

pub(super) fn delete_secret(owner: &str) -> Result<(), String> {
    let owner = normalize_credential_owner(owner)?;
    delete_secret_at(&store_path()?, &owner)
}

pub(super) fn has_secret(owner: &str) -> Result<bool, String> {
    let owner = normalize_credential_owner(owner)?;
    if environment_secret(&owner).is_some() {
        return Ok(true);
    }
    has_secret_at(&store_path()?, &owner)
}

fn save_secret_at(path: &Path, owner: &str, secret: &str) -> Result<(), String> {
    let _guard = store_lock()
        .lock()
        .map_err(|_| "落笔凭证存储暂时不可用。".to_string())?;
    let mut store = load_store(path)?;
    store.secrets.insert(owner.to_string(), secret.to_string());
    save_store(path, &store)
}

fn delete_secret_at(path: &Path, owner: &str) -> Result<(), String> {
    let _guard = store_lock()
        .lock()
        .map_err(|_| "落笔凭证存储暂时不可用。".to_string())?;
    if !path.exists() {
        return Ok(());
    }
    let mut store = load_store(path)?;
    store.secrets.remove(owner);
    save_store(path, &store)
}

fn has_secret_at(path: &Path, owner: &str) -> Result<bool, String> {
    let _guard = store_lock()
        .lock()
        .map_err(|_| "落笔凭证存储暂时不可用。".to_string())?;
    Ok(load_store(path)?
        .secrets
        .get(owner)
        .is_some_and(|secret| !secret.trim().is_empty()))
}

fn read_secret_at(path: &Path, owner: &str) -> Result<String, String> {
    let _guard = store_lock()
        .lock()
        .map_err(|_| "落笔凭证存储暂时不可用。".to_string())?;
    load_store(path)?
        .secrets
        .get(owner)
        .filter(|secret| !secret.trim().is_empty())
        .cloned()
        .ok_or_else(|| "落笔应用凭证中没有匹配记录。".to_string())
}

fn load_store(path: &Path) -> Result<AgentSecretStore, String> {
    if !path.exists() {
        return Ok(AgentSecretStore::default());
    }
    let payload = fs::read(path).map_err(|_| "无法读取落笔应用凭证。".to_string())?;
    let mut store = serde_json::from_slice::<AgentSecretStore>(&payload)
        .map_err(|_| "落笔应用凭证文件已损坏。".to_string())?;
    if store.version == 1 {
        store.secrets.remove("tavily-search");
        store.version = STORE_VERSION;
        save_store(path, &store)?;
    } else if store.version != STORE_VERSION {
        return Err("落笔应用凭证版本不受支持。".to_string());
    }
    Ok(store)
}

fn save_store(path: &Path, store: &AgentSecretStore) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "落笔应用凭证路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建落笔应用数据目录。".to_string())?;
    restrict_directory_permissions(parent)?;
    let payload =
        serde_json::to_vec_pretty(store).map_err(|_| "无法生成落笔应用凭证。".to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|_| "无法创建落笔应用凭证临时文件。".to_string())?;
    temporary
        .write_all(&payload)
        .map_err(|_| "无法保存落笔应用凭证。".to_string())?;
    temporary
        .persist(path)
        .map_err(|_| "无法替换落笔应用凭证。".to_string())?;
    restrict_file_permissions(path)
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join("Loby").join("agent-secrets.json"))
        .ok_or_else(|| "无法确定落笔应用数据目录。".to_string())
}

fn store_lock() -> &'static Mutex<()> {
    STORE_LOCK.get_or_init(|| Mutex::new(()))
}

fn normalize_credential_owner(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();
    let valid = matches!(
        normalized.as_str(),
        "openai-api"
            | "anthropic-api"
            | "qwen-api"
            | "minimax-api"
            | "deepseek-api"
            | "kimi-api"
            | "openai-compatible"
            | "chatgpt-subscription"
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
    let names: &[&str] = match provider {
        "openai-api" => &["OPENAI_API_KEY"],
        "anthropic-api" => &["ANTHROPIC_API_KEY"],
        "qwen-api" => &["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
        "minimax-api" => &["MINIMAX_API_KEY"],
        "deepseek-api" => &["DEEPSEEK_API_KEY"],
        "kimi-api" => &["MOONSHOT_API_KEY", "KIMI_API_KEY"],
        "openai-compatible" => &["LOBY_OPENAI_COMPATIBLE_API_KEY"],
        _ => return None,
    };
    names.iter().find_map(|name| {
        std::env::var(name)
            .ok()
            .map(|secret| secret.trim().to_string())
            .filter(|secret| !secret.is_empty())
    })
}

fn provider_display_name(provider: &str) -> &'static str {
    match provider {
        "openai-api" => "OpenAI API",
        "anthropic-api" => "Anthropic API",
        "qwen-api" => "千问 API",
        "minimax-api" => "MiniMax API",
        "deepseek-api" => "DeepSeek API",
        "kimi-api" => "Kimi API",
        "openai-compatible" => "自定义服务商",
        "chatgpt-subscription" => "ChatGPT 订阅",
        _ => "MCP",
    }
}

fn missing_provider_credential_message(provider: &str) -> String {
    format!("尚未配置 {} 凭证。", provider_display_name(provider))
}

#[cfg(unix)]
fn restrict_directory_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "无法限制落笔应用数据目录权限。".to_string())
}

#[cfg(not(unix))]
fn restrict_directory_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn restrict_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|_| "无法限制落笔应用凭证权限。".to_string())
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_owner_rejects_unscoped_or_unsafe_values() {
        assert!(normalize_credential_owner("openai-api").is_ok());
        assert!(normalize_credential_owner("qwen-api").is_ok());
        assert!(normalize_credential_owner("minimax-api").is_ok());
        assert!(normalize_credential_owner("deepseek-api").is_ok());
        assert!(normalize_credential_owner("kimi-api").is_ok());
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

    #[test]
    fn missing_credential_messages_use_the_selected_provider_name() {
        assert_eq!(
            missing_provider_credential_message("openai-api"),
            "尚未配置 OpenAI API 凭证。"
        );
        assert_eq!(
            missing_provider_credential_message("deepseek-api"),
            "尚未配置 DeepSeek API 凭证。"
        );
        assert_eq!(
            missing_provider_credential_message("qwen-api"),
            "尚未配置 千问 API 凭证。"
        );
    }

    #[test]
    fn application_secret_survives_reload_without_keychain() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let path = directory.path().join("agent-secrets.json");
        save_secret_at(&path, "openai-api", "sk-local")?;
        assert!(has_secret_at(&path, "openai-api")?);
        assert_eq!(read_secret_at(&path, "openai-api")?, "sk-local");
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        assert!(raw.contains("openai-api"));
        assert!(!raw.contains("keychain"));
        delete_secret_at(&path, "openai-api")?;
        assert!(!has_secret_at(&path, "openai-api")?);
        Ok(())
    }

    #[test]
    fn version_one_store_removes_legacy_tavily_secret() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let path = directory.path().join("agent-secrets.json");
        let legacy = AgentSecretStore {
            version: 1,
            secrets: BTreeMap::from([
                ("openai-api".to_string(), "sk-openai".to_string()),
                ("tavily-search".to_string(), "tvly-legacy".to_string()),
            ]),
        };
        fs::write(
            &path,
            serde_json::to_vec_pretty(&legacy).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;

        let migrated = load_store(&path)?;
        assert_eq!(migrated.version, STORE_VERSION);
        assert_eq!(
            migrated.secrets.get("openai-api").map(String::as_str),
            Some("sk-openai")
        );
        assert!(!migrated.secrets.contains_key("tavily-search"));
        let persisted = serde_json::from_slice::<AgentSecretStore>(
            &fs::read(&path).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        assert_eq!(persisted.version, STORE_VERSION);
        assert!(!persisted.secrets.contains_key("tavily-search"));
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn application_secret_file_is_user_only() -> Result<(), String> {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let path = directory.path().join("agent-secrets.json");
        save_secret_at(&path, "anthropic-api", "sk-ant-local")?;
        assert_eq!(
            fs::metadata(path)
                .map_err(|error| error.to_string())?
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        Ok(())
    }
}
