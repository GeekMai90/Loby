//! [INPUT]: 依赖活动写作库、应用 bundle resources、Agent Skills 格式层/导入清单与本地文件系统
//! [OUTPUT]: 提供 Skill 发现、会话创建/迁移、启停、删除、渐进激活、有界资源目录与 UTF-8 分页读取命令
//! [POS]: Agent Skill 领域的确定性仓库层；模型可以提出写入，但不能绕过本层校验和 Agent 审批
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::skill_format::{
    normalize_skill_id, parse_skill, COMPATIBLE, MAX_COMPATIBLE_SKILL_SOURCE_BYTES, UNSUPPORTED,
};
use super::skill_import::{
    bounded_file_catalog, inventory, safe_relative_path, MAX_SKILL_FILE_BYTES,
};
use crate::models::{AgentSkill, AgentSkillDraft, AgentSkillInstruction};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

const MAX_CREATED_SKILL_INSTRUCTION_BYTES: usize = 40 * 1024;
const MAX_SKILL_RESOURCE_SLICE_BYTES: usize = 32 * 1024;
const MAX_SKILL_RESOURCE_PAYLOAD_BYTES: usize = 48 * 1024;

#[derive(Debug, Default, Deserialize, Serialize)]
struct SkillState {
    #[serde(default = "state_version")]
    version: u8,
    #[serde(default)]
    enabled: BTreeMap<String, bool>,
}

#[derive(Debug, Clone)]
struct SkillRoot {
    path: PathBuf,
    source: &'static str,
}

#[tauri::command]
pub(crate) fn list_agent_skills(
    app: tauri::AppHandle,
    library_path: Option<String>,
) -> Result<Vec<AgentSkill>, String> {
    list_skills(&app, library_path.as_deref())
}

#[tauri::command]
pub(crate) fn read_agent_skill_instructions(
    app: tauri::AppHandle,
    library_path: Option<String>,
    paths: Vec<String>,
) -> Result<Vec<AgentSkillInstruction>, String> {
    let roots = skill_roots(&app, library_path.as_deref())?
        .into_iter()
        .filter_map(|root| root.path.canonicalize().ok())
        .collect::<Vec<_>>();
    paths
        .into_iter()
        .map(|path| read_skill_instruction(&roots, &path))
        .collect()
}

#[tauri::command]
pub(crate) fn create_agent_skill(
    app: tauri::AppHandle,
    library_path: String,
    draft: AgentSkillDraft,
) -> Result<AgentSkill, String> {
    let library = canonical_library(&library_path)?;
    create_skill(&app, &library, draft)
}

#[tauri::command]
pub(crate) fn set_agent_skill_enabled(
    app: tauri::AppHandle,
    library_path: String,
    skill_id: String,
    enabled: bool,
) -> Result<AgentSkill, String> {
    let library = canonical_library(&library_path)?;
    let skill = find_skill(&app, &library, &skill_id)?;
    if enabled && skill.compatibility != COMPATIBLE {
        return Err("该 Skill 需要先完成适配，确认兼容后才能启用。".to_string());
    }
    set_enabled_value(&library, &skill.source, &skill.id, enabled)?;
    find_skill(&app, &library, &skill_id)
}

#[tauri::command]
pub(crate) fn delete_agent_skill(
    app: tauri::AppHandle,
    library_path: String,
    skill_id: String,
) -> Result<Vec<AgentSkill>, String> {
    let library = canonical_library(&library_path)?;
    let skill = find_skill(&app, &library, &skill_id)?;
    if skill.source != "library" {
        return Err("应用内置 Skill 不能删除。".to_string());
    }
    let root = library_skill_root(&library);
    let directory = PathBuf::from(&skill.path)
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?
        .canonicalize()
        .map_err(|_| "Skill 目录不存在。".to_string())?;
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "Skill 根目录不存在。".to_string())?;
    if directory.parent() != Some(canonical_root.as_path()) {
        return Err("只能删除当前写作库中的一级 Skill 目录。".to_string());
    }
    fs::remove_dir_all(&directory).map_err(|error| format!("删除 Skill 失败：{error}"))?;
    set_enabled_value(&library, "library", &skill.id, false)?;
    list_skills(&app, Some(library.to_string_lossy().as_ref()))
}

