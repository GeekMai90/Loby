//! [INPUT]: 依赖 fs_paths::write_if_changed、serde_json 与写作库 .loby/activity 受管路径
//! [OUTPUT]: 向 crate 提供 load_writing_activity、save_writing_activity
//! [POS]: 本地写作库领域，封装扫描、保存、偏好、活动记录、监听与回收站
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use std::fs;
use std::path::{Path, PathBuf};

fn activity_path(root: &Path) -> PathBuf {
    root.join(".loby")
        .join("activity")
        .join("writing-activity.json")
}

fn empty_activity() -> serde_json::Value {
    serde_json::json!({
        "version": 1,
        "checkIns": [],
        "celebratedTargets": {}
    })
}

#[tauri::command]
pub(crate) fn load_writing_activity(path: String) -> Result<serde_json::Value, String> {
    let path = activity_path(&PathBuf::from(path));
    if !path.exists() {
        return Ok(empty_activity());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn save_writing_activity(
    path: String,
    activity: serde_json::Value,
) -> Result<String, String> {
    let root = PathBuf::from(path);
    let path = activity_path(&root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&activity).map_err(|error| error.to_string())?;
    write_if_changed(&path, payload)?;
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn activity_round_trips_in_hidden_library_metadata() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-writing-activity-store-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        assert_eq!(
            load_writing_activity(root.display().to_string())?,
            empty_activity()
        );
        let activity = serde_json::json!({
            "version": 1,
            "checkIns": [{"date": "2026-07-19", "sheetId": "sheet-1"}],
            "celebratedTargets": {"sheet-1": [500]}
        });
        let saved_path = save_writing_activity(root.display().to_string(), activity.clone())?;
        assert!(saved_path.ends_with(".loby/activity/writing-activity.json"));
        assert_eq!(load_writing_activity(root.display().to_string())?, activity);

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
