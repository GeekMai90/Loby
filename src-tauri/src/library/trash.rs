use super::save::{
    existing_markdown_path_for_sheet, unique_directory_path, unique_markdown_path_for_base,
    unix_timestamp,
};
use super::{rebuild_library_index_at, INBOX_PROJECT_ID, NOTES_PROJECT_ID};
use crate::fs_paths::{is_image_file_extension, safe_relative_path, unique_destination_path};
use crate::markdown::{safe_visible_path_segment, strip_loby_frontmatter};
use crate::models::{EmptySheetCleanupResult, TrashEntry, WritingProject, WritingSheet};
use crate::project_paths::resolve_project_content_dir;
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn move_project_to_trash(
    path: String,
    project_id: String,
    project_title: String,
) -> Result<Vec<WritingProject>, String> {
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    if !project_dir.exists() {
        return Err("Project folder does not exist.".to_string());
    }

    let trash_root = root.join(".loby").join("trash").join("projects");
    fs::create_dir_all(&trash_root).map_err(|error| error.to_string())?;
    let base_name = project_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(project_title.as_str());
    let destination =
        unique_directory_path(&trash_root, &format!("{} {}", base_name, unix_timestamp()));
    fs::rename(&project_dir, &destination).map_err(|error| error.to_string())?;
    let manifest = TrashEntry {
        id: format!("trash-project-{}-{}", unix_timestamp(), project_id),
        kind: "project".to_string(),
        title: project_title.clone(),
        deleted_at: unix_timestamp(),
        project_id,
        project_title,
        sheet_id: String::new(),
        group_id: String::new(),
        original_path: project_dir.display().to_string(),
        body: String::new(),
        trash_path: String::new(),
        size_bytes: 0,
    };
    write_trash_manifest(&destination.join(".loby-trash.json"), &manifest)?;
    rebuild_library_index_at(root)
}

#[tauri::command]
pub(crate) fn move_sheet_to_trash(
    path: String,
    project_id: String,
    project_title: String,
    sheet_id: String,
    sheet_title: String,
    group_id: String,
) -> Result<Vec<WritingProject>, String> {
    let root = PathBuf::from(path);
    move_sheet_to_trash_at(
        &root,
        &project_id,
        &project_title,
        &sheet_id,
        &sheet_title,
        &group_id,
    )?;
    rebuild_library_index_at(root)
}

