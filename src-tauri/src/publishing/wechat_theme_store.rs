use crate::fs_paths::write_if_changed;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const STORE_SCHEMA_VERSION: u8 = 1;
const MAX_REVISIONS_PER_THEME: usize = 20;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatThemeStore {
    schema_version: u8,
    themes: Vec<Value>,
    #[serde(default)]
    revisions: HashMap<String, Vec<Value>>,
    #[serde(default)]
    redos: HashMap<String, Vec<Value>>,
    #[serde(default)]
    conversations: HashMap<String, Vec<Value>>,
}

impl Default for WechatThemeStore {
    fn default() -> Self {
        Self {
            schema_version: STORE_SCHEMA_VERSION,
            themes: Vec::new(),
            revisions: HashMap::new(),
            redos: HashMap::new(),
            conversations: HashMap::new(),
        }
    }
}

#[tauri::command]
pub(crate) fn load_wechat_theme_store(app: tauri::AppHandle) -> Result<WechatThemeStore, String> {
    load_store_at(theme_store_path(&app)?)
}

#[tauri::command]
pub(crate) fn save_wechat_theme(
    app: tauri::AppHandle,
    theme: Value,
) -> Result<WechatThemeStore, String> {
    let path = theme_store_path(&app)?;
    save_theme_at(&path, theme)
}

#[tauri::command]
pub(crate) fn undo_wechat_theme(
    app: tauri::AppHandle,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let path = theme_store_path(&app)?;
    undo_theme_at(&path, &theme_id)
}

#[tauri::command]
pub(crate) fn redo_wechat_theme(
    app: tauri::AppHandle,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let path = theme_store_path(&app)?;
    redo_theme_at(&path, &theme_id)
}

#[tauri::command]
pub(crate) fn save_wechat_theme_conversation(
    app: tauri::AppHandle,
    theme_id: String,
    messages: Vec<Value>,
) -> Result<WechatThemeStore, String> {
    let path = theme_store_path(&app)?;
    let mut store = load_store_at(&path)?;
    if !store
        .themes
        .iter()
        .any(|theme| theme_id_of(theme) == Some(theme_id.as_str()))
    {
        return Err("找不到对应的个人主题。".to_string());
    }
    if !messages.iter().all(is_valid_conversation_message) {
        return Err("主题 AI 对话包含无效消息。".to_string());
    }
    store.conversations.insert(
        theme_id,
        messages
            .into_iter()
            .rev()
            .take(50)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect(),
    );
    write_store_at(&path, &store)?;
    Ok(store)
}

#[tauri::command]
pub(crate) fn delete_wechat_theme(
    app: tauri::AppHandle,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let path = theme_store_path(&app)?;
    let mut store = load_store_at(&path)?;
    let before = store.themes.len();
    store
        .themes
        .retain(|theme| theme_id_of(theme) != Some(theme_id.as_str()));
    if store.themes.len() == before {
        return Err("找不到要删除的个人主题。".to_string());
    }
    store.revisions.remove(&theme_id);
    store.redos.remove(&theme_id);
    store.conversations.remove(&theme_id);
    write_store_at(&path, &store)?;
    Ok(store)
}

fn theme_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("publishing").join("wechat-themes.json"))
        .map_err(|error| error.to_string())
}

