//! [INPUT]: 依赖 std fs/path/process、reqwest、临时目录、图片格式识别、macOS quicklook 面板与各平台系统打开命令
//! [OUTPUT]: 向 crate 提供 ImagePreviewState、open_local_path、preview_local_image、prepare_image_preview、copy_local_file、reveal_local_path
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

const MAX_REMOTE_PREVIEW_BYTES: u64 = 25 * 1024 * 1024;

pub(crate) struct ImagePreviewState {
    directory: tempfile::TempDir,
}

impl Default for ImagePreviewState {
    fn default() -> Self {
        Self {
            directory: tempfile::Builder::new()
                .prefix("loby-image-previews-")
                .tempdir()
                .expect("failed to create the image preview temporary directory"),
        }
    }
}

#[cfg(target_os = "macos")]
use quicklook::{PreviewItem, QuickLookPanel};
#[cfg(target_os = "macos")]
use std::cell::RefCell;

#[cfg(target_os = "macos")]
thread_local! {
    static QUICK_LOOK_PANEL: RefCell<Option<QuickLookPanel>> = const { RefCell::new(None) };
}

#[tauri::command]
pub(crate) fn open_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&target).status()
    } else {
        Command::new("xdg-open").arg(&target).status()
    }
    .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Open command failed with status: {}", status))
    }
}

#[tauri::command]
pub(crate) fn preview_local_image(path: String) -> Result<(), String> {
    preview_image_path(&PathBuf::from(path))
}

#[tauri::command]
pub(crate) async fn prepare_image_preview(
    state: State<'_, ImagePreviewState>,
    source: String,
) -> Result<String, String> {
    let target = if source.starts_with("http://") || source.starts_with("https://") {
        download_preview_image(state.directory.path(), &source).await?
    } else {
        PathBuf::from(source)
    };
    if !target.is_file() {
        return Err("Image file does not exist.".to_string());
    }
    Ok(target.display().to_string())
}

fn preview_image_path(target: &Path) -> Result<(), String> {
    if !target.is_file() {
        return Err("Image file does not exist.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let preview_item = PreviewItem::from_file_url(target, None)
            .ok_or_else(|| "Image path cannot be previewed.".to_string())?;
        QUICK_LOOK_PANEL
            .try_with(|panel_slot| {
                let mut panel_slot = panel_slot.borrow_mut();
                if panel_slot.is_none() {
                    *panel_slot = QuickLookPanel::shared();
                }
                let panel = panel_slot
                    .as_ref()
                    .ok_or_else(|| "Quick Look is unavailable.".to_string())?;
                panel.set_items(vec![preview_item]);
                panel.reload_if_dirty();
                panel.set_current_preview_item_index(0);
                panel.show();
                Ok(())
            })
            .map_err(|error| error.to_string())?
    }

    #[cfg(not(target_os = "macos"))]
    open_local_path(target.display().to_string())
}

async fn download_preview_image(root: &Path, source: &str) -> Result<PathBuf, String> {
    let mut response = reqwest::Client::new()
        .get(source)
        .send()
        .await
        .map_err(|error| format!("下载预览图片失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("下载预览图片失败：HTTP {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_REMOTE_PREVIEW_BYTES)
    {
        return Err("预览图片不能超过 25 MB。".to_string());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("读取预览图片失败：{error}"))?
    {
        if bytes.len() as u64 + chunk.len() as u64 > MAX_REMOTE_PREVIEW_BYTES {
            return Err("预览图片不能超过 25 MB。".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    save_remote_preview_at(root, &bytes)
}

fn save_remote_preview_at(root: &Path, bytes: &[u8]) -> Result<PathBuf, String> {
    let extension = match image::guess_format(bytes)
        .map_err(|_| "无法识别预览图片格式。".to_string())?
    {
        image::ImageFormat::Png => "png",
        image::ImageFormat::Jpeg => "jpg",
        image::ImageFormat::WebP => "webp",
        _ => return Err("暂不支持这种预览图片格式。".to_string()),
    };
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    let target = root.join(format!("remote-{:016x}.{extension}", hasher.finish()));
    if !target.is_file() {
        fs::write(&target, bytes).map_err(|error| error.to_string())?;
    }
    Ok(target)
}

#[tauri::command]
pub(crate) fn copy_local_file(source_path: String, destination_path: String) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let destination = PathBuf::from(destination_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn reveal_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .status()
    } else {
        let folder = if target.is_dir() {
            target.as_path()
        } else {
            target.parent().unwrap_or_else(|| Path::new("."))
        };
        Command::new("xdg-open").arg(folder).status()
    }
    .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err("Failed to reveal local path.".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ONE_PIXEL_PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6,
        0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240, 31,
        0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];

    #[test]
    fn saves_remote_preview_bytes_in_the_managed_temporary_directory() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let first = save_remote_preview_at(directory.path(), ONE_PIXEL_PNG)?;
        let second = save_remote_preview_at(directory.path(), ONE_PIXEL_PNG)?;
        assert_eq!(first, second);
        assert_eq!(
            first.extension().and_then(|value| value.to_str()),
            Some("png")
        );
        assert!(first.starts_with(directory.path()));
        assert!(first.is_file());
        Ok(())
    }

    #[test]
    fn copy_local_file_creates_destination_directories() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("loby-copy-local-file-test-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;
        let source = root.join("source.txt");
        let destination = root.join("nested").join("destination.txt");
        fs::write(&source, "content").map_err(|error| error.to_string())?;

        copy_local_file(
            source.display().to_string(),
            destination.display().to_string(),
        )?;

        assert_eq!(
            fs::read_to_string(&destination).map_err(|error| error.to_string())?,
            "content"
        );
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
