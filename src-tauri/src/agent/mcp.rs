//! [INPUT]: 依赖 rmcp 官方 Rust SDK、落笔应用内凭证边界、config 目录与 fs_paths 原子替换
//! [OUTPUT]: 向 Agent Runtime/设置页提供 MCP server 配置、stdio/Streamable HTTP 工具发现与受控调用
//! [POS]: 本地 AI agent 领域的 MCP client 边界，不自动安装、授权或继承其他应用的 MCP 配置
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::credentials::read_provider_secret;
use super::tools::{ToolDefinition, ToolExecution};
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
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

const MCP_TIMEOUT: Duration = Duration::from_secs(30);

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
    Ok(store.servers)
}

#[tauri::command]
pub(crate) fn delete_mcp_server(id: String) -> Result<Vec<McpServerConfig>, String> {
    validate_id(&id)?;
    let mut store = load_store()?;
    store.servers.retain(|server| server.id != id);
    save_store(&store)?;
    Ok(store.servers)
}

#[tauri::command]
pub(crate) async fn list_mcp_tools(server_id: String) -> Result<Vec<McpToolInfo>, String> {
    let config = enabled_server(&server_id)?;
    tokio::time::timeout(MCP_TIMEOUT, discover_tools(&config))
        .await
        .map_err(|_| "MCP 工具发现超时。".to_string())?
}

pub(super) async fn available_mcp_tools() -> (Vec<ToolDefinition>, Vec<String>) {
    let servers = match load_store() {
        Ok(store) => store.servers,
        Err(error) => return (Vec::new(), vec![error]),
    };
    let mut definitions = Vec::new();
    let mut errors = Vec::new();
    for server in servers.into_iter().filter(|server| server.enabled) {
        match tokio::time::timeout(MCP_TIMEOUT, discover_tools(&server)).await {
            Ok(Ok(tools)) => {
                definitions.extend(tools.into_iter().map(|tool| ToolDefinition {
                    name: format!("mcp__{}__{}", server.id, tool.name),
                    description: format!(
                        "MCP {}：{}",
                        server.name,
                        if tool.description.is_empty() {
                            tool.title
                        } else {
                            tool.description
                        }
                    ),
                    input_schema: tool.input_schema,
                    // MCP annotations 由外部 server 自行声明，只用于展示，不能作为免审批授权。
                    effect: mcp_tool_effect(tool.read_only).to_string(),
                }));
            }
            Ok(Err(error)) => errors.push(format!("{}：{}", server.name, error)),
            Err(_) => errors.push(format!("{}：工具发现超时", server.name)),
        }
    }
    (definitions, errors)
}

pub(super) async fn execute_namespaced_mcp_tool(
    name: &str,
    arguments: &Value,
) -> Result<ToolExecution, String> {
    let rest = name
        .strip_prefix("mcp__")
        .ok_or_else(|| "MCP 工具命名空间无效。".to_string())?;
    let (server_id, tool_name) = rest
        .split_once("__")
        .ok_or_else(|| "MCP 工具命名空间无效。".to_string())?;
    let arguments = arguments
        .as_object()
        .cloned()
        .ok_or_else(|| "MCP 工具参数必须是 JSON object。".to_string())?;
    let config = enabled_server(server_id)?;
    let result = tokio::time::timeout(MCP_TIMEOUT, invoke_tool(&config, tool_name, arguments))
        .await
        .map_err(|_| "MCP 工具调用超时。".to_string())??;
    Ok(ToolExecution {
        output: serde_json::to_string(&result).map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

async fn discover_tools(config: &McpServerConfig) -> Result<Vec<McpToolInfo>, String> {
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
        .build()
        .map_err(|error| error.to_string())?;
    Ok(StreamableHttpClientTransport::with_client(
        client,
        StreamableHttpClientTransportConfig::with_uri(config.url.clone()),
    ))
}

fn map_tools(server_id: &str, tools: Vec<rmcp::model::Tool>) -> Vec<McpToolInfo> {
    tools
        .into_iter()
        .map(|tool| McpToolInfo {
            server_id: server_id.to_string(),
            name: tool.name.into_owned(),
            title: tool.title.unwrap_or_default(),
            description: tool
                .description
                .map(|description| description.into_owned())
                .unwrap_or_default(),
            input_schema: Value::Object((*tool.input_schema).clone()),
            read_only: tool
                .annotations
                .and_then(|annotations| annotations.read_only_hint)
                .unwrap_or(false),
        })
        .collect()
}

fn mcp_tool_effect(_read_only_hint: bool) -> &'static str {
    "write"
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
    use super::{mcp_tool_effect, validate_config, validate_environment_name, McpServerConfig};

    #[test]
    fn remote_read_only_hint_never_bypasses_local_approval() {
        assert_eq!(mcp_tool_effect(true), "write");
        assert_eq!(mcp_tool_effect(false), "write");
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
}
