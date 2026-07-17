use crate::fs_paths::{safe_resource_filename, unique_hashed_destination_path};
use crate::models::AiImageAttachment;
use image::ImageFormat;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const MAX_AI_IMAGE_ATTACHMENTS: usize = 8;
const MAX_AI_IMAGE_BYTES: usize = 20 * 1024 * 1024;

pub(crate) struct AssistantAttachmentState {
    directory: tempfile::TempDir,
}

impl Default for AssistantAttachmentState {
    fn default() -> Self {
        Self {
            directory: tempfile::Builder::new()
                .prefix("nibva-ai-attachments-")
                .tempdir()
                .expect("failed to create the AI attachment temporary directory"),
        }
    }
}

impl AssistantAttachmentState {
    fn path(&self) -> &Path {
        self.directory.path()
    }
}

#[tauri::command]
pub(crate) fn save_ai_image_attachment(
    state: tauri::State<AssistantAttachmentState>,
    filename: String,
    mime_type: String,
    bytes: Vec<u8>,
) -> Result<AiImageAttachment, String> {
    save_ai_image_attachment_at(state.path(), &filename, &mime_type, &bytes)
}

#[tauri::command]
pub(crate) fn remove_ai_image_attachment(
    state: tauri::State<AssistantAttachmentState>,
    path: String,
) -> Result<(), String> {
    remove_ai_image_attachment_at(state.path(), Path::new(&path))
}

pub(crate) fn resolve_ai_image_paths(
    state: &AssistantAttachmentState,
    paths: &[String],
) -> Result<Vec<PathBuf>, String> {
    resolve_ai_image_paths_at(state.path(), paths)
}

fn resolve_ai_image_paths_at(root: &Path, paths: &[String]) -> Result<Vec<PathBuf>, String> {
    if paths.len() > MAX_AI_IMAGE_ATTACHMENTS {
        return Err(format!("一次最多发送 {MAX_AI_IMAGE_ATTACHMENTS} 张图片。"));
    }
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "AI 图片临时目录不存在，请重新粘贴图片。".to_string())?;
    let mut resolved = Vec::with_capacity(paths.len());
    for path in paths {
        let candidate = Path::new(path);
        if !candidate.is_absolute() {
            return Err("AI 图片临时路径无效，请重新粘贴图片。".to_string());
        }
        let canonical = candidate
            .canonicalize()
            .map_err(|_| "AI 图片临时文件已失效，请重新粘贴图片。".to_string())?;
        if !canonical.is_file() || !canonical.starts_with(&canonical_root) {
            return Err("AI 图片不在当前会话的临时目录中，请重新粘贴图片。".to_string());
        }
        resolved.push(canonical);
    }
    Ok(resolved)
}

fn save_ai_image_attachment_at(
    root: &Path,
    filename: &str,
    _mime_type: &str,
    bytes: &[u8],
) -> Result<AiImageAttachment, String> {
    if bytes.is_empty() {
        return Err("图片附件内容为空。".to_string());
    }
    if bytes.len() > MAX_AI_IMAGE_BYTES {
        return Err("单张图片不能超过 20 MB。".to_string());
    }
    let format = image::guess_format(bytes)
        .map_err(|_| "无法识别图片格式，请使用 PNG、JPEG、WebP 或 GIF。".to_string())?;
    let (extension, mime_type) = match format {
        ImageFormat::Png => ("png", "image/png"),
        ImageFormat::Jpeg => ("jpg", "image/jpeg"),
        ImageFormat::WebP => ("webp", "image/webp"),
        ImageFormat::Gif => ("gif", "image/gif"),
        _ => return Err("暂不支持这种图片格式，请使用 PNG、JPEG、WebP 或 GIF。".to_string()),
    };
    let safe_filename = safe_resource_filename(filename);
    let stem = Path::new(&safe_filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("image");
    let normalized_filename = format!("{stem}.{extension}");
    let destination = unique_hashed_destination_path(root, &normalized_filename, bytes);
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;
    let name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image")
        .to_string();
    let path = destination.display().to_string();
    Ok(AiImageAttachment {
        id: path.clone(),
        name,
        path,
        mime_type: mime_type.to_string(),
        size_bytes: bytes.len() as u64,
    })
}

fn remove_ai_image_attachment_at(root: &Path, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical = path.canonicalize().map_err(|error| error.to_string())?;
    if !canonical.is_file() || !canonical.starts_with(canonical_root) {
        return Err("不能删除当前会话临时目录之外的文件。".to_string());
    }
    fs::remove_file(canonical).map_err(|error| error.to_string())
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
    fn saves_and_removes_images_only_in_the_session_temp_directory() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let attachment = save_ai_image_attachment_at(
            directory.path(),
            "屏幕截图.jpeg",
            "image/jpeg",
            ONE_PIXEL_PNG,
        )?;
        assert_eq!(attachment.mime_type, "image/png");
        assert!(Path::new(&attachment.path).starts_with(directory.path()));
        assert_eq!(
            resolve_ai_image_paths_at(directory.path(), &[attachment.path.clone()])?.len(),
            1
        );
        remove_ai_image_attachment_at(directory.path(), Path::new(&attachment.path))?;
        assert!(!Path::new(&attachment.path).exists());
        Ok(())
    }

    #[test]
    fn rejects_paths_outside_the_session_temp_directory() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let outside = tempfile::NamedTempFile::new().map_err(|error| error.to_string())?;
        assert!(resolve_ai_image_paths_at(
            directory.path(),
            &[outside.path().display().to_string()]
        )
        .is_err());
        assert!(remove_ai_image_attachment_at(directory.path(), outside.path()).is_err());
        Ok(())
    }
}
