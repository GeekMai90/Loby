//! [INPUT]: 依赖 rmcp 官方 Rust SDK、落笔应用内凭证边界、config 目录与 fs_paths 原子替换
//! [OUTPUT]: 向 Agent Runtime/设置页提供 MCP server 配置、并发有界发现缓存、Provider 安全别名与 stdio/Streamable HTTP 受控调用
//! [POS]: 本地 AI agent 领域的 MCP client 边界，不自动安装、授权或继承其他应用的 MCP 配置
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::credentials::read_provider_secret;
use super::tools::{ToolDefinition, ToolEffect, ToolExecution};
use crate::fs_paths::write_if_changed;
use rmcp::{
    model::CallToolRequestParams,
    transport::{
        streamable_http_client::StreamableHttpClientTransportConfig, StreamableHttpClientTransport,
        TokioChildProcess,
    },
    ServiceExt,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const MCP_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_MCP_TOOLS_PER_SERVER: usize = 64;
const MAX_MCP_TOOLS_TOTAL: usize = 128;
const MAX_MCP_TOOL_SCHEMA_BYTES: usize = 64 * 1024;
const MAX_MCP_TOOL_DESCRIPTION_CHARS: usize = 2_000;
const MCP_DISCOVERY_CACHE_TTL: Duration = Duration::from_secs(5 * 60);
static MCP_DISCOVERY_CACHE: OnceLock<Mutex<HashMap<String, CachedMcpDiscovery>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpServerConfig {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) enabled: bool,
    pub(crate) transport: String,
    #[serde(default)]
    pub(crate) command: String,
    #[serde(default)]
    pub(crate) args: Vec<String>,
    #[serde(default)]
    pub(crate) url: String,
    #[serde(default)]
    pub(crate) secret_env: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpToolInfo {
    pub(crate) server_id: String,
    pub(crate) name: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) input_schema: Value,
    pub(crate) read_only: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpServerStore {
    #[serde(default)]
    servers: Vec<McpServerConfig>,
}

#[derive(Clone)]
struct McpDiscovery {
    tools: Vec<McpToolInfo>,
    warnings: Vec<String>,
}

struct CachedMcpDiscovery {
    fingerprint: String,
    expires_at: Instant,
    discovery: McpDiscovery,
}

#[tauri::command]
pub(crate) fn list_mcp_servers() -> Result<Vec<McpServerConfig>, String> {
    Ok(load_store()?.servers)
}

#[tauri::command]
pub(crate) fn save_mcp_server(config: McpServerConfig) -> Result<Vec<McpServerConfig>, String> {
    validate_config(&config)?;
    let mut store = load_store()?;
    if let Some(existing) = store.servers.iter_mut().find(|item| item.id == config.id) {
        *existing = config;
    } else {
        store.servers.push(config);
    }
    store
        .servers
        .sort_by(|left, right| left.name.cmp(&right.name));
    save_store(&store)?;
    clear_mcp_discovery_cache();
    Ok(store.servers)
}

#[tauri::command]
pub(crate) fn delete_mcp_server(id: String) -> Result<Vec<McpServerConfig>, String> {
    validate_id(&id)?;
    let mut store = load_store()?;
    store.servers.retain(|server| server.id != id);
    save_store(&store)?;
    clear_mcp_discovery_cache();
    Ok(store.servers)
}

#[tauri::command]
pub(crate) async fn list_mcp_tools(server_id: String) -> Result<Vec<McpToolInfo>, String> {
    let config = enabled_server(&server_id)?;
    let discovery = tokio::time::timeout(MCP_TIMEOUT, discover_tools(&config))
        .await
        .map_err(|_| "MCP 工具发现超时。".to_string())??;
    cache_mcp_discovery(&config, &discovery);
    Ok(discovery.tools)
}

pub(super) async fn available_mcp_tools() -> (Vec<ToolDefinition>, Vec<String>) {
    let servers = match load_store() {
        Ok(store) => store.servers,
        Err(error) => return (Vec::new(), vec![error]),
    };
    let mut tasks = tokio::task::JoinSet::new();
    let mut discoveries = Vec::new();
    for (index, server) in servers
        .into_iter()
        .filter(|server| server.enabled)
        .enumerate()
    {
        if let Some(discovery) = cached_mcp_discovery(&server) {
            discoveries.push((index, server, Ok(Ok(discovery))));
            continue;
        }
        tasks.spawn(async move {
            let result = tokio::time::timeout(MCP_TIMEOUT, discover_tools(&server)).await;
            (index, server, result)
        });
    }
    let mut errors = Vec::new();
    while let Some(result) = tasks.join_next().await {
        match result {
            Ok(discovery) => {
                if let Ok(Ok(catalog)) = &discovery.2 {
                    cache_mcp_discovery(&discovery.1, catalog);
                }
                discoveries.push(discovery);
            }
            Err(error) => errors.push(format!("MCP 工具发现任务失败：{error}")),
        }
    }
    discoveries.sort_by_key(|(index, _, _)| *index);
    let mut definitions = Vec::new();
    for (_, server, result) in discoveries {
        match result {
            Ok(Ok(discovery)) => {
                errors.extend(
                    discovery
                        .warnings
                        .into_iter()
                        .map(|warning| format!("{}：{warning}", server.name)),
                );
                let remaining = MAX_MCP_TOOLS_TOTAL.saturating_sub(definitions.len());
                if discovery.tools.len() > remaining {
                    errors.push(format!(
                        "{}：超过本轮 MCP 工具总预算，已忽略 {} 个工具",
                        server.name,
                        discovery.tools.len() - remaining
                    ));
                }
                definitions.extend(
                    discovery
                        .tools
                        .into_iter()
                        .take(remaining)
                        .map(|tool| mcp_tool_definition(&server, tool)),
                );
            }
            Ok(Err(error)) => errors.push(format!("{}：{}", server.name, error)),
            Err(_) => errors.push(format!("{}：工具发现超时", server.name)),
        }
    }
    (definitions, errors)
}

fn mcp_tool_definition(server: &McpServerConfig, tool: McpToolInfo) -> ToolDefinition {
    let execution_name = format!(
        "mcp__{}__{}__{}",
        server.id,
        mcp_config_fingerprint(server),
        tool.name
    );
    ToolDefinition {
        name: provider_mcp_tool_name(&server.id, &tool.name),
        display_name: format!("MCP {} / {}", server.name, tool.name),
        execution_name: Some(execution_name),
        description: format!(
            "MCP {} / {}：{}",
            server.name,
            tool.name,
            if tool.description.is_empty() {
                tool.title
            } else {
                tool.description
            }
        ),
        input_schema: tool.input_schema,
        // MCP annotations 由外部 server 自行声明，只用于展示，不能作为免审批授权。
        effect: mcp_tool_effect(tool.read_only),
    }
}

fn provider_mcp_tool_name(server_id: &str, tool_name: &str) -> String {
    const MAX_NAME_BYTES: usize = 64;
    const HASH_BYTES: usize = 6;
    let direct = format!("mcp__{server_id}__{tool_name}");
    if direct.len() <= MAX_NAME_BYTES
        && direct
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return direct;
    }

    let visible = format!("{server_id}_{tool_name}")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    let digest = Sha256::digest(format!("{server_id}\0{tool_name}").as_bytes());
    let suffix = digest[..HASH_BYTES]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let prefix = "mcp__";
    let separator = "__";
    let visible_budget = MAX_NAME_BYTES - prefix.len() - separator.len() - suffix.len();
    let visible = visible.chars().take(visible_budget).collect::<String>();
    format!("{prefix}{visible}{separator}{suffix}")
}

