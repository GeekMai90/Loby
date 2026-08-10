//! [INPUT]: 依赖 serde_json 会话 payload、Mutex 状态与 Tauri 原生窗口 WebviewWindowBuilder/window::Color/Emitter/Manager；macOS 额外使用标题栏 Overlay API
//! [OUTPUT]: 向 crate 提供使用系统窗口控制的 WechatThemeStudioState、open_wechat_theme_studio、get_wechat_theme_studio_session
//! [POS]: 发布领域的公众号主题工作室窗口边界，持有会话并创建原生独立窗口
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde_json::Value;
use std::sync::Mutex;
use tauri::window::Color;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::{LogicalPosition, TitleBarStyle};

const WINDOW_LABEL: &str = "wechat-theme-studio";
const SESSION_CHANGED_EVENT: &str = "loby://wechat-theme-studio-session-changed";
/// 与 tauri.conf.json 主窗口 `backgroundColor` 一致的浅色启动兜底值。
const BOOT_BACKGROUND_COLOR: Color = Color(0xff, 0xff, 0xff, 0xff);

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

    let window_builder = WebviewWindowBuilder::new(
        &app,
        WINDOW_LABEL,
        WebviewUrl::App("index.html?window=wechat-theme-studio".into()),
    )
    .title("落笔公众号主题编辑器")
    .inner_size(1360.0, 900.0)
    .min_inner_size(760.0, 720.0)
    .decorations(true);

    #[cfg(target_os = "macos")]
    let window_builder = window_builder
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(LogicalPosition::new(20.0, 28.0));

    window_builder
        // 窗口层保持不透明：首帧前与 resize 期间露出的是主题底色而不是透明洞。
        // renderer 解析出主题后会用 setBackgroundColor 校正到当前 --background。
        .background_color(BOOT_BACKGROUND_COLOR)
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
