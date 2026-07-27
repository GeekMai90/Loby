//! [INPUT]: 依赖 fs_paths 原子写入、AiAttachment 模型、image/sha2 校验、进程临时目录与写作库受管目录
//! [OUTPUT]: 向 crate 提供附件数量上限、临时保存/删除、内容寻址持久化及跨重启受控路径解析
//! [POS]: 本地 AI agent 的附件所有权边界；composer 只持有临时文件，发送后提升到写作库并供历史轮次安全复用
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::{unique_hashed_destination_path, write_if_changed};
use crate::models::AiAttachment;
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const MAX_AI_ATTACHMENTS: usize = 8;
const MAX_AI_ATTACHMENT_BYTES: usize = 20 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AssistantAttachmentKind {
    Image,
    Document,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ResolvedAssistantAttachment {
    pub(crate) name: String,
    pub(crate) path: PathBuf,
    pub(crate) kind: AssistantAttachmentKind,
}

pub(crate) struct AssistantAttachmentState {
    directory: tempfile::TempDir,
}

impl Default for AssistantAttachmentState {
    fn default() -> Self {
        Self {
            directory: tempfile::Builder::new()
                .prefix("loby-ai-attachments-")
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
pub(crate) fn save_ai_attachment(
    state: tauri::State<AssistantAttachmentState>,
    filename: String,
    mime_type: String,
    bytes: Vec<u8>,
) -> Result<AiAttachment, String> {
    save_ai_attachment_at(state.path(), &filename, &mime_type, &bytes)
}

#[tauri::command]
pub(crate) fn remove_ai_attachment(
    state: tauri::State<AssistantAttachmentState>,
    path: String,
) -> Result<(), String> {
    remove_ai_attachment_at(state.path(), Path::new(&path))
}

#[tauri::command]
pub(crate) fn persist_ai_attachments(
    state: tauri::State<AssistantAttachmentState>,
    path: String,
    attachments: Vec<AiAttachment>,
) -> Result<Vec<AiAttachment>, String> {
    let library_path = canonical_library_path(&path)?;
    persist_ai_attachments_at(state.path(), &library_path, &attachments)
}

pub(crate) fn resolve_ai_attachments(
    state: &AssistantAttachmentState,
    library_path: &Path,
    paths: &[String],
) -> Result<Vec<ResolvedAssistantAttachment>, String> {
    resolve_ai_attachments_at(state.path(), library_path, paths)
}

fn resolve_ai_attachments_at(
    temporary_root: &Path,
    library_path: &Path,
    paths: &[String],
) -> Result<Vec<ResolvedAssistantAttachment>, String> {
    if paths.len() > MAX_AI_ATTACHMENTS {
        return Err(format!("一次最多发送 {MAX_AI_ATTACHMENTS} 个附件。"));
    }
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let canonical_temporary_root = temporary_root
        .canonicalize()
        .map_err(|_| "AI 附件临时目录不存在，请重新添加附件。".to_string())?;
    let managed_root = managed_attachment_root(library_path);
    let canonical_managed_root = managed_root.canonicalize().ok();
    let mut resolved = Vec::with_capacity(paths.len());
    for path in paths {
        let candidate = Path::new(path);
        if !candidate.is_absolute() {
            return Err("AI 附件临时路径无效，请重新添加附件。".to_string());
        }
        let canonical = candidate
            .canonicalize()
            .map_err(|_| "AI 附件临时文件已失效，请重新添加附件。".to_string())?;
        let allowed = canonical.starts_with(&canonical_temporary_root)
            || canonical_managed_root
                .as_ref()
                .is_some_and(|root| canonical.starts_with(root));
        if !canonical.is_file() || !allowed {
            return Err("AI 附件不在当前会话或写作库的受管目录中。".to_string());
        }
        let name = canonical
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "AI 附件文件名无效。".to_string())?
            .to_string();
        resolved.push(ResolvedAssistantAttachment {
            kind: attachment_kind_from_path(&canonical)?,
            name,
            path: canonical,
        });
    }
    Ok(resolved)
}

fn persist_ai_attachments_at(
    temporary_root: &Path,
    library_path: &Path,
    attachments: &[AiAttachment],
) -> Result<Vec<AiAttachment>, String> {
    if attachments.len() > MAX_AI_ATTACHMENTS {
        return Err(format!("一次最多发送 {MAX_AI_ATTACHMENTS} 个附件。"));
    }
    let managed_root = managed_attachment_root(library_path);
    fs::create_dir_all(&managed_root).map_err(|error| error.to_string())?;
    let canonical_temporary_root = temporary_root
        .canonicalize()
        .map_err(|_| "AI 附件临时目录不存在，请重新添加附件。".to_string())?;
    let canonical_managed_root = managed_root
        .canonicalize()
        .map_err(|error| error.to_string())?;
    attachments
        .iter()
        .map(|attachment| {
            let source = Path::new(&attachment.path)
                .canonicalize()
                .map_err(|_| "AI 附件已经失效，请重新添加。".to_string())?;
            if !source.is_file()
                || (!source.starts_with(&canonical_temporary_root)
                    && !source.starts_with(&canonical_managed_root))
            {
                return Err("AI 附件不在允许的受管目录中。".to_string());
            }
            let bytes = fs::read(&source).map_err(|error| error.to_string())?;
            if bytes.is_empty() || bytes.len() > MAX_AI_ATTACHMENT_BYTES {
                return Err("AI 附件为空或超过 20 MB。".to_string());
            }
            let hash = format!("{:x}", Sha256::digest(&bytes));
            let content_directory = managed_root.join(&hash);
            fs::create_dir_all(&content_directory).map_err(|error| error.to_string())?;
            let extension = source
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            let mut filename = safe_ai_attachment_filename(&attachment.name);
            if Path::new(&filename).extension().is_none() && !extension.is_empty() {
                filename.push('.');
                filename.push_str(extension);
            }
            let destination = content_directory.join(filename);
            write_if_changed(&destination, &bytes)?;
            let destination = destination
                .canonicalize()
                .map_err(|error| error.to_string())?;
            let kind = attachment_kind_from_path(&destination)?;
            Ok(AiAttachment {
                id: destination.display().to_string(),
                name: attachment.name.clone(),
                path: destination.display().to_string(),
                mime_type: mime_type_from_path(&destination).to_string(),
                size_bytes: bytes.len() as u64,
                kind: match kind {
                    AssistantAttachmentKind::Image => "image",
                    AssistantAttachmentKind::Document => "document",
                }
                .to_string(),
            })
        })
        .collect()
}

fn managed_attachment_root(library_path: &Path) -> PathBuf {
    library_path.join(".loby").join("ai").join("attachments")
}

fn canonical_library_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())?;
    path.is_dir()
        .then_some(path)
        .ok_or_else(|| "当前写作库路径不是目录。".to_string())
}

fn save_ai_attachment_at(
    root: &Path,
    filename: &str,
    mime_type: &str,
    bytes: &[u8],
) -> Result<AiAttachment, String> {
    if bytes.is_empty() {
        return Err("附件内容为空。".to_string());
    }
    if bytes.len() > MAX_AI_ATTACHMENT_BYTES {
        return Err("单个附件不能超过 20 MB。".to_string());
    }
    let safe_filename = safe_ai_attachment_filename(filename);
    let stem = Path::new(&safe_filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("attachment");
    let requested_extension = Path::new(&safe_filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let requested_mime = mime_type.trim().to_ascii_lowercase();
    let (kind, extension, normalized_mime) = if requested_mime.starts_with("image/")
        || matches!(
            requested_extension.as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "gif"
        ) {
        let format = image::guess_format(bytes)
            .map_err(|_| "无法识别图片格式，请使用 PNG、JPEG、WebP 或 GIF。".to_string())?;
        let (extension, mime_type) = match format {
            ImageFormat::Png => ("png", "image/png"),
            ImageFormat::Jpeg => ("jpg", "image/jpeg"),
            ImageFormat::WebP => ("webp", "image/webp"),
            ImageFormat::Gif => ("gif", "image/gif"),
            _ => return Err("暂不支持这种图片格式，请使用 PNG、JPEG、WebP 或 GIF。".to_string()),
        };
        (AssistantAttachmentKind::Image, extension, mime_type)
    } else {
        let normalized = validate_document_attachment(&requested_extension, bytes)?;
        (
            AssistantAttachmentKind::Document,
            normalized.0,
            normalized.1,
        )
    };
    let normalized_filename = format!("{stem}.{extension}");
    let destination = unique_hashed_destination_path(root, &normalized_filename, bytes);
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;
    let name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment")
        .to_string();
    let path = destination.display().to_string();
    Ok(AiAttachment {
        id: path.clone(),
        name,
        path,
        mime_type: normalized_mime.to_string(),
        size_bytes: bytes.len() as u64,
        kind: match kind {
            AssistantAttachmentKind::Image => "image",
            AssistantAttachmentKind::Document => "document",
        }
        .to_string(),
    })
}

fn validate_document_attachment(
    extension: &str,
    bytes: &[u8],
) -> Result<(&'static str, &'static str), String> {
    match extension {
        "pdf" if bytes.windows(5).take(1024).any(|window| window == b"%PDF-") => {
            Ok(("pdf", "application/pdf"))
        }
        "docx" if bytes.starts_with(b"PK") && bytes.windows(5).any(|window| window == b"word/") => {
            Ok((
                "docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ))
        }
        "doc" if bytes.starts_with(&[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) => {
            Ok(("doc", "application/msword"))
        }
        "txt" | "md" | "markdown" | "csv" | "json" if std::str::from_utf8(bytes).is_ok() => {
            let (extension, mime_type) = match extension {
                "md" | "markdown" => ("md", "text/markdown"),
                "csv" => ("csv", "text/csv"),
                "json" => ("json", "application/json"),
                _ => ("txt", "text/plain"),
            };
            Ok((extension, mime_type))
        }
        "pdf" => Err("无法识别 PDF 文件内容。".to_string()),
        "docx" => Err("无法识别 DOCX 文件内容。".to_string()),
        "doc" => Err("无法识别 DOC 文件内容。".to_string()),
        "txt" | "md" | "markdown" | "csv" | "json" => {
            Err("文本附件必须使用 UTF-8 编码。".to_string())
        }
        _ => {
            Err("暂不支持这种附件，请使用图片、PDF、Word、TXT、Markdown、CSV 或 JSON。".to_string())
        }
    }
}

fn attachment_kind_from_path(path: &Path) -> Result<AssistantAttachmentKind, String> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" | "jpg" | "jpeg" | "webp" | "gif" => Ok(AssistantAttachmentKind::Image),
        "pdf" | "doc" | "docx" | "txt" | "md" | "csv" | "json" => {
            Ok(AssistantAttachmentKind::Document)
        }
        _ => Err("AI 附件类型无效，请重新添加附件。".to_string()),
    }
}

fn mime_type_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        _ => "text/plain",
    }
}

fn safe_ai_attachment_filename(value: &str) -> String {
    let basename = value.trim().rsplit(['/', '\\']).next().unwrap_or_default();
    let sanitized = basename
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let sanitized = sanitized.trim_start_matches(['.', '-']);
    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "attachment".to_string()
    } else {
        sanitized.to_string()
    }
}

fn remove_ai_attachment_at(root: &Path, path: &Path) -> Result<(), String> {
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
    fn saves_and_removes_attachments_only_in_the_session_temp_directory() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let attachment = save_ai_attachment_at(
            directory.path(),
            "屏幕截图.jpeg",
            "image/jpeg",
            ONE_PIXEL_PNG,
        )?;
        assert_eq!(attachment.mime_type, "image/png");
        assert_eq!(attachment.kind, "image");
        assert!(Path::new(&attachment.path).starts_with(directory.path()));
        let resolved = resolve_ai_attachments_at(
            directory.path(),
            directory.path(),
            std::slice::from_ref(&attachment.path),
        )?;
        assert_eq!(resolved[0].kind, AssistantAttachmentKind::Image);
        remove_ai_attachment_at(directory.path(), Path::new(&attachment.path))?;
        assert!(!Path::new(&attachment.path).exists());
        Ok(())
    }

    #[test]
    fn saves_pdf_and_word_files_as_document_attachments() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let pdf = save_ai_attachment_at(
            directory.path(),
            "资料.pdf",
            "application/pdf",
            b"%PDF-1.7\n%%EOF",
        )?;
        let docx = save_ai_attachment_at(
            directory.path(),
            "文章.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"PK\x03\x04word/document.xml",
        )?;
        let doc = save_ai_attachment_at(
            directory.path(),
            "旧稿.doc",
            "application/msword",
            &[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
        )?;
        assert_eq!(pdf.kind, "document");
        assert_eq!(pdf.name, "资料.pdf");
        assert_eq!(docx.kind, "document");
        assert_eq!(doc.kind, "document");
        let resolved = resolve_ai_attachments_at(
            directory.path(),
            directory.path(),
            &[pdf.path, docx.path, doc.path],
        )?;
        assert!(resolved
            .iter()
            .all(|attachment| attachment.kind == AssistantAttachmentKind::Document));
        Ok(())
    }

    #[test]
    fn safe_attachment_filename_keeps_unicode_but_removes_path_segments() {
        assert_eq!(safe_ai_attachment_filename("../../资料.pdf"), "资料.pdf");
        assert_eq!(safe_ai_attachment_filename(r"..\..\文章.docx"), "文章.docx");
    }

    #[test]
    fn rejects_unsupported_or_malformed_documents() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        assert!(save_ai_attachment_at(
            directory.path(),
            "legacy.doc",
            "application/msword",
            b"legacy"
        )
        .is_err());
        assert!(save_ai_attachment_at(
            directory.path(),
            "fake.pdf",
            "application/pdf",
            b"not a pdf"
        )
        .is_err());
        assert!(
            save_ai_attachment_at(directory.path(), "binary.txt", "text/plain", &[0xff, 0xfe])
                .is_err()
        );
        Ok(())
    }

    #[test]
    fn rejects_paths_outside_the_session_temp_directory() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let outside = tempfile::NamedTempFile::new().map_err(|error| error.to_string())?;
        assert!(resolve_ai_attachments_at(
            directory.path(),
            directory.path(),
            &[outside.path().display().to_string()]
        )
        .is_err());
        assert!(remove_ai_attachment_at(directory.path(), outside.path()).is_err());
        Ok(())
    }

    #[test]
    fn promotes_temporary_attachments_into_a_content_addressed_library_directory(
    ) -> Result<(), String> {
        let temporary = tempfile::tempdir().map_err(|error| error.to_string())?;
        let library = tempfile::tempdir().map_err(|error| error.to_string())?;
        let attachment =
            save_ai_attachment_at(temporary.path(), "封面.png", "image/png", ONE_PIXEL_PNG)?;
        let persisted = persist_ai_attachments_at(temporary.path(), library.path(), &[attachment])?;

        assert_eq!(persisted.len(), 1);
        assert!(Path::new(&persisted[0].path).starts_with(
            managed_attachment_root(library.path())
                .canonicalize()
                .map_err(|error| error.to_string())?
        ));
        assert!(Path::new(&persisted[0].path).is_file());
        let resolved = resolve_ai_attachments_at(
            temporary.path(),
            library.path(),
            &[persisted[0].path.clone()],
        )?;
        assert_eq!(resolved[0].kind, AssistantAttachmentKind::Image);
        Ok(())
    }
}