fn mcp_config_fingerprint(config: &McpServerConfig) -> String {
    let mut digest = Sha256::new();
    for field in [
        config.transport.as_str(),
        config.command.as_str(),
        config.url.as_str(),
        config.secret_env.as_str(),
    ] {
        digest.update(field.as_bytes());
        digest.update([0]);
    }
    for argument in &config.args {
        digest.update(argument.as_bytes());
        digest.update([0]);
    }
    digest.finalize()[..6]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn cached_mcp_discovery(config: &McpServerConfig) -> Option<McpDiscovery> {
    let now = Instant::now();
    let mut cache = MCP_DISCOVERY_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .ok()?;
    cache.retain(|_, item| item.expires_at > now);
    cache
        .get(&config.id)
        .filter(|item| item.fingerprint == mcp_config_fingerprint(config))
        .map(|item| item.discovery.clone())
}

fn cache_mcp_discovery(config: &McpServerConfig, discovery: &McpDiscovery) {
    if let Ok(mut cache) = MCP_DISCOVERY_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
    {
        cache.insert(
            config.id.clone(),
            CachedMcpDiscovery {
                fingerprint: mcp_config_fingerprint(config),
                expires_at: Instant::now() + MCP_DISCOVERY_CACHE_TTL,
                discovery: discovery.clone(),
            },
        );
    }
}

fn clear_mcp_discovery_cache() {
    if let Some(cache) = MCP_DISCOVERY_CACHE.get() {
        if let Ok(mut cache) = cache.lock() {
            cache.clear();
        }
    }
}

pub(super) async fn execute_namespaced_mcp_tool(
    name: &str,
    arguments: &Value,
) -> Result<ToolExecution, String> {
    let rest = name
        .strip_prefix("mcp__")
        .ok_or_else(|| "MCP 工具命名空间无效。".to_string())?;
    let (server_id, rest) = rest
        .split_once("__")
        .ok_or_else(|| "MCP 工具命名空间无效。".to_string())?;
    let (expected_fingerprint, tool_name) = rest
        .split_once("__")
        .ok_or_else(|| "MCP 工具命名空间缺少配置快照。".to_string())?;
    let arguments = arguments
        .as_object()
        .cloned()
        .ok_or_else(|| "MCP 工具参数必须是 JSON object。".to_string())?;
    let config = enabled_server(server_id)?;
    if expected_fingerprint != mcp_config_fingerprint(&config) {
        return Err("MCP server 配置在工具发现后发生变化；请重新发送请求后再审批。".to_string());
    }
    let result = tokio::time::timeout(MCP_TIMEOUT, invoke_tool(&config, tool_name, arguments))
        .await
        .map_err(|_| "MCP 工具调用超时。".to_string())??;
    Ok(ToolExecution {
        output: serde_json::to_string(&result).map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

async fn discover_tools(config: &McpServerConfig) -> Result<McpDiscovery, String> {
    if config.transport == "stdio" {
        let transport = stdio_transport(config)?;
        let client = ().serve(transport).await.map_err(mcp_error)?;
        let tools = client.list_all_tools().await.map_err(mcp_error)?;
        let _ = client.cancel().await;
        Ok(map_tools(&config.id, tools))
    } else {
        let transport = http_transport(config)?;
        let client = ().serve(transport).await.map_err(mcp_error)?;
        let tools = client.list_all_tools().await.map_err(mcp_error)?;
        let _ = client.cancel().await;
        Ok(map_tools(&config.id, tools))
    }
}

async fn invoke_tool(
    config: &McpServerConfig,
    tool_name: &str,
    arguments: Map<String, Value>,
) -> Result<Value, String> {
    if tool_name.trim().is_empty() || tool_name.len() > 128 {
        return Err("MCP 工具名称无效。".to_string());
    }
    let params = CallToolRequestParams::new(tool_name.to_string()).with_arguments(arguments);
    if config.transport == "stdio" {
        let client = ().serve(stdio_transport(config)?).await.map_err(mcp_error)?;
        let result = client.call_tool(params).await.map_err(mcp_error)?;
        let _ = client.cancel().await;
        serde_json::to_value(result).map_err(|error| error.to_string())
    } else {
        let client = ().serve(http_transport(config)?).await.map_err(mcp_error)?;
        let result = client.call_tool(params).await.map_err(mcp_error)?;
        let _ = client.cancel().await;
        serde_json::to_value(result).map_err(|error| error.to_string())
    }
}

fn stdio_transport(config: &McpServerConfig) -> Result<TokioChildProcess, String> {
    let command_path = PathBuf::from(&config.command)
        .canonicalize()
        .map_err(|_| "MCP stdio executable 不存在。".to_string())?;
    if !command_path.is_file() {
        return Err("MCP stdio executable 不是文件。".to_string());
    }
    let mut command = tokio::process::Command::new(command_path);
    command
        .args(&config.args)
        .kill_on_drop(true)
        .current_dir(
            Path::new(&config.command)
                .parent()
                .ok_or_else(|| "MCP stdio executable 缺少父目录。".to_string())?,
        )
        .env_clear();
    for name in ["HOME", "PATH", "TMPDIR", "TEMP", "TMP"] {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
    if !config.secret_env.trim().is_empty() {
        validate_environment_name(&config.secret_env)?;
        command.env(
            config.secret_env.trim(),
            read_provider_secret(&format!("mcp:{}", config.id))?,
        );
    }
    TokioChildProcess::new(command).map_err(|error| error.to_string())
}

fn http_transport(
    config: &McpServerConfig,
) -> Result<StreamableHttpClientTransport<reqwest::Client>, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    if !config.secret_env.trim().is_empty() {
        let token = read_provider_secret(&format!("mcp:{}", config.id))?;
        let value = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| "MCP HTTP token 格式无效。".to_string())?;
        headers.insert(reqwest::header::AUTHORIZATION, value);
    }
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(MCP_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| error.to_string())?;
    Ok(StreamableHttpClientTransport::with_client(
        client,
        StreamableHttpClientTransportConfig::with_uri(config.url.clone()),
    ))
}

fn map_tools(server_id: &str, tools: Vec<rmcp::model::Tool>) -> McpDiscovery {
    let mut mapped = Vec::new();
    let mut warnings = Vec::new();
    if tools.len() > MAX_MCP_TOOLS_PER_SERVER {
        warnings.push(format!(
            "server 暴露 {} 个工具，落笔只加载前 {} 个",
            tools.len(),
            MAX_MCP_TOOLS_PER_SERVER
        ));
    }
    for tool in tools.into_iter().take(MAX_MCP_TOOLS_PER_SERVER) {
        let name = tool.name.into_owned();
        if !is_usable_mcp_tool_name(&name) {
            warnings.push(format!(
                "已忽略空名称、过长或包含控制字符的工具 {}",
                compact_external_label(&name)
            ));
            continue;
        }
        if !is_standard_mcp_tool_name(&name) {
            warnings.push(format!(
                "工具 {} 使用了非标准名称，已为 Provider 生成安全别名",
                compact_external_label(&name)
            ));
        }
        let input_schema = Value::Object((*tool.input_schema).clone());
        if serde_json::to_vec(&input_schema)
            .map(|schema| schema.len() > MAX_MCP_TOOL_SCHEMA_BYTES)
            .unwrap_or(true)
        {
            warnings.push(format!(
                "已忽略 schema 超过 64 KB 的工具 {}",
                compact_external_label(&name)
            ));
            continue;
        }
        mapped.push(McpToolInfo {
            server_id: server_id.to_string(),
            name,
            title: truncate_external_text(&tool.title.unwrap_or_default()),
            description: truncate_external_text(
                &tool
                    .description
                    .map(|description| description.into_owned())
                    .unwrap_or_default(),
            ),
            input_schema,
            read_only: tool
                .annotations
                .and_then(|annotations| annotations.read_only_hint)
                .unwrap_or(false),
        });
    }
    McpDiscovery {
        tools: mapped,
        warnings,
    }
}

fn truncate_external_text(value: &str) -> String {
    let value = value.trim();
    if value.chars().count() <= MAX_MCP_TOOL_DESCRIPTION_CHARS {
        return value.to_string();
    }
    format!(
        "{}……",
        value
            .chars()
            .take(MAX_MCP_TOOL_DESCRIPTION_CHARS)
            .collect::<String>()
    )
}

fn is_usable_mcp_tool_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.chars().all(|character| !character.is_control())
}

fn is_standard_mcp_tool_name(value: &str) -> bool {
    is_usable_mcp_tool_name(value)
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
        })
}

