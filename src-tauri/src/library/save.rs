use super::scan::{note_group_from_folder, project_group_from_folder};
use super::{INBOX_PROJECT_ID, NOTES_PROJECT_ID};
use crate::fs_paths::{is_markdown_file, path_file_stem, write_if_changed};
use crate::markdown::{
    render_project_readme, render_project_toml, render_sheet_markdown, safe_visible_path_segment,
    sheet_frontmatter_value,
};
use crate::models::{WritingProject, WritingSheet};
use crate::project_paths::{
    ensure_library_image_dir, ensure_project_resource_dirs, resolve_project_content_dir,
};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn save_library_to_path(
    root: PathBuf,
    projects: Vec<WritingProject>,
) -> Result<String, String> {
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    ensure_library_image_dir(&root)?;

    for project in &projects {
        if project.id == INBOX_PROJECT_ID {
            save_inbox_project(&root, project)?;
        } else if project.id == NOTES_PROJECT_ID {
            save_notes_project(&root, project)?;
        } else {
            save_writing_project(&root, project)?;
        }
    }

    write_library_index(&root, &projects)?;
    Ok(root.display().to_string())
}

fn save_inbox_project(root: &Path, project: &WritingProject) -> Result<(), String> {
    let inbox_dir = root.join("inbox");
    fs::create_dir_all(&inbox_dir).map_err(|error| error.to_string())?;
    let mut active_paths = HashSet::new();
    for sheet in &project.sheets {
        let markdown_path = markdown_path_for_sheet(&inbox_dir, &inbox_dir, sheet);
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
        active_paths.insert(markdown_path);
    }
    cleanup_stale_managed_markdown_files(&inbox_dir, &active_paths)?;
    Ok(())
}

pub(super) fn write_library_index(root: &Path, projects: &[WritingProject]) -> Result<(), String> {
    fs::create_dir_all(root.join(".loby")).map_err(|error| error.to_string())?;
    let index = serde_json::to_string_pretty(&projects).map_err(|error| error.to_string())?;
    write_if_changed(&root.join(".loby").join("library.json"), index)?;
    Ok(())
}

fn save_notes_project(root: &Path, project: &WritingProject) -> Result<(), String> {
    let notes_dir = root.join("notes");
    fs::create_dir_all(&notes_dir).map_err(|error| error.to_string())?;
    rename_legacy_default_folder(&notes_dir, "收件箱", "随手记")?;
    let mut active_paths = HashSet::new();

    for group in &project.groups {
        let group_dir = notes_dir.join(safe_visible_path_segment(&group.title, &group.id));
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
    }

    for sheet in &project.sheets {
        let group = project
            .groups
            .iter()
            .find(|group| group.id == sheet.group_id)
            .cloned()
            .unwrap_or_else(|| note_group_from_folder("随手记"));
        let group_dir = notes_dir.join(safe_visible_path_segment(&group.title, &group.id));
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
        let markdown_path = markdown_path_for_sheet(&notes_dir, &group_dir, sheet);
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
        active_paths.insert(markdown_path);
    }

    cleanup_stale_managed_markdown_files(&notes_dir, &active_paths)?;
    remove_empty_legacy_folder(&notes_dir, "收件箱")?;
    remove_empty_legacy_folder(&notes_dir, "待整理")?;
    Ok(())
}

fn save_writing_project(root: &Path, project: &WritingProject) -> Result<(), String> {
    let project_dir = resolve_or_create_project_dir(root, project)?;
    rename_legacy_default_folder(&project_dir, "默认组", "待整理")?;
    ensure_project_resource_dirs(&project_dir)?;
    let mut active_paths = HashSet::new();

    for sheet in &project.sheets {
        let group = project
            .groups
            .iter()
            .find(|group| group.id == sheet.group_id)
            .cloned()
            .or_else(|| project.groups.first().cloned())
            .unwrap_or_else(|| project_group_from_folder("待整理"));
        let group_dir = project_dir.join(safe_visible_path_segment(&group.title, &group.id));
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
        let markdown_path = markdown_path_for_sheet(&project_dir, &group_dir, sheet);
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
        active_paths.insert(markdown_path);
    }

    cleanup_stale_managed_markdown_files(&project_dir, &active_paths)?;
    remove_empty_legacy_folder(&project_dir, "默认组")?;
    write_if_changed(
        &project_dir.join("project.toml"),
        render_project_toml(project),
    )?;
    write_if_changed(
        &project_dir.join("README.md"),
        render_project_readme(project),
    )?;
    Ok(())
}

