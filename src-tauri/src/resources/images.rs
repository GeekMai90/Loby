use crate::fs_paths::{
    is_image_file_extension, safe_resource_filename, unique_hashed_destination_path,
};
use crate::models::{LibraryImageCentralizationResult, ProjectResourceFile};
use crate::project_paths::ensure_library_image_dir;
use std::fs;
use std::path::{Path, PathBuf};

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
    project_image_resource(&destination)
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
        let destination =
            import_image_file(&target_dir, &source, &safe_resource_filename(file_name))?;
        imported.push(project_image_resource(&destination)?);
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
        let destination =
            import_image_file(&target_dir, &source, &safe_resource_filename(filename))?;
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

pub(super) fn import_image_file(
    target_dir: &Path,
    source: &Path,
    safe_filename: &str,
) -> Result<PathBuf, String> {
    let bytes = fs::read(source).map_err(|error| error.to_string())?;
    let destination = central_image_destination(target_dir, safe_filename, &bytes)?;
    if !destination.is_file() {
        fs::write(&destination, bytes).map_err(|error| error.to_string())?;
    }
    Ok(destination)
}

fn project_image_resource(destination: &Path) -> Result<ProjectResourceFile, String> {
    let metadata = fs::metadata(destination).map_err(|error| error.to_string())?;
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

    fn test_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "loby-resource-images-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn shared_library_images_deduplicate_content_and_hash_name_conflicts() -> Result<(), String> {
        let root = test_root("name-conflict");
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

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn centralizes_legacy_project_images_before_removing_sources() -> Result<(), String> {
        let root = test_root("centralize");
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
            .join("inbox")
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

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn cleanup_keeps_central_and_outside_images_untouched() -> Result<(), String> {
        let root = test_root("safe-cleanup");
        let outside_root = test_root("safe-cleanup-outside");
        for directory in [&root, &outside_root] {
            if directory.exists() {
                fs::remove_dir_all(directory).map_err(|error| error.to_string())?;
            }
        }
        let central = root.join("assets").join("images").join("central.png");
        let outside = outside_root
            .join("assets")
            .join("images")
            .join("outside.png");
        fs::create_dir_all(central.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::create_dir_all(outside.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::write(&central, b"central").map_err(|error| error.to_string())?;
        fs::write(&outside, b"outside").map_err(|error| error.to_string())?;

        remove_centralized_image_sources(
            root.display().to_string(),
            vec![central.display().to_string(), outside.display().to_string()],
        )?;

        assert!(central.is_file());
        assert!(outside.is_file());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        fs::remove_dir_all(&outside_root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
