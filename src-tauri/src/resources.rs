pub(crate) mod exports;

use crate::fs_paths::{
    is_image_file_extension, is_markdown_import_extension, is_text_resource_extension,
    safe_resource_filename, unique_destination_path, unique_hashed_destination_path,
};
use crate::markdown::strip_loby_frontmatter;
use crate::models::{
    ImportedMarkdownFile, LibraryImageCentralizationResult, ProjectResourceFile,
    ProjectResourceText,
};
use crate::project_paths::{
    ensure_library_image_dir, ensure_project_resource_dirs, resolve_project_resource_dir,
};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_RESOURCE_TEXT_BYTES: usize = 60_000;

#[tauri::command]
pub(crate) fn list_project_resources(
    path: String,
    project_id: String,
    project_title: String,
) -> Result<Vec<ProjectResourceFile>, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_resource_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let mut resources = Vec::new();

    for (directory, kind) in [
        ("assets", "asset"),
        ("references", "reference"),
        ("exports", "export"),
    ] {
        collect_resource_files(
            &project_dir.join(directory),
            &project_dir,
            kind,
            &mut resources,
        )?;
    }
    if project_dir != root {
        collect_resource_files(
            &root.join("assets").join("images"),
            &root,
            "asset",
            &mut resources,
        )?;
    }

    resources.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.name.cmp(&b.name)));
    Ok(resources)
}

#[tauri::command]
pub(crate) fn save_project_image(
    path: String,
    project_id: String,
    project_title: String,
    filename: String,
    bytes: Vec<u8>,
) -> Result<ProjectResourceFile, String> {
    let root = PathBuf::from(path);
    let _ = (project_id, project_title);
    let target_dir = ensure_library_image_dir(&root)?;
    let destination =
        central_image_destination(&target_dir, &safe_resource_filename(&filename), &bytes)?;
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;
    let metadata = fs::metadata(&destination).map_err(|error| error.to_string())?;
    Ok(ProjectResourceFile {
        kind: "asset".to_string(),
        name: destination
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image")
            .to_string(),
        path: destination.display().to_string(),
        size_bytes: metadata.len(),
    })
}

#[tauri::command]
pub(crate) fn import_project_images(
    path: String,
    project_id: String,
    project_title: String,
    source_paths: Vec<String>,
) -> Result<Vec<ProjectResourceFile>, String> {
    let root = PathBuf::from(path);
    let _ = (project_id, project_title);
    let target_dir = ensure_library_image_dir(&root)?;
    let mut imported = Vec::new();

    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        if !source.is_file() || !is_image_file_extension(&source) {
            continue;
        }
        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let bytes = fs::read(&source).map_err(|error| error.to_string())?;
        let destination =
            central_image_destination(&target_dir, &safe_resource_filename(file_name), &bytes)?;
        fs::write(&destination, bytes).map_err(|error| error.to_string())?;
        let metadata = fs::metadata(&destination).map_err(|error| error.to_string())?;
        imported.push(ProjectResourceFile {
            kind: "asset".to_string(),
            name: destination
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("image")
                .to_string(),
            path: destination.display().to_string(),
            size_bytes: metadata.len(),
        });
    }

    Ok(imported)
}

#[tauri::command]
pub(crate) fn centralize_library_images(
    path: String,
) -> Result<Vec<LibraryImageCentralizationResult>, String> {
    let root = PathBuf::from(path);
    let target_dir = ensure_library_image_dir(&root)?;
    let mut source_paths = Vec::new();
    for content_root in [
        root.join("projects"),
        root.join("notes"),
        root.join("inbox"),
    ] {
        collect_legacy_image_paths(&content_root, &mut source_paths)?;
    }

    let mut results = Vec::new();
    for source in source_paths {
        let Some(filename) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let bytes = fs::read(&source).map_err(|error| error.to_string())?;
        let destination =
            central_image_destination(&target_dir, &safe_resource_filename(filename), &bytes)?;
        if source != destination && !destination.is_file() {
            fs::write(&destination, bytes).map_err(|error| error.to_string())?;
        }
        results.push(LibraryImageCentralizationResult {
            source_path: source.display().to_string(),
            destination_path: destination.display().to_string(),
            status: "transferred".to_string(),
        });
    }
    Ok(results)
}

