use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

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

const MAX_RESOURCE_TEXT_BYTES: usize = 60_000;

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
    let index_path = root.join("library.json");
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(index_path).map_err(|error| error.to_string())?;
    let mut projects: Vec<WritingProject> =
        serde_json::from_str(&raw).map_err(|error| error.to_string())?;

    for project in &mut projects {
        let sheets_dir = root.join("projects").join(&project.id).join("sheets");
        for sheet in &mut project.sheets {
            let markdown_path = sheets_dir.join(format!("{}.md", sheet.id));
            if markdown_path.exists() {
                let raw_markdown =
                    fs::read_to_string(markdown_path).map_err(|error| error.to_string())?;
                sheet.body = strip_nibva_frontmatter(&raw_markdown).to_string();
            }
        }
    }

    Ok(projects)
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
    let conversations_path = PathBuf::from(path).join("ai").join("conversations.json");
    if !conversations_path.exists() {
        return Ok(serde_json::Value::Array(Vec::new()));
    }

    let raw = fs::read_to_string(conversations_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_conversations(path: String, conversations: serde_json::Value) -> Result<String, String> {
    let root = PathBuf::from(path);
    let ai_dir = root.join("ai");
    fs::create_dir_all(&ai_dir).map_err(|error| error.to_string())?;
    let payload =
        serde_json::to_string_pretty(&conversations).map_err(|error| error.to_string())?;
    let conversations_path = ai_dir.join("conversations.json");
    fs::write(&conversations_path, payload).map_err(|error| error.to_string())?;
    Ok(conversations_path.display().to_string())
}

#[tauri::command]
fn list_project_resources(
    path: String,
    project_id: String,
) -> Result<Vec<ProjectResourceFile>, String> {
    let project_dir = PathBuf::from(path).join("projects").join(project_id);
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
    filename: String,
    content: String,
) -> Result<String, String> {
    let project_dir = PathBuf::from(path).join("projects").join(project_id);
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
    target: String,
    source_paths: Vec<String>,
) -> Result<Vec<ProjectResourceFile>, String> {
    let project_dir = PathBuf::from(path).join("projects").join(project_id);
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
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    for project in &projects {
        let project_dir = root.join("projects").join(&project.id);
        let sheets_dir = project_dir.join("sheets");
        fs::create_dir_all(&sheets_dir).map_err(|error| error.to_string())?;
        ensure_project_resource_dirs(&project_dir)?;

        for sheet in &project.sheets {
            let markdown_path = sheets_dir.join(format!("{}.md", sheet.id));
            fs::write(markdown_path, render_sheet_markdown(sheet))
                .map_err(|error| error.to_string())?;
        }
        cleanup_stale_sheet_files(&sheets_dir, project)?;

        let metadata_path = project_dir.join("project.json");
        let metadata = serde_json::to_string_pretty(project).map_err(|error| error.to_string())?;
        fs::write(metadata_path, metadata).map_err(|error| error.to_string())?;
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
    }

    let index = serde_json::to_string_pretty(&projects).map_err(|error| error.to_string())?;
    fs::write(root.join("library.json"), index).map_err(|error| error.to_string())?;

    Ok(root.display().to_string())
}

fn ensure_project_resource_dirs(project_dir: &Path) -> Result<(), String> {
    for directory in ["assets", "references", "exports"] {
        fs::create_dir_all(project_dir.join(directory)).map_err(|error| error.to_string())?;
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
            "{}. [{}](sheets/{}.md) - {} / {} words",
            index + 1,
            escape_markdown_link_text(&sheet.title),
            sheet.id,
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
        "- [Sheets](sheets/)".to_string(),
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
        "# The app writes canonical state to project.json and sheet Markdown files.".to_string(),
        "".to_string(),
        "[nibva]".to_string(),
        "project = true".to_string(),
        "version = 1".to_string(),
        "".to_string(),
        "[project]".to_string(),
        format!("id = {}", quote_toml(&project.id)),
        format!("title = {}", quote_toml(&project.title)),
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
            format!("updatedAt = {}", quote_toml(&sheet.updated_at)),
            format!("path = {}", quote_toml(&format!("sheets/{}.md", sheet.id))),
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

fn cleanup_stale_sheet_files(sheets_dir: &Path, project: &WritingProject) -> Result<(), String> {
    let active_sheet_ids: HashSet<&str> = project
        .sheets
        .iter()
        .map(|sheet| sheet.id.as_str())
        .collect();
    if !sheets_dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(sheets_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let Some(sheet_id) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        if !active_sheet_ids.contains(sheet_id) {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
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
            sheet_type: "正文".to_string(),
            status: "构思".to_string(),
            target_words: 1200,
            summary: "摘要".to_string(),
            body: "# 正文\n\n内容".to_string(),
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
        assert!(rendered.contains("[测试卡片](sheets/sheet-1.md)"));
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
        assert!(rendered.contains("tags = [\"标签\"]"));
        assert!(rendered.contains("[writingBrief]"));
        assert!(rendered.contains("audience = \"专业写作者\""));
        assert!(rendered.contains("[[sheets]]"));
        assert!(rendered.contains("path = \"sheets/sheet-1.md\""));
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

    fn sample_project() -> WritingProject {
        WritingProject {
            id: "project-1".to_string(),
            title: "项目".to_string(),
            description: "描述".to_string(),
            status: "构思".to_string(),
            target_platform: "公众号".to_string(),
            target_words: 3000,
            tags: vec!["标签".to_string()],
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
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            default_library_path,
            load_library,
            load_library_at,
            save_library,
            save_library_at,
            load_conversations,
            save_conversations,
            list_project_resources,
            save_project_export,
            import_project_resources,
            read_markdown_import_files,
            open_local_path,
            read_project_resource_text,
            list_codex_skills,
            write_skill_task,
            run_codex_chat,
            probe_codex_cli
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nibva");
}
