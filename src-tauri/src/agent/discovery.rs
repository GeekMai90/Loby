use super::process::{agent_binary_name, normalize_agent_provider, resolve_agent_command};
use crate::fs_paths::safe_file_segment;
use crate::models::{
    CodexModelCatalog, CodexModelOption, CodexProbeResult, CodexProbeStep, CodexReasoningLevel,
    CodexServiceTier, CodexSkill, CodexSkillInstruction,
};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_SKILL_INSTRUCTION_BYTES: usize = 80_000;

#[tauri::command]
pub(crate) fn list_codex_skills() -> Result<Vec<CodexSkill>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let mut system_skills = Vec::new();
    collect_skills(
        &home.join(".codex").join("skills").join(".system"),
        0,
        None,
        &mut system_skills,
    )?;
    system_skills.sort_by(|a, b| a.name.cmp(&b.name));

    let mut user_skills = Vec::new();
    collect_skills(
        &home.join(".codex").join("skills"),
        0,
        None,
        &mut user_skills,
    )?;
    collect_skills(
        &home.join(".agents").join("skills"),
        0,
        None,
        &mut user_skills,
    )?;
    for cache_name in ["openai-bundled", "openai-curated", "openai-primary-runtime"] {
        collect_plugin_cache_skills(
            &home
                .join(".codex")
                .join("plugins")
                .join("cache")
                .join(cache_name),
            &mut user_skills,
        )?;
    }
    user_skills.sort_by(|a, b| a.name.cmp(&b.name));

    let mut seen = HashSet::new();
    Ok(system_skills
        .into_iter()
        .chain(user_skills)
        .filter(|skill| seen.insert(skill.name.clone()))
        .collect())
}

#[tauri::command]
pub(crate) fn read_codex_skill_instructions(
    paths: Vec<String>,
) -> Result<Vec<CodexSkillInstruction>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };
    let allowed_roots = codex_skill_roots(&home);
    let mut results = Vec::new();

    for raw_path in paths {
        let requested_path = PathBuf::from(&raw_path);
        let Ok(canonical_path) = fs::canonicalize(&requested_path) else {
            continue;
        };
        if !is_allowed_skill_file(&canonical_path, &allowed_roots) {
            continue;
        }

        let mut file = fs::File::open(&canonical_path).map_err(|error| error.to_string())?;
        let mut buffer = Vec::new();
        file.by_ref()
            .take((MAX_SKILL_INSTRUCTION_BYTES + 1) as u64)
            .read_to_end(&mut buffer)
            .map_err(|error| error.to_string())?;
        let truncated = buffer.len() > MAX_SKILL_INSTRUCTION_BYTES;
        if truncated {
            buffer.truncate(MAX_SKILL_INSTRUCTION_BYTES);
        }
        results.push(CodexSkillInstruction {
            path: raw_path,
            instructions: String::from_utf8_lossy(&buffer).to_string(),
            truncated,
        });
    }

    Ok(results)
}

#[tauri::command]
pub(crate) fn list_codex_models() -> Result<CodexModelCatalog, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(empty_codex_model_catalog());
    };

    let config = fs::read_to_string(home.join(".codex").join("config.toml")).unwrap_or_default();
    let current_model = toml_value(&config, "model").unwrap_or_else(|| "auto".to_string());
    let current_reasoning_effort =
        toml_value(&config, "model_reasoning_effort").unwrap_or_else(|| "medium".to_string());
    let cache_path = home.join(".codex").join("models_cache.json");
    let Ok(raw) = fs::read_to_string(cache_path) else {
        return Ok(CodexModelCatalog {
            fetched_at: String::new(),
            current_model,
            current_reasoning_effort,
            models: Vec::new(),
        });
    };

    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    let fetched_at = value
        .get("fetched_at")
        .and_then(|item| item.as_str())
        .unwrap_or_default()
        .to_string();
    let models = value
        .get("models")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(parse_codex_model_option)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(CodexModelCatalog {
        fetched_at,
        current_model,
        current_reasoning_effort,
        models,
    })
}

#[tauri::command]
pub(crate) fn probe_agent_cli(
    provider: String,
    cli_path: Option<String>,
) -> Result<CodexProbeResult, String> {
    let provider = normalize_agent_provider(&provider);
    let binary = agent_binary_name(&provider);
    let Some(agent_path) = resolve_agent_command(&provider, cli_path) else {
        return Ok(CodexProbeResult {
            resolved_path: String::new(),
            ok: false,
            steps: vec![CodexProbeStep {
                name: "resolve".to_string(),
                ok: false,
                command: format!("command -v {}", binary),
                stdout: String::new(),
                stderr: format!("Cannot find {} on PATH or configured path.", binary),
            }],
        });
    };

    let steps = if provider == "claude" {
        vec![
            run_probe_step(&agent_path, "version", &["--version"]),
            run_probe_step(&agent_path, "print_help", &["--help"]),
        ]
    } else {
        vec![
            run_probe_step(&agent_path, "version", &["--version"]),
            run_probe_step(&agent_path, "exec_help", &["exec", "--help"]),
        ]
    };
    let ok = steps.iter().all(|step| step.ok);
    Ok(CodexProbeResult {
        resolved_path: agent_path,
        ok,
        steps,
    })
}

fn empty_codex_model_catalog() -> CodexModelCatalog {
    CodexModelCatalog {
        fetched_at: String::new(),
        current_model: "auto".to_string(),
        current_reasoning_effort: "medium".to_string(),
        models: Vec::new(),
    }
}

