use notify::{RecursiveMode, Watcher};
mod fs_paths;
mod markdown;
mod models;

use fs_paths::*;
use markdown::*;
use models::*;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[derive(Clone, Default)]
struct AgentApprovalState {
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<String>>>>,
}

#[derive(Clone, Default)]
struct AgentRunState {
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<()>>>>,
}

struct AgentStreamRun {
    window: tauri::Window,
    request_id: String,
    provider: String,
    agent_path: String,
    library_path: PathBuf,
    full_prompt: String,
    runtime: AgentRuntimeSettings,
    approval_state: AgentApprovalState,
    thread_id: Option<String>,
    cancel_receiver: mpsc::Receiver<()>,
}

struct ActiveLibraryWatcher {
    root: PathBuf,
    _watcher: notify::RecommendedWatcher,
}

#[derive(Default)]
struct LibraryWatcherState {
    active: Mutex<Option<ActiveLibraryWatcher>>,
}

const MAX_RESOURCE_TEXT_BYTES: usize = 60_000;
const NOTES_PROJECT_ID: &str = "notes-root";
const NOTES_INBOX_GROUP_ID: &str = "notes-inbox";

#[tauri::command]
fn app_runtime() -> &'static str {
    "Nibva Tauri runtime ready"
}

#[tauri::command]
fn default_library_path() -> Result<String, String> {
    Ok(library_root()?.display().to_string())
}

#[tauri::command]
fn load_library() -> Result<Vec<WritingProject>, String> {
    load_library_from_path(library_root()?)
}

#[tauri::command]
fn load_library_at(path: String) -> Result<Vec<WritingProject>, String> {
    load_library_from_path(PathBuf::from(path))
}

fn load_library_from_path(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    let indexed_projects = load_library_index(&root)?;
    scan_local_first_library(&root, &indexed_projects)
}

#[tauri::command]
fn rebuild_library_index(path: String) -> Result<Vec<WritingProject>, String> {
    rebuild_library_index_at(PathBuf::from(path))
}

fn rebuild_library_index_at(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    let indexed_projects = load_library_index(&root)?;
    let projects = scan_local_first_library(&root, &indexed_projects)?;
    write_library_index(&root, &projects)?;
    Ok(projects)
}

#[tauri::command]
fn watch_library(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, LibraryWatcherState>,
) -> Result<(), String> {
    let root = fs::canonicalize(PathBuf::from(path)).map_err(|error| error.to_string())?;
    if !root.is_dir() {
        return Err("Library path is not a directory.".to_string());
    }

    let mut active = state.active.lock().map_err(|error| error.to_string())?;
    if active.as_ref().map(|watcher| watcher.root.as_path()) == Some(root.as_path()) {
        return Ok(());
    }

    let event_root = root.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        let paths = event
            .paths
            .iter()
            .filter(|path| is_library_content_event_path(&event_root, path))
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();
        if paths.is_empty() {
            return;
        }
        let _ = app.emit(
            "nibva://library-files-changed",
            LibraryFileChange {
                paths,
                kind: format!("{:?}", event.kind),
            },
        );
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    *active = Some(ActiveLibraryWatcher {
        root,
        _watcher: watcher,
    });
    Ok(())
}

#[tauri::command]
fn move_project_to_trash(
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
    rebuild_library_index_at(root)
}

#[tauri::command]
fn clear_library_trash(path: String) -> Result<Vec<WritingProject>, String> {
    let root = PathBuf::from(path);
    let trash_root = root.join(".nibva").join("trash");
    if trash_root.exists() {
        fs::remove_dir_all(&trash_root).map_err(|error| error.to_string())?;
    }
    rebuild_library_index_at(root)
}

#[tauri::command]
fn save_library(projects: Vec<WritingProject>) -> Result<String, String> {
    save_library_to_path(library_root()?, projects)
}

#[tauri::command]
fn save_library_at(path: String, projects: Vec<WritingProject>) -> Result<String, String> {
    save_library_to_path(PathBuf::from(path), projects)
}

