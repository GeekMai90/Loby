//! [INPUT]: 依赖 fs_paths::write_if_changed、serde_json 与写作库 .loby/ai 受管目录
//! [OUTPUT]: 向 crate 提供带数组/体积校验、已验证备份回退的 load_conversations、save_conversations
//! [POS]: 本地 AI agent 领域的会话持久化边界，与 Provider、工具和正文事实解耦，不将单份 JSON 解析失败扩大为历史丢失
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_CONVERSATION_STORE_BYTES: usize = 64 * 1024 * 1024;
const CONVERSATIONS_FILE: &str = "conversations.json";
const CONVERSATIONS_BACKUP_FILE: &str = "conversations.backup.json";

#[tauri::command]
pub(crate) fn load_conversations(path: String) -> Result<serde_json::Value, String> {
    let root = canonical_library_path(&path)?;
    let (primary, backup) = conversation_paths(&root);
    match read_conversation_array(&primary) {
        Ok(value) => Ok(value),
        Err(primary_error) if primary_error == "missing" => {
            match read_conversation_array(&backup) {
                Ok(value) => Ok(value),
                Err(backup_error) if backup_error == "missing" => {
                    Ok(serde_json::Value::Array(Vec::new()))
                }
                Err(backup_error) => Err(format!("AI 会话备份无法读取：{backup_error}")),
            }
        }
        Err(primary_error) => read_conversation_array(&backup).map_err(|backup_error| {
            format!("AI 会话主文件损坏（{primary_error}），备份也无法读取（{backup_error}）。")
        }),
    }
}

#[tauri::command]
pub(crate) fn save_conversations(
    path: String,
    conversations: serde_json::Value,
) -> Result<String, String> {
    if !conversations.is_array() {
        return Err("AI 会话存储根值必须是数组。".to_string());
    }
    let root = canonical_library_path(&path)?;
    let ai_dir = root.join(".loby").join("ai");
    fs::create_dir_all(&ai_dir).map_err(|error| error.to_string())?;
    let payload = serde_json::to_vec_pretty(&conversations).map_err(|error| error.to_string())?;
    if payload.len() > MAX_CONVERSATION_STORE_BYTES {
        return Err("AI 会话存储超过 64 MB，请删除不再需要的历史对话。".to_string());
    }
    let (conversations_path, backup_path) = conversation_paths(&root);
    if let Ok(previous) = fs::read(&conversations_path) {
        if validate_conversation_payload(&previous).is_ok() && previous != payload {
            write_if_changed(&backup_path, previous)?;
        }
    }
    write_if_changed(&conversations_path, payload)?;
    Ok(conversations_path.display().to_string())
}

fn read_conversation_array(path: &Path) -> Result<serde_json::Value, String> {
    let raw = match fs::read(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("missing".to_string())
        }
        Err(error) => return Err(error.to_string()),
    };
    validate_conversation_payload(&raw)
}

fn validate_conversation_payload(raw: &[u8]) -> Result<serde_json::Value, String> {
    if raw.len() > MAX_CONVERSATION_STORE_BYTES {
        return Err("文件超过 64 MB".to_string());
    }
    let value: serde_json::Value =
        serde_json::from_slice(raw).map_err(|error| error.to_string())?;
    value
        .is_array()
        .then_some(value)
        .ok_or_else(|| "根值不是数组".to_string())
}

fn conversation_paths(root: &Path) -> (PathBuf, PathBuf) {
    let directory = root.join(".loby").join("ai");
    (
        directory.join(CONVERSATIONS_FILE),
        directory.join(CONVERSATIONS_BACKUP_FILE),
    )
}

fn canonical_library_path(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())?;
    root.is_dir()
        .then_some(root)
        .ok_or_else(|| "当前写作库路径不是目录。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversations_round_trip_and_missing_store_is_empty() -> Result<(), String> {
        let root = tempfile::tempdir().map_err(|error| error.to_string())?;

        assert_eq!(
            load_conversations(root.path().display().to_string())?,
            serde_json::json!([])
        );
        let conversations = serde_json::json!([{"id": "chat-1", "title": "Draft"}]);
        save_conversations(root.path().display().to_string(), conversations.clone())?;
        assert_eq!(
            load_conversations(root.path().display().to_string())?,
            conversations
        );
        Ok(())
    }

    #[test]
    fn corrupted_primary_falls_back_to_last_valid_backup() -> Result<(), String> {
        let root = tempfile::tempdir().map_err(|error| error.to_string())?;
        let first = serde_json::json!([{"id": "chat-1", "title": "First"}]);
        let second = serde_json::json!([{"id": "chat-1", "title": "Second"}]);
        save_conversations(root.path().display().to_string(), first.clone())?;
        save_conversations(root.path().display().to_string(), second)?;
        let (primary, backup) = conversation_paths(root.path());
        assert!(backup.is_file());
        fs::write(primary, b"{broken").map_err(|error| error.to_string())?;
        assert_eq!(
            load_conversations(root.path().display().to_string())?,
            first
        );
        Ok(())
    }

    #[test]
    fn rejects_non_array_conversation_roots() {
        let root = tempfile::tempdir().unwrap();
        assert!(
            save_conversations(root.path().display().to_string(), serde_json::json!({})).is_err()
        );
    }
}