#[tauri::command]
pub(crate) fn ensure_agent_skill_directory(library_path: String) -> Result<String, String> {
    let library = canonical_library(&library_path)?;
    let root = library_skill_root(&library);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root.display().to_string())
}

pub(super) fn catalog_for_prompt(app: &tauri::AppHandle, library: &Path) -> String {
    let Ok(skills) = list_skills(app, Some(library.to_string_lossy().as_ref())) else {
        return String::new();
    };
    let available = skills
        .iter()
        .filter(|skill| skill.enabled && skill.compatibility == COMPATIBLE)
        .map(|skill| format!("- {}：{}", skill.id, skill.description))
        .collect::<Vec<_>>();
    let pending = skills
        .iter()
        .filter(|skill| {
            skill.source == "library" && !skill.enabled && skill.compatibility != UNSUPPORTED
        })
        .map(|skill| {
            format!(
                "- {}：{}（{}）",
                skill.id, skill.description, skill.compatibility
            )
        })
        .collect::<Vec<_>>();
    if available.is_empty() && pending.is_empty() {
        String::new()
    } else {
        let mut sections = Vec::new();
        if !available.is_empty() {
            sections.push(format!(
                "可用 Skills（需要时先调用 activate_skill；不要根据名称猜测完整工作流）：\n{}",
                available.join("\n")
            ));
        }
        if !pending.is_empty() {
            sections.push(format!(
                "待适配 Skills（仅在用户要求迁移时调用 inspect_skill_package 检查）：\n{}",
                pending.join("\n")
            ));
        }
        sections.join("\n\n")
    }
}

pub(super) fn inspect_skill_for_migration(
    app: &tauri::AppHandle,
    library: &Path,
    skill_id: &str,
) -> Result<String, String> {
    let skill = find_skill(app, library, skill_id)?;
    if skill.source != "library" {
        return Err("只有当前写作库中的 Skill 需要迁移检查。".to_string());
    }
    let source = fs::read_to_string(&skill.path).map_err(|error| error.to_string())?;
    if source.len() > MAX_COMPATIBLE_SKILL_SOURCE_BYTES {
        return Err(
            "该 Skill 的 SKILL.md 超过自动迁移预算；请先在原目录把细节拆到 references 后重新导入。"
                .to_string(),
        );
    }
    let directory = Path::new(&skill.path)
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let package = inventory(directory)?;
    let (files, files_truncated) = bounded_file_catalog(&package.files);
    let diagnostics = skill
        .diagnostics
        .iter()
        .map(|item| format!("- [{}] {}", item.code, item.message))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!(
        "Skill: {} ({})\nCompatibility: {}\nScripts executable: false\nDiagnostics:\n{}\nFiles{}:\n{}\n\n--- BEGIN SKILL.md ---\n{}\n--- END SKILL.md ---\n\nNext: 逐项把宿主专用路径、工具和执行步骤映射为落笔能力，向用户展示修改摘要；确认后调用 update_skill。",
        skill.name,
        skill.id,
        skill.compatibility,
        if diagnostics.is_empty() { "- none" } else { &diagnostics },
        if files_truncated { " (truncated)" } else { "" },
        files.join("\n"),
        source,
    ))
}

pub(super) fn activate_skill(
    app: &tauri::AppHandle,
    library: &Path,
    skill_id: &str,
) -> Result<String, String> {
    let skill = find_skill(app, library, skill_id)?;
    if !skill.enabled || skill.compatibility != COMPATIBLE {
        return Err("该 Skill 当前未启用。".to_string());
    }
    let instructions = fs::read_to_string(&skill.path).map_err(|error| error.to_string())?;
    let directory = Path::new(&skill.path)
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let inventory = inventory(directory)?;
    let resources = inventory
        .files
        .into_iter()
        .filter(|path| path != "SKILL.md")
        .collect::<Vec<_>>();
    let (resources, resources_truncated) = bounded_file_catalog(&resources);
    Ok(format!(
        "Skill: {} ({})\nDescription: {}\nCompatibility: {}\nScripts executable: false\nResources{}:\n{}\n\n--- BEGIN SKILL.md ---\n{}\n--- END SKILL.md ---",
        skill.name,
        skill.id,
        skill.description,
        skill.compatibility,
        if resources_truncated { " (truncated)" } else { "" },
        if resources.is_empty() {
            "- none".to_string()
        } else {
            resources.join("\n")
        },
        instructions,
    ))
}