#[tauri::command]
fn load_conversations(path: String) -> Result<serde_json::Value, String> {
    let conversations_path = PathBuf::from(path)
        .join(".nibva")
        .join("ai")
        .join("conversations.json");
    if !conversations_path.exists() {
        return Ok(serde_json::Value::Array(Vec::new()));
    }

    let raw = fs::read_to_string(conversations_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_conversations(path: String, conversations: serde_json::Value) -> Result<String, String> {
    let root = PathBuf::from(path);
    let ai_dir = root.join(".nibva").join("ai");
    fs::create_dir_all(&ai_dir).map_err(|error| error.to_string())?;
    let payload =
        serde_json::to_string_pretty(&conversations).map_err(|error| error.to_string())?;
    let conversations_path = ai_dir.join("conversations.json");
    fs::write(&conversations_path, payload).map_err(|error| error.to_string())?;
    Ok(conversations_path.display().to_string())
}

fn load_library_index(root: &Path) -> Result<Vec<WritingProject>, String> {
    let index_path = root.join(".nibva").join("library.json");
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(index_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn scan_local_first_library(
    root: &Path,
    indexed_projects: &[WritingProject],
) -> Result<Vec<WritingProject>, String> {
    let mut projects = Vec::new();

    if let Some(notes) = scan_notes_area(root, indexed_projects)? {
        projects.push(notes);
    }

    let projects_root = root.join("projects");
    if projects_root.exists() {
        for entry in fs::read_dir(&projects_root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let project_dir = entry.path();
            if !project_dir.is_dir() || is_hidden_path(&project_dir) {
                continue;
            }

            if let Some(project) = scan_project_area(&project_dir, indexed_projects)? {
                projects.push(project);
            }
        }
    }

    Ok(order_projects_by_index(projects, indexed_projects))
}

fn scan_notes_area(
    root: &Path,
    indexed_projects: &[WritingProject],
) -> Result<Option<WritingProject>, String> {
    let notes_dir = root.join("notes");
    if !notes_dir.exists() {
        return Ok(None);
    }

    let indexed = indexed_projects
        .iter()
        .find(|project| project.id == NOTES_PROJECT_ID);
    let mut project = indexed.cloned().unwrap_or_else(default_notes_project);
    project.id = NOTES_PROJECT_ID.to_string();
    project.title = "笔记".to_string();

    let indexed_group_order = project.groups.clone();
    let mut groups = Vec::new();
    let mut sheets = Vec::new();

    let inbox_group = find_group_by_title_or_id(&project, "收件箱")
        .unwrap_or_else(|| note_group_from_folder("收件箱"));
    collect_markdown_sheets_from_group(&notes_dir, &inbox_group, &project, &mut sheets)?;
    if sheets.iter().any(|sheet| sheet.group_id == inbox_group.id) {
        groups.push(inbox_group.clone());
    }

    for entry in fs::read_dir(&notes_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let group_dir = entry.path();
        if !group_dir.is_dir() || is_hidden_path(&group_dir) {
            continue;
        }

        let group_title = path_file_stem(&group_dir, "收件箱");
        let group = find_group_by_title_or_id(&project, &group_title)
            .unwrap_or_else(|| note_group_from_folder(&group_title));
        collect_markdown_sheets_from_group(&group_dir, &group, &project, &mut sheets)?;
        groups.push(group);
    }

    if groups.is_empty() {
        groups.push(note_group_from_folder("收件箱"));
    }

    project.groups = order_note_groups_by_index(dedupe_groups(groups), &indexed_group_order);
    project.sheets = dedupe_sheets(sheets);
    Ok(Some(project))
}

fn scan_project_area(
    project_dir: &Path,
    indexed_projects: &[WritingProject],
) -> Result<Option<WritingProject>, String> {
    let folder_title = path_file_stem(project_dir, "未命名项目");
    let project_id = read_project_id_from_toml(project_dir);
    let indexed_project = project_id
        .as_ref()
        .and_then(|id| indexed_projects.iter().find(|item| &item.id == id))
        .or_else(|| {
            indexed_projects
                .iter()
                .find(|item| item.title == folder_title)
        });

    let mut project = indexed_project
        .cloned()
        .unwrap_or_else(|| default_project_from_folder(&folder_title));

    if let Some(project_id) = project_id {
        project.id = project_id;
    }

    apply_project_toml_metadata(project_dir, &mut project);

    if project.title.trim().is_empty() {
        project.title = folder_title;
    }

    let indexed_group_order = project.groups.clone();
    let mut groups = Vec::new();
    let mut sheets = Vec::new();

    let default_group = find_group_by_title_or_id(&project, "默认组")
        .or_else(|| project.groups.first().cloned())
        .unwrap_or_else(|| project_group_from_folder("默认组"));
    collect_markdown_sheets_from_group(project_dir, &default_group, &project, &mut sheets)?;
    if sheets
        .iter()
        .any(|sheet| sheet.group_id == default_group.id)
    {
        groups.push(default_group.clone());
    }

    for entry in fs::read_dir(project_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let group_dir = entry.path();
        if !group_dir.is_dir() || is_hidden_path(&group_dir) {
            continue;
        }

        let group_title = path_file_stem(&group_dir, "未命名分组");
        if is_project_support_dir(&group_title) {
            continue;
        }

        let group = find_group_by_title_or_id(&project, &group_title)
            .unwrap_or_else(|| project_group_from_folder(&group_title));
        collect_markdown_sheets_from_group(&group_dir, &group, &project, &mut sheets)?;
        groups.push(group);
    }

    if groups.is_empty() && sheets.is_empty() {
        return Ok(Some(project));
    }

    if groups.is_empty() {
        groups = project.groups.clone();
    }

    project.groups = order_groups_by_index(dedupe_groups(groups), &indexed_group_order);
    project.sheets = dedupe_sheets(sheets);
    Ok(Some(project))
}

fn collect_markdown_sheets_from_group(
    group_dir: &Path,
    group: &ProjectGroup,
    project: &WritingProject,
    sheets: &mut Vec<WritingSheet>,
) -> Result<(), String> {
    for entry in fs::read_dir(group_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        if !is_markdown_file(&path) {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        sheets.push(sheet_from_markdown_file(&path, &raw, &group.id, project));
    }

    Ok(())
}

fn sheet_from_markdown_file(
    path: &Path,
    raw: &str,
    group_id: &str,
    project: &WritingProject,
) -> WritingSheet {
    let fallback_title = path_file_stem(path, "未命名文稿");
    let id = frontmatter_value(raw, "id").unwrap_or_else(|| {
        find_indexed_sheet_by_title(project, &fallback_title)
            .map(|sheet| sheet.id.clone())
            .unwrap_or_else(|| format!("sheet-{}", stable_id_segment(&fallback_title)))
    });
    let indexed = project.sheets.iter().find(|sheet| sheet.id == id);
    let body = strip_nibva_frontmatter(raw).to_string();
    let title = frontmatter_value(raw, "title")
        .or_else(|| markdown_h1_title(&body))
        .or_else(|| indexed.map(|sheet| sheet.title.clone()))
        .unwrap_or(fallback_title);

    WritingSheet {
        id,
        title,
        group_id: group_id.to_string(),
        sheet_type: frontmatter_value(raw, "type")
            .or_else(|| indexed.map(|sheet| sheet.sheet_type.clone()))
            .unwrap_or_else(|| "正文".to_string()),
        status: frontmatter_value(raw, "status")
            .or_else(|| indexed.map(|sheet| sheet.status.clone()))
            .unwrap_or_else(|| "构思".to_string()),
        target_words: frontmatter_value(raw, "targetWords")
            .and_then(|value| value.parse::<u32>().ok())
            .or_else(|| indexed.map(|sheet| sheet.target_words))
            .unwrap_or(0),
        summary: frontmatter_value(raw, "summary")
            .or_else(|| indexed.map(|sheet| sheet.summary.clone()))
            .unwrap_or_default(),
        body,
        created_at: frontmatter_value(raw, "createdAt")
            .or_else(|| indexed.map(|sheet| sheet.created_at.clone()))
            .or_else(|| indexed.map(|sheet| sheet.updated_at.clone()))
            .unwrap_or_default(),
        updated_at: frontmatter_value(raw, "updatedAt")
            .or_else(|| indexed.map(|sheet| sheet.updated_at.clone()))
            .unwrap_or_default(),
        versions: indexed
            .map(|sheet| sheet.versions.clone())
            .unwrap_or_default(),
    }
}

#[tauri::command]
fn list_project_resources(
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
fn save_project_export(
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
fn save_project_export_bundle(
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
fn save_project_image(
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
fn import_project_images(
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
fn import_project_resources(
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
fn read_markdown_import_files(
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
fn open_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&target).status()
    } else {
        Command::new("xdg-open").arg(&target).status()
    }
    .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Open command failed with status: {}", status))
    }
}

#[tauri::command]
fn copy_local_file(source_path: String, destination_path: String) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let destination = PathBuf::from(destination_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_project_resource_text(
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
        std::io::Read::by_ref(&mut file)
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

fn save_library_to_path(root: PathBuf, projects: Vec<WritingProject>) -> Result<String, String> {
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    for project in &projects {
        if project.id == NOTES_PROJECT_ID {
            save_notes_project(&root, project)?;
        } else {
            save_writing_project(&root, project)?;
        }
    }

    write_library_index(&root, &projects)?;
    Ok(root.display().to_string())
}

fn write_library_index(root: &Path, projects: &[WritingProject]) -> Result<(), String> {
    fs::create_dir_all(root.join(".nibva")).map_err(|error| error.to_string())?;
    let index = serde_json::to_string_pretty(&projects).map_err(|error| error.to_string())?;
    fs::write(root.join(".nibva").join("library.json"), &index)
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn save_notes_project(root: &Path, project: &WritingProject) -> Result<(), String> {
    let notes_dir = root.join("notes");
    fs::create_dir_all(&notes_dir).map_err(|error| error.to_string())?;
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
            .unwrap_or_else(|| note_group_from_folder("收件箱"));
        let group_dir = notes_dir.join(safe_visible_path_segment(&group.title, &group.id));
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
        let markdown_path = markdown_path_for_sheet(&notes_dir, &group_dir, sheet);
        fs::write(&markdown_path, render_sheet_markdown(sheet))
            .map_err(|error| error.to_string())?;
        active_paths.insert(markdown_path);
    }

    cleanup_stale_managed_markdown_files(&notes_dir, &active_paths)?;
    Ok(())
}

fn save_writing_project(root: &Path, project: &WritingProject) -> Result<(), String> {
    let project_dir = resolve_or_create_project_dir(root, project)?;
    ensure_project_resource_dirs(&project_dir)?;
    let mut active_paths = HashSet::new();

    for sheet in &project.sheets {
        let group = project
            .groups
            .iter()
            .find(|group| group.id == sheet.group_id)
            .cloned()
            .or_else(|| project.groups.first().cloned())
            .unwrap_or_else(|| project_group_from_folder("默认组"));
        let group_dir = project_dir.join(safe_visible_path_segment(&group.title, &group.id));
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
        let markdown_path = markdown_path_for_sheet(&project_dir, &group_dir, sheet);
        fs::write(&markdown_path, render_sheet_markdown(sheet))
            .map_err(|error| error.to_string())?;
        active_paths.insert(markdown_path);
    }

    cleanup_stale_managed_markdown_files(&project_dir, &active_paths)?;

    fs::write(
        project_dir.join("project.toml"),
        render_project_toml(project),
    )
    .map_err(|error| error.to_string())?;
    fs::write(
        project_dir.join("README.md"),
        render_project_readme(project),
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn reveal_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .status()
    } else {
        let folder = if target.is_dir() {
            target.as_path()
        } else {
            target.parent().unwrap_or_else(|| Path::new("."))
        };
        Command::new("xdg-open").arg(folder).status()
    }
    .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err("Failed to reveal local path.".to_string());
    }

    Ok(())
}

fn ensure_project_resource_dirs(project_dir: &Path) -> Result<(), String> {
    for directory in ["assets", "references", "exports"] {
        fs::create_dir_all(project_dir.join(directory)).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(project_dir.join("assets").join("images"))
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn resolve_project_content_dir(
    root: &Path,
    project_id: &str,
    project_title: Option<&str>,
) -> PathBuf {
    let projects_root = root.join("projects");
    if let Ok(entries) = fs::read_dir(&projects_root) {
        for entry in entries.flatten() {
            let project_dir = entry.path();
            if !project_dir.is_dir() {
                continue;
            }
            if read_project_id_from_toml(&project_dir).as_deref() == Some(project_id) {
                return project_dir;
            }
        }
    }

    root.join("projects").join(safe_visible_path_segment(
        project_title.unwrap_or(project_id),
        project_id,
    ))
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

fn read_project_id_from_toml(project_dir: &Path) -> Option<String> {
    let raw = fs::read_to_string(project_dir.join("project.toml")).ok()?;
    toml_value(&raw, "id")
}

fn apply_project_toml_metadata(project_dir: &Path, project: &mut WritingProject) {
    let Ok(raw) = fs::read_to_string(project_dir.join("project.toml")) else {
        return;
    };

    if let Some(title) = toml_value(&raw, "title").filter(|value| !value.trim().is_empty()) {
        project.title = title;
    }
    if let Some(icon) = toml_value(&raw, "icon") {
        project.icon = icon;
    }
    if let Some(icon_color) = toml_value(&raw, "iconColor") {
        project.icon_color = icon_color;
    }
    if let Some(description) = toml_value(&raw, "description") {
        project.description = description;
    }
}

fn default_notes_project() -> WritingProject {
    WritingProject {
        id: NOTES_PROJECT_ID.to_string(),
        title: "笔记".to_string(),
        icon: "inbox".to_string(),
        icon_color: "#8e8e93".to_string(),
        description: "用于收集暂未归入项目的笔记、想法和短文本。".to_string(),
        status: "构思".to_string(),
        target_platform: "未指定".to_string(),
        target_words: 0,
        tags: vec!["笔记".to_string()],
        groups: vec![note_group_from_folder("收件箱")],
        sheets: Vec::new(),
        updated_at: String::new(),
        publishing_checklist: Vec::new(),
        export_history: Vec::new(),
        writing_brief: ProjectWritingBrief::default(),
    }
}

fn default_project_from_folder(title: &str) -> WritingProject {
    WritingProject {
        id: format!("project-{}", stable_id_segment(title)),
        title: title.to_string(),
        icon: "library".to_string(),
        icon_color: "#007aff".to_string(),
        description: String::new(),
        status: "构思".to_string(),
        target_platform: "未指定".to_string(),
        target_words: 0,
        tags: Vec::new(),
        groups: Vec::new(),
        sheets: Vec::new(),
        updated_at: String::new(),
        publishing_checklist: Vec::new(),
        export_history: Vec::new(),
        writing_brief: ProjectWritingBrief::default(),
    }
}

fn note_group_from_folder(title: &str) -> ProjectGroup {
    ProjectGroup {
        id: if title == "收件箱" {
            NOTES_INBOX_GROUP_ID.to_string()
        } else {
            format!("note-group-{}", stable_id_segment(title))
        },
        title: title.to_string(),
        icon: if title == "收件箱" {
            "inbox".to_string()
        } else {
            "notes".to_string()
        },
        icon_color: if title == "收件箱" {
            "#8e8e93".to_string()
        } else {
            String::new()
        },
        description: String::new(),
    }
}

fn project_group_from_folder(title: &str) -> ProjectGroup {
    ProjectGroup {
        id: format!("group-{}", stable_id_segment(title)),
        title: title.to_string(),
        icon: String::new(),
        icon_color: String::new(),
        description: String::new(),
    }
}

fn find_group_by_title_or_id(project: &WritingProject, title: &str) -> Option<ProjectGroup> {
    let id = safe_file_segment(title);
    project
        .groups
        .iter()
        .find(|group| group.title == title || safe_file_segment(&group.id) == id)
        .cloned()
}

fn find_indexed_sheet_by_title<'a>(
    project: &'a WritingProject,
    title: &str,
) -> Option<&'a WritingSheet> {
    project.sheets.iter().find(|sheet| {
        sheet.title == title || safe_visible_path_segment(&sheet.title, &sheet.id) == title
    })
}

fn dedupe_groups(groups: Vec<ProjectGroup>) -> Vec<ProjectGroup> {
    let mut seen = HashSet::new();
    groups
        .into_iter()
        .filter(|group| seen.insert(group.id.clone()))
        .collect()
}

fn dedupe_sheets(sheets: Vec<WritingSheet>) -> Vec<WritingSheet> {
    let mut seen = HashSet::new();
    sheets
        .into_iter()
        .filter(|sheet| seen.insert(sheet.id.clone()))
        .collect()
}

fn order_projects_by_index(
    projects: Vec<WritingProject>,
    indexed_projects: &[WritingProject],
) -> Vec<WritingProject> {
    let mut ordered = Vec::new();
    let mut remaining = projects;

    for indexed_project in indexed_projects {
        if let Some(index) = remaining
            .iter()
            .position(|project| project.id == indexed_project.id)
        {
            ordered.push(remaining.remove(index));
        }
    }

    ordered.extend(remaining);
    ordered
}

fn order_groups_by_index(
    groups: Vec<ProjectGroup>,
    indexed_groups: &[ProjectGroup],
) -> Vec<ProjectGroup> {
    let mut ordered = Vec::new();
    let mut remaining = groups;

    for indexed_group in indexed_groups {
        if let Some(index) = remaining
            .iter()
            .position(|group| group.id == indexed_group.id)
        {
            ordered.push(remaining.remove(index));
        }
    }

    ordered.extend(remaining);
    ordered
}

fn order_note_groups_by_index(
    groups: Vec<ProjectGroup>,
    indexed_groups: &[ProjectGroup],
) -> Vec<ProjectGroup> {
    let ordered_groups = order_groups_by_index(groups, indexed_groups);
    let mut inbox_group = None;
    let mut other_groups = Vec::new();

    for group in ordered_groups {
        if group.id == NOTES_INBOX_GROUP_ID {
            inbox_group = Some(group);
        } else {
            other_groups.push(group);
        }
    }

    if let Some(group) = inbox_group {
        let mut groups = vec![group];
        groups.extend(other_groups);
        groups
    } else {
        other_groups
    }
}

fn is_project_support_dir(name: &str) -> bool {
    matches!(name, "assets" | "references" | "exports" | "sheets")
}

fn is_library_content_event_path(root: &Path, path: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let mut components = relative.components();
    let Some(first) = components
        .next()
        .and_then(|component| component.as_os_str().to_str())
    else {
        return false;
    };
    if first.starts_with('.') {
        return false;
    }
    matches!(first, "notes" | "projects")
}

fn unique_directory_path(parent: &Path, base_name: &str) -> PathBuf {
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

fn unique_markdown_path_for_base(group_dir: &Path, base_name: &str) -> PathBuf {
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
    let existing = existing_markdown_path_for_sheet(root, &sheet.id);
    let base_name = safe_visible_path_segment(&sheet.title, &sheet.id);

    if let Some(existing_path) = existing.as_ref() {
        let existing_parent = existing_path.parent();
        let existing_stem = path_file_stem(existing_path, "");
        if existing_parent == Some(group_dir)
            && is_matching_sheet_filename_variant(&existing_stem, &base_name)
        {
            return existing_path.clone();
        }
    }

    let desired = group_dir.join(format!("{}.md", base_name));
    if existing.as_ref() == Some(&desired) || !desired.exists() {
        return desired;
    }

    unique_markdown_path_for_base(group_dir, &base_name)
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

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn existing_markdown_path_for_sheet(root: &Path, sheet_id: &str) -> Option<PathBuf> {
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
        if frontmatter_value(&raw, "id").as_deref() == Some(sheet_id) {
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
        if raw
            .lines()
            .take(20)
            .any(|line| line.trim() == "nibvaSheet: true")
        {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
fn list_codex_skills() -> Result<Vec<CodexSkill>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let mut system_skills = Vec::new();
    collect_skills(
        &home.join(".codex").join("skills").join(".system"),
        0,
        None,
        &mut system_skills,
    )?;
    system_skills.sort_by(|a, b| a.name.cmp(&b.name));

    let mut user_skills = Vec::new();
    collect_skills(
        &home.join(".codex").join("skills"),
        0,
        None,
        &mut user_skills,
    )?;
    collect_skills(
        &home.join(".agents").join("skills"),
        0,
        None,
        &mut user_skills,
    )?;
    collect_plugin_cache_skills(
        &home
            .join(".codex")
            .join("plugins")
            .join("cache")
            .join("openai-bundled"),
        &mut user_skills,
    )?;
    collect_plugin_cache_skills(
        &home
            .join(".codex")
            .join("plugins")
            .join("cache")
            .join("openai-curated"),
        &mut user_skills,
    )?;
    collect_plugin_cache_skills(
        &home
            .join(".codex")
            .join("plugins")
            .join("cache")
            .join("openai-primary-runtime"),
        &mut user_skills,
    )?;
    user_skills.sort_by(|a, b| a.name.cmp(&b.name));

    let mut seen = HashSet::new();
    let skills = system_skills
        .into_iter()
        .chain(user_skills)
        .filter(|skill| seen.insert(skill.name.clone()))
        .collect();
    Ok(skills)
}

#[tauri::command]
fn list_codex_models() -> Result<CodexModelCatalog, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(empty_codex_model_catalog());
    };

    let config = fs::read_to_string(home.join(".codex").join("config.toml")).unwrap_or_default();
    let current_model = toml_value(&config, "model").unwrap_or_else(|| "auto".to_string());
    let current_reasoning_effort =
        toml_value(&config, "model_reasoning_effort").unwrap_or_else(|| "medium".to_string());

    let cache_path = home.join(".codex").join("models_cache.json");
    let Ok(raw) = fs::read_to_string(cache_path) else {
        return Ok(CodexModelCatalog {
            fetched_at: String::new(),
            current_model,
            current_reasoning_effort,
            models: Vec::new(),
        });
    };

    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    let fetched_at = value
        .get("fetched_at")
        .and_then(|item| item.as_str())
        .unwrap_or_default()
        .to_string();
    let models = value
        .get("models")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(parse_codex_model_option)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(CodexModelCatalog {
        fetched_at,
        current_model,
        current_reasoning_effort,
        models,
    })
}

fn empty_codex_model_catalog() -> CodexModelCatalog {
    CodexModelCatalog {
        fetched_at: String::new(),
        current_model: "auto".to_string(),
        current_reasoning_effort: "medium".to_string(),
        models: Vec::new(),
    }
}

fn parse_codex_model_option(value: &serde_json::Value) -> Option<CodexModelOption> {
    let slug = value.get("slug")?.as_str()?.to_string();
    let visibility = value
        .get("visibility")
        .and_then(|item| item.as_str())
        .unwrap_or("list");
    if visibility == "hidden" {
        return None;
    }

    let supported_reasoning_levels = value
        .get("supported_reasoning_levels")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(CodexReasoningLevel {
                        effort: item.get("effort")?.as_str()?.to_string(),
                        description: item
                            .get("description")
                            .and_then(|description| description.as_str())
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let additional_speed_tiers = value
        .get("additional_speed_tiers")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|value| value.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let service_tiers = value
        .get("service_tiers")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(CodexServiceTier {
                        id: item.get("id")?.as_str()?.to_string(),
                        name: item
                            .get("name")
                            .and_then(|name| name.as_str())
                            .unwrap_or_default()
                            .to_string(),
                        description: item
                            .get("description")
                            .and_then(|description| description.as_str())
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(CodexModelOption {
        slug,
        display_name: value
            .get("display_name")
            .and_then(|item| item.as_str())
            .unwrap_or_default()
            .to_string(),
        description: value
            .get("description")
            .and_then(|item| item.as_str())
            .unwrap_or_default()
            .to_string(),
        default_reasoning_level: value
            .get("default_reasoning_level")
            .and_then(|item| item.as_str())
            .unwrap_or("medium")
            .to_string(),
        supported_reasoning_levels,
        additional_speed_tiers,
        service_tiers,
    })
}

#[tauri::command]
async fn run_agent_chat(
    path: String,
    provider: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_agent_chat_blocking(
            path, provider, prompt, context, plan_mode, runtime, cli_path,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn start_agent_chat_stream(
    window: tauri::Window,
    approval_state: tauri::State<AgentApprovalState>,
    run_state: tauri::State<AgentRunState>,
    request_id: String,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    thread_id: Option<String>,
    cli_path: Option<String>,
) -> Result<(), String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = resolve_agent_command(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Nibva.",
            agent_binary_name(&provider)
        )
    })?;
    let library_path = PathBuf::from(path);
    let full_prompt = build_agent_prompt(&provider, &prompt, &context, plan_mode);
    let approval_state = approval_state.inner().clone();
    let run_state = run_state.inner().clone();
    let (cancel_sender, cancel_receiver) = mpsc::channel();
    run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .insert(request_id.clone(), cancel_sender);

    tauri::async_runtime::spawn_blocking(move || {
        let cleanup_state = run_state.clone();
        let cleanup_request_id = request_id.clone();
        run_agent_chat_stream_blocking(AgentStreamRun {
            window,
            request_id,
            provider,
            agent_path,
            library_path,
            full_prompt,
            runtime: runtime.unwrap_or_default(),
            approval_state,
            thread_id,
            cancel_receiver,
        });
        {
            if let Ok(mut pending) = cleanup_state.pending.lock() {
                pending.remove(&cleanup_request_id);
            };
        }
    });

    Ok(())
}

#[tauri::command]
fn cancel_agent_chat_stream(
    request_id: String,
    run_state: tauri::State<AgentRunState>,
    approval_state: tauri::State<AgentApprovalState>,
) -> Result<(), String> {
    let sender = run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&request_id);
    if let Some(sender) = sender {
        let _ = sender.send(());
    }
    let approval_prefix = format!("{request_id}:");
    let approval_senders = {
        let mut pending = approval_state
            .pending
            .lock()
            .map_err(|error| error.to_string())?;
        let approval_ids = pending
            .keys()
            .filter(|id| id.starts_with(&approval_prefix))
            .cloned()
            .collect::<Vec<_>>();
        approval_ids
            .into_iter()
            .filter_map(|id| pending.remove(&id))
            .collect::<Vec<_>>()
    };
    for sender in approval_senders {
        let _ = sender.send("cancel".to_string());
    }
    Ok(())
}

#[tauri::command]
fn respond_agent_approval(
    approval_id: String,
    decision: String,
    approval_state: tauri::State<AgentApprovalState>,
) -> Result<(), String> {
    let sender = approval_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&approval_id);
    if let Some(sender) = sender {
        sender.send(decision).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn run_agent_chat_blocking(
    path: String,
    provider: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = resolve_agent_command(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Nibva.",
            agent_binary_name(&provider)
        )
    })?;
    let library_path = PathBuf::from(path);
    let full_prompt = build_agent_prompt(&provider, &prompt, &context, plan_mode);
    let runtime = runtime.unwrap_or_default();

    let (output, command_label) = if provider == "claude" {
        let mut command = Command::new(&agent_path);
        command
            .arg("--print")
            .arg(full_prompt)
            .current_dir(&library_path);
        let output = run_command_with_timeout(command, Duration::from_secs(90))?;
        (
            output,
            format!(
                "{} --print <prompt> # cwd {}",
                agent_path,
                library_path.display()
            ),
        )
    } else {
        let mut command = Command::new(&agent_path);
        apply_codex_exec_args(&mut command, &library_path, &full_prompt, false, &runtime);
        let output = run_command_with_timeout(command, Duration::from_secs(90))?;
        (
            output,
            format_codex_exec_command_label(&agent_path, &library_path, false, &runtime),
        )
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    Ok(CodexChatResult {
        output: stdout,
        error: stderr,
        command: command_label,
    })
}

fn build_agent_prompt(provider: &str, prompt: &str, context: &str, plan_mode: bool) -> String {
    let mode_text = if plan_mode {
        "当前处于 Plan Mode。先分析和制定计划，不要直接改写正文；输出可执行步骤、风险和建议修改范围。"
    } else {
        "当前处于 Default Mode。可以给出直接建议，但仍需避免未经确认覆盖用户正文。"
    };
    let provider_name = if provider == "claude" {
        "Claude Code CLI"
    } else {
        "Codex CLI"
    };
    format!(
        "你是 Nibva 写作软件里的 AI 写作助手。你通过 {} 被调用。\
\n\n工作方式：\
\n- 辅助人类写作，不要替用户一键整篇代写。\
\n- 优先给出可审阅的建议、结构调整、局部润色和发布准备。\
\n- 如果用户要求修改正文，先输出建议稿或 diff 风格说明。\
\n- {}\n- 当前写作上下文如下：\n\n{}\n\n用户消息：\n{}",
        provider_name, mode_text, context, prompt
    )
}

fn apply_codex_exec_args(
    command: &mut Command,
    library_path: &Path,
    full_prompt: &str,
    json: bool,
    runtime: &AgentRuntimeSettings,
) {
    command.arg("exec");
    if json {
        command.arg("--json");
    }
    if !runtime.model.trim().is_empty() && runtime.model.trim() != "auto" {
        command.arg("--model").arg(runtime.model.trim());
    }
    if !runtime.reasoning_effort.trim().is_empty() {
        command.arg("-c").arg(format!(
            "model_reasoning_effort={}",
            toml_string(runtime.reasoning_effort.trim())
        ));
    }
    command
        .arg("-c")
        .arg(format!(
            "service_tier={}",
            toml_string(if runtime.quick_mode {
                "priority"
            } else {
                "default"
            })
        ))
        .arg("--skip-git-repo-check")
        .arg("--cd")
        .arg(library_path)
        .arg("--color")
        .arg("never")
        .arg(full_prompt)
        .env("CODEX_NON_INTERACTIVE", "1");
}

fn format_codex_exec_command_label(
    agent_path: &str,
    library_path: &Path,
    json: bool,
    runtime: &AgentRuntimeSettings,
) -> String {
    let mut parts = vec![agent_path.to_string(), "exec".to_string()];
    if json {
        parts.push("--json".to_string());
    }
    if !runtime.model.trim().is_empty() && runtime.model.trim() != "auto" {
        parts.push(format!("--model {}", runtime.model.trim()));
    }
    if !runtime.reasoning_effort.trim().is_empty() {
        parts.push(format!(
            "-c model_reasoning_effort={}",
            toml_string(runtime.reasoning_effort.trim())
        ));
    }
    parts.push(format!(
        "-c service_tier={}",
        toml_string(if runtime.quick_mode {
            "priority"
        } else {
            "default"
        })
    ));
    parts.push("--skip-git-repo-check".to_string());
    parts.push(format!("--cd {}", library_path.display()));
    parts.push("--color never <prompt>".to_string());
    parts.join(" ")
}

fn toml_string(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn run_agent_chat_stream_blocking(run: AgentStreamRun) {
    if run.provider == "codex" {
        run_codex_app_server_stream_blocking(run);
        return;
    }

    let AgentStreamRun {
        window,
        request_id,
        provider: _,
        agent_path,
        library_path,
        full_prompt,
        runtime: _,
        approval_state: _,
        thread_id: _,
        cancel_receiver,
    } = run;

    emit_agent_stream_event(&window, &request_id, "started", "", "");

    let mut command = Command::new(&agent_path);
    command
        .arg("--print")
        .arg(full_prompt)
        .current_dir(&library_path);

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            emit_agent_stream_event(&window, &request_id, "error", "", &error.to_string());
            return;
        }
    };

    let stderr_reader = child.stderr.take().map(|stderr| {
        thread::spawn(move || {
            let mut buffer = String::new();
            let mut reader = BufReader::new(stderr);
            let _ = reader.read_to_string(&mut buffer);
            buffer
        })
    });

    let Some(stdout) = child.stdout.take() else {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "AI CLI stdout is unavailable.",
        );
        let _ = child.kill();
        return;
    };

    let (line_sender, line_receiver) = mpsc::channel();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line_result in reader.lines() {
            let Ok(line) = line_result else {
                continue;
            };
            if line_sender.send(line).is_err() {
                break;
            }
        }
    });

    loop {
        if cancel_receiver.try_recv().is_ok() {
            let _ = child.kill();
            emit_agent_stream_event(&window, &request_id, "cancelled", "已取消本次请求。", "");
            return;
        }
        match line_receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(line) if !line.trim().is_empty() => {
                emit_agent_stream_event(&window, &request_id, "delta", &format!("{}\n", line), "");
            }
            Ok(_) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if child.try_wait().ok().flatten().is_some() {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    let status = child.wait();
    let stderr = stderr_reader
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default()
        .trim()
        .to_string();

    match status {
        Ok(exit_status) if exit_status.success() => {
            emit_agent_stream_event(&window, &request_id, "done", "", "");
        }
        Ok(_) => {
            let error = if stderr.is_empty() {
                "AI CLI exited with a non-zero status.".to_string()
            } else {
                stderr
            };
            emit_agent_stream_event(&window, &request_id, "error", "", &error);
        }
        Err(error) => {
            emit_agent_stream_event(&window, &request_id, "error", "", &error.to_string());
        }
    }
}

fn run_codex_app_server_stream_blocking(run: AgentStreamRun) {
    let AgentStreamRun {
        window,
        request_id,
        provider: _,
        agent_path,
        library_path,
        full_prompt,
        runtime,
        approval_state,
        thread_id: existing_thread_id,
        cancel_receiver,
    } = run;

    emit_agent_stream_event(&window, &request_id, "started", "", "");

    let mut command = Command::new(&agent_path);
    command
        .arg("app-server")
        .arg("--stdio")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            emit_agent_stream_event(&window, &request_id, "error", "", &error.to_string());
            return;
        }
    };

    let stderr_reader = child.stderr.take().map(|stderr| {
        thread::spawn(move || {
            let mut buffer = String::new();
            let mut reader = BufReader::new(stderr);
            let _ = reader.read_to_string(&mut buffer);
            buffer
        })
    });

    let Some(stdout) = child.stdout.take() else {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "Codex app-server stdout is unavailable.",
        );
        let _ = child.kill();
        return;
    };
    let Some(mut stdin) = child.stdin.take() else {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "Codex app-server stdin is unavailable.",
        );
        let _ = child.kill();
        return;
    };

    if let Err(error) = write_app_server_message(
        &mut stdin,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "clientInfo": {
                    "name": "nibva",
                    "title": "Nibva",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            },
        }),
    ) {
        emit_agent_stream_event(&window, &request_id, "error", "", &error);
        let _ = child.kill();
        return;
    }

    let (line_sender, line_receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        loop {
            line.clear();
            let read = match reader.read_line(&mut line) {
                Ok(read) => read,
                Err(_) => break,
            };
            if read == 0 {
                break;
            }
            if line_sender.send(line.trim().to_string()).is_err() {
                break;
            }
        }
    });

    let mut initialized = false;
    let mut thread_requested = false;
    let mut turn_requested = false;
    let mut completed = false;
    let mut thread_id = String::new();
    let mut cancelled = false;

    loop {
        if cancel_receiver.try_recv().is_ok() {
            cancelled = true;
            break;
        }

        let trimmed = match line_receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(line) => line,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if child.try_wait().ok().flatten().is_some() {
                    break;
                }
                continue;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        };
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<serde_json::Value>(&trimmed) else {
            continue;
        };
        if value.get("timestamp").is_some() && value.get("level").is_some() {
            continue;
        }

        if is_json_rpc_error(&value) {
            emit_agent_stream_event(
                &window,
                &request_id,
                "error",
                "",
                &format_json_rpc_error(&value),
            );
            break;
        }

        if !initialized && value.get("id").and_then(|id| id.as_i64()) == Some(1) {
            initialized = true;
            if let Err(error) = write_app_server_message(
                &mut stdin,
                serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "initialized",
                }),
            ) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        let resume_existing_thread = existing_thread_id
            .as_deref()
            .map(|id| !id.trim().is_empty())
            .unwrap_or(false);

        if initialized && !thread_requested {
            thread_requested = true;
            let thread_request = existing_thread_id
                .as_deref()
                .filter(|id| !id.trim().is_empty())
                .map(|id| build_app_server_thread_resume(id, &library_path, &runtime))
                .unwrap_or_else(|| build_app_server_thread_start(&library_path, &runtime));
            if let Err(error) = write_app_server_message(&mut stdin, thread_request) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        if value.get("id").and_then(|id| id.as_i64()) == Some(2) {
            if let Some(id) = value
                .get("result")
                .and_then(|result| result.get("thread"))
                .and_then(|thread| thread.get("id"))
                .and_then(|id| id.as_str())
            {
                thread_id = id.to_string();
                let mut event = empty_agent_event(&request_id, "status");
                event.raw_type = if resume_existing_thread {
                    "thread/resume.result"
                } else {
                    "thread/start.result"
                }
                .to_string();
                event.title = if resume_existing_thread {
                    "Codex 会话已恢复"
                } else {
                    "Codex 会话已启动"
                }
                .to_string();
                event.status = thread_id.clone();
                emit_agent_event(&window, event);
            }
        }

        if !turn_requested && !thread_id.is_empty() {
            turn_requested = true;
            if let Err(error) = write_app_server_message(
                &mut stdin,
                build_app_server_turn_start(&thread_id, &library_path, &full_prompt, &runtime),
            ) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        if let Some(method) = value.get("method").and_then(|method| method.as_str()) {
            if is_app_server_approval_request(method) {
                let decision = wait_for_app_server_approval(
                    &window,
                    &request_id,
                    method,
                    &value,
                    &approval_state,
                );
                let _ = write_app_server_message(
                    &mut stdin,
                    build_app_server_approval_response(&value, &decision),
                );
                continue;
            }

            if emit_app_server_notification(&window, &request_id, method, &value) {
                completed = true;
                break;
            }
        }
    }

    let _ = child.kill();
    let _ = child.wait();

    if cancelled {
        emit_agent_stream_event(&window, &request_id, "cancelled", "已取消本次请求。", "");
    } else if completed {
        emit_agent_stream_event(&window, &request_id, "done", "", "");
    } else {
        let stderr = stderr_reader
            .and_then(|handle| handle.join().ok())
            .unwrap_or_default()
            .trim()
            .to_string();
        if !stderr.is_empty() {
            emit_agent_stream_event(&window, &request_id, "error", "", &stderr);
        }
    }
}

fn write_app_server_message(
    stdin: &mut std::process::ChildStdin,
    value: serde_json::Value,
) -> Result<(), String> {
    let raw = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    stdin
        .write_all(raw.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| error.to_string())
}

fn build_app_server_thread_start(
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "thread/start",
        "params": {
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "sandbox": "workspace-write",
            "threadSource": "nibva",
            "sessionStartSource": "clear",
        },
    })
}

fn build_app_server_thread_resume(
    thread_id: &str,
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "thread/resume",
        "params": {
            "threadId": thread_id,
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "sandbox": "workspace-write",
        },
    })
}

fn build_app_server_turn_start(
    thread_id: &str,
    library_path: &Path,
    full_prompt: &str,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "turn/start",
        "params": {
            "threadId": thread_id,
            "input": [{
                "type": "text",
                "text": full_prompt,
                "text_elements": [],
            }],
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "effort": normalized_runtime_effort(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
        },
    })
}

