//! [INPUT]: 依赖活动写作库路径、当前对话明确的本地参考目录、Agent Skill 仓库、自动联网搜索路由、图片 Provider 与 Agent runtime 设置
//! [OUTPUT]: 向 Agent Loop 提供区分 Provider/display/execution identity 且带封闭 ToolEffect 的 ToolDefinition，以及有界 Markdown、只读本地目录参考、Skill 资源/外部路径、Provider-neutral 联网搜索和图片工具
//! [POS]: 本地 AI agent 领域的内置工具注册表；写作正文修改仍只能进入 Loby 审阅协议
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::AgentRuntimeSettings;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};

const MAX_DOCUMENT_BYTES: u64 = 512 * 1024;
const MAX_DOCUMENT_RESULTS: usize = 40;
const MAX_SEARCH_SCAN_BYTES: u64 = 32 * 1024 * 1024;
const MAX_SEARCH_RESULTS: u64 = 10;
const MAX_LOCAL_REFERENCE_FILES: usize = 64;
const MAX_LOCAL_REFERENCE_BATCH_FILES: usize = 8;
const MAX_LOCAL_REFERENCE_BATCH_CONTENT_BYTES: usize = 56 * 1024;
const MAX_LOCAL_REFERENCE_FILE_BYTES: u64 = 48 * 1024;
const MAX_LOCAL_REFERENCE_SCAN_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ToolDefinition {
    /// Provider 可见且满足各家 function name 约束的稳定名称。
    pub(crate) name: String,
    /// 面向作者的本地化名称，不参与 Provider tool identity。
    pub(crate) display_name: String,
    /// 外部 transport 的原始执行名称；内置工具与 provider name 相同，因此为空。
    pub(crate) execution_name: Option<String>,
    pub(crate) description: String,
    pub(crate) input_schema: Value,
    pub(crate) effect: ToolEffect,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ToolEffect {
    Read,
    Network,
    Write,
    Proposal,
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
            ToolEffect::Read,
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
            ToolEffect::Read,
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
            ToolEffect::Read,
        ),
        tool(
            "read_local_directory",
            "读取用户在当前对话中明确提供的本地目录中的文本样式文件。首次只传目录 path 列出候选文件；随后优先用 files 一次读取多个目录内相对路径，也可以传 file 读取单个文件或传 query 搜索文件内容。只能读取用户明确提供的目录，不能猜测其他路径。",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "用户消息中明确提供的本地目录绝对路径" },
                    "file": { "type": "string", "description": "目录内相对文件路径；与 files/query 二选一" },
                    "files": {
                        "type": "array",
                        "description": "目录内相对文件路径数组；最多一次读取 8 个文件，与 file/query 二选一",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "maxItems": 8
                    },
                    "query": { "type": "string", "description": "在目录内样式文件中搜索的文本；与 file/files 二选一" },
                    "maxFiles": { "type": "integer", "minimum": 1, "maximum": 64 }
                },
                "required": ["path"],
                "additionalProperties": false
            }),
            ToolEffect::Read,
        ),
        tool(
            "activate_skill",
            "按 id 激活一个已安装的 Skill，读取完整工作流和包内资源清单。需要使用 Skill 时必须先调用。",
            json!({
                "type": "object",
                "properties": { "skillId": { "type": "string" } },
                "required": ["skillId"],
                "additionalProperties": false
            }),
            ToolEffect::Read,
        ),
        tool(
            "read_skill_resource",
            "分页读取已激活 Skill 的 references 文本或检查 assets 资源。脚本不会被执行，二进制资源不会暴露本机绝对路径。",
            json!({
                "type": "object",
                "properties": {
                    "skillId": { "type": "string" },
                    "path": { "type": "string" },
                    "offset": { "type": "integer", "minimum": 0 },
                    "maxBytes": { "type": "integer", "minimum": 1024, "maximum": 32768 }
                },
                "required": ["skillId", "path"],
                "additionalProperties": false
            }),
            ToolEffect::Read,
        ),
        tool(
            "inspect_skill_package",
            "读取当前写作库中一个待迁移 Skill 的原始说明、兼容性诊断和资源清单。该工具可以检查尚未启用的 Skill。",
            json!({
                "type": "object",
                "properties": { "skillId": { "type": "string" } },
                "required": ["skillId"],
                "additionalProperties": false
            }),
            ToolEffect::Read,
        ),
        tool(
            "inspect_external_skill",
            "检查用户在本轮对话中明确提供的单个本地 Skill 目录、SKILL.md、.skill 或 .zip 路径，返回兼容性和文件诊断。不得猜测路径或扫描相邻目录。",
            json!({
                "type": "object",
                "properties": {
                    "sourcePath": { "type": "string", "description": "用户明确提供的绝对路径或 ~/ 开头路径" }
                },
                "required": ["sourcePath"],
                "additionalProperties": false
            }),
            ToolEffect::Read,
        ),
        tool(
            "install_external_skill",
            "把已经预检且用户决定安装的外部 Skill 复制到当前写作库。兼容 Skill 自动启用，待适配 Skill 保持停用；调用需要用户审批。",
            json!({
                "type": "object",
                "properties": {
                    "sourcePath": { "type": "string", "description": "必须与 inspect_external_skill 预检的明确路径一致" }
                },
                "required": ["sourcePath"],
                "additionalProperties": false
            }),
            ToolEffect::Write,
        ),
        tool(
            "create_skill",
            "把已经与用户讨论并确认的可复用工作流保存为当前写作库的开放 Agent Skill。调用前必须确认名称、用途、触发场景和步骤。",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "小写英文、数字和连字符组成的稳定名称" },
                    "description": { "type": "string", "description": "说明用途和触发场景" },
                    "instructions": { "type": "string", "description": "不含 frontmatter 的 Markdown 工作流正文" }
                },
                "required": ["name", "description", "instructions"],
                "additionalProperties": false
            }),
            ToolEffect::Write,
        ),
        tool(
            "update_skill",
            "在用户确认后更新当前写作库中已有 Skill 的描述和工作流正文，保留 references、assets 和 scripts。用于适配或迭代，不可修改内置 Skill。",
            json!({
                "type": "object",
                "properties": {
                    "skillId": { "type": "string" },
                    "description": { "type": "string" },
                    "instructions": { "type": "string", "description": "不含 frontmatter 的完整 Markdown 工作流正文" }
                },
                "required": ["skillId", "description", "instructions"],
                "additionalProperties": false
            }),
            ToolEffect::Write,
        ),
        tool(
            "web_search",
            "联网搜索资料，返回标题、URL 与来源摘要。自动优先使用当前连接的原生搜索，不支持时使用通用搜索。",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "maxResults": { "type": "integer", "minimum": 1, "maximum": 10 }
                },
                "required": ["query"],
                "additionalProperties": false
            }),
            ToolEffect::Network,
        ),
        tool(
            "generate_image",
            "根据提示词生成文章图片；也可使用已启用 Skill 包内的参考图。返回 Loby 临时成果路径，进入正文前仍需作者确认。",
            json!({
                "type": "object",
                "properties": {
                    "prompt": { "type": "string" },
                    "size": { "type": "string", "enum": ["1024x1024", "1536x1024", "1024x1536"] },
                    "skillId": { "type": "string", "description": "使用参考图时所属的已启用 Skill id" },
                    "referencePaths": {
                        "type": "array",
                        "description": "相对 Skill 根目录的参考图路径；只支持 PNG、JPEG、WebP",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "maxItems": 5
                    }
                },
                "required": ["prompt"],
                "additionalProperties": false
            }),
            ToolEffect::Network,
        ),
    ]
}

