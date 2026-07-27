//! [INPUT]: 依赖活动写作库路径、Provider credential store、reqwest、base64 与受控缓存目录
//! [OUTPUT]: 向 Agent Loop 提供统一 ToolDefinition，以及 Markdown 读取/检索、联网搜索和图片生成执行器
//! [POS]: 本地 AI agent 领域的内置工具注册表；写作正文修改仍只能进入 Loby 审阅协议
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::credentials::read_provider_secret;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const MAX_DOCUMENT_BYTES: u64 = 512 * 1024;
const MAX_DOCUMENT_RESULTS: usize = 40;
const MAX_SEARCH_RESULTS: u64 = 10;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ToolDefinition {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) input_schema: Value,
    pub(crate) effect: String,
}

#[derive(Debug)]
pub(super) struct ToolExecution {
    pub(super) output: String,
    pub(super) artifact_path: Option<String>,
}

pub(super) fn builtin_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        tool(
            "list_documents",
            "列出当前写作库中的 Markdown 文档。",
            json!({
                "type": "object",
                "properties": { "limit": { "type": "integer", "minimum": 1, "maximum": 200 } },
                "additionalProperties": false
            }),
            "read",
        ),
        tool(
            "read_markdown",
            "读取当前写作库内的一份 Markdown 文档。path 可以是相对写作库的路径。",
            json!({
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"],
                "additionalProperties": false
            }),
            "read",
        ),
        tool(
            "search_documents",
            "在当前写作库的 Markdown 文档中搜索文本，返回匹配文件和片段。",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "limit": { "type": "integer", "minimum": 1, "maximum": 40 }
                },
                "required": ["query"],
                "additionalProperties": false
            }),
            "read",
        ),
        tool(
            "web_search",
            "联网搜索资料，返回标题、URL 与来源摘要。需要用户配置 Tavily API key。",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "maxResults": { "type": "integer", "minimum": 1, "maximum": 10 }
                },
                "required": ["query"],
                "additionalProperties": false
            }),
            "network",
        ),
        tool(
            "generate_image",
            "根据提示词生成文章图片，返回 Loby 临时成果路径；进入正文前仍需作者确认。",
            json!({
                "type": "object",
                "properties": {
                    "prompt": { "type": "string" },
                    "size": { "type": "string", "enum": ["1024x1024", "1536x1024", "1024x1536"] }
                },
                "required": ["prompt"],
                "additionalProperties": false
            }),
            "network",
        ),
    ]
}

pub(super) async fn execute_builtin_tool(
    library_path: &Path,
    name: &str,
    arguments: &Value,
) -> Result<ToolExecution, String> {
    match name {
        "list_documents" => list_documents(
            library_path,
            argument_u64(arguments, "limit").unwrap_or(100).min(200) as usize,
        ),
        "read_markdown" => read_markdown(library_path, required_string(arguments, "path", 2048)?),
        "search_documents" => search_documents(
            library_path,
            required_string(arguments, "query", 500)?,
            argument_u64(arguments, "limit")
                .unwrap_or(20)
                .min(MAX_DOCUMENT_RESULTS as u64) as usize,
        ),
        "web_search" => {
            web_search(
                required_string(arguments, "query", 500)?,
                argument_u64(arguments, "maxResults")
                    .unwrap_or(5)
                    .clamp(1, MAX_SEARCH_RESULTS),
            )
            .await
        }
        "generate_image" => {
            generate_image(
                required_string(arguments, "prompt", 8_000)?,
                arguments["size"].as_str().unwrap_or("1536x1024"),
            )
            .await
        }
        _ => Err("未知的 Loby 内置工具。".to_string()),
    }
}

