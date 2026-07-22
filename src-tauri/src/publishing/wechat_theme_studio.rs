//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 WechatThemeStudioState、open_wechat_theme_studio、get_wechat_theme_studio_session
//! [POS]: 发布领域，封装渠道适配、主题存储、凭证与上传流程
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 WechatThemeStudioState、open_wechat_theme_studio、get_wechat_theme_studio_session
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde_json::Value;
use std::sync::Mutex;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const WINDOW_LABEL: &str = "wechat-theme-studio";
const SESSION_CHANGED_EVENT: &str = "loby://wechat-theme-studio-session-changed";

#[derive(Default)]
pub(crate) struct WechatThemeStudioState(Mutex<Option<Value>>);

#[tauri::command]
pub(crate) fn open_wechat_theme_studio(
    app: tauri::AppHandle,
    state: tauri::State<'_, WechatThemeStudioState>,
    session: Value,
) -> Result<(), String> {
    *state.0.lock().map_err(|error| error.to_string())? = Some(session);

    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        window.maximize().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        window
            .emit(SESSION_CHANGED_EVENT, ())
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        WINDOW_LABEL,
        WebviewUrl::App("index.html?window=wechat-theme-studio".into()),
    )
    .title("落笔公众号主题编辑器")
    .inner_size(1360.0, 900.0)
    .min_inner_size(760.0, 720.0)
    .decorations(false)
    .transparent(true)
    .shadow(true)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .maximized(true)
    .build()
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn get_wechat_theme_studio_session(
    state: tauri::State<'_, WechatThemeStudioState>,
) -> Result<Value, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "没有可用的公众号主题工作室会话。".to_string())
}