fn parse_codex_model_option(value: &serde_json::Value) -> Option<CodexModelOption> {
    let slug = value.get("slug")?.as_str()?.to_string();
    if value
        .get("visibility")
        .and_then(|item| item.as_str())
        .unwrap_or("list")
        == "hidden"
    {
        return None;
    }

    let supported_reasoning_levels = value
        .get("supported_reasoning_levels")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(CodexReasoningLevel {
                        effort: item.get("effort")?.as_str()?.to_string(),
                        description: item
                            .get("description")
                            .and_then(|description| description.as_str())
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let additional_speed_tiers = value
        .get("additional_speed_tiers")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let service_tiers = value
        .get("service_tiers")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(CodexServiceTier {
                        id: item.get("id")?.as_str()?.to_string(),
                        name: item
                            .get("name")
                            .and_then(|name| name.as_str())
                            .unwrap_or_default()
                            .to_string(),
                        description: item
                            .get("description")
                            .and_then(|description| description.as_str())
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(CodexModelOption {
        slug,
        display_name: value
            .get("display_name")
            .and_then(|item| item.as_str())
            .unwrap_or_default()
            .to_string(),
        description: value
            .get("description")
            .and_then(|item| item.as_str())
            .unwrap_or_default()
            .to_string(),
        default_reasoning_level: value
            .get("default_reasoning_level")
            .and_then(|item| item.as_str())
            .unwrap_or("medium")
            .to_string(),
        supported_reasoning_levels,
        additional_speed_tiers,
        service_tiers,
    })
}

fn run_probe_step(codex_path: &str, name: &str, args: &[&str]) -> CodexProbeStep {
    let output = Command::new(codex_path).args(args).output();
    match output {
        Ok(output) => CodexProbeStep {
            name: name.to_string(),
            ok: output.status.success(),
            command: format!("{} {}", codex_path, args.join(" ")),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        },
        Err(error) => CodexProbeStep {
            name: name.to_string(),
            ok: false,
            command: format!("{} {}", codex_path, args.join(" ")),
            stdout: String::new(),
            stderr: error.to_string(),
        },
    }
}

fn collect_skills(
    root: &Path,
    depth: usize,
    prefix: Option<&str>,
    skills: &mut Vec<CodexSkill>,
) -> Result<(), String> {
    if depth > 5 || !root.exists() {
        return Ok(());
    }
    for entry in sorted_directory_entries(root)? {
        let path = entry.path();
        if !path.is_dir() || should_skip_skill_path(&path) {
            continue;
        }
        let skill_file = path.join("SKILL.md");
        if skill_file.exists() {
            if let Ok(raw) = fs::read_to_string(&skill_file) {
                let fallback_name = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("unknown-skill")
                    .to_string();
                let raw_name = frontmatter_value(&raw, "name").unwrap_or(fallback_name);
                let name = prefix
                    .map(|prefix| format!("{prefix}:{raw_name}"))
                    .unwrap_or(raw_name);
                skills.push(CodexSkill {
                    id: safe_file_segment(&name),
                    name,
                    description: frontmatter_value(&raw, "description").unwrap_or_default(),
                    path: skill_file.display().to_string(),
                });
            }
        } else {
            collect_skills(&path, depth + 1, prefix, skills)?;
        }
    }
    Ok(())
}

fn codex_skill_roots(home: &Path) -> Vec<PathBuf> {
    [
        home.join(".codex").join("skills"),
        home.join(".agents").join("skills"),
        home.join(".codex").join("plugins").join("cache"),
    ]
    .into_iter()
    .filter_map(|path| fs::canonicalize(path).ok())
    .collect()
}

fn is_allowed_skill_file(path: &Path, allowed_roots: &[PathBuf]) -> bool {
    path.file_name().and_then(|name| name.to_str()) == Some("SKILL.md")
        && path.is_file()
        && allowed_roots.iter().any(|root| path.starts_with(root))
}

fn collect_plugin_cache_skills(
    cache_root: &Path,
    skills: &mut Vec<CodexSkill>,
) -> Result<(), String> {
    if !cache_root.exists() {
        return Ok(());
    }
    for plugin_entry in sorted_directory_entries(cache_root)? {
        let plugin_path = plugin_entry.path();
        if !plugin_path.is_dir() || should_skip_skill_path(&plugin_path) {
            continue;
        }
        let Some(plugin_name) = plugin_path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        for version_entry in sorted_directory_entries(&plugin_path)? {
            collect_skills(
                &version_entry.path().join("skills"),
                0,
                Some(plugin_name),
                skills,
            )?;
        }
    }
    Ok(())
}

fn sorted_directory_entries(root: &Path) -> Result<Vec<fs::DirEntry>, String> {
    let mut entries = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    Ok(entries)
}

fn should_skip_skill_path(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    name == ".deprecated"
        || name == ".system"
        || name.starts_with("plugin-backup-")
        || name.starts_with("plugin-install-")
}

fn frontmatter_value(raw: &str, key: &str) -> Option<String> {
    raw.lines().take(20).find_map(|line| {
        let (line_key, value) = line.split_once(':')?;
        if line_key.trim() != key {
            return None;
        }
        Some(
            value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string(),
        )
    })
}

fn toml_value(raw: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} = ");
    raw.lines().find_map(|line| {
        let value = line.trim().strip_prefix(&prefix)?;
        Some(value.trim().trim_matches('"').to_string())
    })
}