#[tauri::command]
pub(crate) fn remove_centralized_image_sources(
    path: String,
    source_paths: Vec<String>,
) -> Result<(), String> {
    let root = PathBuf::from(path);
    let canonical_root = root.canonicalize().unwrap_or(root.clone());
    let central_dir = canonical_root.join("assets").join("images");
    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        let Ok(canonical_source) = source.canonicalize() else {
            continue;
        };
        if !canonical_source.starts_with(&canonical_root)
            || canonical_source.starts_with(&central_dir)
            || !is_assets_image_path(&canonical_source, &canonical_root)
        {
            continue;
        }
        fs::remove_file(&canonical_source).map_err(|error| error.to_string())?;
        remove_empty_image_directories(&canonical_source, &canonical_root)?;
    }
    remove_all_empty_legacy_image_directories(&canonical_root)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn import_project_resources(
    path: String,
    project_id: String,
    project_title: String,
    target: String,
    source_paths: Vec<String>,
) -> Result<Vec<ProjectResourceFile>, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_resource_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let target_dir_name = match target.as_str() {
        "assets" => "assets",
        "references" => "references",
        _ => return Err("Resource target must be assets or references.".to_string()),
    };
    let target_dir = project_dir.join(target_dir_name);
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let central_image_dir = ensure_library_image_dir(&root)?;
    let mut imported = Vec::new();

    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        if !source.is_file() {
            continue;
        }
        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let safe_filename = safe_resource_filename(file_name);
        let destination = if target == "assets" && is_image_file_extension(&source) {
            let bytes = fs::read(&source).map_err(|error| error.to_string())?;
            let destination =
                central_image_destination(&central_image_dir, &safe_filename, &bytes)?;
            if !destination.is_file() {
                fs::write(&destination, bytes).map_err(|error| error.to_string())?;
            }
            destination
        } else {
            let destination = unique_destination_path(&target_dir, &safe_filename);
            fs::copy(&source, &destination).map_err(|error| error.to_string())?;
            destination
        };
        let metadata = fs::metadata(&destination).map_err(|error| error.to_string())?;
        imported.push(ProjectResourceFile {
            kind: target_dir_name.trim_end_matches('s').to_string(),
            name: destination
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("unnamed")
                .to_string(),
            path: destination.display().to_string(),
            size_bytes: metadata.len(),
        });
    }

    Ok(imported)
}

#[tauri::command]
pub(crate) fn read_markdown_import_files(
    source_paths: Vec<String>,
) -> Result<Vec<ImportedMarkdownFile>, String> {
    let mut imported = Vec::new();

    for source_path in source_paths {
        let source = PathBuf::from(&source_path);
        if !source.is_file() {
            return Err(format!("Not a file: {}", source.display()));
        }
        if !is_markdown_import_extension(&source) {
            return Err(format!(
                "Unsupported Markdown import file: {}",
                source.display()
            ));
        }

        let metadata = fs::metadata(&source).map_err(|error| error.to_string())?;
        let raw = fs::read_to_string(&source).map_err(|error| error.to_string())?;
        let name = source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("imported.md")
            .to_string();

        imported.push(ImportedMarkdownFile {
            name,
            path: source.display().to_string(),
            content: strip_loby_frontmatter(&raw).to_string(),
            size_bytes: metadata.len(),
        });
    }

    Ok(imported)
}

