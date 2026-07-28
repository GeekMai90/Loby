//! [INPUT]: 依赖 fs_paths 原子写入、serde、写作库 `.loby/ai/runs` 目录与 Runtime 请求身份
//! [OUTPUT]: 向 Runtime 和 renderer 提供未完成运行的持久化、安全替换、列举、阶段更新与显式清除
//! [POS]: Loby Agent 的崩溃恢复日志边界；只记录可安全重试的用户意图和阶段，不自动重放可能产生副作用的工具
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunCheckpoint {
    pub(crate) version: u8,
    pub(crate) request_id: String,
    pub(crate) conversation_id: String,
    pub(crate) provider: String,
    pub(crate) prompt: String,
    pub(crate) status: String,
    pub(crate) tool_name: String,
    pub(crate) reason: String,
    pub(crate) updated_at_ms: u64,
}

#[derive(Clone, Copy)]
pub(super) struct AgentRunCheckpointUpdate<'a> {
    pub(super) library_path: &'a Path,
    pub(super) request_id: &'a str,
    pub(super) conversation_id: &'a str,
    pub(super) provider: &'a str,
    pub(super) prompt: &'a str,
    pub(super) status: &'a str,
    pub(super) tool_name: &'a str,
    pub(super) reason: &'a str,
}

pub(super) fn write_run_checkpoint(update: AgentRunCheckpointUpdate<'_>) -> Result<(), String> {
    validate_request_id(update.request_id)?;
    let checkpoint = AgentRunCheckpoint {
        version: 1,
        request_id: update.request_id.to_string(),
        conversation_id: update.conversation_id.to_string(),
        provider: update.provider.to_string(),
        prompt: update.prompt.to_string(),
        status: update.status.to_string(),
        tool_name: update.tool_name.to_string(),
        reason: update.reason.to_string(),
        updated_at_ms: now_ms(),
    };
    let payload = serde_json::to_vec_pretty(&checkpoint).map_err(|error| error.to_string())?;
    write_if_changed(
        &checkpoint_path(update.library_path, update.request_id),
        payload,
    )?;
    Ok(())
}

pub(super) fn write_run_checkpoint_replacing(
    update: AgentRunCheckpointUpdate<'_>,
    superseded_request_id: Option<&str>,
) -> Result<(), String> {
    if let Some(superseded) = superseded_request_id {
        validate_request_id(superseded)?;
        if superseded == update.request_id {
            return Err("AI 恢复请求不能替换自己。".to_string());
        }
    }
    write_run_checkpoint(update)?;
    if let Some(superseded) = superseded_request_id {
        if let Err(error) = remove_run_checkpoint(update.library_path, superseded) {
            let _ = remove_run_checkpoint(update.library_path, update.request_id);
            return Err(format!("替换旧 AI 恢复记录失败：{error}"));
        }
    }
    Ok(())
}

pub(super) fn remove_run_checkpoint(library_path: &Path, request_id: &str) -> Result<(), String> {
    validate_request_id(request_id)?;
    let path = checkpoint_path(library_path, request_id);
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn list_agent_run_checkpoints(path: String) -> Result<Vec<AgentRunCheckpoint>, String> {
    let library_path = canonical_library_path(&path)?;
    let directory = checkpoint_directory(&library_path);
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut checkpoints = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|value| value.to_str()) == Some("json"))
        .filter_map(|entry| fs::read(entry.path()).ok())
        .filter_map(|raw| serde_json::from_slice::<AgentRunCheckpoint>(&raw).ok())
        .collect::<Vec<_>>();
    checkpoints.sort_by_key(|checkpoint| std::cmp::Reverse(checkpoint.updated_at_ms));
    Ok(checkpoints)
}

#[tauri::command]
pub(crate) fn dismiss_agent_run_checkpoint(path: String, request_id: String) -> Result<(), String> {
    let library_path = canonical_library_path(&path)?;
    remove_run_checkpoint(&library_path, &request_id)
}

fn checkpoint_path(library_path: &Path, request_id: &str) -> PathBuf {
    checkpoint_directory(library_path).join(format!("{request_id}.json"))
}

fn checkpoint_directory(library_path: &Path) -> PathBuf {
    library_path.join(".loby").join("ai").join("runs")
}

fn canonical_library_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())?;
    path.is_dir()
        .then_some(path)
        .ok_or_else(|| "当前写作库路径不是目录。".to_string())
}

fn validate_request_id(request_id: &str) -> Result<(), String> {
    if !request_id.is_empty()
        && request_id.len() <= 128
        && request_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        Ok(())
    } else {
        Err("AI 请求 ID 无效。".to_string())
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkpoints_round_trip_and_are_explicitly_dismissed() -> Result<(), String> {
        let library = tempfile::tempdir().map_err(|error| error.to_string())?;
        write_run_checkpoint(AgentRunCheckpointUpdate {
            library_path: library.path(),
            request_id: "agent-123",
            conversation_id: "chat-1",
            provider: "openai-api",
            prompt: "继续写作",
            status: "waitingForApproval",
            tool_name: "create_skill",
            reason: "等待用户审批",
        })?;
        let loaded = list_agent_run_checkpoints(library.path().display().to_string())?;
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].conversation_id, "chat-1");
        dismiss_agent_run_checkpoint(
            library.path().display().to_string(),
            "agent-123".to_string(),
        )?;
        assert!(list_agent_run_checkpoints(library.path().display().to_string())?.is_empty());
        Ok(())
    }

    #[test]
    fn replacement_persists_new_checkpoint_before_removing_old_one() -> Result<(), String> {
        let library = tempfile::tempdir().map_err(|error| error.to_string())?;
        write_run_checkpoint(AgentRunCheckpointUpdate {
            library_path: library.path(),
            request_id: "agent-old",
            conversation_id: "chat-1",
            provider: "openai-api",
            prompt: "旧任务",
            status: "running",
            tool_name: "",
            reason: "等待恢复",
        })?;
        write_run_checkpoint_replacing(
            AgentRunCheckpointUpdate {
                library_path: library.path(),
                request_id: "agent-new",
                conversation_id: "chat-1",
                provider: "openai-api",
                prompt: "新任务",
                status: "running",
                tool_name: "",
                reason: "等待恢复",
            },
            Some("agent-old"),
        )?;

        let loaded = list_agent_run_checkpoints(library.path().display().to_string())?;
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].request_id, "agent-new");
        assert_eq!(loaded[0].prompt, "新任务");
        Ok(())
    }
}