pub(super) fn read_skill_resource(
    app: &tauri::AppHandle,
    library: &Path,
    skill_id: &str,
    relative_path: &str,
    offset: usize,
    max_bytes: usize,
) -> Result<String, String> {
    let skill = find_skill(app, library, skill_id)?;
    if !skill.enabled || skill.compatibility != COMPATIBLE {
        return Err("该 Skill 当前未启用。".to_string());
    }
    let directory = Path::new(&skill.path)
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let candidate = resolve_skill_resource(directory, relative_path)?;
    let metadata = fs::metadata(&candidate).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_SKILL_FILE_BYTES {
        return Err("Skill 资源超过 4 MB，不能载入模型上下文。".to_string());
    }
    let bytes = fs::read(&candidate).map_err(|error| error.to_string())?;
    skill_resource_payload(relative_path, &bytes, offset, max_bytes)
}

fn skill_resource_payload(
    relative_path: &str,
    bytes: &[u8],
    offset: usize,
    max_bytes: usize,
) -> Result<String, String> {
    let Ok(content) = std::str::from_utf8(bytes) else {
        return serde_json::to_string(&json!({
            "path": relative_path,
            "binary": true,
            "sizeBytes": bytes.len(),
            "next": "二进制资源不会把本机绝对路径发送给模型；图片请通过 generate_image 的 skillId + referencePaths 使用。",
        }))
        .map_err(|error| error.to_string());
    };
    if offset > content.len() {
        return Err("Skill 资源 offset 超出文件范围。".to_string());
    }
    let mut start = offset;
    while start < content.len() && !content.is_char_boundary(start) {
        start += 1;
    }
    let limit = max_bytes.clamp(1_024, MAX_SKILL_RESOURCE_SLICE_BYTES);
    let mut end = start.saturating_add(limit).min(content.len());
    while end > start && !content.is_char_boundary(end) {
        end -= 1;
    }
    loop {
        let payload = serde_json::to_string(&json!({
            "path": relative_path,
            "content": &content[start..end],
            "startByte": start,
            "endByte": end,
            "totalBytes": content.len(),
            "truncated": end < content.len(),
            "nextOffset": (end < content.len()).then_some(end),
        }))
        .map_err(|error| error.to_string())?;
        if payload.len() <= MAX_SKILL_RESOURCE_PAYLOAD_BYTES || end == start {
            return Ok(payload);
        }
        let shrink_by = (payload.len() - MAX_SKILL_RESOURCE_PAYLOAD_BYTES).max(1_024);
        end = end.saturating_sub(shrink_by).max(start);
        while end > start && !content.is_char_boundary(end) {
            end -= 1;
        }
    }
}

pub(super) fn resolve_skill_image_resources(
    app: &tauri::AppHandle,
    library: &Path,
    skill_id: &str,
    relative_paths: &[String],
) -> Result<Vec<PathBuf>, String> {
    if relative_paths.is_empty() || relative_paths.len() > 8 {
        return Err("参考图数量必须在 1 到 8 张之间。".to_string());
    }
    let skill = find_skill(app, library, skill_id)?;
    if !skill.enabled || skill.compatibility != COMPATIBLE {
        return Err("该 Skill 当前未启用。".to_string());
    }
    let directory = Path::new(&skill.path)
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let mut total_bytes = 0_u64;
    let mut images = Vec::with_capacity(relative_paths.len());
    for relative_path in relative_paths {
        let candidate = resolve_skill_resource(directory, relative_path)?;
        if !is_supported_reference_image(&candidate) {
            return Err("参考图只支持 PNG、JPEG 和 WebP。".to_string());
        }
        let metadata = fs::metadata(&candidate).map_err(|error| error.to_string())?;
        if metadata.len() > MAX_SKILL_FILE_BYTES {
            return Err("单张 Skill 参考图不能超过 4 MB。".to_string());
        }
        total_bytes = total_bytes.saturating_add(metadata.len());
        if total_bytes > 16 * 1024 * 1024 {
            return Err("Skill 参考图总大小不能超过 16 MB。".to_string());
        }
        images.push(candidate);
    }
    Ok(images)
}

