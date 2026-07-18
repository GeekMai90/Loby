use super::save::{
    existing_markdown_path_for_sheet, unique_directory_path, unique_markdown_path_for_base,
    unix_timestamp,
};
use super::{rebuild_library_index_at, INBOX_PROJECT_ID, NOTES_PROJECT_ID};
use crate::markdown::{safe_visible_path_segment, strip_nibva_frontmatter};
use crate::models::{TrashEntry, WritingProject};
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

    let trash_root = root.join(".nibva").join("trash").join("projects");
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
    };
    write_trash_manifest(&destination.join(".nibva-trash.json"), &manifest)?;
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
    let content_root = if project_id == INBOX_PROJECT_ID {
        root.join("inbox")
    } else if project_id == NOTES_PROJECT_ID {
        root.join("notes")
    } else {
        resolve_project_content_dir(&root, &project_id, Some(&project_title))
    };
    let source = existing_markdown_path_for_sheet(&content_root, &sheet_id)
        .ok_or_else(|| "Document Markdown file does not exist.".to_string())?;
    let trash_root = root.join(".nibva").join("trash").join("documents");
    fs::create_dir_all(&trash_root).map_err(|error| error.to_string())?;
    let entry_dir = unique_directory_path(
        &trash_root,
        &format!(
            "{} {}",
            safe_visible_path_segment(&sheet_title, &sheet_id),
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
        title: sheet_title,
        deleted_at: unix_timestamp(),
        project_id,
        project_title,
        sheet_id,
        group_id,
        original_path: source.display().to_string(),
        body: strip_nibva_frontmatter(&raw).to_string(),
    };
    write_trash_manifest(&entry_dir.join("manifest.json"), &manifest)?;
    rebuild_library_index_at(root)
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
        let manifest_path = entry_dir.join(".nibva-trash.json");
        if manifest_path.exists() {
            fs::remove_file(manifest_path).map_err(|error| error.to_string())?;
        }
        fs::rename(entry_dir, destination).map_err(|error| error.to_string())?;
    } else {
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
    let trash_root = root.join(".nibva").join("trash");
    if trash_root.exists() {
        fs::remove_dir_all(&trash_root).map_err(|error| error.to_string())?;
    }
    rebuild_library_index_at(root)
}

fn write_trash_manifest(path: &Path, manifest: &TrashEntry) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

fn list_library_trash_at(root: &Path) -> Result<Vec<TrashEntry>, String> {
    let trash_root = root.join(".nibva").join("trash");
    if !trash_root.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for (kind, manifest_name) in [
        ("projects", ".nibva-trash.json"),
        ("documents", "manifest.json"),
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
                    manifest.body = strip_nibva_frontmatter(&raw).to_string();
                }
            }
            entries.push(manifest);
        }
    }
    entries.sort_by(|left, right| right.deleted_at.cmp(&left.deleted_at));
    Ok(entries)
}

fn find_trash_entry(root: &Path, entry_id: &str) -> Result<(PathBuf, TrashEntry), String> {
    let trash_root = root.join(".nibva").join("trash");
    for (kind, manifest_name) in [
        ("projects", ".nibva-trash.json"),
        ("documents", "manifest.json"),
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
