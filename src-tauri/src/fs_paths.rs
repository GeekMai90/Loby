//! [INPUT]: 依赖 std fs/OpenOptions、path、Write 与系统时间，处理所有调用方传入的非可信路径片段
//! [OUTPUT]: 向 crate 提供 write_if_changed、path_file_stem、is_hidden_path、is_markdown_file、safe_file_segment、stable_id_segment、safe_export_filename、safe_resource_filename 等受控能力
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::fs;
#[cfg(not(windows))]
use std::fs::OpenOptions;
#[cfg(not(windows))]
use std::io::Write;
use std::path::{Path, PathBuf};
#[cfg(not(windows))]
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn write_if_changed(path: &Path, contents: impl AsRef<[u8]>) -> Result<bool, String> {
    let contents = contents.as_ref();
    if fs::metadata(path)
        .map(|metadata| metadata.len() == contents.len() as u64)
        .unwrap_or(false)
        && fs::read(path)
            .map(|existing| existing == contents)
            .unwrap_or(false)
    {
        return Ok(false);
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Destination path has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    #[cfg(windows)]
    {
        fs::write(path, contents).map_err(|error| error.to_string())?;
    }

    #[cfg(not(windows))]
    {
        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("loby-data");
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let temporary_path = parent.join(format!(
            ".{filename}.loby-tmp-{}-{timestamp}",
            std::process::id()
        ));
        let write_result = (|| -> Result<(), String> {
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&temporary_path)
                .map_err(|error| error.to_string())?;
            file.write_all(contents)
                .map_err(|error| error.to_string())?;
            file.sync_all().map_err(|error| error.to_string())?;
            drop(file);
            fs::rename(&temporary_path, path).map_err(|error| error.to_string())?;
            Ok(())
        })();
        if write_result.is_err() {
            let _ = fs::remove_file(&temporary_path);
        }
        write_result?;
    }

    Ok(true)
}

pub(crate) fn path_file_stem(path: &Path, fallback: &str) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

pub(crate) fn is_hidden_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

pub(crate) fn is_markdown_file(path: &Path) -> bool {
    path.is_file()
        && matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase()),
            Some(value) if value == "md" || value == "markdown"
        )
        && path.file_name().and_then(|value| value.to_str()) != Some("README.md")
}

pub(crate) fn safe_file_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub(crate) fn stable_id_segment(value: &str) -> String {
    let safe = safe_file_segment(value);
    if !safe.is_empty() {
        return safe;
    }

    let hash = value
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        });
    format!("{hash:016x}")
}

pub(crate) fn safe_export_filename(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
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

    let sanitized = sanitized.trim_start_matches(['.', '-']).to_string();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "loby-export.md".to_string()
    } else {
        sanitized
    }
}

pub(crate) fn safe_resource_filename(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
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
    let sanitized = sanitized.trim_start_matches(['.', '-']).to_string();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "resource".to_string()
    } else {
        sanitized
    }
}

pub(crate) fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let mut path = PathBuf::new();
    for component in Path::new(value).components() {
        match component {
            std::path::Component::Normal(segment) => path.push(segment),
            _ => return Err(format!("Unsafe relative path: {}", value)),
        }
    }
    if path.as_os_str().is_empty() {
        return Err("Relative path cannot be empty.".to_string());
    }
    Ok(path)
}

