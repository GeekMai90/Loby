//! [INPUT]: 依赖 Agent Skills `SKILL.md` 文本、serde_yaml 与共享诊断模型
//! [OUTPUT]: 提供开放 Agent Skills frontmatter 解析、名称规范化与 Loby 兼容性诊断
//! [POS]: Agent Skill 领域的纯格式层，不访问文件系统，也不决定安装位置或工具权限
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::AgentSkillDiagnostic;
use serde_yaml::Value as YamlValue;
use std::collections::BTreeMap;

pub(super) const COMPATIBLE: &str = "compatible";
pub(super) const ADAPTATION_REQUIRED: &str = "adaptation-required";
pub(super) const UNSUPPORTED: &str = "unsupported";

#[derive(Debug, Clone)]
pub(super) struct ParsedSkill {
    pub(super) name: String,
    pub(super) description: String,
    pub(super) compatibility: String,
    pub(super) diagnostics: Vec<AgentSkillDiagnostic>,
}

pub(super) fn parse_skill(source: &str, directory_name: &str, has_scripts: bool) -> ParsedSkill {
    let metadata = parse_frontmatter(source);
    let name = metadata
        .get("name")
        .cloned()
        .unwrap_or_else(|| directory_name.to_string());
    let description = metadata.get("description").cloned().unwrap_or_default();
    let mut diagnostics = Vec::new();

    if !is_valid_skill_name(&name) {
        diagnostics.push(error(
            "invalid-name",
            "name 必须是 1–64 位小写字母、数字或连字符，且不能以连字符开头或结尾。",
        ));
    }
    if name != directory_name {
        diagnostics.push(error(
            "directory-name-mismatch",
            "Skill 目录名必须与 frontmatter 中的 name 完全一致。",
        ));
    }
    if description.trim().is_empty() || description.chars().count() > 1024 {
        diagnostics.push(error(
            "invalid-description",
            "description 必须填写，且不能超过 1024 个字符。",
        ));
    }
    if source.trim().is_empty() || !source.contains("---") {
        diagnostics.push(error(
            "missing-frontmatter",
            "SKILL.md 缺少有效的 YAML frontmatter。",
        ));
    }

    if has_scripts {
        diagnostics.push(warning(
            "scripts-require-adaptation",
            "该 Skill 包含 scripts。落笔会保留脚本，但当前版本不会执行任意脚本。",
        ));
    }
    for (needle, code, message) in [
        (
            "~/.codex",
            "codex-path",
            "说明中引用了 Codex 私有目录，需要改为落笔写作库或 Skill 相对路径。",
        ),
        (
            "$CODEX_HOME",
            "codex-path",
            "说明中引用了 CODEX_HOME，需要改为落笔写作库或 Skill 相对路径。",
        ),
        (
            "~/.claude",
            "claude-path",
            "说明中引用了 Claude 私有目录，需要改为落笔写作库或 Skill 相对路径。",
        ),
        (
            "mcp__",
            "host-tool-name",
            "说明中包含宿主专用 MCP 工具名，安装后需要映射到落笔可用工具。",
        ),
        (
            "image_gen",
            "host-tool-name",
            "说明中包含宿主专用图片工具名，应改用落笔的 generate_image。",
        ),
        (
            "imagegen",
            "host-tool-name",
            "说明中包含宿主专用图片工具名，应改用落笔的 generate_image。",
        ),
        (
            "Bash",
            "shell-tool",
            "说明中要求 Bash/命令执行；落笔当前不开放任意 shell。",
        ),
        (
            "Shell",
            "shell-tool",
            "说明中要求 Shell/命令执行；落笔当前不开放任意 shell。",
        ),
        (
            "Task tool",
            "subagent-tool",
            "说明中要求宿主的子代理工具，需要改写为落笔支持的工作流。",
        ),
    ] {
        if source.contains(needle) && !diagnostics.iter().any(|item| item.code == code) {
            diagnostics.push(warning(code, message));
        }
    }
    if contains_absolute_user_path(source) {
        diagnostics.push(warning(
            "absolute-path",
            "说明中疑似包含固定的本机绝对路径，需要迁移为当前写作库或 Skill 包内相对路径。",
        ));
    }

    let compatibility = if diagnostics.iter().any(|item| item.level == "error") {
        UNSUPPORTED
    } else if diagnostics.iter().any(|item| item.level == "warning") {
        ADAPTATION_REQUIRED
    } else {
        COMPATIBLE
    };
    ParsedSkill {
        name,
        description,
        compatibility: compatibility.to_string(),
        diagnostics,
    }
}

pub(super) fn normalize_skill_id(value: &str) -> String {
    let mut normalized = value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }
    normalized.trim_matches('-').chars().take(64).collect()
}

pub(super) fn is_valid_skill_name(value: &str) -> bool {
    let length = value.len();
    length > 0
        && length <= 64
        && !value.starts_with('-')
        && !value.ends_with('-')
        && !value.contains("--")
        && value.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn parse_frontmatter(source: &str) -> BTreeMap<String, String> {
    let normalized = source.replace("\r\n", "\n");
    let mut metadata = BTreeMap::new();
    let Some(frontmatter) = normalized
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

fn contains_absolute_user_path(source: &str) -> bool {
    source.contains("/Users/") || source.contains("C:\\Users\\") || source.contains("/home/")
}

fn warning(code: &str, message: &str) -> AgentSkillDiagnostic {
    diagnostic("warning", code, message)
}

fn error(code: &str, message: &str) -> AgentSkillDiagnostic {
    diagnostic("error", code, message)
}

fn diagnostic(level: &str, code: &str, message: &str) -> AgentSkillDiagnostic {
    AgentSkillDiagnostic {
        level: level.to_string(),
        code: code.to_string(),
        message: message.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_skill_id, parse_skill, ADAPTATION_REQUIRED, COMPATIBLE, UNSUPPORTED};

    #[test]
    fn accepts_open_agent_skill_frontmatter() {
        let parsed = parse_skill(
            "---\nname: article-polish\ndescription: 轻量润色\n---\n# Workflow",
            "article-polish",
            false,
        );
        assert_eq!(parsed.compatibility, COMPATIBLE);
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn reports_host_specific_instructions_for_adaptation() {
        let parsed = parse_skill(
            "---\nname: cover\ndescription: 配图\n---\nCall image_gen and save to /Users/example/output.png",
            "cover",
            false,
        );
        assert_eq!(parsed.compatibility, ADAPTATION_REQUIRED);
        assert!(parsed
            .diagnostics
            .iter()
            .any(|item| item.code == "host-tool-name"));
        assert!(parsed
            .diagnostics
            .iter()
            .any(|item| item.code == "absolute-path"));
    }

    #[test]
    fn rejects_invalid_standard_name() {
        let parsed = parse_skill(
            "---\nname: Article Polish\ndescription: test\n---\n",
            "article-polish",
            false,
        );
        assert_eq!(parsed.compatibility, UNSUPPORTED);
    }

    #[test]
    fn normalizes_conversation_draft_names() {
        assert_eq!(normalize_skill_id(" Every 配图 "), "every");
        assert_eq!(normalize_skill_id("Article  Polish"), "article-polish");
    }

    #[test]
    fn bundled_skill_creator_does_not_diagnose_its_migration_checklist_as_a_dependency() {
        let parsed = parse_skill(
            include_str!("../../../skills/skill-creator/SKILL.md"),
            "skill-creator",
            false,
        );
        assert_eq!(parsed.compatibility, COMPATIBLE);
        assert!(parsed.diagnostics.is_empty());
    }
}
