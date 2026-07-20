use crate::models::{
    ExportHistoryItem, ProjectGoal, ProjectGroup, ProjectPropertyDefinition, ProjectWritingBrief,
    PublishingChecklistItem, WritingProject, WritingSheet,
};
use std::fs;
use std::path::Path;
use toml::value::Table;

pub(super) fn apply_project_toml_metadata(project_dir: &Path, project: &mut WritingProject) {
    let Ok(raw) = fs::read_to_string(project_dir.join("project.toml")) else {
        return;
    };
    let Ok(document) = raw.parse::<toml::Value>() else {
        return;
    };
    let generated_by_loby = document
        .get("loby")
        .and_then(toml::Value::as_table)
        .and_then(|table| table.get("project"))
        .and_then(toml::Value::as_bool)
        .unwrap_or(false);

    if let Some(table) = document.get("project").and_then(toml::Value::as_table) {
        apply_project_table(table, project);
    }
    if let Some(table) = document.get("writingBrief").and_then(toml::Value::as_table) {
        project.writing_brief = project_writing_brief_from_toml(table);
    }
    if let Some(table) = document.get("projectGoal").and_then(toml::Value::as_table) {
        project.project_goal = project_goal_from_toml(table);
    } else if project.target_words > 0 {
        project.project_goal = ProjectGoal {
            enabled: true,
            unit: "words".to_string(),
            target: project.target_words,
        };
    }

    apply_array_if_present_or_generated(
        &document,
        "propertyDefinitions",
        generated_by_loby,
        &mut project.property_definitions,
        project_property_definition_from_toml,
    );
    apply_array_if_present_or_generated(
        &document,
        "groups",
        generated_by_loby,
        &mut project.groups,
        project_group_from_toml,
    );
    apply_sheet_metadata(&document, generated_by_loby, &mut project.sheets);
    apply_array_if_present_or_generated(
        &document,
        "publishingChecklist",
        generated_by_loby,
        &mut project.publishing_checklist,
        publishing_checklist_item_from_toml,
    );
    apply_array_if_present_or_generated(
        &document,
        "exportHistory",
        generated_by_loby,
        &mut project.export_history,
        export_history_item_from_toml,
    );
}

fn apply_project_table(table: &Table, project: &mut WritingProject) {
    if let Some(title) = table_string(table, "title").filter(|value| !value.trim().is_empty()) {
        project.title = title;
    }
    if let Some(icon) = table_string(table, "icon") {
        project.icon = icon;
    }
    if let Some(icon_color) = table_string(table, "iconColor") {
        project.icon_color = icon_color;
    }
    if let Some(description) = table_string(table, "description") {
        project.description = description;
    }
    if let Some(target_words) = table
        .get("targetWords")
        .and_then(toml::Value::as_integer)
        .and_then(|value| u32::try_from(value).ok())
    {
        project.target_words = target_words;
    }
    if let Some(updated_at) = table_string(table, "updatedAt") {
        project.updated_at = updated_at;
    }
    if let Some(archived_at) = table_string(table, "archivedAt") {
        project.archived_at = archived_at;
    }
    if let Some(tags) = table.get("tags").and_then(toml::Value::as_array) {
        project.tags = tags
            .iter()
            .filter_map(toml::Value::as_str)
            .map(str::to_string)
            .collect();
    }
}

fn project_writing_brief_from_toml(table: &Table) -> ProjectWritingBrief {
    ProjectWritingBrief {
        audience: table_string(table, "audience").unwrap_or_default(),
        thesis: table_string(table, "thesis").unwrap_or_default(),
        tone: table_string(table, "tone").unwrap_or_default(),
        publishing_notes: table_string(table, "publishingNotes").unwrap_or_default(),
    }
}