fn resolve_skill_resource(directory: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = safe_relative_path(relative_path)?;
    if relative == Path::new("SKILL.md") || relative.starts_with("scripts") {
        return Err("请通过 activate_skill 读取说明；当前版本不开放 Skill 脚本。".to_string());
    }
    let directory = directory
        .canonicalize()
        .map_err(|_| "Skill 目录不存在。".to_string())?;
    let candidate = directory
        .join(relative)
        .canonicalize()
        .map_err(|_| "Skill 资源不存在。".to_string())?;
    if !candidate.starts_with(&directory) || !candidate.is_file() {
        return Err("Skill 资源路径无效。".to_string());
    }
    Ok(candidate)
}

fn is_supported_reference_image(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp")
    )
}

pub(super) fn create_skill_from_tool(
    app: &tauri::AppHandle,
    library: &Path,
    name: &str,
    description: &str,
    instructions: &str,
) -> Result<String, String> {
    let skill = create_skill(
        app,
        library,
        AgentSkillDraft {
            name: name.to_string(),
            description: description.to_string(),
            instructions: instructions.to_string(),
        },
    )?;
    serde_json::to_string(&json!({
        "status": "created",
        "skill": skill,
        "message": "Skill 已保存到当前写作库；后续对话可通过 / 菜单或自然语言调用。",
    }))
    .map_err(|error| error.to_string())
}

pub(super) fn update_skill_from_tool(
    app: &tauri::AppHandle,
    library: &Path,
    skill_id: &str,
    description: &str,
    instructions: &str,
) -> Result<String, String> {
    let skill = find_skill(app, library, skill_id)?;
    if skill.source != "library" {
        return Err("应用内置 Skill 不能通过对话修改。".to_string());
    }
    validate_draft_content(description, instructions)?;
    let path = PathBuf::from(&skill.path);
    let content = build_skill_source(&skill.id, description.trim(), instructions.trim())?;
    let parent = path
        .parent()
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    use std::io::Write;
    temporary
        .write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    temporary
        .persist(&path)
        .map_err(|error| error.error.to_string())?;
    let updated = find_skill(app, library, &skill.id)?;
    let enabled = updated.compatibility == "compatible";
    set_enabled_value(library, "library", &skill.id, enabled)?;
    let updated = find_skill(app, library, &skill.id)?;
    serde_json::to_string(&json!({
        "status": "updated",
        "skill": updated,
        "message": if enabled { "适配完成并已启用。" } else { "工作流已更新，但仍有兼容性提示，暂未启用。" },
    }))
    .map_err(|error| error.to_string())
}

fn list_skills(
    app: &tauri::AppHandle,
    library_path: Option<&str>,
) -> Result<Vec<AgentSkill>, String> {
    let library = library_path
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(canonical_library)
        .transpose()?;
    let state = library.as_deref().map(load_state).unwrap_or_default();
    let mut skills = BTreeMap::<String, AgentSkill>::new();
    for root in skill_roots(app, library_path)? {
        collect_skills(&root, &state, &mut skills);
    }
    Ok(skills.into_values().collect())
}

fn skill_roots(
    app: &tauri::AppHandle,
    library_path: Option<&str>,
) -> Result<Vec<SkillRoot>, String> {
    let mut roots = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(SkillRoot {
            path: resource_dir.join("skills"),
            source: "builtin",
        });
    }
    let source_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../skills");
    if source_root.exists() {
        roots.push(SkillRoot {
            path: source_root,
            source: "builtin",
        });
    }
    if let Some(path) = library_path.map(str::trim).filter(|path| !path.is_empty()) {
        let library = canonical_library(path)?;
        roots.push(SkillRoot {
            path: library_skill_root(&library),
            source: "library",
        });
    }
    Ok(roots)
}

fn collect_skills(root: &SkillRoot, state: &SkillState, skills: &mut BTreeMap<String, AgentSkill>) {
    let Ok(entries) = fs::read_dir(&root.path) else {
        return;
    };
    let mut entries = entries.filter_map(Result::ok).collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let directory = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&directory) else {
            continue;
        };
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            continue;
        }
        let skill_file = directory.join("SKILL.md");
        let Ok(source) = fs::read_to_string(&skill_file) else {
            continue;
        };
        let directory_name = directory
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        let Ok(package) = inventory(&directory) else {
            continue;
        };
        let parsed = parse_skill(&source, directory_name, package.has_scripts);
        let id = normalize_skill_id(&parsed.name);
        if id.is_empty() {
            continue;
        }
        let state_key = state_key(root.source, &id);
        let enabled = state
            .enabled
            .get(&state_key)
            .copied()
            .unwrap_or(parsed.compatibility == COMPATIBLE);
        skills.insert(
            id.clone(),
            AgentSkill {
                id,
                name: parsed.name,
                description: parsed.description,
                path: skill_file.display().to_string(),
                source: root.source.to_string(),
                compatibility: parsed.compatibility,
                enabled,
                diagnostics: parsed.diagnostics,
                resource_count: package.files.len().saturating_sub(1),
                has_scripts: package.has_scripts,
            },
        );
    }
}