fn normalized_runtime_model(runtime: &AgentRuntimeSettings) -> Option<String> {
    let model = runtime.model.trim();
    if model.is_empty() || model == "auto" {
        None
    } else {
        Some(model.to_string())
    }
}

fn normalized_runtime_effort(runtime: &AgentRuntimeSettings) -> Option<String> {
    let effort = runtime.reasoning_effort.trim();
    if effort.is_empty() {
        None
    } else {
        Some(effort.to_string())
    }
}

fn runtime_service_tier(runtime: &AgentRuntimeSettings) -> &'static str {
    if runtime.quick_mode {
        "priority"
    } else {
        "default"
    }
}

fn is_json_rpc_error(value: &serde_json::Value) -> bool {
    value.get("error").is_some()
}

fn format_json_rpc_error(value: &serde_json::Value) -> String {
    value
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(|message| message.as_str())
        .unwrap_or("Codex app-server returned an error.")
        .to_string()
}

fn is_app_server_approval_request(method: &str) -> bool {
    matches!(
        method,
        "item/commandExecution/requestApproval"
            | "item/fileChange/requestApproval"
            | "item/permissions/requestApproval"
            | "applyPatchApproval"
            | "execCommandApproval"
    )
}

fn wait_for_app_server_approval(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
    approval_state: &AgentApprovalState,
) -> String {
    let approval_id = format!(
        "{}:{}",
        request_id,
        value
            .get("id")
            .map(|id| id.to_string())
            .unwrap_or_else(|| "approval".to_string())
    );
    let (sender, receiver) = mpsc::channel();
    if let Ok(mut pending) = approval_state.pending.lock() {
        pending.insert(approval_id.clone(), sender);
    }
    emit_app_server_approval_request(window, request_id, method, value, &approval_id);
    let decision = receiver
        .recv_timeout(Duration::from_secs(600))
        .unwrap_or_else(|_| "decline".to_string());
    if let Ok(mut pending) = approval_state.pending.lock() {
        pending.remove(&approval_id);
    }
    normalize_approval_decision(&decision)
}