fn load_store_at(path: impl AsRef<Path>) -> Result<WechatThemeStore, String> {
    let path = path.as_ref();
    if !path.exists() {
        return Ok(WechatThemeStore::default());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let store: WechatThemeStore =
        serde_json::from_str(&raw).map_err(|error| format!("个人主题文件损坏：{error}"))?;
    if store.schema_version != STORE_SCHEMA_VERSION {
        return Err("个人主题文件版本不受支持。".to_string());
    }
    Ok(store)
}

fn save_theme_at(path: impl AsRef<Path>, theme: Value) -> Result<WechatThemeStore, String> {
    validate_personal_theme(&theme)?;
    let path = path.as_ref();
    let theme_id = theme_id_of(&theme)
        .ok_or_else(|| "个人主题缺少 ID。".to_string())?
        .to_string();
    let mut store = load_store_at(path)?;

    if let Some(index) = store
        .themes
        .iter()
        .position(|saved| theme_id_of(saved) == Some(theme_id.as_str()))
    {
        if store.themes[index] != theme {
            let revisions = store.revisions.entry(theme_id.clone()).or_default();
            revisions.push(store.themes[index].clone());
            if revisions.len() > MAX_REVISIONS_PER_THEME {
                revisions.drain(0..revisions.len() - MAX_REVISIONS_PER_THEME);
            }
            store.themes[index] = theme;
            store.redos.remove(&theme_id);
        }
    } else {
        store.themes.push(theme);
    }

    write_store_at(path, &store)?;
    Ok(store)
}

fn undo_theme_at(path: impl AsRef<Path>, theme_id: &str) -> Result<WechatThemeStore, String> {
    let path = path.as_ref();
    let mut store = load_store_at(path)?;
    let previous = store
        .revisions
        .get_mut(theme_id)
        .and_then(Vec::pop)
        .ok_or_else(|| "这个主题还没有可撤销的修改。".to_string())?;
    let theme = store
        .themes
        .iter_mut()
        .find(|theme| theme_id_of(theme) == Some(theme_id))
        .ok_or_else(|| "找不到要撤销的个人主题。".to_string())?;
    store
        .redos
        .entry(theme_id.to_string())
        .or_default()
        .push(theme.clone());
    *theme = previous;
    write_store_at(path, &store)?;
    Ok(store)
}

fn redo_theme_at(path: impl AsRef<Path>, theme_id: &str) -> Result<WechatThemeStore, String> {
    let path = path.as_ref();
    let mut store = load_store_at(path)?;
    let next = store
        .redos
        .get_mut(theme_id)
        .and_then(Vec::pop)
        .ok_or_else(|| "这个主题还没有可重做的修改。".to_string())?;
    let theme = store
        .themes
        .iter_mut()
        .find(|theme| theme_id_of(theme) == Some(theme_id))
        .ok_or_else(|| "找不到要重做的个人主题。".to_string())?;
    store
        .revisions
        .entry(theme_id.to_string())
        .or_default()
        .push(theme.clone());
    *theme = next;
    write_store_at(path, &store)?;
    Ok(store)
}

fn write_store_at(path: &Path, store: &WechatThemeStore) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    write_if_changed(path, payload).map(|_| ())
}

fn validate_personal_theme(theme: &Value) -> Result<(), String> {
    let object = theme
        .as_object()
        .ok_or_else(|| "个人主题必须是 JSON 对象。".to_string())?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "个人主题缺少 ID。".to_string())?;
    if id.is_empty()
        || id.len() > 80
        || !id.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'.' | b'_' | b'-'))
        })
    {
        return Err("个人主题 ID 无效。".to_string());
    }
    if object.get("kind").and_then(Value::as_str) != Some("personal") {
        return Err("内置主题不能被覆盖。".to_string());
    }
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("个人主题协议版本无效。".to_string());
    }
    Ok(())
}

fn theme_id_of(theme: &Value) -> Option<&str> {
    theme.get("id").and_then(Value::as_str)
}

fn is_valid_conversation_message(message: &Value) -> bool {
    let Some(object) = message.as_object() else {
        return false;
    };
    let valid_role = matches!(
        object.get("role").and_then(Value::as_str),
        Some("user" | "assistant")
    );
    let valid_id = object
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(|id| !id.is_empty() && id.len() <= 120);
    let valid_content = object
        .get("content")
        .and_then(Value::as_str)
        .is_some_and(|content| content.len() <= 20_000);
    let valid_error = object.get("error").is_none_or(Value::is_boolean);
    valid_role && valid_id && valid_content && valid_error
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn personal_theme(id: &str, accent: &str) -> Value {
        json!({
            "schemaVersion": 1,
            "id": id,
            "kind": "personal",
            "name": "我的主题",
            "tokens": { "accent": accent }
        })
    }

    #[test]
    fn personal_themes_round_trip_with_bounded_undo_history() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let path = directory.path().join("wechat-themes.json");

        assert!(load_store_at(&path)?.themes.is_empty());
        save_theme_at(&path, personal_theme("my-theme", "#111111"))?;
        for index in 0..25 {
            save_theme_at(&path, personal_theme("my-theme", &format!("#{index:06}")))?;
        }

        let store = load_store_at(&path)?;
        assert_eq!(store.themes.len(), 1);
        assert_eq!(store.revisions["my-theme"].len(), MAX_REVISIONS_PER_THEME);

        let undone = undo_theme_at(&path, "my-theme")?;
        assert_eq!(undone.themes[0]["tokens"]["accent"], "#000023");
        assert_eq!(undone.revisions["my-theme"].len(), 19);
        assert_eq!(undone.redos["my-theme"].len(), 1);

        let redone = redo_theme_at(&path, "my-theme")?;
        assert_eq!(redone.themes[0]["tokens"]["accent"], "#000024");
        assert_eq!(redone.redos["my-theme"].len(), 0);
        Ok(())
    }

    #[test]
    fn built_in_theme_cannot_be_saved_as_personal_data() {
        let theme = json!({ "schemaVersion": 1, "id": "deep-blue-study", "kind": "built-in" });
        assert_eq!(
            validate_personal_theme(&theme),
            Err("内置主题不能被覆盖。".to_string())
        );
    }
}