fn list_documents(library_path: &Path, limit: usize) -> Result<ToolExecution, String> {
    let root = canonical_library(library_path)?;
    let mut paths = Vec::new();
    collect_markdown_paths(&root, &root, &mut paths, limit)?;
    paths.sort();
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({ "documents": paths }))
            .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn read_markdown(library_path: &Path, path: &str) -> Result<ToolExecution, String> {
    let (root, candidate) = resolve_markdown_path(library_path, path)?;
    let metadata = fs::metadata(&candidate).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err("单个 Markdown 文档超过 512 KB，不能直接发送给模型。".to_string());
    }
    let content = fs::read_to_string(&candidate).map_err(|error| error.to_string())?;
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({
            "path": relative_display(&root, &candidate),
            "content": content
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn search_documents(
    library_path: &Path,
    query: &str,
    limit: usize,
) -> Result<ToolExecution, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("搜索词不能为空。".to_string());
    }
    let root = canonical_library(library_path)?;
    let mut paths = Vec::new();
    collect_markdown_paths(&root, &root, &mut paths, 2_000)?;
    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();
    for relative in paths {
        let path = root.join(&relative);
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.len() > MAX_DOCUMENT_BYTES {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        if let Some(index) = content.to_lowercase().find(&query_lower) {
            let start = content[..index]
                .char_indices()
                .rev()
                .nth(120)
                .map(|(index, _)| index)
                .unwrap_or(0);
            let end = content[index..]
                .char_indices()
                .nth(240)
                .map(|(offset, _)| index + offset)
                .unwrap_or(content.len());
            matches.push(json!({
                "path": relative,
                "snippet": content[start..end].replace('\n', " ")
            }));
            if matches.len() >= limit {
                break;
            }
        }
    }
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({ "query": query, "matches": matches }))
            .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

async fn web_search(query: &str, max_results: u64) -> Result<ToolExecution, String> {
    let secret = read_provider_secret("tavily-search")?;
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| error.to_string())?
        .post("https://api.tavily.com/search")
        .bearer_auth(secret)
        .json(&json!({
            "query": query,
            "search_depth": "basic",
            "include_answer": false,
            "include_raw_content": false,
            "max_results": max_results
        }))
        .send()
        .await
        .map_err(|error| format!("联网搜索失败：{error}"))?;
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("搜索服务返回了无法解析的响应：{error}"))?;
    if !status.is_success() {
        return Err(format!("搜索服务请求失败（HTTP {}）。", status.as_u16()));
    }
    let results = value["results"]
        .as_array()
        .into_iter()
        .flatten()
        .take(max_results as usize)
        .map(|result| {
            json!({
                "title": result["title"].as_str().unwrap_or_default(),
                "url": result["url"].as_str().unwrap_or_default(),
                "content": result["content"].as_str().unwrap_or_default()
            })
        })
        .collect::<Vec<_>>();
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({ "query": query, "results": results }))
            .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

async fn generate_image(prompt: &str, size: &str) -> Result<ToolExecution, String> {
    if !matches!(size, "1024x1024" | "1536x1024" | "1024x1536") {
        return Err("图片尺寸无效。".to_string());
    }
    let secret = read_provider_secret("openai-api")?;
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| error.to_string())?
        .post("https://api.openai.com/v1/images/generations")
        .bearer_auth(secret)
        .json(&json!({
            "model": "gpt-image-2",
            "prompt": prompt,
            "size": size,
            "output_format": "png"
        }))
        .send()
        .await
        .map_err(|error| format!("图片生成失败：{error}"))?;
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("图片服务返回了无法解析的响应：{error}"))?;
    if !status.is_success() {
        return Err(format!("图片生成请求失败（HTTP {}）。", status.as_u16()));
    }
    let encoded = value["data"][0]["b64_json"]
        .as_str()
        .ok_or_else(|| "图片服务没有返回图片数据。".to_string())?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|_| "图片服务返回了无效图片数据。".to_string())?;
    let directory = generated_image_directory()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(format!("{}.png", Uuid::new_v4()));
    fs::write(&path, bytes).map_err(|error| error.to_string())?;
    let path = path.display().to_string();
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({ "status": "completed", "path": path }))
            .map_err(|error| error.to_string())?,
        artifact_path: Some(path),
    })
}