fn move_sheet_to_trash_at(
    root: &Path,
    project_id: &str,
    project_title: &str,
    sheet_id: &str,
    sheet_title: &str,
    group_id: &str,
) -> Result<(), String> {
    let content_root = if project_id == INBOX_PROJECT_ID {
        root.join("inbox")
    } else if project_id == NOTES_PROJECT_ID {
        root.join("notes")
    } else {
        resolve_project_content_dir(root, project_id, Some(project_title))
    };
    let source = existing_markdown_path_for_sheet(&content_root, sheet_id)
        .ok_or_else(|| "Document Markdown file does not exist.".to_string())?;
    let trash_root = root.join(".loby").join("trash").join("documents");
    fs::create_dir_all(&trash_root).map_err(|error| error.to_string())?;
    let entry_dir = unique_directory_path(
        &trash_root,
        &format!(
            "{} {}",
            safe_visible_path_segment(sheet_title, sheet_id),
            unix_timestamp()
        ),
    );
    fs::create_dir_all(&entry_dir).map_err(|error| error.to_string())?;
    let destination = entry_dir.join("document.md");
    fs::rename(&source, &destination).map_err(|error| error.to_string())?;
    let raw = fs::read_to_string(&destination).map_err(|error| error.to_string())?;
    let manifest = TrashEntry {
        id: format!("trash-document-{}-{}", unix_timestamp(), sheet_id),
        kind: "document".to_string(),
        title: sheet_title.to_string(),
        deleted_at: unix_timestamp(),
        project_id: project_id.to_string(),
        project_title: project_title.to_string(),
        sheet_id: sheet_id.to_string(),
        group_id: group_id.to_string(),
        original_path: source.display().to_string(),
        body: strip_loby_frontmatter(&raw).to_string(),
        trash_path: destination.display().to_string(),
        size_bytes: 0,
    };
    write_trash_manifest(&entry_dir.join("manifest.json"), &manifest)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn clean_empty_sheets(path: String) -> Result<EmptySheetCleanupResult, String> {
    let root = PathBuf::from(path);
    let projects = rebuild_library_index_at(root.clone())?;
    let targets = projects
        .iter()
        .flat_map(|project| {
            project
                .sheets
                .iter()
                .filter(|sheet| is_empty_sheet(sheet))
                .map(|sheet| {
                    (
                        project.id.clone(),
                        project.title.clone(),
                        sheet.id.clone(),
                        sheet.title.clone(),
                        sheet.group_id.clone(),
                    )
                })
        })
        .collect::<Vec<_>>();

    for (project_id, project_title, sheet_id, sheet_title, group_id) in &targets {
        move_sheet_to_trash_at(
            &root,
            project_id,
            project_title,
            sheet_id,
            sheet_title,
            group_id,
        )?;
    }

    let projects = if targets.is_empty() {
        projects
    } else {
        rebuild_library_index_at(root)?
    };
    Ok(EmptySheetCleanupResult {
        projects,
        removed_count: targets.len(),
    })
}

fn is_empty_sheet(sheet: &WritingSheet) -> bool {
    sheet.body.trim().is_empty()
        && (sheet.title.trim().is_empty() || sheet.title.trim() == "无标题")
}

#[tauri::command]
pub(crate) fn list_library_trash(path: String) -> Result<Vec<TrashEntry>, String> {
    list_library_trash_at(&PathBuf::from(path))
}

#[tauri::command]
pub(crate) fn restore_trash_entry(
    path: String,
    entry_id: String,
) -> Result<Vec<WritingProject>, String> {
    let root = PathBuf::from(path);
    let (entry_dir, manifest) = find_trash_entry(&root, &entry_id)?;
    let original = PathBuf::from(&manifest.original_path);
    if !original.starts_with(&root) {
        return Err("Trash entry points outside the active library.".to_string());
    }

    if manifest.kind == "project" {
        let parent = original
            .parent()
            .ok_or_else(|| "Project restore path has no parent.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let destination = if original.exists() {
            unique_directory_path(
                parent,
                original
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(&manifest.title),
            )
        } else {
            original
        };
        let manifest_path = entry_dir.join(".loby-trash.json");
        if manifest_path.exists() {
            fs::remove_file(manifest_path).map_err(|error| error.to_string())?;
        }
        fs::rename(entry_dir, destination).map_err(|error| error.to_string())?;
    } else if manifest.kind == "document" {
        let source = entry_dir.join("document.md");
        if !source.exists() {
            return Err("Trashed document file is missing.".to_string());
        }
        let parent = original
            .parent()
            .ok_or_else(|| "Document restore path has no parent.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let destination = if original.exists() {
            unique_markdown_path_for_base(
                parent,
                original
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or(&manifest.title),
            )
        } else {
            original
        };
        fs::rename(source, destination).map_err(|error| error.to_string())?;
        fs::remove_dir_all(entry_dir).map_err(|error| error.to_string())?;
    } else if manifest.kind == "image" {
        let source = PathBuf::from(&manifest.trash_path)
            .canonicalize()
            .map_err(|_| "Trashed image file is missing or invalid.".to_string())?;
        let image_trash_root = root.join(".loby").join("trash").join("images");
        let image_root = root.join("assets").join("images");
        let canonical_image_trash_root = image_trash_root
            .canonicalize()
            .map_err(|_| "Image trash folder is missing or invalid.".to_string())?;
        if !source.is_file()
            || !source.starts_with(&canonical_image_trash_root)
            || !is_image_file_extension(&source)
        {
            return Err("Trashed image file is missing or invalid.".to_string());
        }
        let relative_original = original.strip_prefix(&image_root).map_err(|_| {
            "Image trash entry points outside the library image folder.".to_string()
        })?;
        let safe_relative_original = safe_relative_path(&relative_original.to_string_lossy())?;
        let original = image_root.join(safe_relative_original);
        if !is_image_file_extension(&original) {
            return Err("Image trash entry points outside the library image folder.".to_string());
        }
        let parent = original
            .parent()
            .ok_or_else(|| "Image restore path has no parent.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let destination = if original.exists() {
            unique_destination_path(
                parent,
                original
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(&manifest.title),
            )
        } else {
            original
        };
        fs::rename(source, destination).map_err(|error| error.to_string())?;
        fs::remove_dir_all(entry_dir).map_err(|error| error.to_string())?;
    } else {
        return Err("Unsupported trash entry kind.".to_string());
    }
    rebuild_library_index_at(root)
}

#[tauri::command]
pub(crate) fn delete_trash_entry(
    path: String,
    entry_id: String,
) -> Result<Vec<TrashEntry>, String> {
    let root = PathBuf::from(path);
    let (entry_dir, _) = find_trash_entry(&root, &entry_id)?;
    fs::remove_dir_all(entry_dir).map_err(|error| error.to_string())?;
    list_library_trash_at(&root)
}

#[tauri::command]
pub(crate) fn clear_library_trash(path: String) -> Result<Vec<WritingProject>, String> {
    let root = PathBuf::from(path);
    clear_library_trash_at(&root, |trash_root| {
        trash::delete(trash_root).map_err(|error| error.to_string())
    })
}

pub(crate) fn clear_library_trash_at(
    root: &Path,
    move_to_system_trash: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<Vec<WritingProject>, String> {
    let trash_root = root.join(".loby").join("trash");
    if trash_root.exists() {
        move_to_system_trash(&trash_root)?;
    }
    rebuild_library_index_at(root.to_path_buf())
}

fn write_trash_manifest(path: &Path, manifest: &TrashEntry) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

fn list_library_trash_at(root: &Path) -> Result<Vec<TrashEntry>, String> {
    let trash_root = root.join(".loby").join("trash");
    if !trash_root.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for (kind, manifest_name) in [
        ("projects", ".loby-trash.json"),
        ("documents", "manifest.json"),
        ("images", "manifest.json"),
    ] {
        let kind_root = trash_root.join(kind);
        if !kind_root.exists() {
            continue;
        }
        for entry in fs::read_dir(kind_root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if !entry.path().is_dir() {
                continue;
            }
            let manifest_path = entry.path().join(manifest_name);
            let Ok(raw) = fs::read_to_string(manifest_path) else {
                continue;
            };
            let Ok(mut manifest) = serde_json::from_str::<TrashEntry>(&raw) else {
                continue;
            };
            if manifest.kind == "document" {
                if let Ok(raw) = fs::read_to_string(entry.path().join("document.md")) {
                    manifest.body = strip_loby_frontmatter(&raw).to_string();
                }
            }
            entries.push(manifest);
        }
    }
    entries.sort_by(|left, right| right.deleted_at.cmp(&left.deleted_at));
    Ok(entries)
}

fn find_trash_entry(root: &Path, entry_id: &str) -> Result<(PathBuf, TrashEntry), String> {
    let trash_root = root.join(".loby").join("trash");
    for (kind, manifest_name) in [
        ("projects", ".loby-trash.json"),
        ("documents", "manifest.json"),
        ("images", "manifest.json"),
    ] {
        let kind_root = trash_root.join(kind);
        if !kind_root.exists() {
            continue;
        }
        for entry in fs::read_dir(kind_root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let entry_dir = entry.path();
            if !entry_dir.is_dir() {
                continue;
            }
            let Ok(raw) = fs::read_to_string(entry_dir.join(manifest_name)) else {
                continue;
            };
            let Ok(manifest) = serde_json::from_str::<TrashEntry>(&raw) else {
                continue;
            };
            if manifest.id == entry_id {
                return Ok((entry_dir, manifest));
            }
        }
    }
    Err("Trash entry was not found.".to_string())
}
