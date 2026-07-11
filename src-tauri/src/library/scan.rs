use super::{NOTES_INBOX_GROUP_ID, NOTES_PROJECT_ID};
use crate::fs_paths::{
    is_hidden_path, is_markdown_file, path_file_stem, safe_file_segment, stable_id_segment,
};
use crate::markdown::{
    markdown_h1_title, safe_visible_path_segment, sheet_frontmatter_properties,
    sheet_frontmatter_value, strip_nibva_frontmatter,
};
use crate::models::{
    ProjectGroup, ProjectPropertyDefinition, ProjectWritingBrief, WritingProject, WritingSheet,
};
use crate::project_paths::read_project_id_from_toml;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

pub(super) fn scan_local_first_library(
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
        if path.is_dir() || !is_markdown_file(&path) {
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
    let id = sheet_frontmatter_value(raw, "id").unwrap_or_else(|| {
        find_indexed_sheet_by_title(project, &fallback_title)
            .map(|sheet| sheet.id.clone())
            .unwrap_or_else(|| format!("sheet-{}", stable_id_segment(&fallback_title)))
    });
    let indexed = project.sheets.iter().find(|sheet| sheet.id == id);
    let body = strip_nibva_frontmatter(raw).to_string();
    let title = sheet_frontmatter_value(raw, "title")
        .or_else(|| markdown_h1_title(&body))
        .or_else(|| indexed.map(|sheet| sheet.title.clone()))
        .unwrap_or(fallback_title);

    WritingSheet {
        id,
        title,
        group_id: group_id.to_string(),
        sheet_type: sheet_frontmatter_value(raw, "type")
            .or_else(|| indexed.map(|sheet| sheet.sheet_type.clone()))
            .unwrap_or_else(|| "正文".to_string()),
        status: sheet_frontmatter_value(raw, "status")
            .or_else(|| indexed.map(|sheet| sheet.status.clone()))
            .unwrap_or_else(|| "构思".to_string()),
        target_words: sheet_frontmatter_value(raw, "targetWords")
            .and_then(|value| value.parse::<u32>().ok())
            .or_else(|| indexed.map(|sheet| sheet.target_words))
            .unwrap_or(0),
        summary: sheet_frontmatter_value(raw, "summary")
            .or_else(|| indexed.map(|sheet| sheet.summary.clone()))
            .unwrap_or_default(),
        body,
        created_at: sheet_frontmatter_value(raw, "createdAt")
            .or_else(|| indexed.map(|sheet| sheet.created_at.clone()))
            .or_else(|| indexed.map(|sheet| sheet.updated_at.clone()))
            .unwrap_or_default(),
        updated_at: sheet_frontmatter_value(raw, "updatedAt")
            .or_else(|| indexed.map(|sheet| sheet.updated_at.clone()))
            .unwrap_or_default(),
        properties: sheet_frontmatter_properties(raw),
        archived_at: sheet_frontmatter_value(raw, "archivedAt")
            .or_else(|| indexed.map(|sheet| sheet.archived_at.clone()))
            .unwrap_or_default(),
        versions: indexed
            .map(|sheet| sheet.versions.clone())
            .unwrap_or_default(),
    }
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
    if let Ok(document) = raw.parse::<toml::Value>() {
        if let Some(project_table) = document.get("project").and_then(toml::Value::as_table) {
            if let Some(archived_at) = project_table
                .get("archivedAt")
                .and_then(toml::Value::as_str)
            {
                project.archived_at = archived_at.to_string();
            }
        }
        if let Some(definitions) = document
            .get("propertyDefinitions")
            .and_then(toml::Value::as_array)
        {
            project.property_definitions = definitions
                .iter()
                .filter_map(project_property_definition_from_toml)
                .collect();
        }
    }
}

fn project_property_definition_from_toml(value: &toml::Value) -> Option<ProjectPropertyDefinition> {
    let table = value.as_table()?;
    let default_value = table
        .get("defaultValueJson")
        .and_then(toml::Value::as_str)
        .filter(|value| !value.is_empty())
        .and_then(|value| serde_json::from_str(value).ok());
    let options = table
        .get("optionsJson")
        .and_then(toml::Value::as_str)
        .and_then(|value| serde_json::from_str(value).ok())
        .unwrap_or_default();
    Some(ProjectPropertyDefinition {
        id: table.get("id")?.as_str()?.to_string(),
        key: table.get("key")?.as_str()?.to_string(),
        label: table.get("label")?.as_str()?.to_string(),
        field_type: table.get("type")?.as_str()?.to_string(),
        description: table
            .get("description")
            .and_then(toml::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        options,
        default_value,
        show_when_empty: table
            .get("showWhenEmpty")
            .and_then(toml::Value::as_bool)
            .unwrap_or(true),
        locked: table
            .get("locked")
            .and_then(toml::Value::as_bool)
            .unwrap_or(false),
    })
}

pub(crate) fn default_notes_project() -> WritingProject {
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
        property_definitions: Vec::new(),
        archived_at: String::new(),
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
        property_definitions: Vec::new(),
        archived_at: String::new(),
        publishing_checklist: Vec::new(),
        export_history: Vec::new(),
        writing_brief: ProjectWritingBrief::default(),
    }
}

pub(super) fn note_group_from_folder(title: &str) -> ProjectGroup {
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

pub(super) fn project_group_from_folder(title: &str) -> ProjectGroup {
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

fn toml_value(raw: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} = ");
    raw.lines().find_map(|line| {
        let value = line.trim().strip_prefix(&prefix)?;
        Some(value.trim().trim_matches('"').to_string())
    })
}