fn normalize_approval_decision(decision: &str) -> String {
    match decision {
        "accept" | "acceptForSession" | "cancel" => decision.to_string(),
        _ => "decline".to_string(),
    }
}

fn build_app_server_approval_response(
    request: &serde_json::Value,
    decision: &str,
) -> serde_json::Value {
    let id = request
        .get("id")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "decision": decision,
        },
    })
}

fn emit_app_server_approval_request(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
    approval_id: &str,
) {
    let params = value.get("params").unwrap_or(&serde_json::Value::Null);
    let mut event = empty_agent_event(request_id, "approval");
    event.raw_type = method.to_string();
    event.item_id = approval_id.to_string();
    event.item_type = "approval".to_string();
    event.status = "pending".to_string();
    event.title = app_server_approval_title(method).to_string();
    event.command = params
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.text = params
        .get("reason")
        .and_then(|value| value.as_str())
        .unwrap_or("请确认是否允许 Codex 执行该操作。")
        .to_string();
    emit_agent_event(window, event);
}

fn app_server_approval_title(method: &str) -> &'static str {
    match method {
        "item/commandExecution/requestApproval" | "execCommandApproval" => "需要命令审批",
        "item/fileChange/requestApproval" | "applyPatchApproval" => "需要文件修改审批",
        "item/permissions/requestApproval" => "需要权限审批",
        _ => "需要用户确认",
    }
}