fn tool(name: &str, description: &str, input_schema: Value, effect: &str) -> ToolDefinition {
    ToolDefinition {
        name: name.to_string(),
        description: description.to_string(),
        input_schema,
        effect: effect.to_string(),
    }
}

fn canonical_library(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())
        .and_then(|path| {
            if path.is_dir() {
                Ok(path)
            } else {
                Err("当前写作库路径不是目录。".to_string())
            }
        })
}

fn resolve_markdown_path(library_path: &Path, path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = canonical_library(library_path)?;
    let supplied = PathBuf::from(path.trim());
    let candidate = if supplied.is_absolute() {
        supplied
    } else {
        root.join(supplied)
    }
    .canonicalize()
    .map_err(|_| "Markdown 文件不存在。".to_string())?;
    let relative = candidate
        .strip_prefix(&root)
        .map_err(|_| "只能读取当前写作库内的 Markdown。".to_string())?;
    if !candidate.is_file() || has_hidden_component(relative) || !is_markdown(&candidate) {
        return Err("只能读取当前写作库内的可见 Markdown 文件。".to_string());
    }
    Ok((root, candidate))
}

fn collect_markdown_paths(
    root: &Path,
    directory: &Path,
    output: &mut Vec<String>,
    limit: usize,
) -> Result<(), String> {
    if output.len() >= limit {
        return Ok(());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        if output.len() >= limit {
            break;
        }
        let path = entry.path();
        let relative = path.strip_prefix(root).unwrap_or(&path);
        if has_hidden_component(relative) || entry.file_type().is_ok_and(|kind| kind.is_symlink()) {
            continue;
        }
        if path.is_dir() {
            collect_markdown_paths(root, &path, output, limit)?;
        } else if path.is_file() && is_markdown(&path) {
            output.push(relative_display(root, &path));
        }
    }
    Ok(())
}

fn has_hidden_component(path: &Path) -> bool {
    path.components().any(|component| match component {
        Component::Normal(name) => name.to_string_lossy().starts_with('.'),
        _ => false,
    })
}

fn is_markdown(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("md" | "markdown")
    )
}

fn relative_display(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn required_string<'a>(arguments: &'a Value, key: &str, max: usize) -> Result<&'a str, String> {
    let value = arguments[key]
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("工具参数 {key} 不能为空。"))?;
    if value.len() > max || value.contains('\0') {
        return Err(format!("工具参数 {key} 无效。"));
    }
    Ok(value)
}

fn argument_u64(arguments: &Value, key: &str) -> Option<u64> {
    arguments[key].as_u64()
}

fn generated_image_directory() -> Result<PathBuf, String> {
    dirs::cache_dir()
        .map(|root| root.join("Loby").join("generated-images"))
        .ok_or_else(|| "无法确定 Loby 图片缓存目录。".to_string())
}

#[cfg(test)]
mod tests {
    use super::{read_markdown, search_documents};
    use std::fs;

    #[test]
    fn markdown_tools_reject_hidden_and_outside_files() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        fs::write(directory.path().join("visible.md"), "needle in visible")
            .map_err(|error| error.to_string())?;
        fs::create_dir(directory.path().join(".loby")).map_err(|error| error.to_string())?;
        fs::write(directory.path().join(".loby/hidden.md"), "needle in hidden")
            .map_err(|error| error.to_string())?;

        assert!(read_markdown(directory.path(), "visible.md")?
            .output
            .contains("visible"));
        assert!(read_markdown(directory.path(), ".loby/hidden.md").is_err());
        let results = search_documents(directory.path(), "needle", 10)?.output;
        assert!(results.contains("visible.md"));
        assert!(!results.contains("hidden.md"));
        Ok(())
    }
}