pub(super) async fn execute_builtin_tool(
    app: &tauri::AppHandle,
    library_path: &Path,
    local_directory_paths: &[String],
    conversation_provider: &str,
    runtime: &AgentRuntimeSettings,
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
        "read_local_directory" => read_local_directory(
            local_directory_paths,
            required_string(arguments, "path", 4_096)?,
            optional_string(arguments, "file", 4_096)?,
            &optional_string_array(arguments, "files", MAX_LOCAL_REFERENCE_BATCH_FILES, 4_096)?,
            optional_string(arguments, "query", 500)?,
            argument_u64(arguments, "maxFiles")
                .unwrap_or(24)
                .clamp(1, MAX_LOCAL_REFERENCE_FILES as u64) as usize,
        ),
        "activate_skill" => super::skill_store::activate_skill(
            app,
            library_path,
            required_string(arguments, "skillId", 128)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "read_skill_resource" => super::skill_store::read_skill_resource(
            app,
            library_path,
            required_string(arguments, "skillId", 128)?,
            required_string(arguments, "path", 2048)?,
            argument_u64(arguments, "offset").unwrap_or_default() as usize,
            argument_u64(arguments, "maxBytes").unwrap_or(32 * 1024) as usize,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "inspect_skill_package" => super::skill_store::inspect_skill_for_migration(
            app,
            library_path,
            required_string(arguments, "skillId", 128)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "inspect_external_skill" => super::skill_import::inspect_external_skill_for_tool(
            required_string(arguments, "sourcePath", 4096)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "install_external_skill" => super::skill_import::install_external_skill_for_tool(
            app,
            library_path,
            required_string(arguments, "sourcePath", 4096)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "create_skill" => super::skill_store::create_skill_from_tool(
            app,
            library_path,
            required_string(arguments, "name", 128)?,
            required_string(arguments, "description", 2048)?,
            required_string(arguments, "instructions", 96 * 1024)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "update_skill" => super::skill_store::update_skill_from_tool(
            app,
            library_path,
            required_string(arguments, "skillId", 128)?,
            required_string(arguments, "description", 2048)?,
            required_string(arguments, "instructions", 96 * 1024)?,
        )
        .map(|output| ToolExecution {
            output,
            artifact_path: None,
        }),
        "web_search" => {
            super::web_search::search(
                conversation_provider,
                runtime,
                required_string(arguments, "query", 500)?,
                argument_u64(arguments, "maxResults")
                    .unwrap_or(5)
                    .clamp(1, MAX_SEARCH_RESULTS),
            )
            .await
        }
        "generate_image" => {
            let reference_paths = optional_string_array(arguments, "referencePaths", 5, 2048)?;
            let skill_id = arguments["skillId"].as_str().map(str::trim);
            let references = if reference_paths.is_empty() {
                Vec::new()
            } else {
                let skill_id = skill_id
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "使用 Skill 参考图时必须提供 skillId。".to_string())?;
                super::skill_store::resolve_skill_image_resources(
                    app,
                    library_path,
                    skill_id,
                    &reference_paths,
                )?
            };
            super::image_generation::generate_image(
                conversation_provider,
                runtime,
                required_string(arguments, "prompt", 8_000)?,
                arguments["size"].as_str().unwrap_or("1536x1024"),
                &references,
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
    let mut scanned_bytes = 0_u64;
    let mut scan_truncated = false;
    for relative in paths {
        let path = root.join(&relative);
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.len() > MAX_DOCUMENT_BYTES {
            continue;
        }
        if !reserve_search_scan_bytes(&mut scanned_bytes, metadata.len()) {
            scan_truncated = true;
            break;
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
        output: serde_json::to_string(&json!({
            "query": query,
            "matches": matches,
            "scannedBytes": scanned_bytes,
            "scanTruncated": scan_truncated
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn read_local_directory(
    allowed_paths: &[String],
    requested_path: &str,
    file: Option<&str>,
    requested_files: &[String],
    query: Option<&str>,
    max_files: usize,
) -> Result<ToolExecution, String> {
    if file.is_some() && (!requested_files.is_empty() || query.is_some())
        || !requested_files.is_empty() && query.is_some()
    {
        return Err("file、files 和 query 只能三选一。".to_string());
    }
    let root = resolve_local_reference_root(allowed_paths, requested_path)?;
    if let Some(file) = file {
        return read_local_reference_file(&root, file);
    }
    if !requested_files.is_empty() {
        return read_local_reference_files(&root, requested_files);
    }
    if let Some(query) = query {
        return search_local_reference_files(&root, query, max_files);
    }

    let mut files = Vec::new();
    let mut scanned_bytes = 0_u64;
    let mut truncated = false;
    collect_local_reference_files(
        &root,
        &root,
        &mut files,
        max_files,
        &mut scanned_bytes,
        &mut truncated,
    )?;
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({
            "directory": root.file_name().and_then(|name| name.to_str()).unwrap_or("参考目录"),
            "files": files,
            "scannedBytes": scanned_bytes,
            "truncated": truncated,
            "next": "从 files.path 选择样式文件，再用同一个 path 和 file 参数读取内容。"
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn resolve_local_reference_root(
    allowed_paths: &[String],
    requested_path: &str,
) -> Result<PathBuf, String> {
    let requested = expand_user_path(requested_path)?;
    if !requested.is_absolute() {
        return Err("本地参考目录必须使用用户消息中明确提供的绝对路径。".to_string());
    }
    let root = requested
        .canonicalize()
        .map_err(|_| "用户提供的本地参考目录不存在或无法读取。".to_string())?;
    if !root.is_dir() || is_symlink(&requested) {
        return Err("本地参考路径必须是可读取的真实目录。".to_string());
    }

    let allowed = allowed_paths.iter().filter_map(|path| {
        let path = expand_user_path(path).ok()?;
        if is_symlink(&path) {
            return None;
        }
        let path = path.canonicalize().ok()?;
        path.is_dir().then_some(path)
    });
    if allowed.into_iter().any(|path| root.starts_with(path)) {
        Ok(root)
    } else {
        Err("只能读取当前对话中用户明确提供的本地目录。".to_string())
    }
}

fn read_local_reference_file(root: &Path, relative_path: &str) -> Result<ToolExecution, String> {
    let value = read_local_reference_file_value(root, relative_path)?;
    Ok(ToolExecution {
        output: serde_json::to_string(&value).map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn read_local_reference_files(
    root: &Path,
    relative_paths: &[String],
) -> Result<ToolExecution, String> {
    let mut content_bytes = 0_usize;
    let files = relative_paths
        .iter()
        .map(|path| {
            let mut value = read_local_reference_file_value(root, path)?;
            let file_bytes = value["content"].as_str().map(str::len).unwrap_or_default();
            if content_bytes.saturating_add(file_bytes) > MAX_LOCAL_REFERENCE_BATCH_CONTENT_BYTES {
                value["content"] =
                    json!("[批量读取结果超过上下文预算，请单独调用 file 读取该文件]");
                value["truncated"] = json!(true);
            } else {
                content_bytes += file_bytes;
            }
            Ok(value)
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({
            "files": files,
            "count": relative_paths.len(),
            "contentBytes": content_bytes,
            "next": "已读取这些参考文件；除非仍缺少必要信息，否则直接完成分析或主题修改。"
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn read_local_reference_file_value(root: &Path, relative_path: &str) -> Result<Value, String> {
    let path = resolve_local_reference_file(root, relative_path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_LOCAL_REFERENCE_FILE_BYTES {
        return Err("这个参考文件超过 48 KB，不能直接发送给模型。".to_string());
    }
    let content = fs::read_to_string(&path)
        .map_err(|_| "参考文件不是可读取的 UTF-8 文本文件。".to_string())?;
    Ok(json!({
        "file": relative_display(root, &path),
        "content": redact_local_reference_content(&content),
        "truncated": false
    }))
}

fn search_local_reference_files(
    root: &Path,
    query: &str,
    max_files: usize,
) -> Result<ToolExecution, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("本地参考目录搜索词不能为空。".to_string());
    }
    let mut files = Vec::new();
    let mut scanned_bytes = 0_u64;
    let mut truncated = false;
    collect_local_reference_files(
        root,
        root,
        &mut files,
        MAX_LOCAL_REFERENCE_FILES,
        &mut scanned_bytes,
        &mut truncated,
    )?;
    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();
    for file in files.iter().filter_map(|file| file["path"].as_str()) {
        let path = root.join(file);
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.len() > MAX_LOCAL_REFERENCE_FILE_BYTES {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let content = redact_local_reference_content(&content);
        let Some(line) = content
            .lines()
            .find(|line| line.to_lowercase().contains(&query_lower))
        else {
            continue;
        };
        matches.push(json!({
            "path": file,
            "snippet": line.chars().take(480).collect::<String>()
        }));
        if matches.len() >= max_files {
            break;
        }
    }
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({
            "query": query,
            "matches": matches,
            "scannedBytes": scanned_bytes,
            "truncated": truncated
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: None,
    })
}

fn collect_local_reference_files(
    root: &Path,
    directory: &Path,
    output: &mut Vec<Value>,
    max_files: usize,
    scanned_bytes: &mut u64,
    truncated: &mut bool,
) -> Result<(), String> {
    if output.len() >= max_files {
        *truncated = true;
        return Ok(());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        if output.len() >= max_files {
            *truncated = true;
            break;
        }
        let path = entry.path();
        let relative = path.strip_prefix(root).unwrap_or(&path);
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() || has_hidden_component(relative) {
            continue;
        }
        if file_type.is_dir() {
            if is_ignored_local_reference_directory(&path) {
                continue;
            }
            collect_local_reference_files(
                root,
                &path,
                output,
                max_files,
                scanned_bytes,
                truncated,
            )?;
            continue;
        }
        if !file_type.is_file() || !is_local_reference_text_file(&path) {
            continue;
        }
        let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
        if !reserve_local_reference_scan_bytes(scanned_bytes, metadata.len()) {
            *truncated = true;
            break;
        }
        output.push(json!({
            "path": relative_display(root, &path),
            "sizeBytes": metadata.len(),
            "readable": metadata.len() <= MAX_LOCAL_REFERENCE_FILE_BYTES
        }));
    }
    Ok(())
}

fn resolve_local_reference_file(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = PathBuf::from(relative_path.trim().replace('\\', "/"));
    if relative.as_os_str().is_empty()
        || relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("参考文件必须是目录内的相对路径。".to_string());
    }
    let candidate = root.join(relative);
    let path = candidate
        .canonicalize()
        .map_err(|_| "参考文件不存在或无法读取。".to_string())?;
    if !path.starts_with(root) || has_symlink_between(root, &path) {
        return Err("参考文件不能通过符号链接或路径逃逸访问。".to_string());
    }
    if !path.is_file() || !is_local_reference_text_file(&path) {
        return Err("只能读取目录内受支持的文本样式文件。".to_string());
    }
    Ok(path)
}

fn has_symlink_between(root: &Path, path: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            continue;
        };
        current.push(name);
        if is_symlink(&current) {
            return true;
        }
    }
    false
}

fn expand_user_path(path: &str) -> Result<PathBuf, String> {
    let path = path.trim();
    if let Some(relative) = path.strip_prefix("~/") {
        let home = std::env::var_os("HOME").ok_or_else(|| "无法解析用户目录。".to_string())?;
        return Ok(PathBuf::from(home).join(relative));
    }
    Ok(PathBuf::from(path))
}

fn is_symlink(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
}

fn is_ignored_local_reference_directory(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some("node_modules" | "target" | "dist" | "build" | "coverage" | ".git")
    )
}

fn is_local_reference_text_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if name.starts_with(".env")
        || name.contains("secret")
        || name.contains("credential")
        || name.contains("token")
        || name.ends_with(".pem")
        || name.ends_with(".key")
        || name.ends_with(".lock")
    {
        return false;
    }
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some(
            "css"
                | "scss"
                | "less"
                | "html"
                | "htm"
                | "json"
                | "md"
                | "markdown"
                | "ts"
                | "tsx"
                | "js"
                | "jsx"
                | "vue"
                | "yaml"
                | "yml"
                | "toml"
        )
    )
}

fn reserve_local_reference_scan_bytes(scanned_bytes: &mut u64, next_bytes: u64) -> bool {
    let Some(total) = scanned_bytes.checked_add(next_bytes) else {
        return false;
    };
    if total > MAX_LOCAL_REFERENCE_SCAN_BYTES {
        return false;
    }
    *scanned_bytes = total;
    true
}

fn redact_local_reference_content(content: &str) -> String {
    content
        .lines()
        .map(|line| {
            let lower = line.to_ascii_lowercase();
            let sensitive_key = [
                "api_key",
                "apikey",
                "client_secret",
                "app_secret",
                "password",
                "access_token",
                "refresh_token",
                "authorization",
            ]
            .iter()
            .any(|key| lower.contains(key));
            if (sensitive_key && (line.contains('=') || line.contains(':')))
                || lower.contains("bearer ")
                || lower.contains("sk-")
            {
                "[本地参考中的敏感配置已隐藏]".to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn tool(name: &str, description: &str, input_schema: Value, effect: ToolEffect) -> ToolDefinition {
    ToolDefinition {
        name: name.to_string(),
        display_name: name.to_string(),
        execution_name: None,
        description: description.to_string(),
        input_schema,
        effect,
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

fn reserve_search_scan_bytes(scanned_bytes: &mut u64, next_bytes: u64) -> bool {
    let Some(total) = scanned_bytes.checked_add(next_bytes) else {
        return false;
    };
    if total > MAX_SEARCH_SCAN_BYTES {
        return false;
    }
    *scanned_bytes = total;
    true
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

fn optional_string<'a>(
    arguments: &'a Value,
    key: &str,
    max: usize,
) -> Result<Option<&'a str>, String> {
    let Some(value) = arguments.get(key) else {
        return Ok(None);
    };
    let value = value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("工具参数 {key} 必须是非空字符串。"))?;
    if value.len() > max || value.contains('\0') {
        return Err(format!("工具参数 {key} 无效。"));
    }
    Ok(Some(value))
}

fn argument_u64(arguments: &Value, key: &str) -> Option<u64> {
    arguments[key].as_u64()
}

fn optional_string_array(
    arguments: &Value,
    key: &str,
    max_items: usize,
    max_item_bytes: usize,
) -> Result<Vec<String>, String> {
    let Some(values) = arguments.get(key) else {
        return Ok(Vec::new());
    };
    let values = values
        .as_array()
        .ok_or_else(|| format!("工具参数 {key} 必须是字符串数组。"))?;
    if values.is_empty() || values.len() > max_items {
        return Err(format!("工具参数 {key} 数量无效。"));
    }
    values
        .iter()
        .map(|value| {
            let value = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| format!("工具参数 {key} 包含无效路径。"))?;
            if value.len() > max_item_bytes || value.contains('\0') {
                return Err(format!("工具参数 {key} 包含无效路径。"));
            }
            Ok(value.to_string())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        builtin_tool_definitions, optional_string_array, read_local_directory, read_markdown,
        reserve_search_scan_bytes, search_documents, ToolEffect, MAX_SEARCH_SCAN_BYTES,
    };
    use serde_json::json;
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

    #[test]
    fn reference_path_arguments_are_bounded_strings() {
        assert_eq!(
            optional_string_array(&json!({}), "referencePaths", 5, 2048).unwrap(),
            Vec::<String>::new()
        );
        assert!(optional_string_array(
            &json!({ "referencePaths": ["assets/one.png", 2] }),
            "referencePaths",
            5,
            2048,
        )
        .is_err());
    }

    #[test]
    fn external_skill_inspection_is_read_only_but_installation_requires_approval() {
        let tools = builtin_tool_definitions();
        let inspect = tools
            .iter()
            .find(|tool| tool.name == "inspect_external_skill")
            .unwrap();
        let install = tools
            .iter()
            .find(|tool| tool.name == "install_external_skill")
            .unwrap();
        assert_eq!(inspect.effect, ToolEffect::Read);
        assert_eq!(install.effect, ToolEffect::Write);
    }

    #[test]
    fn document_search_scan_budget_is_cumulative_and_overflow_safe() {
        let mut scanned = MAX_SEARCH_SCAN_BYTES - 10;
        assert!(reserve_search_scan_bytes(&mut scanned, 10));
        assert_eq!(scanned, MAX_SEARCH_SCAN_BYTES);
        assert!(!reserve_search_scan_bytes(&mut scanned, 1));
        assert!(!reserve_search_scan_bytes(&mut scanned, u64::MAX));
    }

    #[test]
    fn local_directory_tool_reads_only_explicit_style_files() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let styles = directory.path().join("src").join("styles");
        fs::create_dir_all(&styles).map_err(|error| error.to_string())?;
        fs::write(styles.join("theme.css"), ":root { --accent: #4F6FFF; }")
            .map_err(|error| error.to_string())?;
        fs::write(styles.join("theme.png"), b"not text").map_err(|error| error.to_string())?;
        fs::write(directory.path().join(".env"), "SECRET=hidden")
            .map_err(|error| error.to_string())?;
        fs::write(
            directory.path().join("settings.json"),
            "{\n  \"apiKey\": \"sk-live-secret\",\n  \"theme\": \"cream\"\n}",
        )
        .map_err(|error| error.to_string())?;

        let root = directory.path().display().to_string();
        let inventory =
            read_local_directory(std::slice::from_ref(&root), &root, None, &[], None, 64)?;
        assert!(inventory.output.contains("src/styles/theme.css"));
        assert!(!inventory.output.contains("theme.png"));
        assert!(!inventory.output.contains(".env"));

        let file = read_local_directory(
            std::slice::from_ref(&root),
            &root,
            Some("src/styles/theme.css"),
            &[],
            None,
            64,
        )?;
        assert!(file.output.contains("--accent"));
        let settings = read_local_directory(
            std::slice::from_ref(&root),
            &root,
            Some("settings.json"),
            &[],
            None,
            64,
        )?;
        assert!(!settings.output.contains("sk-live-secret"));
        assert!(settings.output.contains("cream"));
        let batch = read_local_directory(
            std::slice::from_ref(&root),
            &root,
            None,
            &[
                "src/styles/theme.css".to_string(),
                "settings.json".to_string(),
            ],
            None,
            64,
        )?;
        assert!(batch.output.contains("--accent"));
        assert!(batch.output.contains("cream"));
        assert!(read_local_directory(
            &[directory.path().join("other").display().to_string()],
            &root,
            Some("src/styles/theme.css"),
            &[],
            None,
            64,
        )
        .is_err());
        Ok(())
    }
}