#[tauri::command]
pub(crate) fn read_project_resource_text(
    path: String,
    resource_paths: Vec<String>,
) -> Result<Vec<ProjectResourceText>, String> {
    let library_root = fs::canonicalize(PathBuf::from(path)).map_err(|error| error.to_string())?;
    let projects_root = library_root.join("projects");
    let library_assets_root = library_root.join("assets");
    let mut results = Vec::new();

    for resource_path in resource_paths {
        let path = PathBuf::from(&resource_path);
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("unnamed")
            .to_string();
        let size_bytes = fs::metadata(&path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        let Ok(canonical_path) = fs::canonicalize(&path) else {
            results.push(ProjectResourceText {
                path: resource_path,
                name,
                status: "missing".to_string(),
                content: String::new(),
                size_bytes,
                truncated: false,
            });
            continue;
        };

        if !canonical_path.starts_with(&projects_root)
            && !canonical_path.starts_with(&library_assets_root)
        {
            results.push(ProjectResourceText {
                path: canonical_path.display().to_string(),
                name,
                status: "blocked-outside-library".to_string(),
                content: String::new(),
                size_bytes,
                truncated: false,
            });
            continue;
        }

        if !canonical_path.is_file() {
            results.push(ProjectResourceText {
                path: canonical_path.display().to_string(),
                name,
                status: "not-a-file".to_string(),
                content: String::new(),
                size_bytes,
                truncated: false,
            });
            continue;
        }

        if !is_text_resource_extension(&canonical_path) {
            results.push(ProjectResourceText {
                path: canonical_path.display().to_string(),
                name,
                status: "path-only-non-text".to_string(),
                content: String::new(),
                size_bytes,
                truncated: false,
            });
            continue;
        }

        let mut file = fs::File::open(&canonical_path).map_err(|error| error.to_string())?;
        let mut bytes = Vec::new();
        file.by_ref()
            .take((MAX_RESOURCE_TEXT_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        let truncated = bytes.len() > MAX_RESOURCE_TEXT_BYTES;
        if truncated {
            bytes.truncate(MAX_RESOURCE_TEXT_BYTES);
        }
        results.push(ProjectResourceText {
            path: canonical_path.display().to_string(),
            name,
            status: "loaded".to_string(),
            content: String::from_utf8_lossy(&bytes).to_string(),
            size_bytes,
            truncated,
        });
    }

    Ok(results)
}

fn collect_resource_files(
    resource_dir: &Path,
    name_root: &Path,
    kind: &str,
    resources: &mut Vec<ProjectResourceFile>,
) -> Result<(), String> {
    if !resource_dir.exists() {
        return Ok(());
    }
    let mut pending_dirs = vec![resource_dir.to_path_buf()];
    while let Some(current_dir) = pending_dirs.pop() {
        for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                pending_dirs.push(path);
                continue;
            }
            if !path.is_file() {
                continue;
            }
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            let name = path
                .strip_prefix(name_root)
                .ok()
                .and_then(|value| value.to_str())
                .or_else(|| path.file_name().and_then(|value| value.to_str()))
                .unwrap_or("unnamed")
                .to_string();
            resources.push(ProjectResourceFile {
                kind: kind.to_string(),
                name,
                path: path.display().to_string(),
                size_bytes: metadata.len(),
            });
        }
    }
    Ok(())
}

fn collect_legacy_image_paths(root: &Path, images: &mut Vec<PathBuf>) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    let mut pending_dirs = vec![root.to_path_buf()];
    while let Some(current_dir) = pending_dirs.pop() {
        for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                pending_dirs.push(path);
            } else if path.is_file()
                && is_image_file_extension(&path)
                && is_assets_image_path(&path, root)
            {
                images.push(path);
            }
        }
    }
    Ok(())
}

fn is_assets_image_path(path: &Path, root: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return false;
    };
    let components = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>();
    components
        .windows(2)
        .any(|window| window[0] == "assets" && window[1] == "images")
}

fn central_image_destination(
    target_dir: &Path,
    filename: &str,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    let direct_path = target_dir.join(filename);
    if direct_path.is_file()
        && fs::read(&direct_path)
            .map(|existing| existing == bytes)
            .unwrap_or(false)
    {
        return Ok(direct_path);
    }
    Ok(unique_hashed_destination_path(target_dir, filename, bytes))
}

