//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 enter_zen_mode、mark_zen_window_ready、exit_zen_mode
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 enter_zen_mode、mark_zen_window_ready、exit_zen_mode
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::sync::atomic::{AtomicU8, Ordering};
use tauri::{
    utils::config::Color, Emitter, LogicalPosition, Manager, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const MAIN_WINDOW_LABEL: &str = "main";
const ZEN_BACKGROUND_WINDOW_LABEL: &str = "zen-background";
const ZEN_EDITOR_WINDOW_LABEL: &str = "zen-editor";
const ZEN_EXIT_REQUESTED_EVENT: &str = "loby://zen-exit-requested";
const ZEN_BACKGROUND_READY: u8 = 0b01;
const ZEN_EDITOR_READY: u8 = 0b10;
const ZEN_ALL_READY: u8 = ZEN_BACKGROUND_READY | ZEN_EDITOR_READY;
static ZEN_READY_WINDOWS: AtomicU8 = AtomicU8::new(0);

#[tauri::command]
pub(crate) async fn enter_zen_mode(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到落笔主窗口。".to_string())?;

    if let Some(editor_window) = app.get_webview_window(ZEN_EDITOR_WINDOW_LABEL) {
        if editor_window
            .is_visible()
            .map_err(|error| error.to_string())?
        {
            editor_window
                .set_focus()
                .map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    if let Some(background_window) = app.get_webview_window(ZEN_BACKGROUND_WINDOW_LABEL) {
        background_window
            .destroy()
            .map_err(|error| error.to_string())?;
    }

    ZEN_READY_WINDOWS.store(0, Ordering::Release);
    let monitor = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let mut background_builder = WebviewWindowBuilder::new(
        &app,
        ZEN_BACKGROUND_WINDOW_LABEL,
        WebviewUrl::App("index.html?window=zen-background".into()),
    )
    .title("落笔禅模式背景")
    .inner_size(960.0, 760.0)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .skip_taskbar(true)
    .focusable(false)
    .focused(false)
    .background_color(Color(39, 49, 60, 255))
    .visible(false);

    let mut editor_position = None;
    let mut editor_height = 820.0;
    if let Some(monitor) = monitor {
        let scale_factor = monitor.scale_factor();
        let monitor_x = f64::from(monitor.position().x) / scale_factor;
        let monitor_y = f64::from(monitor.position().y) / scale_factor;
        let monitor_width = f64::from(monitor.size().width) / scale_factor;
        let monitor_height = f64::from(monitor.size().height) / scale_factor;
        editor_height = (monitor_height - 44.0).clamp(560.0, 1120.0);
        editor_position = Some(LogicalPosition::new(
            monitor_x + (monitor_width - 760.0) / 2.0,
            monitor_y + (monitor_height - editor_height) / 2.0,
        ));
        background_builder = background_builder
            .position(monitor_x, monitor_y)
            .inner_size(monitor_width, monitor_height);
    }

    let background_window = background_builder
        .build()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    background_window
        .set_simple_fullscreen(true)
        .map_err(|error| error.to_string())?;

    #[cfg(not(target_os = "macos"))]
    background_window
        .maximize()
        .map_err(|error| error.to_string())?;

    let mut editor_builder = WebviewWindowBuilder::new(
        &app,
        ZEN_EDITOR_WINDOW_LABEL,
        WebviewUrl::App("index.html?window=zen-editor".into()),
    )
    .title("落笔禅模式")
    .inner_size(760.0, editor_height)
    .min_inner_size(640.0, 560.0)
    .decorations(false)
    .transparent(true)
    .shadow(true)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .skip_taskbar(false)
    .background_color(Color(57, 73, 87, 0))
    .visible(false);

    editor_builder = editor_builder
        .parent(&background_window)
        .map_err(|error| error.to_string())?;

    if let Some(position) = editor_position {
        editor_builder = editor_builder.position(position.x, position.y);
    } else {
        editor_builder = editor_builder.center();
    }

    let editor_window = editor_builder.build().map_err(|error| error.to_string())?;
    let editor_window_for_close = editor_window.clone();
    editor_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = editor_window_for_close.emit(ZEN_EXIT_REQUESTED_EVENT, ());
        }
    });

    Ok(())
}

#[tauri::command]
pub(crate) async fn mark_zen_window_ready(
    app: tauri::AppHandle,
    window: WebviewWindow,
) -> Result<(), String> {
    let ready_bit = match window.label() {
        ZEN_BACKGROUND_WINDOW_LABEL => ZEN_BACKGROUND_READY,
        ZEN_EDITOR_WINDOW_LABEL => ZEN_EDITOR_READY,
        _ => return Ok(()),
    };
    let ready_windows = ZEN_READY_WINDOWS.fetch_or(ready_bit, Ordering::AcqRel) | ready_bit;
    if ready_windows != ZEN_ALL_READY {
        return Ok(());
    }

    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到落笔主窗口。".to_string())?;
    let background_window = app
        .get_webview_window(ZEN_BACKGROUND_WINDOW_LABEL)
        .ok_or_else(|| "找不到禅模式背景窗口。".to_string())?;
    let editor_window = app
        .get_webview_window(ZEN_EDITOR_WINDOW_LABEL)
        .ok_or_else(|| "找不到禅模式编辑器窗口。".to_string())?;

    background_window
        .show()
        .map_err(|error| error.to_string())?;
    editor_window.show().map_err(|error| error.to_string())?;
    editor_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    main_window.hide().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn exit_zen_mode(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(background_window) = app.get_webview_window(ZEN_BACKGROUND_WINDOW_LABEL) {
        background_window
            .hide()
            .map_err(|error| error.to_string())?;
        #[cfg(target_os = "macos")]
        background_window
            .set_simple_fullscreen(false)
            .map_err(|error| error.to_string())?;
    }

    ZEN_READY_WINDOWS.store(0, Ordering::Release);
    restore_main_window(&app)?;
    let _ = app.emit("loby://zen-finished", ());

    if let Some(background_window) = app.get_webview_window(ZEN_BACKGROUND_WINDOW_LABEL) {
        background_window
            .destroy()
            .map_err(|error| error.to_string())?;
    }
    if let Some(editor_window) = app.get_webview_window(ZEN_EDITOR_WINDOW_LABEL) {
        editor_window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn restore_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到落笔主窗口。".to_string())?;
    main_window.show().map_err(|error| error.to_string())?;
    main_window
        .unminimize()
        .map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}