fn create_skill(
    app: &tauri::AppHandle,
    library: &Path,
    draft: AgentSkillDraft,
) -> Result<AgentSkill, String> {
    let name = normalize_skill_id(&draft.name);
    if name.is_empty() {
        return Err("Skill 名称至少需要包含英文字母或数字。".to_string());
    }
    let description = draft.description.trim();
    let instructions = draft.instructions.trim();
    validate_draft_content(description, instructions)?;
    let root = library_skill_root(library);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let destination = root.join(&name);
    if destination.exists() {
        return Err(format!(
            "Skill“{name}”已经存在；请先在设置中删除或换一个名称。"
        ));
    }
    let content = build_skill_source(&name, description, instructions)?;
    let staging = root.join(format!(".creating-{}", Uuid::new_v4()));
    fs::create_dir(&staging).map_err(|error| error.to_string())?;
    if let Err(error) = fs::write(staging.join("SKILL.md"), content) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error.to_string());
    }
    if let Err(error) = fs::rename(&staging, &destination) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error.to_string());
    }
    set_enabled_value(library, "library", &name, true)?;
    find_skill(app, library, &name)
}

fn validate_draft_content(description: &str, instructions: &str) -> Result<(), String> {
    if description.trim().is_empty() || description.chars().count() > 1024 {
        return Err("Skill 描述不能为空且不能超过 1024 个字符。".to_string());
    }
    if instructions.trim().is_empty() || instructions.len() > MAX_CREATED_SKILL_INSTRUCTION_BYTES {
        return Err(
            "Skill 工作流不能为空且不能超过 40 KB；更长细节请拆到 references。".to_string(),
        );
    }
    if instructions.trim_start().starts_with("---") {
        return Err("工作流正文不能重复包含 YAML frontmatter。".to_string());
    }
    Ok(())
}

fn build_skill_source(name: &str, description: &str, instructions: &str) -> Result<String, String> {
    let metadata = BTreeMap::from([
        ("name", name.to_string()),
        ("description", description.to_string()),
    ]);
    let yaml = serde_yaml::to_string(&metadata).map_err(|error| error.to_string())?;
    Ok(format!("---\n{}---\n\n{}\n", yaml, instructions))
}

pub(super) fn find_skill(
    app: &tauri::AppHandle,
    library: &Path,
    id: &str,
) -> Result<AgentSkill, String> {
    let normalized = normalize_skill_id(id);
    list_skills(app, Some(library.to_string_lossy().as_ref()))?
        .into_iter()
        .find(|skill| skill.id == normalized)
        .ok_or_else(|| "Skill 不存在。".to_string())
}

fn read_skill_instruction(roots: &[PathBuf], path: &str) -> Result<AgentSkillInstruction, String> {
    let requested = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "Skill 文件不存在。".to_string())?;
    if requested.file_name().and_then(|name| name.to_str()) != Some("SKILL.md")
        || !requested.is_file()
        || !roots.iter().any(|root| requested.starts_with(root))
    {
        return Err("Skill 文件不在落笔允许的目录中。".to_string());
    }
    let bytes = fs::read(&requested).map_err(|error| error.to_string())?;
    let truncated = bytes.len() > MAX_COMPATIBLE_SKILL_SOURCE_BYTES;
    let mut end = bytes.len().min(MAX_COMPATIBLE_SKILL_SOURCE_BYTES);
    while end > 0 && std::str::from_utf8(&bytes[..end]).is_err() {
        end -= 1;
    }
    Ok(AgentSkillInstruction {
        path: requested.display().to_string(),
        instructions: String::from_utf8_lossy(&bytes[..end]).to_string(),
        truncated,
    })
}