fn emit_app_server_notification(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
) -> bool {
    match method {
        "thread/status/changed" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let status = params
                .get("status")
                .and_then(|status| status.get("type"))
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = match status {
                "active" => "Codex 正在运行",
                "idle" => "Codex 空闲",
                _ => "Codex 状态更新",
            }
            .to_string();
            event.status = status.to_string();
            emit_agent_event(window, event);
        }
        "turn/started" => {
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "开始处理".to_string();
            event.status = app_server_turn_id(value);
            emit_agent_event(window, event);
        }
        "turn/completed" => {
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "本轮完成".to_string();
            event.status = app_server_turn_id(value);
            emit_agent_event(window, event);
            return true;
        }
        "warning" | "configWarning" | "guardianWarning" | "deprecationNotice" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let mut event = empty_agent_event(request_id, "activity");
            event.raw_type = method.to_string();
            event.item_id = method.to_string();
            event.item_type = "warning".to_string();
            event.title = "Codex 提示".to_string();
            event.text = params
                .get("message")
                .or_else(|| params.get("text"))
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            emit_agent_event(window, event);
        }
        "thread/settings/updated" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let settings = params
                .get("threadSettings")
                .unwrap_or(&serde_json::Value::Null);
            let model = settings
                .get("model")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let effort = settings
                .get("effort")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let service_tier = settings
                .get("serviceTier")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "运行配置已应用".to_string();
            event.status = [model, effort, service_tier]
                .into_iter()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(" / ");
            emit_agent_event(window, event);
        }
        "item/agentMessage/delta" => {
            if let Some(delta) = value
                .get("params")
                .and_then(|params| params.get("delta"))
                .and_then(|value| value.as_str())
            {
                emit_agent_stream_event(window, request_id, "delta", delta, "");
            }
        }
        "item/started" | "item/completed" => {
            if let Some(item) = value.get("params").and_then(|params| params.get("item")) {
                emit_app_server_item_event(window, request_id, method, item);
            }
        }
        "item/commandExecution/outputDelta"
        | "command/exec/outputDelta"
        | "process/outputDelta"
        | "item/fileChange/outputDelta"
        | "item/mcpToolCall/progress"
        | "item/reasoning/summaryTextDelta"
        | "item/reasoning/textDelta"
        | "item/plan/delta" => {
            emit_app_server_delta_activity(window, request_id, method, value);
        }
        "thread/tokenUsage/updated" => {
            if let Some(usage) = value
                .get("params")
                .and_then(|params| params.get("tokenUsage"))
                .and_then(|usage| usage.get("last").or_else(|| usage.get("total")))
            {
                let mut event = empty_agent_event(request_id, "usage");
                event.raw_type = method.to_string();
                event.title = "用量更新".to_string();
                event.usage = Some(parse_app_server_token_usage(usage));
                emit_agent_event(window, event);
            }
        }
        "mcpServer/startupStatus/updated" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let name = params
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("MCP");
            let status = params
                .get("status")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            if status == "failed" {
                let mut event = empty_agent_event(request_id, "activity");
                event.raw_type = method.to_string();
                event.item_id = format!("mcp:{name}");
                event.item_type = "mcp".to_string();
                event.title = format!("MCP {name} 启动失败");
                event.status = status.to_string();
                event.text = params
                    .get("error")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                emit_agent_event(window, event);
            }
        }
        _ => {}
    }
    false
}

