//! [INPUT]: 依赖 library scan/group 规则、fs_paths/markdown/project_paths 安全写入能力、写作库 models 与 std fs/time
//! [OUTPUT]: 向 crate 提供基于缓存路径索引的整库/单文稿 revision 保存、内部改名登记、metadata-only index、unix_timestamp 及按文稿 ID 查找现有 Markdown 的能力
//! [POS]: 本地写作库的安全保存边界，高频正文只原子写入目标 Markdown；标题改名先登记源/目标路径，避免 watcher 把内部移动误报为外部刷新
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::scan::{note_group_from_folder, project_group_from_folder};
use super::{INBOX_PROJECT_ID, NOTES_PROJECT_ID};
use crate::fs_paths::{is_markdown_file, path_file_stem, write_if_changed, write_if_changed_with};
use crate::markdown::{
    render_project_readme, render_project_toml, render_sheet_markdown, safe_visible_path_segment,
    sheet_frontmatter_value,
};
use crate::models::{DocumentProjectContext, DocumentSaveReceipt, WritingProject, WritingSheet};
use crate::project_paths::{
    ensure_library_image_dir, ensure_project_resource_dirs, resolve_project_content_dir,
};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

type LibrarySheetPaths = HashMap<String, PathBuf>;
type SheetPathCache = HashMap<PathBuf, LibrarySheetPaths>;

fn sheet_path_cache() -> &'static Mutex<SheetPathCache> {
    static CACHE: OnceLock<Mutex<SheetPathCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn library_write_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

pub(crate) fn save_library_to_path(
    root: PathBuf,
    projects: Vec<WritingProject>,
) -> Result<String, String> {
    let _write_guard = library_write_lock()
        .lock()
        .map_err(|error| error.to_string())?;
    let mut existing_sheet_paths = existing_library_markdown_paths(&root);
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    ensure_library_image_dir(&root)?;

    for project in &projects {
        if project.id == INBOX_PROJECT_ID {
            save_inbox_project(&root, project, &mut existing_sheet_paths)?;
        } else if project.id == NOTES_PROJECT_ID {
            save_notes_project(&root, project, &mut existing_sheet_paths)?;
        } else {
            save_writing_project(&root, project, &mut existing_sheet_paths)?;
        }
    }

    write_owned_library_index(&root, projects)?;
    sheet_path_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(root.clone(), existing_sheet_paths);
    Ok(root.display().to_string())
}

pub(crate) fn save_document_to_path(
    root: PathBuf,
    project: DocumentProjectContext,
    sheet: WritingSheet,
    revision: u64,
) -> Result<DocumentSaveReceipt, String> {
    let _write_guard = library_write_lock()
        .lock()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    let group_dir = if project.id == INBOX_PROJECT_ID {
        root.join("inbox")
    } else if project.id == NOTES_PROJECT_ID {
        let group = project
            .groups
            .iter()
            .find(|group| group.id == sheet.group_id)
            .cloned()
            .unwrap_or_else(|| note_group_from_folder("随手记"));
        root.join("notes")
            .join(safe_visible_path_segment(&group.title, &group.id))
    } else {
        let project_dir =
            resolve_or_create_project_dir_for_identity(&root, &project.id, &project.title)?;
        ensure_project_resource_dirs(&project_dir)?;
        let group = project
            .groups
            .iter()
            .find(|group| group.id == sheet.group_id)
            .or_else(|| project.groups.first())
            .cloned()
            .unwrap_or_else(|| project_group_from_folder("待整理"));
        project_dir.join(safe_visible_path_segment(&group.title, &group.id))
    };
    fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;

    let mut cache = sheet_path_cache()
        .lock()
        .map_err(|error| error.to_string())?;
    let paths = cache
        .entry(root.clone())
        .or_insert_with(|| existing_library_markdown_paths(&root));
    if paths
        .get(&sheet.id)
        .is_some_and(|path| !markdown_file_belongs_to_sheet(path, &sheet.id))
    {
        *paths = existing_library_markdown_paths(&root);
    }

    let markdown_path = relocate_markdown_path_for_sheet(&group_dir, &sheet, paths)?;
    let written = write_if_changed_with(&markdown_path, render_sheet_markdown(&sheet), || {
        super::watcher::record_internal_write(&markdown_path)
    })?;
    paths.insert(sheet.id.clone(), markdown_path.clone());

    Ok(DocumentSaveReceipt {
        path: markdown_path.display().to_string(),
        revision,
        written,
    })
}

pub(crate) fn save_library_metadata_to_path(
    root: PathBuf,
    projects: Vec<WritingProject>,
) -> Result<String, String> {
    let _write_guard = library_write_lock()
        .lock()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join(".loby")).map_err(|error| error.to_string())?;
    write_owned_library_index(&root, projects)?;
    Ok(root.display().to_string())
}

fn save_inbox_project(
    root: &Path,
    project: &WritingProject,
    existing_sheet_paths: &mut HashMap<String, PathBuf>,
) -> Result<(), String> {
    let inbox_dir = root.join("inbox");
    fs::create_dir_all(&inbox_dir).map_err(|error| error.to_string())?;
    for sheet in &project.sheets {
        let markdown_path =
            relocate_markdown_path_for_sheet(&inbox_dir, sheet, existing_sheet_paths)?;
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
    }
    Ok(())
}

pub(super) fn write_library_index(root: &Path, projects: &[WritingProject]) -> Result<(), String> {
    write_owned_library_index(root, projects.to_vec())
}

