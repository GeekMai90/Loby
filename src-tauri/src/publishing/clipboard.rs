//! [INPUT]: 依赖 Tauri 主线程调度、serde 请求反序列化与 macOS NSPasteboard 原生剪贴板
//! [OUTPUT]: 向 publishing 提供 write_wechat_clipboard_prelude command，按摘要、标题顺序写入独立系统剪贴板记录并等待管理器捕获
//! [POS]: 发布领域的原生剪贴板前序适配边界，为 renderer 最终使用 WebKit 写入公众号富文本保留稳定的历史记录间隔
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde::Deserialize;

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
#[cfg(target_os = "macos")]
use objc2_foundation::NSString;
#[cfg(target_os = "macos")]
use std::time::Duration;
#[cfg(target_os = "macos")]
use tauri::AppHandle;

#[cfg(target_os = "macos")]
// HapiGo 能直接感知实体 Cmd+C，但应用主动改写 NSPasteboard 时依赖轮询。
// 间隔必须跨过一轮监听，否则中间的标题会在入库前被最后的富文本覆盖。
const CLIPBOARD_HISTORY_SETTLE_DELAY: Duration = Duration::from_millis(1200);
#[cfg(not(target_os = "macos"))]
const UNSUPPORTED_PLATFORM_ERROR: &str = "NATIVE_WECHAT_CLIPBOARD_UNSUPPORTED";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatClipboardPreludeRequest {
    description: String,
    title: String,
}

#[cfg(any(target_os = "macos", test))]
#[derive(Debug, PartialEq, Eq)]
struct ClipboardTextEntry(String);

#[tauri::command]
pub(crate) async fn write_wechat_clipboard_prelude(
    app: tauri::AppHandle,
    request: WechatClipboardPreludeRequest,
) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = (request.description, request.title);
        Err(UNSUPPORTED_PLATFORM_ERROR.to_string())
    }

    #[cfg(target_os = "macos")]
    {
        for entry in clipboard_entries(request) {
            write_entry_on_main_thread(&app, entry).await?;
            tokio::time::sleep(CLIPBOARD_HISTORY_SETTLE_DELAY).await;
        }
        Ok(())
    }
}

#[cfg(any(target_os = "macos", test))]
fn clipboard_entries(request: WechatClipboardPreludeRequest) -> Vec<ClipboardTextEntry> {
    let mut entries = Vec::with_capacity(2);
    let description = request.description.trim();
    if !description.is_empty() {
        entries.push(ClipboardTextEntry(description.to_string()));
    }

    let title = request.title.trim();
    if !title.is_empty() {
        entries.push(ClipboardTextEntry(title.to_string()));
    }
    entries
}

#[cfg(target_os = "macos")]
async fn write_entry_on_main_thread(
    app: &AppHandle,
    entry: ClipboardTextEntry,
) -> Result<(), String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(write_macos_clipboard_entry(entry));
    })
    .map_err(|error| format!("无法调度系统剪贴板写入：{error}"))?;

    receiver
        .await
        .map_err(|_| "系统剪贴板写入任务意外中断".to_string())?
}

#[cfg(target_os = "macos")]
fn write_macos_clipboard_entry(entry: ClipboardTextEntry) -> Result<(), String> {
    let pasteboard = NSPasteboard::generalPasteboard();
    pasteboard.clearContents();

    let value = NSString::from_str(&entry.0);
    let written = unsafe { pasteboard.setString_forType(&value, NSPasteboardTypeString) };

    if written {
        Ok(())
    } else {
        Err("macOS 系统剪贴板拒绝写入公众号内容".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(description: &str) -> WechatClipboardPreludeRequest {
        WechatClipboardPreludeRequest {
            description: description.to_string(),
            title: " 文章标题 ".to_string(),
        }
    }

    #[test]
    fn builds_summary_and_title_as_independent_prelude_entries() {
        assert_eq!(
            clipboard_entries(request(" 文章摘要 ")),
            vec![
                ClipboardTextEntry("文章摘要".to_string()),
                ClipboardTextEntry("文章标题".to_string()),
            ]
        );
    }

    #[test]
    fn skips_an_empty_summary_without_changing_the_remaining_order() {
        assert_eq!(
            clipboard_entries(request("   ")),
            vec![ClipboardTextEntry("文章标题".to_string())]
        );
    }
}
