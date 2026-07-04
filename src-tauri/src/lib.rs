use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SheetVersion {
    id: String,
    title: String,
    body: String,
    created_at: String,
    word_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WritingSheet {
    id: String,
    title: String,
    #[serde(default)]
    group_id: String,
    #[serde(rename = "type")]
    sheet_type: String,
    status: String,
    target_words: u32,
    summary: String,
    body: String,
    #[serde(default)]
    created_at: String,
    updated_at: String,
    #[serde(default)]
    versions: Vec<SheetVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectGroup {
    id: String,
    title: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    icon_color: String,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingChecklistItem {
    id: String,
    label: String,
    done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportHistoryItem {
    id: String,
    label: String,
    filename: String,
    path: String,
    exported_at: String,
    sheet_count: u32,
    word_count: u32,
    target_platform: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectWritingBrief {
    #[serde(default)]
    audience: String,
    #[serde(default)]
    thesis: String,
    #[serde(default)]
    tone: String,
    #[serde(default)]
    publishing_notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WritingProject {
    id: String,
    title: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    icon_color: String,
    description: String,
    status: String,
    target_platform: String,
    target_words: u32,
    tags: Vec<String>,
    #[serde(default)]
    groups: Vec<ProjectGroup>,
    sheets: Vec<WritingSheet>,
    updated_at: String,
    #[serde(default)]
    publishing_checklist: Vec<PublishingChecklistItem>,
    #[serde(default)]
    export_history: Vec<ExportHistoryItem>,
    #[serde(default)]
    writing_brief: ProjectWritingBrief,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexSkill {
    id: String,
    name: String,
    description: String,
    path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillTask {
    action: String,
    skill_id: String,
    skill_name: String,
    project_id: String,
    project_title: String,
    #[serde(default)]
    project_path: String,
    #[serde(default)]
    target_platform: String,
    sheet_id: String,
    sheet_title: String,
    #[serde(default)]
    sheet_path: String,
    #[serde(default)]
    selected_context_sheet_ids: Vec<String>,
    #[serde(default)]
    resource_paths: Vec<String>,
    selected_text: String,
    body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexChatResult {
    output: String,
    error: String,
    command: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexProbeStep {
    name: String,
    ok: bool,
    command: String,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexProbeResult {
    resolved_path: String,
    ok: bool,
    steps: Vec<CodexProbeStep>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectResourceFile {
    kind: String,
    name: String,
    path: String,
    size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectResourceText {
    path: String,
    name: String,
    status: String,
    content: String,
    size_bytes: u64,
    truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedMarkdownFile {
    name: String,
    path: String,
    content: String,
    size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryFileChange {
    paths: Vec<String>,
    kind: String,
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

        for entry in fs::read_dir(resource_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
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

fn order_groups_by_index(groups: Vec<ProjectGroup>, indexed_groups: &[ProjectGroup]) -> Vec<ProjectGroup> {
    let mut ordered = Vec::new();
    let mut remaining = groups;

    for indexed_group in indexed_groups {
        if let Some(index) = remaining.iter().position(|group| group.id == indexed_group.id) {
            ordered.push(remaining.remove(index));
        }
    }

    ordered.extend(remaining);
    ordered
}

fn order_note_groups_by_index(groups: Vec<ProjectGroup>, indexed_groups: &[ProjectGroup]) -> Vec<ProjectGroup> {
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

fn path_file_stem(path: &Path, fallback: &str) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn is_hidden_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

fn is_project_support_dir(name: &str) -> bool {
    matches!(name, "assets" | "references" | "exports" | "sheets")
}

fn is_markdown_file(path: &Path) -> bool {
    path.is_file()
        && matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase()),
            Some(value) if value == "md" || value == "markdown"
        )
        && path.file_name().and_then(|value| value.to_str()) != Some("README.md")
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

fn markdown_h1_title(markdown: &str) -> Option<String> {
    markdown.lines().find_map(|line| {
        let trimmed = line.trim_start();
        let title = trimmed.strip_prefix("# ")?;
        let title = title.trim();
        if title.is_empty() {
            None
        } else {
            Some(title.to_string())
        }
    })
}

fn safe_visible_path_segment(title: &str, fallback: &str) -> String {
    let sanitized = title
        .trim()
        .chars()
        .map(|character| {
            if matches!(
                character,
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0'
            ) {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let sanitized = sanitized.trim_matches(['.', '-']).to_string();
    if sanitized.is_empty() {
        safe_file_segment(fallback)
    } else {
        sanitized
    }
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

fn render_project_readme(project: &WritingProject) -> String {
    let mut output = vec![
        "---".to_string(),
        "nibvaProject: true".to_string(),
        format!("id: {}", quote_yaml(&project.id)),
        format!("title: {}", quote_yaml(&project.title)),
        format!("status: {}", quote_yaml(&project.status)),
        format!("targetPlatform: {}", quote_yaml(&project.target_platform)),
        format!("targetWords: {}", project.target_words),
        format!("updatedAt: {}", quote_yaml(&project.updated_at)),
        format!(
            "tags: [{}]",
            project
                .tags
                .iter()
                .map(|tag| quote_yaml(tag))
                .collect::<Vec<_>>()
                .join(", ")
        ),
        "---".to_string(),
        "".to_string(),
        format!("# {}", project.title),
        "".to_string(),
        project.description.clone(),
        "".to_string(),
        "## Project".to_string(),
        "".to_string(),
        format!("- Status: {}", project.status),
        format!("- Target platform: {}", project.target_platform),
        format!("- Target words: {}", project.target_words),
        format!("- Updated: {}", project.updated_at),
        "".to_string(),
    ];

    let brief_lines = render_project_writing_brief(&project.writing_brief);
    if !brief_lines.is_empty() {
        output.extend(brief_lines);
    }

    output.extend(["## Sheets".to_string(), "".to_string()]);

    for (index, sheet) in project.sheets.iter().enumerate() {
        output.push(format!(
            "{}. [{}]({}) - {} / {} words",
            index + 1,
            escape_markdown_link_text(&sheet.title),
            sheet_markdown_relative_path(project, sheet),
            sheet.sheet_type,
            sheet.target_words
        ));
        if !sheet.summary.trim().is_empty() {
            output.push(format!("   - {}", sheet.summary));
        }
    }

    if !project.groups.is_empty() {
        output.extend(["".to_string(), "## Groups".to_string(), "".to_string()]);
        for group in &project.groups {
            let sheet_count = project
                .sheets
                .iter()
                .filter(|sheet| sheet.group_id == group.id)
                .count();
            output.push(format!(
                "- {}: {} sheets",
                inline_markdown_text(&group.title),
                sheet_count
            ));
            if !group.description.trim().is_empty() {
                output.push(format!("  - {}", inline_markdown_text(&group.description)));
            }
        }
    }

    output.extend([
        "".to_string(),
        "## Project Folders".to_string(),
        "".to_string(),
        "- Writing groups are stored as folders in this project directory.".to_string(),
        "- [Assets](assets/)".to_string(),
        "- [References](references/)".to_string(),
        "- [Exports](exports/)".to_string(),
    ]);

    output.push("".to_string());
    output.join("\n")
}

fn render_project_toml(project: &WritingProject) -> String {
    let mut output = vec![
        "# Generated by Nibva for readable local project metadata.".to_string(),
        "# Markdown files in visible group folders are the durable writing content.".to_string(),
        "# App indexes live under the library-level .nibva/ folder.".to_string(),
        "".to_string(),
        "[nibva]".to_string(),
        "project = true".to_string(),
        "version = 1".to_string(),
        "".to_string(),
        "[project]".to_string(),
        format!("id = {}", quote_toml(&project.id)),
        format!("title = {}", quote_toml(&project.title)),
        format!("icon = {}", quote_toml(&project.icon)),
        format!("iconColor = {}", quote_toml(&project.icon_color)),
        format!("description = {}", quote_toml(&project.description)),
        format!("status = {}", quote_toml(&project.status)),
        format!("targetPlatform = {}", quote_toml(&project.target_platform)),
        format!("targetWords = {}", project.target_words),
        format!("updatedAt = {}", quote_toml(&project.updated_at)),
        format!("tags = {}", toml_string_array(&project.tags)),
        "".to_string(),
        "[writingBrief]".to_string(),
        format!("audience = {}", quote_toml(&project.writing_brief.audience)),
        format!("thesis = {}", quote_toml(&project.writing_brief.thesis)),
        format!("tone = {}", quote_toml(&project.writing_brief.tone)),
        format!(
            "publishingNotes = {}",
            quote_toml(&project.writing_brief.publishing_notes)
        ),
    ];

    for sheet in &project.sheets {
        output.extend([
            "".to_string(),
            "[[sheets]]".to_string(),
            format!("id = {}", quote_toml(&sheet.id)),
            format!("title = {}", quote_toml(&sheet.title)),
            format!("groupId = {}", quote_toml(&sheet.group_id)),
            format!("type = {}", quote_toml(&sheet.sheet_type)),
            format!("status = {}", quote_toml(&sheet.status)),
            format!("targetWords = {}", sheet.target_words),
            format!("summary = {}", quote_toml(&sheet.summary)),
            format!("createdAt = {}", quote_toml(&sheet.created_at)),
            format!("updatedAt = {}", quote_toml(&sheet.updated_at)),
            format!(
                "path = {}",
                quote_toml(&sheet_markdown_relative_path(project, sheet))
            ),
        ]);
    }

    for group in &project.groups {
        output.extend([
            "".to_string(),
            "[[groups]]".to_string(),
            format!("id = {}", quote_toml(&group.id)),
            format!("title = {}", quote_toml(&group.title)),
            format!("icon = {}", quote_toml(&group.icon)),
            format!("iconColor = {}", quote_toml(&group.icon_color)),
            format!("description = {}", quote_toml(&group.description)),
        ]);
    }

    for item in &project.publishing_checklist {
        output.extend([
            "".to_string(),
            "[[publishingChecklist]]".to_string(),
            format!("id = {}", quote_toml(&item.id)),
            format!("label = {}", quote_toml(&item.label)),
            format!("done = {}", item.done),
        ]);
    }

    for item in &project.export_history {
        output.extend([
            "".to_string(),
            "[[exportHistory]]".to_string(),
            format!("id = {}", quote_toml(&item.id)),
            format!("label = {}", quote_toml(&item.label)),
            format!("filename = {}", quote_toml(&item.filename)),
            format!("path = {}", quote_toml(&item.path)),
            format!("exportedAt = {}", quote_toml(&item.exported_at)),
            format!("sheetCount = {}", item.sheet_count),
            format!("wordCount = {}", item.word_count),
            format!("targetPlatform = {}", quote_toml(&item.target_platform)),
        ]);
    }

    output.push("".to_string());
    output.join("\n")
}

fn sheet_markdown_relative_path(project: &WritingProject, sheet: &WritingSheet) -> String {
    let group_title = project
        .groups
        .iter()
        .find(|group| group.id == sheet.group_id)
        .map(|group| group.title.as_str())
        .unwrap_or("默认组");
    format!(
        "{}/{}.md",
        safe_visible_path_segment(group_title, &sheet.group_id),
        safe_visible_path_segment(&sheet.title, &sheet.id)
    )
}

fn render_project_writing_brief(brief: &ProjectWritingBrief) -> Vec<String> {
    let fields = [
        ("Audience", brief.audience.trim()),
        ("Thesis", brief.thesis.trim()),
        ("Tone", brief.tone.trim()),
        ("Publishing notes", brief.publishing_notes.trim()),
    ];
    let filled_fields: Vec<(&str, &str)> = fields
        .iter()
        .copied()
        .filter(|(_, value)| !value.is_empty())
        .collect();

    if filled_fields.is_empty() {
        return vec![];
    }

    let mut output = vec!["## Writing Brief".to_string(), "".to_string()];
    for (label, value) in filled_fields {
        output.push(format!("- {}: {}", label, inline_markdown_text(value)));
    }
    output.push("".to_string());
    output
}

fn render_sheet_markdown(sheet: &WritingSheet) -> String {
    [
        "---".to_string(),
        "nibvaSheet: true".to_string(),
        format!("id: {}", quote_yaml(&sheet.id)),
        format!("title: {}", quote_yaml(&sheet.title)),
        format!("groupId: {}", quote_yaml(&sheet.group_id)),
        format!("type: {}", quote_yaml(&sheet.sheet_type)),
        format!("status: {}", quote_yaml(&sheet.status)),
        format!("targetWords: {}", sheet.target_words),
        format!("summary: {}", quote_yaml(&sheet.summary)),
        format!("createdAt: {}", quote_yaml(&sheet.created_at)),
        format!("updatedAt: {}", quote_yaml(&sheet.updated_at)),
        "---".to_string(),
        "".to_string(),
        sheet.body.trim_start_matches('\u{feff}').to_string(),
    ]
    .join("\n")
}

fn strip_nibva_frontmatter(markdown: &str) -> &str {
    let normalized = markdown.strip_prefix('\u{feff}').unwrap_or(markdown);
    if !normalized.starts_with("---\n") {
        return normalized;
    }

    let Some(end_index) = normalized[4..].find("\n---\n") else {
        return normalized;
    };
    let frontmatter = &normalized[4..4 + end_index];
    if !frontmatter
        .lines()
        .any(|line| line.trim() == "nibvaSheet: true")
    {
        return normalized;
    }

    normalized[4 + end_index + "\n---\n".len()..]
        .strip_prefix('\n')
        .unwrap_or(&normalized[4 + end_index + "\n---\n".len()..])
}

fn quote_yaml(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn quote_toml(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            '\u{08}' => output.push_str("\\b"),
            '\u{0c}' => output.push_str("\\f"),
            value if value.is_control() => output.push_str(&format!("\\u{:04X}", value as u32)),
            value => output.push(value),
        }
    }
    output.push('"');
    output
}

fn toml_string_array(values: &[String]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|value| quote_toml(value))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn escape_markdown_link_text(value: &str) -> String {
    value.replace('[', "\\[").replace(']', "\\]")
}

fn inline_markdown_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[tauri::command]
fn list_codex_skills() -> Result<Vec<CodexSkill>, String> {
    let mut skills = Vec::new();
    let Some(home) = dirs::home_dir() else {
        return Ok(skills);
    };

    let roots = [
        home.join(".codex").join("skills"),
        home.join(".agents").join("skills"),
    ];

    for root in roots {
        collect_skills(&root, 0, &mut skills)?;
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills.dedup_by(|a, b| a.path == b.path);
    Ok(skills)
}

#[tauri::command]
fn write_skill_task(path: String, task: SkillTask) -> Result<String, String> {
    let root = PathBuf::from(path);
    let tasks_dir = root.join("ai-tasks");
    fs::create_dir_all(&tasks_dir).map_err(|error| error.to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    let safe_skill = safe_file_segment(&task.skill_id);
    let task_path = tasks_dir.join(format!("{}-{}.json", timestamp, safe_skill));
    let payload = serde_json::to_string_pretty(&task).map_err(|error| error.to_string())?;
    fs::write(&task_path, payload).map_err(|error| error.to_string())?;

    Ok(task_path.display().to_string())
}

#[tauri::command]
fn run_codex_chat(
    path: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    codex_cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    let codex_path = resolve_codex_command(codex_cli_path).ok_or_else(|| {
        "Cannot find codex on PATH. Install Codex CLI or set up the shell PATH used by Nibva."
            .to_string()
    })?;
    let library_path = PathBuf::from(path);
    let mode_text = if plan_mode {
        "当前处于 Plan Mode。先分析和制定计划，不要直接改写正文；输出可执行步骤、风险和建议修改范围。"
    } else {
        "当前处于 Default Mode。可以给出直接建议，但仍需避免未经确认覆盖用户正文。"
    };
    let full_prompt = format!(
        "你是 Nibva 写作软件里的 AI 写作助手。你通过 Codex CLI 被调用。\
\n\n工作方式：\
\n- 辅助人类写作，不要替用户一键整篇代写。\
\n- 优先给出可审阅的建议、结构调整、局部润色和发布准备。\
\n- 如果用户要求修改正文，先输出建议稿或 diff 风格说明。\
\n- {}\n- 当前写作上下文如下：\n\n{}\n\n用户消息：\n{}",
        mode_text, context, prompt
    );

    let output = Command::new(&codex_path)
        .arg("exec")
        .arg("--cd")
        .arg(&library_path)
        .arg("--color")
        .arg("never")
        .arg(full_prompt)
        .env("CODEX_NON_INTERACTIVE", "1")
        .output()
        .map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    Ok(CodexChatResult {
        output: stdout,
        error: stderr,
        command: format!(
            "{} exec --cd {} --color never <prompt>",
            codex_path,
            library_path.display()
        ),
    })
}

#[tauri::command]
fn probe_codex_cli(codex_cli_path: Option<String>) -> Result<CodexProbeResult, String> {
    let Some(codex_path) = resolve_codex_command(codex_cli_path) else {
        return Ok(CodexProbeResult {
            resolved_path: String::new(),
            ok: false,
            steps: vec![CodexProbeStep {
                name: "resolve".to_string(),
                ok: false,
                command: "command -v codex".to_string(),
                stdout: String::new(),
                stderr: "Cannot find codex on PATH or configured path.".to_string(),
            }],
        });
    };

    let steps = vec![
        run_probe_step(&codex_path, "version", &["--version"]),
        run_probe_step(&codex_path, "exec_help", &["exec", "--help"]),
        run_probe_step(&codex_path, "app_server_help", &["app-server", "--help"]),
    ];
    let ok = steps.iter().all(|step| step.ok);

    Ok(CodexProbeResult {
        resolved_path: codex_path,
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

fn resolve_codex_command(configured_path: Option<String>) -> Option<String> {
    if let Some(path) = configured_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Ok(path) = std::env::var("CODEX_CLI") {
        if !path.trim().is_empty() {
            return Some(path);
        }
    }

    let shell_lookup = Command::new("/bin/zsh")
        .arg("-lc")
        .arg("command -v codex")
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

    if shell_lookup.is_some() {
        return shell_lookup;
    }

    let Some(home) = dirs::home_dir() else {
        return None;
    };
    let candidates = [
        home.join(".codex").join("bin").join("codex"),
        PathBuf::from("/opt/homebrew/bin/codex"),
        PathBuf::from("/usr/local/bin/codex"),
    ];

    candidates
        .iter()
        .find(|candidate| candidate.exists())
        .map(|candidate| candidate.display().to_string())
}

fn collect_skills(root: &Path, depth: usize, skills: &mut Vec<CodexSkill>) -> Result<(), String> {
    if depth > 5 || !root.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(root).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
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
                let name = frontmatter_value(&raw, "name").unwrap_or(fallback_name);
                let description = frontmatter_value(&raw, "description").unwrap_or_default();
                skills.push(CodexSkill {
                    id: safe_file_segment(&name),
                    name,
                    description,
                    path: skill_file.display().to_string(),
                });
            }
        } else {
            collect_skills(&path, depth + 1, skills)?;
        }
    }

    Ok(())
}

fn frontmatter_value(raw: &str, key: &str) -> Option<String> {
    raw.lines().take(20).find_map(|line| {
        let (line_key, value) = line.split_once(':')?;
        if line_key.trim() != key {
            return None;
        }
        Some(value.trim().trim_matches('"').to_string())
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

fn safe_file_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn stable_id_segment(value: &str) -> String {
    let safe = safe_file_segment(value);
    if !safe.is_empty() {
        return safe;
    }

    let hash = value
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        });
    format!("{hash:016x}")
}

fn safe_export_filename(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let sanitized = sanitized.trim_start_matches(['.', '-']).to_string();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "nibva-export.md".to_string()
    } else {
        sanitized
    }
}

fn safe_resource_filename(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let sanitized = sanitized.trim_start_matches(['.', '-']).to_string();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "resource".to_string()
    } else {
        sanitized
    }
}

fn unique_destination_path(directory: &Path, filename: &str) -> PathBuf {
    let candidate = directory.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("resource");
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 2.. {
        let name = match extension {
            Some(extension) if !extension.is_empty() => format!("{}-{}.{}", stem, index, extension),
            _ => format!("{}-{}", stem, index),
        };
        let candidate = directory.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("unique destination loop should always return")
}

fn is_text_resource_extension(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown"
            | "txt"
            | "text"
            | "html"
            | "htm"
            | "json"
            | "jsonl"
            | "csv"
            | "tsv"
            | "yaml"
            | "yml"
            | "xml"
            | "css"
            | "js"
            | "jsx"
            | "ts"
            | "tsx"
            | "rtf"
            | "log"
    )
}

fn is_markdown_import_extension(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "txt" | "text"
    )
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
        assert!(rendered.contains("title: \"测试卡片\""));
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
    fn safe_export_filename_preserves_extension_without_path_segments() {
        assert_eq!(
            safe_export_filename("../My Export: Final.md"),
            "My-Export-Final.md"
        );
        assert_eq!(safe_export_filename(""), "nibva-export.md");
    }

    #[test]
    fn safe_resource_filename_removes_path_like_segments() {
        assert_eq!(
            safe_resource_filename("../../Reference File.pdf"),
            "Reference-File.pdf"
        );
        assert_eq!(safe_resource_filename(""), "resource");
    }

    #[test]
    fn text_resource_detection_is_extension_based() {
        assert!(is_text_resource_extension(Path::new("reference.md")));
        assert!(is_text_resource_extension(Path::new("data.JSON")));
        assert!(!is_text_resource_extension(Path::new("image.png")));
    }

    #[test]
    fn markdown_import_detection_allows_markdown_and_text() {
        assert!(is_markdown_import_extension(Path::new("article.md")));
        assert!(is_markdown_import_extension(Path::new("article.MARKDOWN")));
        assert!(is_markdown_import_extension(Path::new("draft.txt")));
        assert!(!is_markdown_import_extension(Path::new("image.png")));
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
        .menu(|handle| {
            let rebuild_index =
                MenuItem::with_id(handle, "rebuild-index", "重建索引", true, None::<&str>)?;
            let menu = Menu::default(handle)?;
            let mut inserted = false;

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
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "rebuild-index" {
                let _ = app.emit("nibva://rebuild-index", ());
            }
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
            import_project_resources,
            read_markdown_import_files,
            open_local_path,
            reveal_local_path,
            read_project_resource_text,
            list_codex_skills,
            write_skill_task,
            run_codex_chat,
            probe_codex_cli
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nibva");
}
