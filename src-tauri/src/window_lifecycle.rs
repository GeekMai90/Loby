//! [INPUT]: 依赖 Tauri 主窗口/运行事件、tauri.conf 窗口配置与 macOS AppKit 窗口控件
//! [OUTPUT]: 向 app 组合层提供主窗口平台化关闭、窗口状态持久化、首屏显示与 renderer 信号缺失时的兜底显示、Dock 恢复与全屏退出时无闪动的交通灯位置修复
//! [POS]: native 主窗口生命周期边界，集中平台窗口行为与本机窗口偏好，不持有写作业务状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, Runtime, WebviewWindow, Window, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, DEFAULT_FILENAME};

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";
const TRAFFIC_LIGHT_REPAIR_DELAY: Duration = Duration::from_millis(160);
/// 兜底显示的等待上限。取值只需宽到不会抢在正常冷启动之前，不是对首屏耗时的估计。
const STARTUP_REVEAL_FALLBACK_DELAY: Duration = Duration::from_millis(3000);
static TRAFFIC_LIGHT_REPAIR_GENERATION: AtomicU64 = AtomicU64::new(0);
static MAIN_WINDOW_REVEALED: AtomicBool = AtomicBool::new(false);

pub(crate) fn install_platform_window_observers<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), String> {
    maximize_main_window_on_first_launch(app);
    schedule_startup_reveal_fallback(app);

    #[cfg(target_os = "macos")]
    install_macos_fullscreen_observer(app)?;

    #[cfg(not(target_os = "macos"))]
    let _ = app;

    Ok(())
}

/// renderer 的揭窗信号跑在隐藏 WebView 里，而系统会挂起隐藏 WebView 的定时器与
/// animation frame。一旦这个信号没能穿出来，主窗口就会永远隐藏、应用完全不可用。
/// 兜底只有放在不受 WebView 挂起影响的原生侧才有意义；它不参与正常路径，
/// 只保证"窗口绝不会永远不显示"这一条底线。
fn schedule_startup_reveal_fallback<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_REVEAL_FALLBACK_DELAY).await;
        if MAIN_WINDOW_REVEALED.load(Ordering::Acquire) {
            return;
        }
        let _ = app.clone().run_on_main_thread(move || {
            if MAIN_WINDOW_REVEALED.load(Ordering::Acquire) {
                return;
            }
            let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
                return;
            };
            eprintln!("renderer 未在预期时间内报告首屏就绪，按兜底显示主窗口。");
            if let Err(error) = reveal_main_window(&window) {
                eprintln!("failed to reveal the main window from the startup fallback: {error}");
            }
        });
    });
}

#[tauri::command]
pub(crate) fn mark_main_window_ready(window: WebviewWindow) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Ok(());
    }
    // 兜底已经显示过窗口时，迟到的 renderer 信号不能再抢一次焦点——用户此时
    // 可能已经切到别的应用。Dock 恢复走 reveal_main_window，不受这条约束。
    if MAIN_WINDOW_REVEALED.load(Ordering::Acquire) {
        return Ok(());
    }
    reveal_main_window(&window)
}

#[tauri::command]
pub(crate) fn dismiss_main_window(window: WebviewWindow) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Ok(());
    }

    persist_window_state(window.app_handle());

    #[cfg(target_os = "macos")]
    return window.hide().map_err(|error| error.to_string());

    #[cfg(not(target_os = "macos"))]
    window.destroy().map_err(|error| error.to_string())
}

pub(crate) fn handle_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
    if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
        persist_window_state(app);
    }

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
            // 交通灯修复本身会触发一次窗口布局事件，因此这里只做防抖调度。
            // 若在 Resized 回调里同步修改 AppKit 标题栏，会与原生最大化动画互相重入。
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
    window.set_focus().map_err(|error| error.to_string())?;
    MAIN_WINDOW_REVEALED.store(true, Ordering::Release);
    Ok(())
}

fn window_state_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

fn persist_window_state<R: Runtime>(app: &AppHandle<R>) {
    if let Err(error) = app.save_window_state(window_state_flags()) {
        eprintln!("failed to persist the main window state: {error}");
    }
}

/// 保留旧版本的首次启动体验；一旦存在插件写入的主窗口状态，就完全交给插件恢复。
fn maximize_main_window_on_first_launch<R: Runtime>(app: &AppHandle<R>) {
    if has_saved_main_window_state(app) {
        return;
    }

    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    if let Err(error) = window.maximize() {
        eprintln!("failed to maximize the main window on first launch: {error}");
    }
}

fn has_saved_main_window_state<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Ok(app_config_dir) = app.path().app_config_dir() else {
        return false;
    };
    let Ok(raw) = std::fs::read_to_string(app_config_dir.join(DEFAULT_FILENAME)) else {
        return false;
    };
    saved_window_state_includes_main_window(&raw)
}

fn saved_window_state_includes_main_window(raw: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|value| value.get(MAIN_WINDOW_LABEL).cloned())
        .and_then(|state| state.as_object().cloned())
        .is_some_and(|state| {
            state
                .get("width")
                .and_then(serde_json::Value::as_u64)
                .is_some_and(|width| width > 0)
                && state
                    .get("height")
                    .and_then(serde_json::Value::as_u64)
                    .is_some_and(|height| height > 0)
        })
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
        let target_title_bar_origin_y = ns_window.frame().size.height - title_bar_height;
        let title_bar_needs_update =
            !approximately_equal(title_bar_rect.size.height, title_bar_height)
                || !approximately_equal(title_bar_rect.origin.y, target_title_bar_origin_y);
        if title_bar_needs_update {
            title_bar_rect.size.height = title_bar_height;
            title_bar_rect.origin.y = target_title_bar_origin_y;
            title_bar_container.setFrame(title_bar_rect);
        }

        let spacing = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
        let mut buttons = vec![close, miniaturize];
        if let Some(zoom) = zoom {
            buttons.push(zoom);
        }
        for (index, button) in buttons.into_iter().enumerate() {
            let mut frame = NSView::frame(&button);
            let target_origin_x = position.x + index as f64 * spacing;
            if !approximately_equal(frame.origin.x, target_origin_x) {
                frame.origin.x = target_origin_x;
                button.setFrameOrigin(frame.origin);
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn approximately_equal(left: f64, right: f64) -> bool {
    (left - right).abs() < 0.5
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

#[cfg(test)]
mod window_state_tests {
    use super::saved_window_state_includes_main_window;

    #[test]
    fn accepts_a_valid_main_window_state() {
        assert!(saved_window_state_includes_main_window(
            r#"{"main":{"width":1360,"height":900,"x":0,"y":0,"maximized":false}}"#
        ));
    }

    #[test]
    fn rejects_missing_invalid_or_empty_main_window_state() {
        assert!(!saved_window_state_includes_main_window(r#"{}"#));
        assert!(!saved_window_state_includes_main_window(
            r#"{"main":{"width":0,"height":900}}"#
        ));
        assert!(!saved_window_state_includes_main_window(
            r#"{"main":{"width":1360,"height":0}}"#
        ));
        assert!(!saved_window_state_includes_main_window("not-json"));
    }
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
