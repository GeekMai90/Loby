use crate::fs_paths::write_if_changed;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn quick_prompts_path(path: &str) -> PathBuf {
    PathBuf::from(path)
        .join(".loby")
        .join("ai")
        .join("quick-prompts.json")
}

#[tauri::command]
pub(crate) fn load_quick_prompts(path: String) -> Result<serde_json::Value, String> {
    let prompts_path = quick_prompts_path(&path);
    if !prompts_path.exists() {
        return Ok(json!({ "version": 1, "prompts": [] }));
    }

    let raw = fs::read_to_string(prompts_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn save_quick_prompts(path: String, store: serde_json::Value) -> Result<String, String> {
    let prompts_path = quick_prompts_path(&path);
    if let Some(parent) = prompts_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&store).map_err(|error| error.to_string())?;
    write_if_changed(&prompts_path, payload)?;
    Ok(prompts_path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quick_prompts_round_trip_and_missing_store_is_empty() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-quick-prompt-store-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        assert_eq!(
            load_quick_prompts(root.display().to_string())?,
            json!({ "version": 1, "prompts": [] })
        );
        let store = json!({
            "version": 1,
            "prompts": [{
                "id": "prompt-1",
                "title": "润色",
                "content": "润色当前文稿"
            }]
        });
        let saved_path = save_quick_prompts(root.display().to_string(), store.clone())?;
        assert!(saved_path.ends_with(".loby/ai/quick-prompts.json"));
        assert_eq!(load_quick_prompts(root.display().to_string())?, store);

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
