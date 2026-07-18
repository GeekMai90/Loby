pub(crate) mod exports;
pub(crate) mod images;

use crate::fs_paths::{
    is_image_file_extension, is_markdown_import_extension, is_text_resource_extension,
    safe_resource_filename, unique_destination_path,
};
use crate::markdown::strip_loby_frontmatter;
use crate::models::{ImportedMarkdownFile, ProjectResourceFile, ProjectResourceText};
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
            images::import_image_file(&central_image_dir, &source, &safe_filename)?
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

#[cfg(test)]
mod tests {
    use super::*;

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
