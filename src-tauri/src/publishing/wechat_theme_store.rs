use crate::fs_paths::write_if_changed;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const STORE_SCHEMA_VERSION: u8 = 2;
const STATE_SCHEMA_VERSION: u8 = 1;
const MAX_REVISIONS_PER_THEME: usize = 20;
const MAX_THEME_FILE_BYTES: u64 = 16 * 1024 * 1024;
const THEME_FILE_EXTENSION: &str = "lobywechat";
const THEME_FILE_FORMAT: &str = "loby-wechat-theme";
const THEME_FILE_FORMAT_VERSION: u8 = 1;

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
    #[serde(default)]
    active_conversation_ids: HashMap<String, String>,
    #[serde(default)]
    preferences: WechatThemePreferences,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatThemeAppState {
    schema_version: u8,
    #[serde(default)]
    libraries: HashMap<String, WechatThemeLibraryState>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatThemeLibraryState {
    #[serde(default = "default_state_schema_version")]
    schema_version: u8,
    #[serde(default)]
    revisions: HashMap<String, Vec<Value>>,
    #[serde(default)]
    redos: HashMap<String, Vec<Value>>,
    #[serde(default)]
    conversations: HashMap<String, Vec<Value>>,
    #[serde(default)]
    active_conversation_ids: HashMap<String, String>,
    #[serde(default)]
    preferences: WechatThemePreferences,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatThemeFileEnvelope {
    format: String,
    format_version: u8,
    theme: Value,
}

#[derive(Debug)]
struct WechatThemeEntry {
    path: PathBuf,
    theme: Value,
}

#[derive(Debug)]
struct WechatThemeStorage {
    library_key: String,
    themes_dir: PathBuf,
    state_path: PathBuf,
    legacy_state_path: PathBuf,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatThemePreferences {
    default_theme_id: String,
    #[serde(default)]
    favorite_theme_ids: Vec<String>,
}

impl Default for WechatThemePreferences {
    fn default() -> Self {
        Self {
            default_theme_id: "loby-basic".to_string(),
            favorite_theme_ids: Vec::new(),
        }
    }
}

impl Default for WechatThemeStore {
    fn default() -> Self {
        Self {
            schema_version: STORE_SCHEMA_VERSION,
            themes: Vec::new(),
            revisions: HashMap::new(),
            redos: HashMap::new(),
            conversations: HashMap::new(),
            active_conversation_ids: HashMap::new(),
            preferences: WechatThemePreferences::default(),
        }
    }
}

impl Default for WechatThemeLibraryState {
    fn default() -> Self {
        Self {
            schema_version: STATE_SCHEMA_VERSION,
            revisions: HashMap::new(),
            redos: HashMap::new(),
            conversations: HashMap::new(),
            active_conversation_ids: HashMap::new(),
            preferences: WechatThemePreferences::default(),
        }
    }
}

fn default_state_schema_version() -> u8 {
    STATE_SCHEMA_VERSION
}

impl Default for WechatThemeAppState {
    fn default() -> Self {
        Self {
            schema_version: STATE_SCHEMA_VERSION,
            libraries: HashMap::new(),
        }
    }
}

impl WechatThemeStore {
    fn from_parts(themes: Vec<Value>, state: WechatThemeLibraryState) -> Self {
        Self {
            schema_version: STORE_SCHEMA_VERSION,
            themes,
            revisions: state.revisions,
            redos: state.redos,
            conversations: state.conversations,
            active_conversation_ids: state.active_conversation_ids,
            preferences: state.preferences,
        }
    }
}

#[tauri::command]
pub(crate) fn load_wechat_theme_store(
    app: tauri::AppHandle,
    library_path: String,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    load_store_at(&storage)
}

#[tauri::command]
pub(crate) fn save_wechat_theme(
    app: tauri::AppHandle,
    library_path: String,
    theme: Value,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    save_theme_at(&storage, theme)
}

#[tauri::command]
pub(crate) fn save_wechat_theme_preferences(
    app: tauri::AppHandle,
    library_path: String,
    preferences: WechatThemePreferences,
) -> Result<WechatThemeStore, String> {
    validate_preferences(&preferences)?;
    let storage = theme_storage(&app, &library_path)?;
    let mut state = load_library_state_at(&storage)?;
    state.preferences = preferences;
    write_library_state_at(&storage, state)?;
    load_store_at(&storage)
}

#[tauri::command]
pub(crate) fn undo_wechat_theme(
    app: tauri::AppHandle,
    library_path: String,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    undo_theme_at(&storage, &theme_id)
}

#[tauri::command]
pub(crate) fn redo_wechat_theme(
    app: tauri::AppHandle,
    library_path: String,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    redo_theme_at(&storage, &theme_id)
}

#[tauri::command]
pub(crate) fn save_wechat_theme_conversations(
    app: tauri::AppHandle,
    library_path: String,
    theme_id: String,
    conversations: Vec<Value>,
    active_conversation_id: String,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    if !load_theme_entries(&storage.themes_dir)?
        .iter()
        .any(|entry| theme_id_of(&entry.theme) == Some(theme_id.as_str()))
    {
        return Err("找不到对应的个人主题。".to_string());
    }
    if conversations.len() > 50 || !conversations.iter().all(is_valid_conversation) {
        return Err("主题 AI 对话记录无效。".to_string());
    }
    if !conversations.iter().any(|conversation| {
        conversation.get("id").and_then(Value::as_str) == Some(active_conversation_id.as_str())
    }) {
        return Err("找不到当前主题 AI 对话。".to_string());
    }
    let mut state = load_library_state_at(&storage)?;
    state.conversations.insert(theme_id.clone(), conversations);
    state
        .active_conversation_ids
        .insert(theme_id, active_conversation_id);
    write_library_state_at(&storage, state)?;
    load_store_at(&storage)
}

#[tauri::command]
pub(crate) fn delete_wechat_theme(
    app: tauri::AppHandle,
    library_path: String,
    theme_id: String,
) -> Result<WechatThemeStore, String> {
    let storage = theme_storage(&app, &library_path)?;
    let entry = load_theme_entries(&storage.themes_dir)?
        .into_iter()
        .find(|entry| theme_id_of(&entry.theme) == Some(theme_id.as_str()))
        .ok_or_else(|| "找不到要删除的个人主题。".to_string())?;
    fs::remove_file(entry.path).map_err(|error| format!("删除个人主题失败：{error}"))?;

    let mut state = load_library_state_at(&storage)?;
    state.revisions.remove(&theme_id);
    state.redos.remove(&theme_id);
    state.conversations.remove(&theme_id);
    state.active_conversation_ids.remove(&theme_id);
    state
        .preferences
        .favorite_theme_ids
        .retain(|favorite_id| favorite_id != &theme_id);
    if state.preferences.default_theme_id == theme_id {
        state.preferences.default_theme_id = "loby-basic".to_string();
    }
    write_library_state_at(&storage, state)?;
    load_store_at(&storage)
}

#[tauri::command]
pub(crate) fn read_wechat_theme_file(path: String) -> Result<String, String> {
    let path = validated_theme_file_path(&path)?;
    let metadata = fs::metadata(&path).map_err(|error| format!("读取主题文件失败：{error}"))?;
    if !metadata.is_file() {
        return Err("选择的主题文件无效。".to_string());
    }
    if metadata.len() > MAX_THEME_FILE_BYTES {
        return Err("主题文件过大，无法导入。".to_string());
    }
    fs::read_to_string(path).map_err(|error| format!("读取主题文件失败：{error}"))
}

#[tauri::command]
pub(crate) fn write_wechat_theme_file(path: String, content: String) -> Result<(), String> {
    let path = validated_theme_file_path(&path)?;
    if content.len() as u64 > MAX_THEME_FILE_BYTES {
        return Err("主题文件过大，无法导出。".to_string());
    }
    write_if_changed(&path, content)
        .map(|_| ())
        .map_err(|error| format!("保存主题文件失败：{error}"))
}

fn validated_theme_file_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let valid_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(THEME_FILE_EXTENSION));
    if !valid_extension {
        return Err("请选择 .lobywechat 主题文件。".to_string());
    }
    Ok(path)
}

fn theme_storage(app: &tauri::AppHandle, library_path: &str) -> Result<WechatThemeStorage, String> {
    let library_root =
        fs::canonicalize(library_path).map_err(|error| format!("无法读取写作文件夹：{error}"))?;
    if !library_root.is_dir() {
        return Err("写作文件夹无效。".to_string());
    }
    let themes_dir = library_root.join("themes");
    fs::create_dir_all(&themes_dir).map_err(|error| format!("无法创建主题目录：{error}"))?;
    let legacy_state_path = app
        .path()
        .app_data_dir()
        .map(|path| path.join("publishing").join("wechat-theme-state.json"))
        .map_err(|error| error.to_string())?;
    Ok(WechatThemeStorage {
        library_key: library_root.to_string_lossy().into_owned(),
        themes_dir,
        state_path: library_root
            .join(".loby")
            .join("publishing")
            .join("wechat-theme-state.json"),
        legacy_state_path,
    })
}

fn load_store_at(storage: &WechatThemeStorage) -> Result<WechatThemeStore, String> {
    let themes = load_theme_entries(&storage.themes_dir)?
        .into_iter()
        .map(|entry| entry.theme)
        .collect();
    let state = load_library_state_at(storage)?;
    Ok(WechatThemeStore::from_parts(themes, state))
}

fn load_library_state_at(storage: &WechatThemeStorage) -> Result<WechatThemeLibraryState, String> {
    let state = if storage.state_path.exists() {
        let raw = fs::read_to_string(&storage.state_path).map_err(|error| error.to_string())?;
        serde_json::from_str::<WechatThemeLibraryState>(&raw)
            .map_err(|error| format!("公众号主题工作状态损坏：{error}"))?
    } else {
        let legacy = load_app_state_at(&storage.legacy_state_path)?;
        let state = legacy
            .libraries
            .get(&storage.library_key)
            .cloned()
            .unwrap_or_default();
        if legacy.libraries.contains_key(&storage.library_key) {
            write_library_state_at(storage, state.clone())?;
        }
        state
    };
    if state.schema_version != STATE_SCHEMA_VERSION {
        return Err("公众号主题工作状态版本不受支持。".to_string());
    }
    validate_preferences(&state.preferences)?;
    Ok(state)
}

fn load_app_state_at(path: &Path) -> Result<WechatThemeAppState, String> {
    if !path.exists() {
        return Ok(WechatThemeAppState::default());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let state: WechatThemeAppState =
        serde_json::from_str(&raw).map_err(|error| format!("公众号主题工作状态损坏：{error}"))?;
    if state.schema_version != STATE_SCHEMA_VERSION {
        return Err("公众号主题工作状态版本不受支持。".to_string());
    }
    Ok(state)
}

fn write_library_state_at(
    storage: &WechatThemeStorage,
    state: WechatThemeLibraryState,
) -> Result<(), String> {
    if let Some(parent) = storage.state_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    write_if_changed(&storage.state_path, payload).map(|_| ())
}

fn load_theme_entries(themes_dir: &Path) -> Result<Vec<WechatThemeEntry>, String> {
    fs::create_dir_all(themes_dir).map_err(|error| format!("无法创建主题目录：{error}"))?;
    let mut entries = Vec::new();
    let mut theme_ids = std::collections::HashSet::new();
    for directory_entry in
        fs::read_dir(themes_dir).map_err(|error| format!("读取主题目录失败：{error}"))?
    {
        let path = directory_entry
            .map_err(|error| format!("读取主题目录失败：{error}"))?
            .path();
        if !path.is_file()
            || !path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case(THEME_FILE_EXTENSION))
        {
            continue;
        }
        let metadata = fs::metadata(&path).map_err(|error| format!("读取主题文件失败：{error}"))?;
        if metadata.len() > MAX_THEME_FILE_BYTES {
            return Err(format!("主题文件过大：{}", path.display()));
        }
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("读取主题文件失败：{error}"))?;
        let theme =
            parse_theme_file(&raw).map_err(|error| format!("{}：{error}", path.display()))?;
        let theme_id = theme_id_of(&theme).ok_or_else(|| "个人主题缺少 ID。".to_string())?;
        if !theme_ids.insert(theme_id.to_string()) {
            return Err(format!("主题目录中存在重复 ID：{theme_id}"));
        }
        entries.push(WechatThemeEntry { path, theme });
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}

fn parse_theme_file(content: &str) -> Result<Value, String> {
    let envelope: WechatThemeFileEnvelope = serde_json::from_str(content)
        .map_err(|error| format!("主题文件不是有效的 JSON：{error}"))?;
    if envelope.format != THEME_FILE_FORMAT {
        return Err("这不是落笔公众号主题文件。".to_string());
    }
    if envelope.format_version != THEME_FILE_FORMAT_VERSION {
        return Err("主题文件版本不受支持。".to_string());
    }
    validate_personal_theme(&envelope.theme)?;
    Ok(envelope.theme)
}

fn write_theme_at(
    themes_dir: &Path,
    theme: &Value,
    existing_path: Option<&Path>,
) -> Result<PathBuf, String> {
    validate_personal_theme(theme)?;
    let name = theme
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "个人主题缺少名称。".to_string())?;
    let target_path = available_theme_path(themes_dir, name, existing_path);
    let envelope = WechatThemeFileEnvelope {
        format: THEME_FILE_FORMAT.to_string(),
        format_version: THEME_FILE_FORMAT_VERSION,
        theme: theme.clone(),
    };
    let payload = format!(
        "{}\n",
        serde_json::to_string_pretty(&envelope).map_err(|error| error.to_string())?
    );
    write_if_changed(&target_path, payload)
        .map_err(|error| format!("保存主题文件失败：{error}"))?;
    if let Some(previous_path) = existing_path {
        if previous_path != target_path && previous_path.exists() {
            fs::remove_file(previous_path)
                .map_err(|error| format!("清理旧主题文件失败：{error}"))?;
        }
    }
    Ok(target_path)
}