pub(super) fn canonical_library(path: &str) -> Result<PathBuf, String> {
    PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())
        .and_then(|path| {
            if path.is_dir() {
                Ok(path)
            } else {
                Err("当前写作库路径不是目录。".to_string())
            }
        })
}

pub(super) fn library_skill_root(library: &Path) -> PathBuf {
    library.join(".agents").join("skills")
}

fn state_path(library: &Path) -> PathBuf {
    library.join(".loby").join("skill-state.json")
}

fn load_state(library: &Path) -> SkillState {
    fs::read_to_string(state_path(library))
        .ok()
        .and_then(|source| serde_json::from_str(&source).ok())
        .unwrap_or_default()
}

pub(super) fn set_enabled_value(
    library: &Path,
    source: &str,
    id: &str,
    enabled: bool,
) -> Result<(), String> {
    let path = state_path(library);
    let parent = path
        .parent()
        .ok_or_else(|| "Skill 状态路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let mut state = load_state(library);
    state.version = state_version();
    state.enabled.insert(state_key(source, id), enabled);
    let bytes = serde_json::to_vec_pretty(&state).map_err(|error| error.to_string())?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    use std::io::Write;
    temporary
        .write_all(&bytes)
        .map_err(|error| error.to_string())?;
    temporary
        .persist(&path)
        .map_err(|error| error.error.to_string())?;
    Ok(())
}

fn state_key(source: &str, id: &str) -> String {
    format!("{source}:{id}")
}

const fn state_version() -> u8 {
    1
}

#[cfg(test)]
mod tests {
    use super::{resolve_skill_resource, skill_resource_payload};
    use std::fs;

    #[test]
    fn skill_resources_cannot_escape_or_enter_scripts() -> Result<(), String> {
        let parent = tempfile::tempdir().map_err(|error| error.to_string())?;
        let skill = parent.path().join("skill");
        fs::create_dir_all(skill.join("assets")).map_err(|error| error.to_string())?;
        fs::create_dir_all(skill.join("scripts")).map_err(|error| error.to_string())?;
        fs::write(skill.join("assets/reference.png"), b"png").map_err(|error| error.to_string())?;
        fs::write(skill.join("scripts/run.sh"), b"exit 0").map_err(|error| error.to_string())?;
        fs::write(parent.path().join("outside.png"), b"png").map_err(|error| error.to_string())?;

        assert!(resolve_skill_resource(&skill, "assets/reference.png").is_ok());
        assert!(resolve_skill_resource(&skill, "scripts/run.sh").is_err());
        assert!(resolve_skill_resource(&skill, "../outside.png").is_err());
        Ok(())
    }

    #[test]
    fn text_resources_are_paginated_without_breaking_utf8() -> Result<(), String> {
        let content = "开头".repeat(8_000);
        let first = skill_resource_payload("references/long.md", content.as_bytes(), 0, 4_096)?;
        let first: serde_json::Value = serde_json::from_str(&first).unwrap();
        let next = first["nextOffset"].as_u64().unwrap() as usize;
        assert!(first["truncated"].as_bool().unwrap());
        assert!(content.is_char_boundary(next));
        assert!(!first["content"].as_str().unwrap().contains('�'));

        let second = skill_resource_payload("references/long.md", content.as_bytes(), next, 4_096)?;
        let second: serde_json::Value = serde_json::from_str(&second).unwrap();
        assert_eq!(second["startByte"].as_u64(), Some(next as u64));
        Ok(())
    }

    #[test]
    fn binary_resources_do_not_expose_local_paths() -> Result<(), String> {
        let payload =
            skill_resource_payload("assets/reference.png", &[0xff, 0xd8, 0xff], 0, 4_096)?;
        assert!(payload.contains("\"binary\":true"));
        assert!(!payload.contains("/Users/"));
        assert!(!payload.contains("localPath"));
        Ok(())
    }

    #[test]
    fn escaped_text_resource_payload_stays_below_tool_result_budget() -> Result<(), String> {
        let content = "\0".repeat(32 * 1024);
        let payload =
            skill_resource_payload("references/control.md", content.as_bytes(), 0, 32 * 1024)?;
        assert!(payload.len() <= 48 * 1024);
        let payload: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert!(payload["truncated"].as_bool().unwrap());
        Ok(())
    }
}
