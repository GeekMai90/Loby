//! [INPUT]: 依赖 Tauri 主窗口/运行事件、tauri.conf 窗口配置与 macOS AppKit 窗口控件
//! [OUTPUT]: 向 app 组合层提供主窗口平台化关闭、首屏显示、Dock 恢复与全屏退出时无闪动的交通灯位置修复
//! [POS]: native 主窗口生命周期边界，集中平台窗口行为，不持有写作业务状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, Runtime, WebviewWindow, Window, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAFFIC_LIGHT_REPAIR_DELAY: Duration = Duration::from_millis(160);
static TRAFFIC_LIGHT_REPAIR_GENERATION: AtomicU64 = AtomicU64::new(0);

pub(crate) fn install_platform_window_observers<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    install_macos_fullscreen_observer(app)?;

    #[cfg(not(target_os = "macos"))]
    let _ = app;

    Ok(())
}

#[tauri::command]
pub(crate) fn mark_main_window_ready(window: WebviewWindow) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Ok(());
    }
    reveal_main_window(&window)
}

#[tauri::command]
pub(crate) fn dismiss_main_window(window: WebviewWindow) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    return window.hide().map_err(|error| error.to_string());

    #[cfg(not(target_os = "macos"))]
    window.destroy().map_err(|error| error.to_string())
}

pub(crate) fn handle_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen {
        has_visible_windows,
        ..
    } = event
    {
        if should_reveal_on_reopen(has_visible_windows) {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(error) = reveal_main_window(&window) {
                    eprintln!("failed to reveal the main window from Dock: {error}");
                }
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (app, event);
}

pub(crate) fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    #[cfg(target_os = "macos")]
    {
        let layout_changed = matches!(event, WindowEvent::Resized(_) | WindowEvent::Focused(true));
        let fullscreen = window.is_fullscreen().unwrap_or(false);
        if should_schedule_traffic_light_restore(window.label(), fullscreen, layout_changed) {
            restore_main_window_traffic_lights(window.app_handle());
            schedule_traffic_light_restore(window);
        }
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (window, event);
}

fn reveal_main_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if let Err(error) = restore_macos_traffic_lights(window) {
        eprintln!("failed to restore macOS traffic lights before reveal: {error}");
    }
    window.show().map_err(|error| error.to_string())?;
    if window.is_minimized().unwrap_or(false) {
        window.unminimize().map_err(|error| error.to_string())?;
    }
    window.set_focus().map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn restore_main_window_traffic_lights<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    if let Err(error) = restore_macos_traffic_lights(&window) {
        eprintln!("failed to restore macOS traffic lights: {error}");
    }
}

#[cfg(target_os = "macos")]
fn install_macos_fullscreen_observer<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    use block2::RcBlock;
    use objc2_app_kit::{NSWindow, NSWindowDidExitFullScreenNotification};
    use objc2_foundation::{NSNotification, NSNotificationCenter, NSOperationQueue};
    use std::ptr::NonNull;

    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "找不到主窗口。".to_string())?;
    let ns_window_pointer = window.ns_window().map_err(|error| error.to_string())?;
    let app = app.clone();
    let observer = unsafe {
        let ns_window: &NSWindow = &*ns_window_pointer.cast();
        let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
            restore_main_window_traffic_lights(&app);
        });
        NSNotificationCenter::defaultCenter().addObserverForName_object_queue_usingBlock(
            Some(NSWindowDidExitFullScreenNotification),
            Some(ns_window),
            Some(&NSOperationQueue::mainQueue()),
            &block,
        )
    };

    // 观察器与主窗口同寿命；进程退出时由系统统一回收，不能在 setup 返回时注销。
    std::mem::forget(observer);
    Ok(())
}

#[cfg(target_os = "macos")]
fn schedule_traffic_light_restore<R: Runtime>(window: &Window<R>) {
    let generation = TRAFFIC_LIGHT_REPAIR_GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(TRAFFIC_LIGHT_REPAIR_DELAY).await;
        if TRAFFIC_LIGHT_REPAIR_GENERATION.load(Ordering::Acquire) != generation {
            return;
        }
        let app_for_main_thread = app.clone();
        let _ = app.run_on_main_thread(move || {
            if TRAFFIC_LIGHT_REPAIR_GENERATION.load(Ordering::Acquire) != generation {
                return;
            }
            let Some(window) = app_for_main_thread.get_webview_window(MAIN_WINDOW_LABEL) else {
                return;
            };
            if window.is_fullscreen().unwrap_or(false) {
                return;
            }
            restore_main_window_traffic_lights(&app_for_main_thread);
        });
    });
}

#[cfg(target_os = "macos")]
fn restore_macos_traffic_lights<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    use objc2_app_kit::{NSView, NSWindow, NSWindowButton};

    let position = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == MAIN_WINDOW_LABEL)
        .and_then(|config| config.traffic_light_position.as_ref())
        .ok_or_else(|| "主窗口没有配置交通灯位置。".to_string())?;
    let ns_window_pointer = window.ns_window().map_err(|error| error.to_string())?;

    unsafe {
        let ns_window: &NSWindow = &*ns_window_pointer.cast();
        let close = ns_window
            .standardWindowButton(NSWindowButton::CloseButton)
            .ok_or_else(|| "找不到关闭按钮。".to_string())?;
        let miniaturize = ns_window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .ok_or_else(|| "找不到最小化按钮。".to_string())?;
        let zoom = ns_window.standardWindowButton(NSWindowButton::ZoomButton);
        let button_container = close
            .superview()
            .ok_or_else(|| "找不到窗口按钮容器。".to_string())?;
        let title_bar_container = button_container
            .superview()
            .ok_or_else(|| "找不到标题栏容器。".to_string())?;

        let close_rect = NSView::frame(&close);
        let title_bar_height = close_rect.size.height + position.y;
        let mut title_bar_rect = NSView::frame(&title_bar_container);
        title_bar_rect.size.height = title_bar_height;
        title_bar_rect.origin.y = ns_window.frame().size.height - title_bar_height;
        title_bar_container.setFrame(title_bar_rect);

        let spacing = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
        let mut buttons = vec![close, miniaturize];
        if let Some(zoom) = zoom {
            buttons.push(zoom);
        }
        for (index, button) in buttons.into_iter().enumerate() {
            let mut frame = NSView::frame(&button);
            frame.origin.x = position.x + index as f64 * spacing;
            button.setFrameOrigin(frame.origin);
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn should_reveal_on_reopen(has_visible_windows: bool) -> bool {
    !has_visible_windows
}

#[cfg(target_os = "macos")]
fn should_schedule_traffic_light_restore(
    window_label: &str,
    fullscreen: bool,
    layout_changed: bool,
) -> bool {
    window_label == MAIN_WINDOW_LABEL && !fullscreen && layout_changed
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::{should_reveal_on_reopen, should_schedule_traffic_light_restore};

    #[test]
    fn reveals_the_hidden_main_window_when_the_dock_reopens_the_app() {
        assert!(should_reveal_on_reopen(false));
        assert!(!should_reveal_on_reopen(true));
    }

    #[test]
    fn restores_traffic_lights_only_for_non_fullscreen_main_window_layout_changes() {
        assert!(should_schedule_traffic_light_restore("main", false, true));
        assert!(!should_schedule_traffic_light_restore("main", true, true));
        assert!(!should_schedule_traffic_light_restore(
            "wechat-theme-studio",
            false,
            true
        ));
        assert!(!should_schedule_traffic_light_restore("main", false, false));
    }
}