fn available_theme_path(themes_dir: &Path, name: &str, existing_path: Option<&Path>) -> PathBuf {
    let base = safe_theme_filename(name);
    for suffix in 1.. {
        let filename = if suffix == 1 {
            format!("{base}.{THEME_FILE_EXTENSION}")
        } else {
            format!("{base}-{suffix}.{THEME_FILE_EXTENSION}")
        };
        let candidate = themes_dir.join(filename);
        if !candidate.exists() || existing_path == Some(candidate.as_path()) {
            return candidate;
        }
    }
    unreachable!()
}

fn safe_theme_filename(name: &str) -> String {
    let sanitized: String = name
        .trim()
        .chars()
        .map(|character| {
            if character.is_control() || "\\/:*?\"<>|".contains(character) {
                '-'
            } else {
                character
            }
        })
        .collect();
    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim_end_matches(['.', ' ']);
    let limited: String = trimmed.chars().take(80).collect();
    if limited.is_empty() {
        "公众号主题".to_string()
    } else {
        limited
    }
}

fn save_theme_at(storage: &WechatThemeStorage, theme: Value) -> Result<WechatThemeStore, String> {
    validate_personal_theme(&theme)?;
    let theme_id = theme_id_of(&theme)
        .ok_or_else(|| "个人主题缺少 ID。".to_string())?
        .to_string();
    let entries = load_theme_entries(&storage.themes_dir)?;
    let existing = entries
        .iter()
        .find(|entry| theme_id_of(&entry.theme) == Some(theme_id.as_str()));
    let mut state = load_library_state_at(storage)?;
    if let Some(saved) = existing {
        if saved.theme != theme {
            let revisions = state.revisions.entry(theme_id.clone()).or_default();
            revisions.push(saved.theme.clone());
            if revisions.len() > MAX_REVISIONS_PER_THEME {
                revisions.drain(0..revisions.len() - MAX_REVISIONS_PER_THEME);
            }
            state.redos.remove(&theme_id);
        }
    }
    write_theme_at(
        &storage.themes_dir,
        &theme,
        existing.map(|entry| entry.path.as_path()),
    )?;
    write_library_state_at(storage, state)?;
    load_store_at(storage)
}