pub(crate) fn unique_destination_path(directory: &Path, filename: &str) -> PathBuf {
    let candidate = directory.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("resource");
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 2.. {
        let name = match extension {
            Some(extension) if !extension.is_empty() => format!("{}-{}.{}", stem, index, extension),
            _ => format!("{}-{}", stem, index),
        };
        let candidate = directory.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("unique destination loop should always return")
}

pub(crate) fn unique_hashed_destination_path(
    directory: &Path,
    filename: &str,
    contents: &[u8],
) -> PathBuf {
    let candidate = directory.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = path.extension().and_then(|value| value.to_str());
    for collision in 0.. {
        let hash = short_content_hash(contents, collision);
        let name = match extension {
            Some(extension) if !extension.is_empty() => format!("{stem}-{hash}.{extension}"),
            _ => format!("{stem}-{hash}"),
        };
        let candidate = directory.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("unique hashed destination loop should always return")
}

fn short_content_hash(contents: &[u8], collision: u64) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in contents.iter().copied().chain(collision.to_le_bytes()) {
        hash = (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")[..8].to_string()
}

pub(crate) fn is_text_resource_extension(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown"
            | "txt"
            | "text"
            | "html"
            | "htm"
            | "json"
            | "jsonl"
            | "csv"
            | "tsv"
            | "yaml"
            | "yml"
            | "xml"
            | "css"
            | "js"
            | "jsx"
            | "ts"
            | "tsx"
            | "rtf"
            | "log"
    )
}

pub(crate) fn is_markdown_import_extension(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "txt" | "text"
    )
}

pub(crate) fn is_image_file_extension(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "avif" | "gif" | "jpeg" | "jpg" | "png" | "svg" | "webp"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_file_segment_normalizes_ascii_only_segments() {
        assert_eq!(safe_file_segment("Hello World_2026!"), "hello-world_2026");
        assert_eq!(safe_file_segment("中文标题"), "");
    }

    #[test]
    fn write_if_changed_skips_identical_content_and_replaces_changes() -> Result<(), String> {
        let directory =
            std::env::temp_dir().join(format!("loby-write-if-changed-test-{}", std::process::id()));
        if directory.exists() {
            std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        }
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let destination = directory.join("document.md");

        assert!(write_if_changed(&destination, "first")?);
        assert!(!write_if_changed(&destination, "first")?);
        assert!(write_if_changed(&destination, "second")?);
        assert_eq!(
            std::fs::read_to_string(&destination).map_err(|error| error.to_string())?,
            "second"
        );
        assert_eq!(
            std::fs::read_dir(&directory)
                .map_err(|error| error.to_string())?
                .count(),
            1
        );

        std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn stable_id_segment_hashes_non_ascii_titles() {
        let first = stable_id_segment("中文标题");
        let second = stable_id_segment("中文标题");

        assert_eq!(first, second);
        assert_eq!(first.len(), 16);
    }

    #[test]
    fn safe_export_filename_preserves_extension_without_path_segments() {
        assert_eq!(
            safe_export_filename("../My Export: Final.md"),
            "My-Export-Final.md"
        );
        assert_eq!(safe_export_filename(""), "loby-export.md");
    }

    #[test]
    fn safe_resource_filename_removes_path_like_segments() {
        assert_eq!(
            safe_resource_filename("../../Reference File.pdf"),
            "Reference-File.pdf"
        );
        assert_eq!(safe_resource_filename(""), "resource");
    }

    #[test]
    fn safe_relative_path_rejects_escape_paths() {
        assert_eq!(
            safe_relative_path("assets/image.png").unwrap(),
            PathBuf::from("assets/image.png")
        );
        assert!(safe_relative_path("../secret.txt").is_err());
        assert!(safe_relative_path("/tmp/secret.txt").is_err());
        assert!(safe_relative_path("").is_err());
    }

    #[test]
    fn unique_destination_path_adds_suffix_when_needed() -> Result<(), String> {
        let directory =
            std::env::temp_dir().join(format!("loby-fs-paths-test-{}", std::process::id()));
        if directory.exists() {
            std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        }
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        std::fs::write(directory.join("image.png"), b"data").map_err(|error| error.to_string())?;

        assert_eq!(
            unique_destination_path(&directory, "image.png"),
            directory.join("image-2.png")
        );

        std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn unique_hashed_destination_path_uses_short_hashes_for_image_conflicts() -> Result<(), String>
    {
        let directory =
            std::env::temp_dir().join(format!("loby-fs-hashed-paths-test-{}", std::process::id()));
        if directory.exists() {
            std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        }
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        std::fs::write(directory.join("image.png"), b"original")
            .map_err(|error| error.to_string())?;

        let first_conflict = unique_hashed_destination_path(&directory, "image.png", b"new-image");
        assert_eq!(
            first_conflict.file_name().and_then(|value| value.to_str()),
            Some(format!("image-{}.png", short_content_hash(b"new-image", 0)).as_str())
        );
        assert_ne!(first_conflict, directory.join("image-2.png"));

        std::fs::write(&first_conflict, b"new-image").map_err(|error| error.to_string())?;
        let repeated_conflict =
            unique_hashed_destination_path(&directory, "image.png", b"new-image");
        assert_ne!(repeated_conflict, first_conflict);
        assert!(!repeated_conflict.exists());

        std::fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn text_resource_detection_is_extension_based() {
        assert!(is_text_resource_extension(Path::new("reference.md")));
        assert!(is_text_resource_extension(Path::new("data.JSON")));
        assert!(!is_text_resource_extension(Path::new("image.png")));
    }

    #[test]
    fn markdown_import_detection_allows_markdown_and_text() {
        assert!(is_markdown_import_extension(Path::new("article.md")));
        assert!(is_markdown_import_extension(Path::new("article.MARKDOWN")));
        assert!(is_markdown_import_extension(Path::new("draft.txt")));
        assert!(!is_markdown_import_extension(Path::new("image.png")));
    }
}