fn remove_empty_image_directories(source: &Path, library_root: &Path) -> Result<(), String> {
    let Some(images_dir) = source.parent() else {
        return Ok(());
    };
    let Some(assets_dir) = images_dir.parent() else {
        return Ok(());
    };
    for directory in [images_dir, assets_dir] {
        if directory == library_root || !directory.is_dir() {
            continue;
        }
        if fs::read_dir(directory)
            .map_err(|error| error.to_string())?
            .next()
            .is_none()
        {
            fs::remove_dir(directory).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn remove_all_empty_legacy_image_directories(library_root: &Path) -> Result<(), String> {
    let mut image_dirs = Vec::new();
    for content_root in [
        library_root.join("projects"),
        library_root.join("notes"),
        library_root.join("inbox"),
    ] {
        collect_legacy_image_directories(&content_root, &mut image_dirs)?;
    }
    image_dirs.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for image_dir in image_dirs {
        if !image_dir.is_dir()
            || fs::read_dir(&image_dir)
                .map_err(|error| error.to_string())?
                .next()
                .is_some()
        {
            continue;
        }
        fs::remove_dir(&image_dir).map_err(|error| error.to_string())?;
        if let Some(assets_dir) = image_dir.parent() {
            if assets_dir.is_dir()
                && fs::read_dir(assets_dir)
                    .map_err(|error| error.to_string())?
                    .next()
                    .is_none()
            {
                fs::remove_dir(assets_dir).map_err(|error| error.to_string())?;
            }
        }
    }
    Ok(())
}

fn collect_legacy_image_directories(
    root: &Path,
    directories: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    let mut pending_dirs = vec![root.to_path_buf()];
    while let Some(current_dir) = pending_dirs.pop() {
        for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if !path.is_dir() {
                continue;
            }
            if path.file_name().and_then(|value| value.to_str()) == Some("images")
                && path.parent().and_then(|parent| parent.file_name())
                    == Some(std::ffi::OsStr::new("assets"))
            {
                directories.push(path);
            } else {
                pending_dirs.push(path);
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_library_images_deduplicate_content_and_hash_name_conflicts() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-image-name-conflict-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let first = save_project_image(
            root.display().to_string(),
            "project-one".to_string(),
            "Project One".to_string(),
            "image.png".to_string(),
            b"same-image".to_vec(),
        )?;
        let second = save_project_image(
            root.display().to_string(),
            "project-one".to_string(),
            "Project One".to_string(),
            "image.png".to_string(),
            b"same-image".to_vec(),
        )?;
        let third = save_project_image(
            root.display().to_string(),
            "project-two".to_string(),
            "Project Two".to_string(),
            "image.png".to_string(),
            b"different-image".to_vec(),
        )?;

        assert_eq!(first.name, "image.png");
        assert_eq!(first.path, second.path);
        assert!(PathBuf::from(&first.path).starts_with(root.join("assets").join("images")));
        let hash = third
            .name
            .strip_prefix("image-")
            .and_then(|value| value.strip_suffix(".png"))
            .expect("conflicting image should include a short hash");
        assert_eq!(hash.len(), 8);
        assert!(hash.chars().all(|character| character.is_ascii_hexdigit()));
        assert_ne!(third.name, "image-2.png");
        assert_ne!(first.path, third.path);
        assert!(PathBuf::from(first.path).is_file());
        assert!(PathBuf::from(third.path).is_file());

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn centralizes_legacy_project_images_before_removing_sources() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-centralize-images-test-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let first = root
            .join("projects")
            .join("博客")
            .join("assets")
            .join("images")
            .join("cover.png");
        let second = root
            .join("projects")
            .join("收件箱")
            .join("assets")
            .join("images")
            .join("cover.png");
        let empty_images = root
            .join("projects")
            .join("落笔指南")
            .join("assets")
            .join("images");
        fs::create_dir_all(first.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::create_dir_all(second.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::create_dir_all(&empty_images).map_err(|error| error.to_string())?;
        fs::write(&first, b"first-image").map_err(|error| error.to_string())?;
        fs::write(&second, b"second-image").map_err(|error| error.to_string())?;

        let results = centralize_library_images(root.display().to_string())?;

        assert_eq!(results.len(), 2);
        assert!(results
            .iter()
            .all(|result| PathBuf::from(&result.destination_path).is_file()));
        assert!(first.is_file());
        assert!(second.is_file());
        remove_centralized_image_sources(
            root.display().to_string(),
            results
                .iter()
                .map(|result| result.source_path.clone())
                .collect(),
        )?;
        assert!(!first.exists());
        assert!(!second.exists());
        assert!(!empty_images.exists());
        assert_eq!(
            fs::read_dir(root.join("assets").join("images"))
                .map_err(|error| error.to_string())?
                .count(),
            2
        );

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn resource_text_loading_stays_inside_the_library_resource_areas() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("loby-resource-text-test-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let reference = root
            .join("projects")
            .join("project-one")
            .join("references")
            .join("source.md");
        let outside = root.join("outside.md");
        let shared_asset = root.join("assets").join("images").join("caption.txt");
        fs::create_dir_all(reference.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::create_dir_all(shared_asset.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::write(&reference, "reference body").map_err(|error| error.to_string())?;
        fs::write(&shared_asset, "shared caption").map_err(|error| error.to_string())?;
        fs::write(&outside, "outside body").map_err(|error| error.to_string())?;

        let results = read_project_resource_text(
            root.display().to_string(),
            vec![
                reference.display().to_string(),
                shared_asset.display().to_string(),
                outside.display().to_string(),
            ],
        )?;

        assert_eq!(results[0].status, "loaded");
        assert_eq!(results[0].content, "reference body");
        assert_eq!(results[1].status, "loaded");
        assert_eq!(results[1].content, "shared caption");
        assert_eq!(results[2].status, "blocked-outside-library");
        assert!(results[2].content.is_empty());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