fn undo_theme_at(storage: &WechatThemeStorage, theme_id: &str) -> Result<WechatThemeStore, String> {
    let entries = load_theme_entries(&storage.themes_dir)?;
    let current = entries
        .iter()
        .find(|entry| theme_id_of(&entry.theme) == Some(theme_id))
        .ok_or_else(|| "找不到要撤销的个人主题。".to_string())?;
    let mut state = load_library_state_at(storage)?;
    let previous = state
        .revisions
        .get_mut(theme_id)
        .and_then(Vec::pop)
        .ok_or_else(|| "这个主题还没有可撤销的修改。".to_string())?;
    state
        .redos
        .entry(theme_id.to_string())
        .or_default()
        .push(current.theme.clone());
    write_theme_at(&storage.themes_dir, &previous, Some(&current.path))?;
    write_library_state_at(storage, state)?;
    load_store_at(storage)
}

fn redo_theme_at(storage: &WechatThemeStorage, theme_id: &str) -> Result<WechatThemeStore, String> {
    let entries = load_theme_entries(&storage.themes_dir)?;
    let current = entries
        .iter()
        .find(|entry| theme_id_of(&entry.theme) == Some(theme_id))
        .ok_or_else(|| "找不到要重做的个人主题。".to_string())?;
    let mut state = load_library_state_at(storage)?;
    let next = state
        .redos
        .get_mut(theme_id)
        .and_then(Vec::pop)
        .ok_or_else(|| "这个主题还没有可重做的修改。".to_string())?;
    state
        .revisions
        .entry(theme_id.to_string())
        .or_default()
        .push(current.theme.clone());
    write_theme_at(&storage.themes_dir, &next, Some(&current.path))?;
    write_library_state_at(storage, state)?;
    load_store_at(storage)
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
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(2) {
        return Err("个人主题协议版本无效。".to_string());
    }
    Ok(())
}