fn compact_external_label(value: &str) -> String {
    value
        .chars()
        .filter(|character| !character.is_control())
        .take(80)
        .collect()
}

fn mcp_tool_effect(_read_only_hint: bool) -> ToolEffect {
    ToolEffect::Write
}

fn enabled_server(id: &str) -> Result<McpServerConfig, String> {
    validate_id(id)?;
    load_store()?
        .servers
        .into_iter()
        .find(|server| server.id == id && server.enabled)
        .ok_or_else(|| "MCP server 不存在或尚未启用。".to_string())
}

fn validate_config(config: &McpServerConfig) -> Result<(), String> {
    validate_id(&config.id)?;
    if config.name.trim().is_empty() || config.name.len() > 80 {
        return Err("MCP server 名称无效。".to_string());
    }
    if config.args.len() > 32
        || config
            .args
            .iter()
            .any(|arg| arg.len() > 2048 || arg.contains('\0'))
    {
        return Err("MCP stdio 参数无效。".to_string());
    }
    if !config.secret_env.trim().is_empty() {
        validate_environment_name(&config.secret_env)?;
    }
    match config.transport.as_str() {
        "stdio" => {
            if config.command.trim().is_empty() || !Path::new(&config.command).is_absolute() {
                return Err("MCP stdio executable 必须是绝对路径。".to_string());
            }
        }
        "streamable-http" => validate_http_url(&config.url)?,
        _ => return Err("MCP transport 只支持 stdio 或 streamable-http。".to_string()),
    }
    Ok(())
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 64
        || id.contains("__")
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("MCP server id 无效。".to_string());
    }
    Ok(())
}

