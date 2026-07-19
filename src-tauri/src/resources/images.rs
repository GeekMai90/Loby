use crate::fs_paths::{
    is_image_file_extension, safe_relative_path, safe_resource_filename,
    unique_hashed_destination_path,
};
use crate::library::rebuild_library_index_at;
use crate::markdown::safe_visible_path_segment;
use crate::models::{
    LibraryImageCentralizationResult, ProjectResourceFile, TrashEntry, UnusedImageCandidate,
    UnusedImageCleanupResult, WritingProject,
};
use crate::project_paths::ensure_library_image_dir;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub(crate) fn scan_unused_library_images(
    path: String,
) -> Result<Vec<UnusedImageCandidate>, String> {
    scan_unused_library_images_at(&PathBuf::from(path))
}

#[tauri::command]
pub(crate) fn trash_unused_library_images(
    path: String,
    image_paths: Vec<String>,
) -> Result<UnusedImageCleanupResult, String> {
    trash_unused_library_images_at(&PathBuf::from(path), image_paths)
}

fn scan_unused_library_images_at(root: &Path) -> Result<Vec<UnusedImageCandidate>, String> {
    let projects = rebuild_library_index_at(root.to_path_buf())?;
    let image_root = root.join("assets").join("images");
    if !image_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut reference_texts = collect_library_markdown_texts(root)?;
    collect_version_reference_texts(&projects, &mut reference_texts);
    let normalized_references = reference_texts
        .into_iter()
        .map(|text| text.to_lowercase())
        .collect::<Vec<_>>();
    let mut image_paths = Vec::new();
    collect_image_paths(&image_root, &mut image_paths)?;

    let mut candidates = Vec::new();
    for image_path in image_paths {
        let Some(name) = image_path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let normalized_name = name.to_lowercase();
        let encoded_name = percent_encoded_filename(name).to_lowercase();
        if normalized_references.iter().any(|text| {
            text.contains(&normalized_name)
                || (encoded_name != normalized_name && text.contains(&encoded_name))
        }) {
            continue;
        }
        let metadata = fs::metadata(&image_path).map_err(|error| error.to_string())?;
        candidates.push(UnusedImageCandidate {
            name: name.to_string(),
            path: image_path.display().to_string(),
            size_bytes: metadata.len(),
        });
    }
    candidates.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(candidates)
}

fn trash_unused_library_images_at(
    root: &Path,
    image_paths: Vec<String>,
) -> Result<UnusedImageCleanupResult, String> {
    let requested_count = image_paths.len();
    let current_candidates = scan_unused_library_images_at(root)?;
    let candidate_paths = current_candidates
        .iter()
        .filter_map(|candidate| PathBuf::from(&candidate.path).canonicalize().ok())
        .collect::<HashSet<_>>();
    let mut handled_paths = HashSet::new();
    let mut moved_count = 0;

    for requested_path in image_paths {
        let Ok(canonical_path) = PathBuf::from(requested_path).canonicalize() else {
            continue;
        };
        if !candidate_paths.contains(&canonical_path)
            || !handled_paths.insert(canonical_path.clone())
        {
            continue;
        }
        if move_unused_image_to_trash(root, &canonical_path).is_ok() {
            moved_count += 1;
        }
    }

    Ok(UnusedImageCleanupResult {
        moved_count,
        skipped_count: requested_count.saturating_sub(moved_count),
    })
}

fn move_unused_image_to_trash(root: &Path, source: &Path) -> Result<(), String> {
    let image_root = root.join("assets").join("images");
    let canonical_image_root = image_root.canonicalize().unwrap_or(image_root);
    if !source.is_file()
        || !source.starts_with(&canonical_image_root)
        || !is_image_file_extension(source)
    {
        return Err("Image cleanup target is outside the library image folder.".to_string());
    }
    let filename = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Image cleanup target has no valid filename.".to_string())?;
    let relative_source = source
        .strip_prefix(&canonical_image_root)
        .map_err(|_| "Image cleanup target is outside the library image folder.".to_string())?;
    let safe_relative_source = safe_relative_path(&relative_source.to_string_lossy())?;
    let original_path = root
        .join("assets")
        .join("images")
        .join(safe_relative_source);
    let size_bytes = fs::metadata(source)
        .map_err(|error| error.to_string())?
        .len();
    let trash_root = root.join(".loby").join("trash").join("images");
    fs::create_dir_all(&trash_root).map_err(|error| error.to_string())?;
    let entry_dir = unique_image_trash_directory(
        &trash_root,
        &format!(
            "{} {}",
            safe_visible_path_segment(filename, "image"),
            image_cleanup_timestamp()
        ),
    );
    fs::create_dir_all(&entry_dir).map_err(|error| error.to_string())?;
    let destination = entry_dir.join(filename);
    let entry_id = format!(
        "trash-image-{}",
        entry_dir
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(filename)
    );
    let manifest = TrashEntry {
        id: entry_id,
        kind: "image".to_string(),
        title: filename.to_string(),
        deleted_at: image_cleanup_timestamp(),
        project_id: String::new(),
        project_title: String::new(),
        sheet_id: String::new(),
        group_id: String::new(),
        original_path: original_path.display().to_string(),
        body: String::new(),
        trash_path: destination.display().to_string(),
        size_bytes,
    };
    let manifest_raw =
        serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    if let Err(error) = fs::write(entry_dir.join("manifest.json"), manifest_raw) {
        let _ = fs::remove_dir_all(&entry_dir);
        return Err(error.to_string());
    }
    if let Err(error) = fs::rename(source, &destination) {
        let _ = fs::remove_dir_all(&entry_dir);
        return Err(error.to_string());
    }
    Ok(())
}