fn theme_id_of(theme: &Value) -> Option<&str> {
    theme.get("id").and_then(Value::as_str)
}

fn validate_preferences(preferences: &WechatThemePreferences) -> Result<(), String> {
    if !is_valid_theme_id(&preferences.default_theme_id)
        || preferences.favorite_theme_ids.len() > 200
        || !preferences
            .favorite_theme_ids
            .iter()
            .all(|theme_id| is_valid_theme_id(theme_id))
    {
        return Err("主题偏好数据无效。".to_string());
    }
    Ok(())
}

fn is_valid_theme_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'.' | b'_' | b'-'))
        })
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
    let valid_images = object.get("images").is_none();
    let valid_run = object.get("run").is_none_or(is_valid_agent_run);
    valid_role && valid_id && valid_content && valid_error && valid_images && valid_run
}

fn is_valid_conversation(conversation: &Value) -> bool {
    let Some(object) = conversation.as_object() else {
        return false;
    };
    let valid_id = object
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(|id| !id.is_empty() && id.len() <= 120);
    let valid_title = object
        .get("title")
        .and_then(Value::as_str)
        .is_some_and(|title| !title.is_empty() && title.len() <= 240);
    let valid_messages = object
        .get("messages")
        .and_then(Value::as_array)
        .is_some_and(|messages| {
            messages.len() <= 50 && messages.iter().all(is_valid_conversation_message)
        });
    let valid_thread = object
        .get("agentThreadId")
        .is_none_or(|thread_id| thread_id.as_str().is_some_and(|id| id.len() <= 200));
    let valid_timestamps = ["createdAt", "updatedAt"].iter().all(|key| {
        object
            .get(*key)
            .and_then(Value::as_str)
            .is_some_and(|timestamp| !timestamp.is_empty() && timestamp.len() <= 80)
    });
    valid_id && valid_title && valid_messages && valid_thread && valid_timestamps
}