fn write_owned_library_index(root: &Path, mut projects: Vec<WritingProject>) -> Result<(), String> {
    fs::create_dir_all(root.join(".loby")).map_err(|error| error.to_string())?;
    for sheet in projects
        .iter_mut()
        .flat_map(|project| project.sheets.iter_mut())
    {
        sheet.body.clear();
    }
    let index = serde_json::to_string_pretty(&projects).map_err(|error| error.to_string())?;
    write_if_changed(&root.join(".loby").join("library.json"), index)?;
    Ok(())
}

fn save_notes_project(
    root: &Path,
    project: &WritingProject,
    existing_sheet_paths: &mut HashMap<String, PathBuf>,
) -> Result<(), String> {
    let notes_dir = root.join("notes");
    fs::create_dir_all(&notes_dir).map_err(|error| error.to_string())?;
    rename_legacy_default_folder(&notes_dir, "收件箱", "随手记")?;
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
        let markdown_path =
            relocate_markdown_path_for_sheet(&group_dir, sheet, existing_sheet_paths)?;
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
    }

    remove_empty_legacy_folder(&notes_dir, "收件箱")?;
    remove_empty_legacy_folder(&notes_dir, "待整理")?;
    Ok(())
}

fn save_writing_project(
    root: &Path,
    project: &WritingProject,
    existing_sheet_paths: &mut HashMap<String, PathBuf>,
) -> Result<(), String> {
    let project_dir = resolve_or_create_project_dir(root, project)?;
    rename_legacy_default_folder(&project_dir, "默认组", "待整理")?;
    ensure_project_resource_dirs(&project_dir)?;
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
        let markdown_path =
            relocate_markdown_path_for_sheet(&group_dir, sheet, existing_sheet_paths)?;
        write_if_changed(&markdown_path, render_sheet_markdown(sheet))?;
    }

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
    resolve_or_create_project_dir_for_identity(root, &project.id, &project.title)
}

fn resolve_or_create_project_dir_for_identity(
    root: &Path,
    project_id: &str,
    project_title: &str,
) -> Result<PathBuf, String> {
    let projects_root = root.join("projects");
    fs::create_dir_all(&projects_root).map_err(|error| error.to_string())?;
    let desired_dir = projects_root.join(safe_visible_path_segment(project_title, project_id));
    let existing = resolve_project_content_dir(root, project_id, Some(project_title));
    if existing.exists() {
        return Ok(existing);
    }

    let project_dir = if desired_dir.exists() {
        unique_directory_path(
            &projects_root,
            &safe_visible_path_segment(project_title, project_id),
        )
    } else {
        desired_dir
    };
    fs::create_dir_all(&project_dir).map_err(|error| error.to_string())?;
    Ok(project_dir)
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

fn relocate_markdown_path_for_sheet(
    group_dir: &Path,
    sheet: &WritingSheet,
    existing_sheet_paths: &mut HashMap<String, PathBuf>,
) -> Result<PathBuf, String> {
    let base_name = safe_visible_path_segment(&sheet.title, &sheet.id);
    let desired = group_dir.join(format!("{}.md", base_name));

    if existing_sheet_paths.get(&sheet.id) == Some(&desired) {
        return Ok(desired);
    }

    let existing = existing_sheet_paths.get(&sheet.id).cloned();

    if let Some(existing_path) = existing.as_ref() {
        let existing_parent = existing_path.parent();
        let existing_stem = path_file_stem(existing_path, "");
        if existing_parent == Some(group_dir)
            && is_matching_sheet_filename_variant(&existing_stem, &base_name)
        {
            return Ok(existing_path.clone());
        }
    }

    let destination = if existing.as_ref() == Some(&desired) || !desired.exists() {
        desired
    } else {
        unique_markdown_path_for_base(group_dir, &base_name)
    };

    if let Some(existing_path) = existing.filter(|path| path != &destination) {
        super::watcher::record_internal_move(&existing_path, &destination);
        fs::rename(&existing_path, &destination).map_err(|error| {
            format!(
                "无法移动文稿 {} 到 {}：{error}",
                existing_path.display(),
                destination.display()
            )
        })?;
    }

    existing_sheet_paths.insert(sheet.id.clone(), destination.clone());
    Ok(destination)
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
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        if sheet_frontmatter_value(&raw, "id").as_deref() == Some(sheet_id) {
            return Some(path);
        }
    }

    None
}

fn existing_library_markdown_paths(root: &Path) -> HashMap<String, PathBuf> {
    let mut paths = HashMap::new();
    for content_root in [
        root.join("inbox"),
        root.join("notes"),
        root.join("projects"),
    ] {
        collect_existing_markdown_paths(&content_root, &mut paths);
    }
    paths
}

fn collect_existing_markdown_paths(root: &Path, paths: &mut HashMap<String, PathBuf>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path_file_stem(&path, "");
            if !is_project_support_dir(&name) || name == "sheets" {
                collect_existing_markdown_paths(&path, paths);
            }
            continue;
        }
        if !is_markdown_file(&path) {
            continue;
        }
        let Some(sheet_id) = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| sheet_frontmatter_value(&raw, "id"))
        else {
            continue;
        };
        paths.entry(sheet_id).or_insert(path);
    }
}

fn is_project_support_dir(name: &str) -> bool {
    matches!(name, "assets" | "references" | "exports" | "sheets")
}
