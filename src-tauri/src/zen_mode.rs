use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const MAIN_WINDOW_LABEL: &str = "main";
const ZEN_WINDOW_LABEL: &str = "zen";

#[tauri::command]
pub(crate) async fn enter_zen_mode(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到 Nibva 主窗口。".to_string())?;

    if let Some(zen_window) = app.get_webview_window(ZEN_WINDOW_LABEL) {
        main_window.hide().map_err(|error| error.to_string())?;
        zen_window.show().map_err(|error| error.to_string())?;
        zen_window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let monitor = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let mut builder = WebviewWindowBuilder::new(
        &app,
        ZEN_WINDOW_LABEL,
        WebviewUrl::App("index.html?window=zen".into()),
    )
    .title("Nibva 禅模式")
    .inner_size(960.0, 760.0)
    .min_inner_size(640.0, 560.0)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .skip_taskbar(true)
    .visible(false);

    if let Some(monitor) = monitor {
        let scale_factor = monitor.scale_factor();
        builder = builder
            .position(
                f64::from(monitor.position().x) / scale_factor,
                f64::from(monitor.position().y) / scale_factor,
            )
            .inner_size(
                f64::from(monitor.size().width) / scale_factor,
                f64::from(monitor.size().height) / scale_factor,
            );
    }

    let zen_window = builder.build().map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    zen_window
        .set_simple_fullscreen(true)
        .map_err(|error| error.to_string())?;

    #[cfg(not(target_os = "macos"))]
    zen_window.maximize().map_err(|error| error.to_string())?;

    main_window.hide().map_err(|error| error.to_string())?;
    zen_window.show().map_err(|error| error.to_string())?;
    zen_window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn exit_zen_mode(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(zen_window) = app.get_webview_window(ZEN_WINDOW_LABEL) {
        #[cfg(target_os = "macos")]
        zen_window
            .set_simple_fullscreen(false)
            .map_err(|error| error.to_string())?;
        zen_window.destroy().map_err(|error| error.to_string())?;
    }

    restore_main_window(&app)?;
    let _ = app.emit("nibva://zen-finished", ());
    Ok(())
}

fn restore_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到 Nibva 主窗口。".to_string())?;
    main_window.show().map_err(|error| error.to_string())?;
    main_window
        .unminimize()
        .map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}