fn is_valid_agent_run(run: &Value) -> bool {
    let Some(object) = run.as_object() else {
        return false;
    };
    let valid_status = matches!(
        object.get("status").and_then(Value::as_str),
        Some("running" | "completed" | "error" | "cancelled")
    );
    let valid_activities = object
        .get("activities")
        .and_then(Value::as_array)
        .is_some_and(|activities| {
            activities.len() <= 200 && activities.iter().all(is_valid_agent_run_activity)
        });
    let valid_usage = object
        .get("usage")
        .is_some_and(|usage| usage.is_null() || is_valid_agent_usage(usage));
    let valid_error = object
        .get("error")
        .is_none_or(|error| error.as_str().is_some_and(|text| text.len() <= 20_000));
    let bounded_size = serde_json::to_vec(run).is_ok_and(|raw| raw.len() <= 200_000);
    valid_status && valid_activities && valid_usage && valid_error && bounded_size
}

fn is_valid_agent_run_activity(activity: &Value) -> bool {
    let Some(object) = activity.as_object() else {
        return false;
    };
    [
        "id", "rawType", "title", "status", "command", "output", "text",
    ]
    .iter()
    .all(|key| {
        object
            .get(*key)
            .and_then(Value::as_str)
            .is_some_and(|text| text.len() <= 20_000)
    }) && object
        .get("exitCode")
        .is_some_and(|exit_code| exit_code.is_null() || exit_code.is_i64())
}

