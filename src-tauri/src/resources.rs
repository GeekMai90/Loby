use crate::fs_paths::{
    is_image_file_extension, is_markdown_import_extension, is_text_resource_extension,
    safe_export_filename, safe_relative_path, safe_resource_filename, unique_destination_path,
};
use crate::markdown::strip_nibva_frontmatter;
use crate::models::{
    ImportedMarkdownFile, ProjectExportBundleAsset, ProjectExportBundleFile, ProjectResourceFile,
    ProjectResourceText,
};
use crate::project_paths::{ensure_project_resource_dirs, resolve_project_content_dir};
use std::fs;
use std::io::Read;
use std::path::PathBuf;

const MAX_RESOURCE_TEXT_BYTES: usize = 60_000;

#[tauri::command]
pub(crate) fn list_project_resources(
    path: String,
    project_id: String,
    project_title: String,
) -> Result<Vec<ProjectResourceFile>, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let mut resources = Vec::new();

    for (directory, kind) in [
        ("assets", "asset"),
        ("references", "reference"),
        ("exports", "export"),
    ] {
        let resource_dir = project_dir.join(directory);
        if !resource_dir.exists() {
            continue;
        }

        let mut pending_dirs = vec![resource_dir];
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
                    .strip_prefix(&project_dir)
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
    }

    resources.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.name.cmp(&b.name)));
    Ok(resources)
}

#[tauri::command]
pub(crate) fn save_project_export(
    path: String,
    project_id: String,
    project_title: String,
    filename: String,
    content: String,
) -> Result<String, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let filename = safe_export_filename(&filename);
    let export_path = project_dir.join("exports").join(filename);
    fs::write(&export_path, content).map_err(|error| error.to_string())?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
pub(crate) fn save_project_export_bundle(
    path: String,
    project_id: String,
    project_title: String,
    directory_name: String,
    files: Vec<ProjectExportBundleFile>,
    assets: Vec<ProjectExportBundleAsset>,
) -> Result<String, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let bundle_name = safe_export_filename(&directory_name);
    let bundle_dir = project_dir.join("exports").join(bundle_name);
    fs::create_dir_all(&bundle_dir).map_err(|error| error.to_string())?;

    for file in files {
        let relative_path = safe_relative_path(&file.relative_path)?;
        let destination = bundle_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(destination, file.content).map_err(|error| error.to_string())?;
    }

    for asset in assets {
        let source = PathBuf::from(asset.source_path);
        if !source.is_file() {
            continue;
        }
        let relative_path = safe_relative_path(&asset.relative_path)?;
        let destination = bundle_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(source, destination).map_err(|error| error.to_string())?;
    }

    Ok(bundle_dir.display().to_string())
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
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let target_dir = project_dir.join("assets").join("images");
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let destination = unique_destination_path(&target_dir, &safe_resource_filename(&filename));
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
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let target_dir = project_dir.join("assets").join("images");
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let mut imported = Vec::new();

    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        if !source.is_file() || !is_image_file_extension(&source) {
            continue;
        }
        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let destination = unique_destination_path(&target_dir, &safe_resource_filename(file_name));
        fs::copy(&source, &destination).map_err(|error| error.to_string())?;
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
pub(crate) fn import_project_resources(
    path: String,
    project_id: String,
    project_title: String,
    target: String,
    source_paths: Vec<String>,
) -> Result<Vec<ProjectResourceFile>, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let target_dir_name = match target.as_str() {
        "assets" => "assets",
        "references" => "references",
        _ => return Err("Resource target must be assets or references.".to_string()),
    };
    let target_dir = project_dir.join(target_dir_name);
    let mut imported = Vec::new();

    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        if !source.is_file() {
            continue;
        }
        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let destination = unique_destination_path(&target_dir, &safe_resource_filename(file_name));
        fs::copy(&source, &destination).map_err(|error| error.to_string())?;
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
            content: strip_nibva_frontmatter(&raw).to_string(),
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

        if !canonical_path.starts_with(&projects_root) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_text_loading_stays_inside_the_projects_area() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("nibva-resource-text-test-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let reference = root
            .join("projects")
            .join("project-one")
            .join("references")
            .join("source.md");
        let outside = root.join("outside.md");
        fs::create_dir_all(reference.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::write(&reference, "reference body").map_err(|error| error.to_string())?;
        fs::write(&outside, "outside body").map_err(|error| error.to_string())?;

        let results = read_project_resource_text(
            root.display().to_string(),
            vec![
                reference.display().to_string(),
                outside.display().to_string(),
            ],
        )?;

        assert_eq!(results[0].status, "loaded");
        assert_eq!(results[0].content, "reference body");
        assert_eq!(results[1].status, "blocked-outside-library");
        assert!(results[1].content.is_empty());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
