//! [INPUT]: 依赖用户 config 目录、活动写作库、应用随附 skills 与 Provider 模型目录
//! [OUTPUT]: 向 renderer 提供 Loby Skill 发现/受控说明读取和按 Provider 隔离的模型目录
//! [POS]: 本地 AI agent 领域的能力发现层，不读取任何外部 AI 客户端配置
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::providers;
use crate::models::{AgentModelCatalog, AgentSkill, AgentSkillInstruction};
use serde_yaml::Value as YamlValue;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_SKILL_INSTRUCTION_BYTES: usize = 96 * 1024;

#[tauri::command]
pub(crate) fn list_agent_skills(library_path: Option<String>) -> Result<Vec<AgentSkill>, String> {
    let roots = skill_roots(library_path.as_deref())?;
    let mut skills = BTreeMap::<String, AgentSkill>::new();
    for root in roots {
        collect_skills(&root, &mut skills);
    }
    Ok(skills.into_values().collect())
}

#[tauri::command]
pub(crate) fn read_agent_skill_instructions(
    library_path: Option<String>,
    paths: Vec<String>,
) -> Result<Vec<AgentSkillInstruction>, String> {
    let roots = skill_roots(library_path.as_deref())?
        .into_iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    paths
        .into_iter()
        .map(|path| read_skill_instruction(&roots, &path))
        .collect()
}

#[tauri::command]
pub(crate) fn list_agent_models(provider: String) -> Result<AgentModelCatalog, String> {
    providers::model_catalog(&provider)
}

fn skill_roots(library_path: Option<&str>) -> Result<Vec<PathBuf>, String> {
    let mut roots = Vec::new();
    if let Some(config) = dirs::config_dir() {
        roots.push(config.join("Loby").join("skills"));
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../skills"));
    if let Some(path) = library_path.map(str::trim).filter(|path| !path.is_empty()) {
        let root = PathBuf::from(path)
            .canonicalize()
            .map_err(|_| "当前写作库路径无效，无法发现 Skill。".to_string())?;
        roots.push(root.join(".loby").join("skills"));
    }
    Ok(roots)
}

fn collect_skills(root: &Path, skills: &mut BTreeMap<String, AgentSkill>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut entries = entries.filter_map(Result::ok).collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let directory = entry.path();
        if !directory.is_dir() {
            continue;
        }
        let skill_file = directory.join("SKILL.md");
        let Ok(source) = fs::read_to_string(&skill_file) else {
            continue;
        };
        let metadata = parse_skill_metadata(&source);
        let fallback = directory
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("skill")
            .to_string();
        let name = metadata
            .get("name")
            .filter(|value| !value.trim().is_empty())
            .cloned()
            .unwrap_or(fallback);
        let id = normalize_skill_id(&name);
        if id.is_empty() {
            continue;
        }
        skills.insert(
            id.clone(),
            AgentSkill {
                id,
                name,
                description: metadata.get("description").cloned().unwrap_or_default(),
                path: skill_file.display().to_string(),
            },
        );
    }
}

fn read_skill_instruction(roots: &[PathBuf], path: &str) -> Result<AgentSkillInstruction, String> {
    let requested = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "Skill 文件不存在。".to_string())?;
    if requested.file_name().and_then(|name| name.to_str()) != Some("SKILL.md")
        || !requested.is_file()
        || !roots.iter().any(|root| requested.starts_with(root))
    {
        return Err("Skill 文件不在 Loby 允许的目录中。".to_string());
    }
    let bytes = fs::read(&requested).map_err(|error| error.to_string())?;
    let truncated = bytes.len() > MAX_SKILL_INSTRUCTION_BYTES;
    let visible = &bytes[..bytes.len().min(MAX_SKILL_INSTRUCTION_BYTES)];
    let instructions = String::from_utf8_lossy(visible).to_string();
    Ok(AgentSkillInstruction {
        path: requested.display().to_string(),
        instructions,
        truncated,
    })
}

fn parse_skill_metadata(source: &str) -> BTreeMap<String, String> {
    let mut metadata = BTreeMap::new();
    let Some(frontmatter) = source
        .strip_prefix("---\n")
        .and_then(|source| source.split_once("\n---"))
        .map(|(frontmatter, _)| frontmatter)
    else {
        return metadata;
    };
    let Ok(YamlValue::Mapping(mapping)) = serde_yaml::from_str::<YamlValue>(frontmatter) else {
        return metadata;
    };
    for key in ["name", "description"] {
        let yaml_key = YamlValue::String(key.to_string());
        if let Some(value) = mapping.get(&yaml_key).and_then(YamlValue::as_str) {
            metadata.insert(key.to_string(), value.trim().to_string());
        }
    }
    metadata
}

fn normalize_skill_id(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::{normalize_skill_id, parse_skill_metadata};

    #[test]
    fn parses_only_stable_skill_metadata() {
        let metadata = parse_skill_metadata(
            "---\nname: article-polish\ndescription: 轻量润色\nextra: ignored\n---\n# Skill",
        );
        assert_eq!(
            metadata.get("name").map(String::as_str),
            Some("article-polish")
        );
        assert_eq!(
            metadata.get("description").map(String::as_str),
            Some("轻量润色")
        );
        assert!(!metadata.contains_key("extra"));
    }

    #[test]
    fn normalizes_skill_ids_without_path_semantics() {
        assert_eq!(normalize_skill_id("Article Polish"), "article-polish");
        assert_eq!(normalize_skill_id("../unsafe"), "unsafe");
    }
}