fn is_valid_agent_usage(usage: &Value) -> bool {
    let Some(object) = usage.as_object() else {
        return false;
    };
    [
        "inputTokens",
        "cachedInputTokens",
        "outputTokens",
        "reasoningOutputTokens",
    ]
    .iter()
    .all(|key| object.get(*key).is_some_and(Value::is_u64))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn personal_theme(id: &str, accent: &str) -> Value {
        json!({
            "schemaVersion": 2,
            "id": id,
            "kind": "personal",
            "name": "我的主题",
            "baseStyle": { "colors": { "accent": accent } }
        })
    }

    fn test_storage(directory: &Path) -> WechatThemeStorage {
        WechatThemeStorage {
            library_key: directory.join("library").to_string_lossy().into_owned(),
            themes_dir: directory.join("library").join("themes"),
            state_path: directory
                .join("library")
                .join(".loby")
                .join("publishing")
                .join("wechat-theme-state.json"),
            legacy_state_path: directory.join("app-data").join("wechat-theme-state.json"),
        }
    }

    #[test]
    fn personal_themes_round_trip_with_bounded_undo_history() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let storage = test_storage(directory.path());

        assert!(load_store_at(&storage)?.themes.is_empty());
        save_theme_at(&storage, personal_theme("my-theme", "#111111"))?;
        for index in 0..25 {
            save_theme_at(
                &storage,
                personal_theme("my-theme", &format!("#{index:06}")),
            )?;
        }

        let store = load_store_at(&storage)?;
        assert_eq!(store.themes.len(), 1);
        assert_eq!(store.revisions["my-theme"].len(), MAX_REVISIONS_PER_THEME);
        let theme_path = storage.themes_dir.join("我的主题.lobywechat");
        let theme_file = fs::read_to_string(&theme_path).map_err(|error| error.to_string())?;
        assert_eq!(parse_theme_file(&theme_file)?["id"], "my-theme");
        assert!(!theme_file.contains("revisions"));
        assert!(!theme_file.contains("conversations"));

        let undone = undo_theme_at(&storage, "my-theme")?;
        assert_eq!(undone.themes[0]["baseStyle"]["colors"]["accent"], "#000023");
        assert_eq!(undone.revisions["my-theme"].len(), 19);
        assert_eq!(undone.redos["my-theme"].len(), 1);

        let redone = redo_theme_at(&storage, "my-theme")?;
        assert_eq!(redone.themes[0]["baseStyle"]["colors"]["accent"], "#000024");
        assert_eq!(redone.redos["my-theme"].len(), 0);
        Ok(())
    }

    #[test]
    fn built_in_theme_cannot_be_saved_as_personal_data() {
        let theme = json!({ "schemaVersion": 2, "id": "loby-basic", "kind": "built-in" });
        assert_eq!(
            validate_personal_theme(&theme),
            Err("内置主题不能被覆盖。".to_string())
        );
    }

    #[test]
    fn standalone_theme_files_require_the_lobywechat_extension() {
        assert!(validated_theme_file_path("/tmp/清雅蓝白.lobywechat").is_ok());
        assert!(validated_theme_file_path("/tmp/清雅蓝白.LOBYWECHAT").is_ok());
        assert_eq!(
            validated_theme_file_path("/tmp/清雅蓝白.json"),
            Err("请选择 .lobywechat 主题文件。".to_string())
        );
    }

    #[test]
    fn state_is_scoped_by_writing_library() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let first = test_storage(directory.path());
        let second = WechatThemeStorage {
            library_key: directory
                .path()
                .join("other-library")
                .to_string_lossy()
                .into_owned(),
            themes_dir: directory.path().join("other-library").join("themes"),
            state_path: directory
                .path()
                .join("other-library")
                .join(".loby")
                .join("publishing")
                .join("wechat-theme-state.json"),
            legacy_state_path: first.legacy_state_path.clone(),
        };
        let mut first_state = WechatThemeLibraryState::default();
        first_state.preferences.default_theme_id = "my-theme".to_string();
        write_library_state_at(&first, first_state)?;

        assert_eq!(
            load_store_at(&first)?.preferences.default_theme_id,
            "my-theme"
        );
        assert_eq!(
            load_store_at(&second)?.preferences.default_theme_id,
            "loby-basic"
        );
        Ok(())
    }

    #[test]
    fn legacy_app_state_is_copied_into_the_writing_library() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let storage = test_storage(directory.path());
        let mut state = WechatThemeLibraryState::default();
        state.preferences.default_theme_id = "my-theme".to_string();
        let legacy = WechatThemeAppState {
            schema_version: STATE_SCHEMA_VERSION,
            libraries: HashMap::from([(storage.library_key.clone(), state)]),
        };
        if let Some(parent) = storage.legacy_state_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(
            &storage.legacy_state_path,
            serde_json::to_string_pretty(&legacy).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;

        assert_eq!(
            load_store_at(&storage)?.preferences.default_theme_id,
            "my-theme"
        );
        assert!(storage.state_path.exists());
        Ok(())
    }

    #[test]
    fn same_named_themes_get_distinct_files_and_renames_update_the_filename() -> Result<(), String>
    {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let storage = test_storage(directory.path());
        save_theme_at(&storage, personal_theme("theme-one", "#111111"))?;
        save_theme_at(&storage, personal_theme("theme-two", "#222222"))?;
        assert!(storage.themes_dir.join("我的主题.lobywechat").exists());
        assert!(storage.themes_dir.join("我的主题-2.lobywechat").exists());

        let mut renamed = personal_theme("theme-one", "#111111");
        renamed["name"] = Value::String("深蓝书房".to_string());
        save_theme_at(&storage, renamed)?;
        assert!(storage.themes_dir.join("深蓝书房.lobywechat").exists());
        assert!(!storage.themes_dir.join("我的主题.lobywechat").exists());
        Ok(())
    }

    #[test]
    fn theme_conversation_accepts_bounded_agent_run_details() {
        let message = json!({
            "id": "assistant-1",
            "role": "assistant",
            "content": "已经调整主题。",
            "run": {
                "status": "completed",
                "activities": [{
                    "id": "reasoning-1",
                    "rawType": "item/reasoning/textDelta",
                    "title": "思考过程",
                    "status": "completed",
                    "command": "",
                    "output": "检查标题层级",
                    "text": "",
                    "exitCode": null
                }],
                "usage": {
                    "inputTokens": 100,
                    "cachedInputTokens": 50,
                    "outputTokens": 20,
                    "reasoningOutputTokens": 10
                }
            }
        });

        assert!(is_valid_conversation_message(&message));
        assert!(!is_valid_conversation_message(&json!({
            "id": "assistant-2",
            "role": "assistant",
            "content": "无效运行记录",
            "run": { "status": "completed", "activities": "broken", "usage": null }
        })));
    }

    #[test]
    fn theme_conversation_history_accepts_multiple_threaded_conversations() {
        let conversation = json!({
            "id": "theme-chat-1",
            "title": "调整标题",
            "messages": [{
                "id": "user-1",
                "role": "user",
                "content": "标题更克制一点"
            }],
            "agentThreadId": "thread-1",
            "createdAt": "2026-07-17T00:00:00.000Z",
            "updatedAt": "2026-07-17T00:00:00.000Z"
        });

        assert!(is_valid_conversation(&conversation));
        assert!(!is_valid_conversation(&json!({
            "id": "theme-chat-2",
            "title": "无效对话",
            "messages": "broken",
            "createdAt": "2026-07-17T00:00:00.000Z",
            "updatedAt": "2026-07-17T00:00:00.000Z"
        })));
    }
}