fn app_server_turn_id(value: &serde_json::Value) -> String {
    value
        .get("params")
        .and_then(|params| params.get("turn"))
        .and_then(|turn| turn.get("id"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string()
}

fn emit_app_server_item_event(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    item: &serde_json::Value,
) {
    let item_type = item
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    if item_type == "agentMessage" || item_type == "userMessage" {
        return;
    }

    let mut event = empty_agent_event(request_id, "activity");
    event.raw_type = method.to_string();
    event.item_id = item
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.item_type = item_type.to_string();
    event.status = if method == "item/started" {
        "in_progress"
    } else {
        "completed"
    }
    .to_string();
    event.title = app_server_item_title(item_type, method).to_string();
    event.command = item
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.output = item
        .get("aggregated_output")
        .or_else(|| item.get("output"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.text = item
        .get("message")
        .or_else(|| item.get("text"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.exit_code = item
        .get("exit_code")
        .or_else(|| item.get("exitCode"))
        .and_then(|value| value.as_i64());
    emit_agent_event(window, event);
}

fn app_server_item_title(item_type: &str, method: &str) -> &'static str {
    match item_type {
        "commandExecution" => "运行命令",
        "mcpToolCall" => "调用工具",
        "fileChange" => "文件修改",
        "reasoning" => "思考过程",
        "plan" => "更新计划",
        "error" => "Codex 提示",
        _ if method == "item/started" => "开始工具步骤",
        _ => "完成工具步骤",
    }
}

fn emit_app_server_delta_activity(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
) {
    let params = value.get("params").unwrap_or(&serde_json::Value::Null);
    let mut event = empty_agent_event(request_id, "activity");
    event.raw_type = method.to_string();
    event.item_id = params
        .get("itemId")
        .or_else(|| params.get("processId"))
        .and_then(|value| value.as_str())
        .unwrap_or(method)
        .to_string();
    event.item_type = method.to_string();
    event.status = "in_progress".to_string();
    event.title = app_server_delta_title(method).to_string();
    event.output = params
        .get("delta")
        .or_else(|| params.get("text"))
        .or_else(|| params.get("output"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    emit_agent_event(window, event);
}

fn app_server_delta_title(method: &str) -> &'static str {
    match method {
        "item/commandExecution/outputDelta"
        | "command/exec/outputDelta"
        | "process/outputDelta" => "命令输出",
        "item/fileChange/outputDelta" => "文件修改输出",
        "item/mcpToolCall/progress" => "工具进度",
        "item/reasoning/summaryTextDelta" | "item/reasoning/textDelta" => "思考过程",
        "item/plan/delta" => "计划更新",
        _ => "运行过程",
    }
}

fn parse_app_server_token_usage(value: &serde_json::Value) -> AgentUsage {
    AgentUsage {
        input_tokens: value
            .get("inputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        cached_input_tokens: value
            .get("cachedInputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        output_tokens: value
            .get("outputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        reasoning_output_tokens: value
            .get("reasoningOutputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
    }
}

fn emit_agent_stream_event(
    window: &tauri::Window,
    request_id: &str,
    kind: &str,
    text: &str,
    error: &str,
) {
    let _ = window.emit(
        "nibva://agent-chat-stream",
        AgentChatStreamEvent {
            request_id: request_id.to_string(),
            kind: kind.to_string(),
            text: text.to_string(),
            error: error.to_string(),
            raw_type: String::new(),
            item_id: String::new(),
            item_type: String::new(),
            status: String::new(),
            title: String::new(),
            command: String::new(),
            output: String::new(),
            exit_code: None,
            usage: None,
        },
    );
}

fn empty_agent_event(request_id: &str, kind: &str) -> AgentChatStreamEvent {
    AgentChatStreamEvent {
        request_id: request_id.to_string(),
        kind: kind.to_string(),
        text: String::new(),
        error: String::new(),
        raw_type: String::new(),
        item_id: String::new(),
        item_type: String::new(),
        status: String::new(),
        title: String::new(),
        command: String::new(),
        output: String::new(),
        exit_code: None,
        usage: None,
    }
}

fn emit_agent_event(window: &tauri::Window, event: AgentChatStreamEvent) {
    let _ = window.emit("nibva://agent-chat-stream", event);
}

fn run_command_with_timeout(mut command: Command, timeout: Duration) -> Result<Output, String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let started_at = Instant::now();

    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(_) => return child.wait_with_output().map_err(|error| error.to_string()),
            None if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let output = child
                    .wait_with_output()
                    .map_err(|error| error.to_string())?;
                let mut stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !stderr.is_empty() {
                    stderr.push('\n');
                }
                stderr.push_str("AI CLI timed out after 90 seconds.");
                return Ok(Output {
                    status: output.status,
                    stdout: output.stdout,
                    stderr: stderr.into_bytes(),
                });
            }
            None => thread::sleep(Duration::from_millis(100)),
        }
    }
}

#[tauri::command]
fn probe_agent_cli(provider: String, cli_path: Option<String>) -> Result<CodexProbeResult, String> {
    let provider = normalize_agent_provider(&provider);
    let binary = agent_binary_name(&provider);
    let Some(agent_path) = resolve_agent_command(&provider, cli_path) else {
        return Ok(CodexProbeResult {
            resolved_path: String::new(),
            ok: false,
            steps: vec![CodexProbeStep {
                name: "resolve".to_string(),
                ok: false,
                command: format!("command -v {}", binary),
                stdout: String::new(),
                stderr: format!("Cannot find {} on PATH or configured path.", binary),
            }],
        });
    };

    let steps = if provider == "claude" {
        vec![
            run_probe_step(&agent_path, "version", &["--version"]),
            run_probe_step(&agent_path, "print_help", &["--help"]),
        ]
    } else {
        vec![
            run_probe_step(&agent_path, "version", &["--version"]),
            run_probe_step(&agent_path, "exec_help", &["exec", "--help"]),
        ]
    };
    let ok = steps.iter().all(|step| step.ok);

    Ok(CodexProbeResult {
        resolved_path: agent_path,
        ok,
        steps,
    })
}

fn run_probe_step(codex_path: &str, name: &str, args: &[&str]) -> CodexProbeStep {
    let output = Command::new(codex_path).args(args).output();
    match output {
        Ok(output) => CodexProbeStep {
            name: name.to_string(),
            ok: output.status.success(),
            command: format!("{} {}", codex_path, args.join(" ")),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        },
        Err(error) => CodexProbeStep {
            name: name.to_string(),
            ok: false,
            command: format!("{} {}", codex_path, args.join(" ")),
            stdout: String::new(),
            stderr: error.to_string(),
        },
    }
}

fn library_root() -> Result<PathBuf, String> {
    let documents = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
        .ok_or_else(|| "Cannot locate a Documents directory".to_string())?;
    Ok(Path::new(&documents).join("NibvaLibrary"))
}

fn normalize_agent_provider(provider: &str) -> String {
    if provider.eq_ignore_ascii_case("claude") {
        "claude".to_string()
    } else {
        "codex".to_string()
    }
}

fn agent_binary_name(provider: &str) -> &'static str {
    if provider == "claude" {
        "claude"
    } else {
        "codex"
    }
}

fn agent_env_var(provider: &str) -> &'static str {
    if provider == "claude" {
        "CLAUDE_CLI"
    } else {
        "CODEX_CLI"
    }
}

fn resolve_agent_command(provider: &str, configured_path: Option<String>) -> Option<String> {
    let binary = agent_binary_name(provider);
    if let Some(path) = configured_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Ok(path) = std::env::var(agent_env_var(provider)) {
        if !path.trim().is_empty() {
            return Some(path);
        }
    }

    let shell_lookup = Command::new("/bin/zsh")
        .arg("-lc")
        .arg(format!("command -v {}", binary))
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if value.is_empty() {
                    None
                } else {
                    Some(value)
                }
            } else {
                None
            }
        });

    if let Some(path) = shell_lookup {
        if is_agent_command_usable(&path) {
            return Some(path);
        }
    }

    let home = dirs::home_dir()?;
    let candidates = if provider == "claude" {
        vec![
            home.join(".claude").join("local").join("claude"),
            home.join(".local").join("bin").join("claude"),
            PathBuf::from("/opt/homebrew/bin/claude"),
            PathBuf::from("/usr/local/bin/claude"),
        ]
    } else {
        vec![
            home.join(".codex")
                .join("plugins")
                .join(".plugin-appserver")
                .join("codex"),
            home.join(".codex").join("bin").join("codex"),
            home.join(".local").join("bin").join("codex"),
            PathBuf::from("/opt/homebrew/bin/codex"),
            PathBuf::from("/usr/local/bin/codex"),
        ]
    };

    candidates
        .iter()
        .find(|candidate| candidate.exists() && is_agent_command_usable_path(candidate))
        .map(|candidate| candidate.display().to_string())
}

fn is_agent_command_usable_path(path: &Path) -> bool {
    is_agent_command_usable(&path.display().to_string())
}

fn is_agent_command_usable(path: &str) -> bool {
    let mut command = Command::new(path);
    command.arg("--version");
    run_command_with_timeout(command, Duration::from_secs(8))
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn collect_skills(
    root: &Path,
    depth: usize,
    prefix: Option<&str>,
    skills: &mut Vec<CodexSkill>,
) -> Result<(), String> {
    if depth > 5 || !root.exists() {
        return Ok(());
    }

    let entries = sorted_directory_entries(root)?;
    for entry in entries {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if should_skip_skill_path(&path) {
            continue;
        }

        let skill_file = path.join("SKILL.md");
        if skill_file.exists() {
            if let Ok(raw) = fs::read_to_string(&skill_file) {
                let fallback_name = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("unknown-skill")
                    .to_string();
                let raw_name = frontmatter_value(&raw, "name").unwrap_or(fallback_name);
                let name = prefix
                    .map(|prefix| format!("{prefix}:{raw_name}"))
                    .unwrap_or(raw_name);
                let description = frontmatter_value(&raw, "description").unwrap_or_default();
                skills.push(CodexSkill {
                    id: safe_file_segment(&name),
                    name,
                    description,
                    path: skill_file.display().to_string(),
                });
            }
        } else {
            collect_skills(&path, depth + 1, prefix, skills)?;
        }
    }

    Ok(())
}

fn collect_plugin_cache_skills(
    cache_root: &Path,
    skills: &mut Vec<CodexSkill>,
) -> Result<(), String> {
    if !cache_root.exists() {
        return Ok(());
    }

    for plugin_entry in sorted_directory_entries(cache_root)? {
        let plugin_path = plugin_entry.path();
        if !plugin_path.is_dir() || should_skip_skill_path(&plugin_path) {
            continue;
        }
        let Some(plugin_name) = plugin_path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        for version_entry in sorted_directory_entries(&plugin_path)? {
            let skills_root = version_entry.path().join("skills");
            collect_skills(&skills_root, 0, Some(plugin_name), skills)?;
        }
    }

    Ok(())
}

fn sorted_directory_entries(root: &Path) -> Result<Vec<fs::DirEntry>, String> {
    let mut entries = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    Ok(entries)
}

fn should_skip_skill_path(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    name == ".deprecated"
        || name == ".system"
        || name.starts_with("plugin-backup-")
        || name.starts_with("plugin-install-")
}

fn frontmatter_value(raw: &str, key: &str) -> Option<String> {
    raw.lines().take(20).find_map(|line| {
        let (line_key, value) = line.split_once(':')?;
        if line_key.trim() != key {
            return None;
        }
        Some(
            value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string(),
        )
    })
}

fn toml_value(raw: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} = ");
    raw.lines().find_map(|line| {
        let line = line.trim();
        let value = line.strip_prefix(&prefix)?;
        Some(value.trim().trim_matches('"').to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_sheet() -> WritingSheet {
        WritingSheet {
            id: "sheet-1".to_string(),
            title: "测试卡片".to_string(),
            group_id: "group-main".to_string(),
            sheet_type: "正文".to_string(),
            status: "构思".to_string(),
            target_words: 1200,
            summary: "摘要".to_string(),
            body: "# 正文\n\n内容".to_string(),
            created_at: "2026-07-04T11:00:00.000Z".to_string(),
            updated_at: "2026-07-04".to_string(),
            versions: Vec::new(),
        }
    }

    #[test]
    fn render_sheet_markdown_adds_nibva_frontmatter() {
        let rendered = render_sheet_markdown(&sample_sheet());
        assert!(rendered.starts_with("---\nnibvaSheet: true\n"));
        assert!(rendered.contains("title: 测试卡片"));
        assert!(rendered.contains("createdAt: 2026-07-04 11:00:00"));
        assert!(rendered.contains("updatedAt: 2026-07-04"));
        assert!(rendered.ends_with("# 正文\n\n内容"));
    }

    #[test]
    fn strip_nibva_frontmatter_removes_only_nibva_metadata() {
        let rendered = render_sheet_markdown(&sample_sheet());
        assert_eq!(strip_nibva_frontmatter(&rendered), "# 正文\n\n内容");
    }

    #[test]
    fn strip_nibva_frontmatter_keeps_user_frontmatter() {
        let user_markdown = "---\ntitle: User Metadata\n---\n\n# Keep";
        assert_eq!(strip_nibva_frontmatter(user_markdown), user_markdown);
    }

    #[test]
    fn render_project_readme_links_sheets() {
        let project = sample_project();
        let rendered = render_project_readme(&project);
        assert!(rendered.contains("nibvaProject: true"));
        assert!(rendered.contains("## Writing Brief"));
        assert!(rendered.contains("Audience: 专业写作者"));
        assert!(rendered.contains("[测试卡片](正文/测试卡片.md)"));
        assert!(rendered.contains("[Assets](assets/)"));
        assert!(rendered.contains("[References](references/)"));
        assert!(rendered.contains("[Exports](exports/)"));
    }

    #[test]
    fn render_project_toml_writes_readable_project_metadata() {
        let rendered = render_project_toml(&sample_project());
        assert!(rendered.contains("[nibva]"));
        assert!(rendered.contains("project = true"));
        assert!(rendered.contains("[project]"));
        assert!(rendered.contains("title = \"项目\""));
        assert!(rendered.contains("icon = \"article\""));
        assert!(rendered.contains("iconColor = \"#007aff\""));
        assert!(rendered.contains("tags = [\"标签\"]"));
        assert!(rendered.contains("[writingBrief]"));
        assert!(rendered.contains("audience = \"专业写作者\""));
        assert!(rendered.contains("[[sheets]]"));
        assert!(rendered.contains("path = \"正文/测试卡片.md\""));
        assert!(rendered.contains("[[publishingChecklist]]"));
        assert!(rendered.contains("done = true"));
        assert!(rendered.contains("[[exportHistory]]"));
        assert!(rendered.contains("filename = \"project.md\""));
    }

    #[test]
    fn quote_toml_escapes_control_characters() {
        assert_eq!(
            quote_toml("A \"quote\"\nC:\\Path"),
            "\"A \\\"quote\\\"\\nC:\\\\Path\""
        );
    }

    #[test]
    fn quote_yaml_prefers_plain_scalars_when_safe() {
        assert_eq!(quote_yaml("测试卡片"), "测试卡片");
        assert_eq!(quote_yaml("2026-07-04 11:00:00"), "2026-07-04 11:00:00");
        assert_eq!(quote_yaml("A: value"), "\"A: value\"");
        assert_eq!(quote_yaml("#007aff"), "\"#007aff\"");
    }

    #[test]
    fn save_library_writes_visible_folder_first_markdown() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "nibva-folder-first-test-{}-{}",
            std::process::id(),
            unix_timestamp()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let mut notes = default_notes_project();
        notes.sheets = vec![WritingSheet {
            id: "note-1".to_string(),
            title: "随手记".to_string(),
            group_id: NOTES_INBOX_GROUP_ID.to_string(),
            sheet_type: "正文".to_string(),
            status: "构思".to_string(),
            target_words: 0,
            summary: String::new(),
            body: "这是一个临时想法。".to_string(),
            created_at: "2026-07-04T11:00:00.000Z".to_string(),
            updated_at: "2026-07-04".to_string(),
            versions: Vec::new(),
        }];

        save_library_to_path(root.clone(), vec![sample_project(), notes])?;

        assert!(root
            .join("projects")
            .join("项目")
            .join("正文")
            .join("测试卡片.md")
            .exists());
        assert!(root.join("notes").join("收件箱").join("随手记.md").exists());
        assert!(root.join(".nibva").join("library.json").exists());
        assert!(!root.join("library.json").exists());
        assert!(!root
            .join("projects")
            .join("项目")
            .join("project.json")
            .exists());

        let loaded = load_library_from_path(root.clone())?;
        assert!(loaded.iter().any(|project| project.title == "项目"
            && project.sheets.iter().any(|sheet| sheet.title == "测试卡片")));
        assert!(loaded.iter().any(|project| project.id == NOTES_PROJECT_ID
            && project.sheets.iter().any(|sheet| sheet.title == "随手记")));

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn save_library_creates_empty_note_group_folders() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "nibva-empty-note-group-test-{}-{}",
            std::process::id(),
            unix_timestamp()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        save_library_to_path(root.clone(), vec![default_notes_project()])?;

        assert!(root.join("notes").join("收件箱").is_dir());

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn rebuild_library_index_scans_finder_added_folders_and_markdown() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "nibva-rebuild-index-test-{}-{}",
            std::process::id(),
            unix_timestamp()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let inbox_dir = root.join("notes").join("收件箱");
        let project_dir = root.join("projects").join("外部导入项目");
        let group_dir = project_dir.join("文章");
        fs::create_dir_all(&inbox_dir).map_err(|error| error.to_string())?;
        fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
        fs::write(
            inbox_dir.join("临时想法.md"),
            "# 临时想法\n\n从 Finder 加入。",
        )
        .map_err(|error| error.to_string())?;
        fs::write(
            group_dir.join("分组文章.md"),
            "# 分组文章\n\n从 Finder 加入。",
        )
        .map_err(|error| error.to_string())?;
        fs::write(
            project_dir.join("根目录文章.md"),
            "# 根目录文章\n\n直接放在项目根目录。",
        )
        .map_err(|error| error.to_string())?;

        let rebuilt = rebuild_library_index_at(root.clone())?;

        assert!(root.join(".nibva").join("library.json").exists());
        assert!(rebuilt.iter().any(|project| {
            project.id == NOTES_PROJECT_ID
                && project.sheets.iter().any(|sheet| sheet.title == "临时想法")
        }));
        assert!(rebuilt.iter().any(|project| {
            project.title == "外部导入项目"
                && project.groups.iter().any(|group| group.title == "文章")
                && project.sheets.iter().any(|sheet| sheet.title == "分组文章")
                && project
                    .sheets
                    .iter()
                    .any(|sheet| sheet.title == "根目录文章")
        }));
        assert!(project_dir.join("根目录文章.md").exists());

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn move_project_to_trash_keeps_files_until_trash_is_cleared() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "nibva-trash-test-{}-{}",
            std::process::id(),
            unix_timestamp()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let project = sample_project();
        save_library_to_path(root.clone(), vec![project.clone(), default_notes_project()])?;

        let next_projects = move_project_to_trash(
            root.display().to_string(),
            project.id.clone(),
            project.title.clone(),
        )?;

        assert!(!next_projects.iter().any(|item| item.id == project.id));
        assert!(!root.join("projects").join("项目").exists());
        assert!(root.join(".nibva").join("trash").join("projects").exists());

        clear_library_trash(root.display().to_string())?;
        assert!(!root.join(".nibva").join("trash").exists());

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn toml_string_escapes_runtime_config_values() {
        assert_eq!(toml_string("high"), "\"high\"");
        assert_eq!(toml_string("a\"b\\c"), "\"a\\\"b\\\\c\"");
    }

    #[test]
    fn codex_exec_command_label_includes_runtime_overrides() {
        let runtime = AgentRuntimeSettings {
            model: "gpt-5.5".to_string(),
            reasoning_effort: "high".to_string(),
            quick_mode: true,
        };
        let label = format_codex_exec_command_label(
            "/tmp/codex",
            Path::new("/tmp/project"),
            true,
            &runtime,
        );

        assert!(label.contains("exec --json"));
        assert!(label.contains("--model gpt-5.5"));
        assert!(label.contains("-c model_reasoning_effort=\"high\""));
        assert!(label.contains("-c service_tier=\"priority\""));
        assert!(label.contains("--cd /tmp/project"));
    }

    #[test]
    fn app_server_thread_start_uses_native_runtime_fields() {
        let runtime = AgentRuntimeSettings {
            model: "gpt-5.5".to_string(),
            reasoning_effort: "high".to_string(),
            quick_mode: true,
        };
        let message = build_app_server_thread_start(Path::new("/tmp/project"), &runtime);
        let params = message.get("params").expect("params");

        assert_eq!(
            message.get("method").and_then(|value| value.as_str()),
            Some("thread/start")
        );
        assert_eq!(
            params.get("model").and_then(|value| value.as_str()),
            Some("gpt-5.5")
        );
        assert_eq!(
            params.get("serviceTier").and_then(|value| value.as_str()),
            Some("priority")
        );
        assert_eq!(
            params
                .get("approvalPolicy")
                .and_then(|value| value.as_str()),
            Some("on-request")
        );
        assert_eq!(
            params
                .get("approvalsReviewer")
                .and_then(|value| value.as_str()),
            Some("user")
        );
        assert_eq!(
            params.get("sandbox").and_then(|value| value.as_str()),
            Some("workspace-write")
        );
    }

    #[test]
    fn app_server_turn_start_uses_native_effort_and_input() {
        let runtime = AgentRuntimeSettings {
            model: "gpt-5.5".to_string(),
            reasoning_effort: "low".to_string(),
            quick_mode: false,
        };
        let message =
            build_app_server_turn_start("thread-1", Path::new("/tmp/project"), "hello", &runtime);
        let params = message.get("params").expect("params");
        let input = params
            .get("input")
            .and_then(|value| value.as_array())
            .and_then(|items| items.first())
            .expect("input item");

        assert_eq!(
            message.get("method").and_then(|value| value.as_str()),
            Some("turn/start")
        );
        assert_eq!(
            params.get("threadId").and_then(|value| value.as_str()),
            Some("thread-1")
        );
        assert_eq!(
            params.get("effort").and_then(|value| value.as_str()),
            Some("low")
        );
        assert_eq!(
            params.get("serviceTier").and_then(|value| value.as_str()),
            Some("default")
        );
        assert_eq!(
            input.get("type").and_then(|value| value.as_str()),
            Some("text")
        );
        assert_eq!(
            input.get("text").and_then(|value| value.as_str()),
            Some("hello")
        );
    }

    #[test]
    fn app_server_thread_resume_uses_existing_thread_id() {
        let runtime = AgentRuntimeSettings {
            model: "gpt-5.5".to_string(),
            reasoning_effort: "medium".to_string(),
            quick_mode: false,
        };
        let message =
            build_app_server_thread_resume("thread-1", Path::new("/tmp/project"), &runtime);
        let params = message.get("params").expect("params");

        assert_eq!(
            message.get("method").and_then(|value| value.as_str()),
            Some("thread/resume")
        );
        assert_eq!(
            params.get("threadId").and_then(|value| value.as_str()),
            Some("thread-1")
        );
        assert_eq!(
            params.get("serviceTier").and_then(|value| value.as_str()),
            Some("default")
        );
        assert_eq!(
            params
                .get("approvalPolicy")
                .and_then(|value| value.as_str()),
            Some("on-request")
        );
    }

    #[test]
    fn app_server_runtime_omits_auto_model_and_blank_effort() {
        let runtime = AgentRuntimeSettings {
            model: "auto".to_string(),
            reasoning_effort: " ".to_string(),
            quick_mode: false,
        };
        let thread_message = build_app_server_thread_start(Path::new("/tmp/project"), &runtime);
        let thread_params = thread_message.get("params").expect("params");
        let turn_message =
            build_app_server_turn_start("thread-1", Path::new("/tmp/project"), "hello", &runtime);
        let turn_params = turn_message.get("params").expect("params");

        assert!(thread_params
            .get("model")
            .is_some_and(|value| value.is_null()));
        assert!(turn_params
            .get("model")
            .is_some_and(|value| value.is_null()));
        assert!(turn_params
            .get("effort")
            .is_some_and(|value| value.is_null()));
        assert_eq!(
            turn_params
                .get("serviceTier")
                .and_then(|value| value.as_str()),
            Some("default")
        );
    }

    #[test]
    fn approval_decisions_are_normalized_for_app_server() {
        assert_eq!(normalize_approval_decision("accept"), "accept");
        assert_eq!(
            normalize_approval_decision("acceptForSession"),
            "acceptForSession"
        );
        assert_eq!(normalize_approval_decision("cancel"), "cancel");
        assert_eq!(normalize_approval_decision("decline"), "decline");
        assert_eq!(normalize_approval_decision("unexpected"), "decline");
    }

    #[test]
    fn app_server_approval_response_preserves_request_id() {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 42,
            "method": "item/commandExecution/requestApproval",
            "params": {
                "command": "pwd",
            },
        });
        let response = build_app_server_approval_response(&request, "decline");

        assert_eq!(
            response.get("id").and_then(|value| value.as_i64()),
            Some(42)
        );
        assert_eq!(
            response
                .get("result")
                .and_then(|result| result.get("decision"))
                .and_then(|value| value.as_str()),
            Some("decline")
        );
    }

    #[test]
    fn app_server_token_usage_uses_missing_fields_as_zero() {
        let usage = parse_app_server_token_usage(&serde_json::json!({
            "inputTokens": 120,
            "outputTokens": 24,
        }));

        assert_eq!(usage.input_tokens, 120);
        assert_eq!(usage.cached_input_tokens, 0);
        assert_eq!(usage.output_tokens, 24);
        assert_eq!(usage.reasoning_output_tokens, 0);
    }

    fn sample_project() -> WritingProject {
        WritingProject {
            id: "project-1".to_string(),
            title: "项目".to_string(),
            icon: "article".to_string(),
            icon_color: "#007aff".to_string(),
            description: "描述".to_string(),
            status: "构思".to_string(),
            target_platform: "公众号".to_string(),
            target_words: 3000,
            tags: vec!["标签".to_string()],
            groups: vec![ProjectGroup {
                id: "group-main".to_string(),
                title: "正文".to_string(),
                icon: "article".to_string(),
                icon_color: "#007aff".to_string(),
                description: String::new(),
            }],
            sheets: vec![sample_sheet()],
            updated_at: "2026-07-04".to_string(),
            publishing_checklist: vec![PublishingChecklistItem {
                id: "title".to_string(),
                label: "标题已确认".to_string(),
                done: true,
            }],
            export_history: vec![ExportHistoryItem {
                id: "export-1".to_string(),
                label: "Markdown".to_string(),
                filename: "project.md".to_string(),
                path: "/tmp/project.md".to_string(),
                exported_at: "2026-07-04T00:00:00.000Z".to_string(),
                sheet_count: 1,
                word_count: 4,
                target_platform: "公众号".to_string(),
            }],
            writing_brief: ProjectWritingBrief {
                audience: "专业写作者".to_string(),
                thesis: "写作项目需要清楚的上下文".to_string(),
                tone: "清楚、克制".to_string(),
                publishing_notes: "保持白色 Apple 风格".to_string(),
            },
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(LibraryWatcherState::default())
        .manage(AgentApprovalState::default())
        .manage(AgentRunState::default())
        .menu(|handle| {
            let open_settings =
                MenuItem::with_id(handle, "open-settings", "设置", true, Some("CmdOrCtrl+,"))?;
            let rebuild_index =
                MenuItem::with_id(handle, "rebuild-index", "重建索引", true, None::<&str>)?;
            let menu = Menu::default(handle)?;
            let mut settings_inserted = false;
            let mut inserted = false;

            for item in menu.items()? {
                let Some(submenu) = item.as_submenu() else {
                    continue;
                };
                submenu.insert_items(&[&open_settings], 1)?;
                settings_inserted = true;
                break;
            }

            if !settings_inserted {
                menu.append(&Submenu::with_items(
                    handle,
                    "Nibva",
                    true,
                    &[&open_settings],
                )?)?;
            }

            for item in menu.items()? {
                let Some(submenu) = item.as_submenu() else {
                    continue;
                };
                if submenu.text()? == "File" {
                    let separator = PredefinedMenuItem::separator(handle)?;
                    submenu.insert_items(&[&rebuild_index, &separator], 0)?;
                    inserted = true;
                    break;
                }
            }

            if !inserted {
                menu.append(&Submenu::with_items(
                    handle,
                    "File",
                    true,
                    &[&rebuild_index],
                )?)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open-settings" => {
                let _ = app.emit("nibva://open-settings", ());
            }
            "rebuild-index" => {
                let _ = app.emit("nibva://rebuild-index", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            default_library_path,
            load_library,
            load_library_at,
            rebuild_library_index,
            watch_library,
            move_project_to_trash,
            clear_library_trash,
            save_library,
            save_library_at,
            load_conversations,
            save_conversations,
            list_project_resources,
            save_project_export,
            save_project_export_bundle,
            save_project_image,
            import_project_images,
            import_project_resources,
            read_markdown_import_files,
            open_local_path,
            copy_local_file,
            reveal_local_path,
            read_project_resource_text,
            list_codex_skills,
            list_codex_models,
            run_agent_chat,
            start_agent_chat_stream,
            cancel_agent_chat_stream,
            respond_agent_approval,
            probe_agent_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nibva");
}
