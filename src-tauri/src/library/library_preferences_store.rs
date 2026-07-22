//! [INPUT]: 依赖 fs_paths::write_if_changed、serde_json 与写作库 .loby/preferences.json 受管路径
//! [OUTPUT]: 向 crate 提供 load_library_preferences、save_library_preferences
//! [POS]: 本地写作库领域，封装扫描、保存、偏好、活动记录、监听与回收站
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use std::fs;
use std::path::{Path, PathBuf};

fn preferences_path(root: &Path) -> PathBuf {
    root.join(".loby").join("preferences.json")
}

#[tauri::command]
pub(crate) fn load_library_preferences(path: String) -> Result<serde_json::Value, String> {
    let path = preferences_path(&PathBuf::from(path));
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 512 * 1024 {
        return Err("写作文件夹偏好文件超过大小限制。".to_string());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn save_library_preferences(
    path: String,
    preferences: serde_json::Value,
) -> Result<String, String> {
    let root = PathBuf::from(path);
    let path = preferences_path(&root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&preferences).map_err(|error| error.to_string())?;
    if payload.len() > 512 * 1024 {
        return Err("写作文件夹偏好文件超过大小限制。".to_string());
    }
    write_if_changed(&path, payload)?;
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_round_trip_in_hidden_library_metadata() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-library-preferences-store-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        assert_eq!(
            load_library_preferences(root.display().to_string())?,
            serde_json::Value::Null
        );
        let preferences = serde_json::json!({
            "version": 1,
            "lastProjectId": "project-1",
            "goalCelebrationEnabled": false
        });
        let saved_path = save_library_preferences(root.display().to_string(), preferences.clone())?;
        assert!(saved_path.ends_with(".loby/preferences.json"));
        assert_eq!(
            load_library_preferences(root.display().to_string())?,
            preferences
        );

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