fn project_goal_from_toml(table: &Table) -> ProjectGoal {
    let unit = table_string(table, "unit")
        .filter(|value| value == "words" || value == "articles")
        .unwrap_or_else(|| "words".to_string());
    let target = table_u32(table, "target").unwrap_or(0);
    ProjectGoal {
        enabled: table
            .get("enabled")
            .and_then(toml::Value::as_bool)
            .unwrap_or(false)
            && target > 0,
        unit,
        target,
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
        id: table_string(table, "id")?,
        key: table_string(table, "key")?,
        label: table_string(table, "label")?,
        field_type: table_string(table, "type")?,
        description: table_string(table, "description").unwrap_or_default(),
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

fn project_group_from_toml(value: &toml::Value) -> Option<ProjectGroup> {
    let table = value.as_table()?;
    Some(ProjectGroup {
        id: table_string(table, "id")?,
        title: table_string(table, "title")?,
        icon: table_string(table, "icon").unwrap_or_default(),
        icon_color: table_string(table, "iconColor").unwrap_or_default(),
        description: table_string(table, "description").unwrap_or_default(),
    })
}

fn publishing_checklist_item_from_toml(value: &toml::Value) -> Option<PublishingChecklistItem> {
    let table = value.as_table()?;
    Some(PublishingChecklistItem {
        id: table_string(table, "id")?,
        label: table_string(table, "label")?,
        done: table
            .get("done")
            .and_then(toml::Value::as_bool)
            .unwrap_or(false),
    })
}

fn export_history_item_from_toml(value: &toml::Value) -> Option<ExportHistoryItem> {
    let table = value.as_table()?;
    Some(ExportHistoryItem {
        id: table_string(table, "id")?,
        label: table_string(table, "label")?,
        filename: table_string(table, "filename")?,
        path: table_string(table, "path")?,
        exported_at: table_string(table, "exportedAt")?,
        sheet_count: table_u32(table, "sheetCount")?,
        word_count: table_u32(table, "wordCount")?,
        target_platform: table_string(table, "targetPlatform")?,
    })
}

fn apply_sheet_metadata(
    document: &toml::Value,
    generated_by_loby: bool,
    sheets: &mut Vec<WritingSheet>,
) {
    let values = document.get("sheets").and_then(toml::Value::as_array);
    if values.is_none() && !generated_by_loby {
        return;
    }
    let mut existing = std::mem::take(sheets);
    *sheets = values
        .into_iter()
        .flatten()
        .filter_map(|value| {
            let table = value.as_table()?;
            let id = table_string(table, "id")?;
            let mut sheet = existing
                .iter()
                .position(|sheet| sheet.id == id)
                .map(|index| existing.remove(index))
                .unwrap_or_else(|| empty_sheet(id));
            if let Some(title) = table_string(table, "title") {
                sheet.title = title;
            }
            if let Some(group_id) = table_string(table, "groupId") {
                sheet.group_id = group_id;
            }
            if let Some(target_words) = table_u32(table, "targetWords") {
                sheet.target_words = target_words;
            }
            if let Some(summary) = table_string(table, "summary") {
                sheet.summary = summary;
            }
            if let Some(created_at) = table_string(table, "createdAt") {
                sheet.created_at = created_at;
            }
            if let Some(updated_at) = table_string(table, "updatedAt") {
                sheet.updated_at = updated_at;
            }
            if let Some(completed_at) = table_string(table, "completedAt") {
                sheet.completed_at = completed_at;
            }
            Some(sheet)
        })
        .collect();
}

fn empty_sheet(id: String) -> WritingSheet {
    WritingSheet {
        id,
        title: String::new(),
        group_id: String::new(),
        status: "构思".to_string(),
        target_words: 0,
        summary: String::new(),
        body: String::new(),
        created_at: String::new(),
        updated_at: String::new(),
        properties: Default::default(),
        archived_at: String::new(),
        completed_at: String::new(),
        versions: Vec::new(),
    }
}

fn apply_array_if_present_or_generated<T>(
    document: &toml::Value,
    key: &str,
    generated_by_loby: bool,
    target: &mut Vec<T>,
    parse: fn(&toml::Value) -> Option<T>,
) {
    let values = document.get(key).and_then(toml::Value::as_array);
    if values.is_none() && !generated_by_loby {
        return;
    }
    *target = values.into_iter().flatten().filter_map(parse).collect();
}

fn table_string(table: &Table, key: &str) -> Option<String> {
    table
        .get(key)
        .and_then(toml::Value::as_str)
        .map(str::to_string)
}

fn table_u32(table: &Table, key: &str) -> Option<u32> {
    table
        .get(key)
        .and_then(toml::Value::as_integer)
        .and_then(|value| u32::try_from(value).ok())
}