fn validate_environment_name(name: &str) -> Result<(), String> {
    if name.len() > 96
        || !name.chars().all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '_'
        })
    {
        return Err("MCP secret 环境变量名无效。".to_string());
    }
    Ok(())
}

fn validate_http_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "MCP HTTP URL 无效。".to_string())?;
    let is_local_debug = cfg!(debug_assertions)
        && parsed.scheme() == "http"
        && parsed
            .host_str()
            .is_some_and(|host| matches!(host, "localhost" | "127.0.0.1" | "::1"));
    if parsed.scheme() != "https" && !is_local_debug {
        return Err("MCP HTTP URL 必须使用 HTTPS；开发模式只允许本机 HTTP。".to_string());
    }
    Ok(())
}

fn load_store() -> Result<McpServerStore, String> {
    let path = store_path()?;
    let source = match fs::read_to_string(path) {
        Ok(source) => source,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(McpServerStore::default())
        }
        Err(error) => return Err(error.to_string()),
    };
    serde_json::from_str(&source).map_err(|error| format!("MCP server 配置损坏：{error}"))
}

fn save_store(store: &McpServerStore) -> Result<(), String> {
    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_vec_pretty(store).map_err(|error| error.to_string())?;
    write_if_changed(&path, payload).map(|_| ())
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|root| root.join("Loby").join("ai").join("mcp-servers.json"))
        .ok_or_else(|| "无法确定 Loby 配置目录。".to_string())
}