fn rename_legacy_default_folder(
    parent: &Path,
    legacy_name: &str,
    new_name: &str,
) -> Result<(), String> {
    let legacy = parent.join(legacy_name);
    let destination = parent.join(new_name);
    if legacy.is_dir() && !destination.exists() {
        fs::rename(legacy, destination).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn remove_empty_legacy_folder(parent: &Path, name: &str) -> Result<(), String> {
    let path = parent.join(name);
    if !path.is_dir() {
        return Ok(());
    }
    if path
        .read_dir()
        .map_err(|error| error.to_string())?
        .next()
        .is_none()
    {
        fs::remove_dir(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn resolve_or_create_project_dir(root: &Path, project: &WritingProject) -> Result<PathBuf, String> {
    let projects_root = root.join("projects");
    fs::create_dir_all(&projects_root).map_err(|error| error.to_string())?;
    let desired_dir = projects_root.join(safe_visible_path_segment(&project.title, &project.id));
    let existing = resolve_project_content_dir(root, &project.id, Some(&project.title));
    if existing.exists() {
        return Ok(existing);
    }

    let project_dir = if desired_dir.exists() {
        unique_directory_path(
            &projects_root,
            &safe_visible_path_segment(&project.title, &project.id),
        )
    } else {
        desired_dir
    };
    fs::create_dir_all(&project_dir).map_err(|error| error.to_string())?;
    Ok(project_dir)
}

pub(super) fn unique_directory_path(parent: &Path, base_name: &str) -> PathBuf {
    let mut candidate = parent.join(base_name);
    if !candidate.exists() {
        return candidate;
    }

    for index in 2..1000 {
        candidate = parent.join(format!("{} {}", base_name, index));
        if !candidate.exists() {
            return candidate;
        }
    }

    parent.join(format!("{} {}", base_name, unix_timestamp()))
}

pub(super) fn unique_markdown_path_for_base(group_dir: &Path, base_name: &str) -> PathBuf {
    let mut candidate = group_dir.join(format!("{}.md", base_name));
    if !candidate.exists() {
        return candidate;
    }

    for index in 2..1000 {
        candidate = group_dir.join(format!("{} {}.md", base_name, index));
        if !candidate.exists() {
            return candidate;
        }
    }

    group_dir.join(format!("{} {}.md", base_name, unix_timestamp()))
}

fn markdown_path_for_sheet(root: &Path, group_dir: &Path, sheet: &WritingSheet) -> PathBuf {
    let base_name = safe_visible_path_segment(&sheet.title, &sheet.id);
    let desired = group_dir.join(format!("{}.md", base_name));

    if markdown_file_belongs_to_sheet(&desired, &sheet.id) {
        return desired;
    }

    let existing = existing_markdown_path_for_sheet(root, &sheet.id);

    if let Some(existing_path) = existing.as_ref() {
        let existing_parent = existing_path.parent();
        let existing_stem = path_file_stem(existing_path, "");
        if existing_parent == Some(group_dir)
            && is_matching_sheet_filename_variant(&existing_stem, &base_name)
        {
            return existing_path.clone();
        }
    }

    if existing.as_ref() == Some(&desired) || !desired.exists() {
        return desired;
    }

    unique_markdown_path_for_base(group_dir, &base_name)
}

fn markdown_file_belongs_to_sheet(path: &Path, sheet_id: &str) -> bool {
    if !path.is_file() {
        return false;
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| sheet_frontmatter_value(&raw, "id"))
        .as_deref()
        == Some(sheet_id)
}

fn is_matching_sheet_filename_variant(filename: &str, base_name: &str) -> bool {
    if filename == base_name {
        return true;
    }
    let Some(suffix) = filename.strip_prefix(&format!("{} ", base_name)) else {
        return false;
    };
    suffix.parse::<u16>().is_ok()
}

pub(crate) fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub(super) fn existing_markdown_path_for_sheet(root: &Path, sheet_id: &str) -> Option<PathBuf> {
    if !root.exists() {
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if is_project_support_dir(&path_file_stem(&path, ""))
                && path_file_stem(&path, "") != "sheets"
            {
                continue;
            }
            if let Some(found) = existing_markdown_path_for_sheet(&path, sheet_id) {
                return Some(found);
            }
            continue;
        }
        if !is_markdown_file(&path) {
            continue;
        }
        let raw = fs::read_to_string(&path).ok()?;
        if sheet_frontmatter_value(&raw, "id").as_deref() == Some(sheet_id) {
            return Some(path);
        }
    }

    None
}

fn cleanup_stale_managed_markdown_files(
    root: &Path,
    active_paths: &HashSet<PathBuf>,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            cleanup_stale_managed_markdown_files(&path, active_paths)?;
            continue;
        }
        if !is_markdown_file(&path) || active_paths.contains(&path) {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        if is_managed_sheet_markdown(&raw) {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn is_managed_sheet_markdown(raw: &str) -> bool {
    raw.lines()
        .take(40)
        .any(|line| matches!(line.trim(), "lobySheet: true" | "nibvaSheet: true"))
}

fn is_project_support_dir(name: &str) -> bool {
    matches!(name, "assets" | "references" | "exports" | "sheets")
}