fn collect_library_markdown_texts(root: &Path) -> Result<Vec<String>, String> {
    let mut texts = Vec::new();
    let mut pending_dirs = vec![root.to_path_buf()];
    let image_root = root.join("assets").join("images");
    let image_trash_root = root.join(".loby").join("trash").join("images");
    while let Some(current_dir) = pending_dirs.pop() {
        for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                if path != image_root && path != image_trash_root {
                    pending_dirs.push(path);
                }
                continue;
            }
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(extension.as_str(), "md" | "markdown" | "mdx") {
                texts.push(fs::read_to_string(path).map_err(|error| error.to_string())?);
            }
        }
    }
    Ok(texts)
}

fn collect_version_reference_texts(projects: &[WritingProject], texts: &mut Vec<String>) {
    for project in projects {
        for sheet in &project.sheets {
            texts.extend(sheet.versions.iter().map(|version| version.body.clone()));
        }
    }
}

fn collect_image_paths(root: &Path, images: &mut Vec<PathBuf>) -> Result<(), String> {
    let mut pending_dirs = vec![root.to_path_buf()];
    while let Some(current_dir) = pending_dirs.pop() {
        for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                pending_dirs.push(path);
            } else if file_type.is_file() && is_image_file_extension(&path) {
                images.push(path);
            }
        }
    }
    Ok(())
}

fn percent_encoded_filename(filename: &str) -> String {
    let mut encoded = String::new();
    for byte in filename.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(*byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn unique_image_trash_directory(parent: &Path, base_name: &str) -> PathBuf {
    let direct = parent.join(base_name);
    if !direct.exists() {
        return direct;
    }
    for index in 2..1000 {
        let candidate = parent.join(format!("{base_name} {index}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{base_name} {}", image_cleanup_timestamp()))
}

fn image_cleanup_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
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
    use crate::library::save_library_to_path;
    use crate::models::SheetVersion;

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
    fn unused_image_cleanup_preserves_live_history_and_trash_references() -> Result<(), String> {
        let root = test_root("unused-cleanup");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let image_root = root.join("assets").join("images");
        let sheet_dir = root.join("projects").join("博客").join("正文");
        fs::create_dir_all(&image_root).map_err(|error| error.to_string())?;
        fs::create_dir_all(&sheet_dir).map_err(|error| error.to_string())?;
        for name in [
            "used.png",
            "html.png",
            "encoded name.png",
            "history.png",
            "trash-only.png",
            "unused.png",
        ] {
            fs::write(image_root.join(name), name.as_bytes()).map_err(|error| error.to_string())?;
        }
        fs::write(
            sheet_dir.join("文章.md"),
            "![正文图](../../../assets/images/used.png)\n<img src=\"../../../assets/images/html.png\">\n![编码](../../../assets/images/encoded%20name.png)",
        )
        .map_err(|error| error.to_string())?;

        let mut projects = rebuild_library_index_at(root.clone())?;
        let sheet = projects
            .iter_mut()
            .flat_map(|project| project.sheets.iter_mut())
            .next()
            .ok_or_else(|| "Expected scanned sheet.".to_string())?;
        sheet.versions.push(SheetVersion {
            id: "version-image".to_string(),
            title: "历史图片".to_string(),
            body: "![旧图](../../../assets/images/history.png)".to_string(),
            created_at: "2026-07-19T10:00:00.000Z".to_string(),
            word_count: 0,
            source: "manual".to_string(),
            reason: "测试".to_string(),
        });
        save_library_to_path(root.clone(), projects)?;

        let trashed_document = root
            .join(".loby")
            .join("trash")
            .join("documents")
            .join(format!("deleted-{}", image_cleanup_timestamp()));
        fs::create_dir_all(&trashed_document).map_err(|error| error.to_string())?;
        fs::write(
            trashed_document.join("document.md"),
            "![[assets/images/trash-only.png]]",
        )
        .map_err(|error| error.to_string())?;

        let candidates = scan_unused_library_images_at(&root)?;
        assert_eq!(
            candidates
                .iter()
                .map(|candidate| candidate.name.as_str())
                .collect::<Vec<_>>(),
            vec!["unused.png"]
        );

        let result = trash_unused_library_images_at(
            &root,
            vec![
                image_root.join("unused.png").display().to_string(),
                image_root.join("used.png").display().to_string(),
            ],
        )?;
        assert_eq!(result.moved_count, 1);
        assert_eq!(result.skipped_count, 1);
        assert!(!image_root.join("unused.png").exists());
        assert!(image_root.join("used.png").is_file());

        let entries = crate::library::trash::list_library_trash(root.display().to_string())?;
        let image_entry = entries
            .iter()
            .find(|entry| entry.kind == "image")
            .ok_or_else(|| "Expected trashed image entry.".to_string())?;
        assert_eq!(image_entry.title, "unused.png");
        assert!(PathBuf::from(&image_entry.trash_path).is_file());
        crate::library::trash::restore_trash_entry(
            root.display().to_string(),
            image_entry.id.clone(),
        )?;
        assert!(image_root.join("unused.png").is_file());

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