fn mcp_error(error: impl std::fmt::Display) -> String {
    format!("MCP 连接失败：{error}")
}

#[cfg(test)]
mod tests {
    use super::{
        cache_mcp_discovery, cached_mcp_discovery, clear_mcp_discovery_cache,
        is_standard_mcp_tool_name, is_usable_mcp_tool_name, mcp_config_fingerprint,
        mcp_tool_effect, provider_mcp_tool_name, validate_config, validate_environment_name,
        McpDiscovery, McpServerConfig, ToolEffect,
    };

    #[test]
    fn remote_read_only_hint_never_bypasses_local_approval() {
        assert_eq!(mcp_tool_effect(true), ToolEffect::Write);
        assert_eq!(mcp_tool_effect(false), ToolEffect::Write);
    }

    #[test]
    fn mcp_http_requires_secure_or_local_debug_url() {
        let mut config = McpServerConfig {
            id: "research".to_string(),
            name: "Research".to_string(),
            enabled: true,
            transport: "streamable-http".to_string(),
            command: String::new(),
            args: Vec::new(),
            url: "https://example.com/mcp".to_string(),
            secret_env: String::new(),
        };
        assert!(validate_config(&config).is_ok());
        config.url = "http://example.com/mcp".to_string();
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn secret_environment_name_is_an_explicit_allowlist_key() {
        assert!(validate_environment_name("EXA_API_KEY").is_ok());
        assert!(validate_environment_name("PATH=/tmp").is_err());
        assert!(validate_environment_name("lowercase").is_err());
    }

    #[test]
    fn provider_tool_alias_is_bounded_safe_and_collision_resistant() {
        let first = provider_mcp_tool_name(
            "research-server-with-a-very-long-identifier",
            "documents/search.by/path/with-a-very-long-tool-name",
        );
        let second = provider_mcp_tool_name(
            "research-server-with-a-very-long-identifier",
            "documents-search-by-path-with-a-very-long-tool-name",
        );
        assert!(first.len() <= 64);
        assert!(first
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_')));
        assert_ne!(first, second);
    }

    #[test]
    fn raw_mcp_tool_names_follow_the_protocol_character_budget() {
        assert!(is_standard_mcp_tool_name("documents.search-by-id"));
        assert!(!is_standard_mcp_tool_name("documents/search"));
        assert!(is_usable_mcp_tool_name("documents/search"));
        assert!(is_usable_mcp_tool_name(&"x".repeat(128)));
        assert!(!is_usable_mcp_tool_name(&"x".repeat(129)));
        assert!(!is_usable_mcp_tool_name("documents\nsearch"));
    }

    #[test]
    fn server_id_cannot_collide_with_namespace_separator() {
        let mut config = McpServerConfig {
            id: "research__private".to_string(),
            name: "Research".to_string(),
            enabled: true,
            transport: "streamable-http".to_string(),
            command: String::new(),
            args: Vec::new(),
            url: "https://example.com/mcp".to_string(),
            secret_env: String::new(),
        };
        assert!(validate_config(&config).is_err());
        config.id = "research_private".to_string();
        assert!(validate_config(&config).is_ok());
    }

    #[test]
    fn execution_fingerprint_changes_with_transport_but_not_display_name() {
        let mut config = McpServerConfig {
            id: "research".to_string(),
            name: "Research".to_string(),
            enabled: true,
            transport: "streamable-http".to_string(),
            command: String::new(),
            args: Vec::new(),
            url: "https://example.com/mcp".to_string(),
            secret_env: "MCP_TOKEN".to_string(),
        };
        let original = mcp_config_fingerprint(&config);
        config.name = "资料库".to_string();
        assert_eq!(mcp_config_fingerprint(&config), original);
        config.url = "https://other.example.com/mcp".to_string();
        assert_ne!(mcp_config_fingerprint(&config), original);
    }

    #[test]
    fn discovery_cache_is_bound_to_the_execution_config() {
        clear_mcp_discovery_cache();
        let mut config = McpServerConfig {
            id: "cache-test".to_string(),
            name: "Research".to_string(),
            enabled: true,
            transport: "streamable-http".to_string(),
            command: String::new(),
            args: Vec::new(),
            url: "https://example.com/mcp".to_string(),
            secret_env: String::new(),
        };
        let discovery = McpDiscovery {
            tools: Vec::new(),
            warnings: vec!["cached".to_string()],
        };
        cache_mcp_discovery(&config, &discovery);
        assert_eq!(
            cached_mcp_discovery(&config).unwrap().warnings,
            vec!["cached"]
        );
        config.url = "https://other.example.com/mcp".to_string();
        assert!(cached_mcp_discovery(&config).is_none());
        clear_mcp_discovery_cache();
    }
}
