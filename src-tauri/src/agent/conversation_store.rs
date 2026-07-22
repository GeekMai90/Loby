//! [INPUT]: 依赖 fs_paths::write_if_changed、serde_json 与写作库 .loby/ai 受管目录
//! [OUTPUT]: 向 crate 提供 load_conversations、save_conversations
//! [POS]: 本地 AI agent 领域，封装 Codex 进程、协议、流式事件与会话附件持久化
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub(crate) fn load_conversations(path: String) -> Result<serde_json::Value, String> {
    let conversations_path = PathBuf::from(path)
        .join(".loby")
        .join("ai")
        .join("conversations.json");
    if !conversations_path.exists() {
        return Ok(serde_json::Value::Array(Vec::new()));
    }

    let raw = fs::read_to_string(conversations_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn save_conversations(
    path: String,
    conversations: serde_json::Value,
) -> Result<String, String> {
    let root = PathBuf::from(path);
    let ai_dir = root.join(".loby").join("ai");
    fs::create_dir_all(&ai_dir).map_err(|error| error.to_string())?;
    let payload =
        serde_json::to_string_pretty(&conversations).map_err(|error| error.to_string())?;
    let conversations_path = ai_dir.join("conversations.json");
    write_if_changed(&conversations_path, payload)?;
    Ok(conversations_path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversations_round_trip_and_missing_store_is_empty() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-conversation-store-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        assert_eq!(
            load_conversations(root.display().to_string())?,
            serde_json::json!([])
        );
        let conversations = serde_json::json!([{"id": "chat-1", "title": "Draft"}]);
        save_conversations(root.display().to_string(), conversations.clone())?;
        assert_eq!(
            load_conversations(root.display().to_string())?,
            conversations
        );

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
