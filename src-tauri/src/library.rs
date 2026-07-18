mod project_metadata;
mod save;
mod scan;
pub(crate) mod trash;

use crate::models::{ProjectGroup, ProjectWritingBrief, WritingProject, WritingSheet};
pub(crate) use save::save_library_to_path;
use save::write_library_index;
use scan::scan_local_first_library;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const NOTES_PROJECT_ID: &str = "notes-root";
pub(crate) const NOTES_QUICK_GROUP_ID: &str = "notes-quick";
pub(crate) const INBOX_PROJECT_ID: &str = "inbox-root";
pub(crate) const INBOX_GROUP_ID: &str = "inbox-default";
const STARTER_PROJECT_ID: &str = "loby-guide";
const STARTER_GROUP_ID: &str = "group-default";
const STARTER_SHEET_ID: &str = "loby-guide-welcome";
const STARTER_SHEET_DATE: &str = "2026-07-11";
const DEFAULT_LIBRARIES_DIRECTORY_NAME: &str = "LobyLibrary";
const STARTER_SHEET_BODY: &str = r#"# 欢迎使用落笔

落笔是一款以本地 Markdown 文件为核心的写作应用。你的文稿保存在自己选择的写作库中，可以自由访问、备份和迁移。

## 从一篇文稿开始

- 还没想好归属的文章，可以先放进“收件箱”。
- 已经确定主题的内容，可以创建项目并在项目中继续整理。
- 临时想法和灵感，可以通过“随手记”快速保存。

这篇文稿是“落笔指南”的第一篇内容。我们会继续完善这里的使用说明，你也可以像编辑普通文稿一样修改或删除它。
"#;

#[tauri::command]
pub(crate) fn default_libraries_path() -> Result<String, String> {
    Ok(default_libraries_root()?.display().to_string())
}

#[tauri::command]
pub(crate) fn create_library_directory(
    name: String,
    parent_path: Option<String>,
) -> Result<String, String> {
    let parent = match parent_path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => default_libraries_root()?,
    };
    create_library_directory_at(&parent, &name)
}

#[tauri::command]
pub(crate) fn move_library_directory(
    path: String,
    destination_parent: String,
) -> Result<String, String> {
    move_library_directory_at(Path::new(&path), Path::new(&destination_parent))
}

#[tauri::command]
pub(crate) fn default_library_path() -> Result<String, String> {
    Ok(library_root()?.display().to_string())
}

#[tauri::command]
pub(crate) fn load_library() -> Result<Vec<WritingProject>, String> {
    load_library_from_path(library_root()?)
}

#[tauri::command]
pub(crate) fn load_library_at(path: String) -> Result<Vec<WritingProject>, String> {
    load_library_from_path(PathBuf::from(path))
}

pub(crate) fn load_library_from_path(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    let indexed_projects = load_library_index(&root)?;
    scan_local_first_library(&root, &indexed_projects)
}

#[tauri::command]
pub(crate) fn rebuild_library_index(path: String) -> Result<Vec<WritingProject>, String> {
    rebuild_library_index_at(PathBuf::from(path))
}

pub(crate) fn rebuild_library_index_at(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    let indexed_projects = load_library_index(&root)?;
    let projects = scan_local_first_library(&root, &indexed_projects)?;
    write_library_index(&root, &projects)?;
    Ok(projects)
}

#[tauri::command]
pub(crate) fn save_library(projects: Vec<WritingProject>) -> Result<String, String> {
    save_library_to_path(library_root()?, projects)
}

#[tauri::command]
pub(crate) fn save_library_at(
    path: String,
    projects: Vec<WritingProject>,
) -> Result<String, String> {
    save_library_to_path(PathBuf::from(path), projects)
}

#[tauri::command]
pub(crate) fn save_zen_sheet_at(
    path: String,
    project_id: String,
    sheet_id: String,
    title: String,
    body: String,
    updated_at: String,
) -> Result<WritingSheet, String> {
    save_zen_sheet_at_path(
        PathBuf::from(path),
        &project_id,
        &sheet_id,
        title,
        body,
        updated_at,
    )
}

pub(crate) fn save_zen_sheet_at_path(
    root: PathBuf,
    project_id: &str,
    sheet_id: &str,
    title: String,
    body: String,
    updated_at: String,
) -> Result<WritingSheet, String> {
    let mut projects = load_library_from_path(root.clone())?;
    let project = projects
        .iter_mut()
        .find(|project| project.id == project_id)
        .ok_or_else(|| "禅模式对应的项目已经不存在。".to_string())?;
    let sheet = project
        .sheets
        .iter_mut()
        .find(|sheet| sheet.id == sheet_id)
        .ok_or_else(|| "禅模式对应的文稿已经不存在。".to_string())?;

    sheet.title = title;
    sheet.body = body;
    sheet.updated_at = updated_at.clone();
    project.updated_at = updated_at;
    let saved_sheet = sheet.clone();
    save_library_to_path(root, projects)?;
    Ok(saved_sheet)
}

fn load_library_index(root: &Path) -> Result<Vec<WritingProject>, String> {
    let index_path = root.join(".loby").join("library.json");
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(index_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

pub(crate) fn library_root() -> Result<PathBuf, String> {
    let documents = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
        .ok_or_else(|| "Cannot locate a Documents directory".to_string())?;
    Ok(documents.join(DEFAULT_LIBRARIES_DIRECTORY_NAME))
}

fn default_libraries_root() -> Result<PathBuf, String> {
    let documents = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
        .ok_or_else(|| "Cannot locate a Documents directory".to_string())?;
    Ok(documents.join(DEFAULT_LIBRARIES_DIRECTORY_NAME))
}

fn create_library_directory_at(parent: &Path, name: &str) -> Result<String, String> {
    let name = validate_library_name(name)?;
    let root = parent.join(name);
    if root.exists() {
        if !root.is_dir() {
            return Err("同名路径已经存在，但它不是文件夹。".to_string());
        }
        if root
            .read_dir()
            .map_err(|error| error.to_string())?
            .next()
            .is_some()
        {
            return Err("同名文件夹已经存在。请更换名称，或使用“打开已有写作库”。".to_string());
        }
    }
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join(".loby")).map_err(|error| error.to_string())?;
    save_library_to_path(root.clone(), vec![starter_project()])?;
    Ok(root.display().to_string())
}

fn starter_project() -> WritingProject {
    WritingProject {
        id: STARTER_PROJECT_ID.to_string(),
        title: "落笔指南".to_string(),
        icon: "book".to_string(),
        icon_color: "#007aff".to_string(),
        description: "认识落笔，并从第一篇文稿开始。".to_string(),
        status: "构思".to_string(),
        target_platform: "未指定".to_string(),
        target_words: 0,
        tags: vec!["落笔".to_string(), "使用指南".to_string()],
        groups: vec![ProjectGroup {
            id: STARTER_GROUP_ID.to_string(),
            title: "待整理".to_string(),
            icon: "library".to_string(),
            icon_color: "#007aff".to_string(),
            description: String::new(),
        }],
        sheets: vec![WritingSheet {
            id: STARTER_SHEET_ID.to_string(),
            title: "欢迎使用落笔".to_string(),
            group_id: STARTER_GROUP_ID.to_string(),
            sheet_type: "正文".to_string(),
            status: "构思".to_string(),
            target_words: 0,
            summary: "了解落笔的本地写作方式，以及收件箱、项目和随手记的基本用途。".to_string(),
            body: STARTER_SHEET_BODY.to_string(),
            created_at: STARTER_SHEET_DATE.to_string(),
            updated_at: STARTER_SHEET_DATE.to_string(),
            properties: Default::default(),
            archived_at: String::new(),
            versions: Vec::new(),
        }],
        updated_at: String::new(),
        property_definitions: Vec::new(),
        archived_at: String::new(),
        publishing_checklist: Vec::new(),
        export_history: Vec::new(),
        writing_brief: ProjectWritingBrief::default(),
    }
}

fn move_library_directory_at(source: &Path, destination_parent: &Path) -> Result<String, String> {
    let source = fs::canonicalize(source).map_err(|error| format!("无法读取写作库：{error}"))?;
    if !source.is_dir() {
        return Err("写作库路径不是文件夹。".to_string());
    }

    let destination_parent = fs::canonicalize(destination_parent)
        .map_err(|error| format!("无法读取目标位置：{error}"))?;
    if !destination_parent.is_dir() {
        return Err("目标位置不是文件夹。".to_string());
    }
    if destination_parent.starts_with(&source) {
        return Err("不能把写作库移动到它自己的内部。".to_string());
    }

    let directory_name = source
        .file_name()
        .ok_or_else(|| "无法确定写作库文件夹名称。".to_string())?;
    let destination = destination_parent.join(directory_name);
    if destination == source {
        return Ok(source.display().to_string());
    }
    if destination.exists() {
        return Err("目标位置已经存在同名文件夹。".to_string());
    }

    fs::rename(&source, &destination).map_err(|error| format!("移动写作库失败：{error}"))?;
    Ok(destination.display().to_string())
}

fn validate_library_name(value: &str) -> Result<&str, String> {
    let name = value.trim();
    if name.is_empty() {
        return Err("写作库名称不能为空。".to_string());
    }
    if name == "." || name == ".." {
        return Err("写作库名称无效。".to_string());
    }
    if name.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err("写作库名称不能包含路径或系统保留字符。".to_string());
    }
    Ok(name)
}

#[cfg(test)]
pub(crate) use save::unix_timestamp;
#[cfg(test)]
pub(crate) use scan::{default_inbox_project, default_notes_project};

#[cfg(test)]
mod library_directory_tests {
    use super::*;

    #[test]
    fn creates_named_library_structure() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-create-{}", unix_timestamp()));
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;

        let created = PathBuf::from(create_library_directory_at(&root, "我的写作库")?);
        assert!(created.join("inbox").is_dir());
        assert!(created.join("notes").is_dir());
        assert!(created.join("projects").is_dir());
        assert!(created.join(".loby").is_dir());
        let starter_sheet_path = created
            .join("projects")
            .join("落笔指南")
            .join("待整理")
            .join("欢迎使用落笔.md");
        assert!(starter_sheet_path.is_file());
        let starter_sheet_markdown =
            fs::read_to_string(starter_sheet_path).map_err(|error| error.to_string())?;
        assert!(starter_sheet_markdown.contains("createdAt: 2026-07-11"));
        assert!(starter_sheet_markdown.contains("updatedAt: 2026-07-11"));

        let projects = load_library_from_path(created)?;
        let introduction = projects
            .iter()
            .find(|project| project.id == STARTER_PROJECT_ID)
            .ok_or_else(|| "没有找到首次创建的“落笔指南”项目。".to_string())?;
        assert_eq!(introduction.title, "落笔指南");
        assert!(introduction
            .groups
            .iter()
            .any(|group| group.title == "待整理"));
        assert!(introduction.sheets.iter().any(|sheet| {
            sheet.id == STARTER_SHEET_ID
                && sheet.title == "欢迎使用落笔"
                && sheet.group_id == STARTER_GROUP_ID
                && sheet.created_at == STARTER_SHEET_DATE
                && sheet.updated_at == STARTER_SHEET_DATE
                && sheet.body.starts_with("# 欢迎使用落笔")
        }));
        assert_eq!(
            introduction
                .sheets
                .iter()
                .filter(|sheet| sheet.id == STARTER_SHEET_ID)
                .count(),
            1
        );

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn uses_the_compact_default_libraries_directory_name() -> Result<(), String> {
        assert_eq!(
            default_libraries_root()?
                .file_name()
                .and_then(|name| name.to_str()),
            Some("LobyLibrary")
        );
        Ok(())
    }

    #[test]
    fn does_not_recreate_deleted_starter_project_when_loading() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("loby-library-starter-delete-{}", unix_timestamp()));
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;

        let created = PathBuf::from(create_library_directory_at(&root, "写作库")?);
        fs::remove_dir_all(created.join("projects").join("落笔指南"))
            .map_err(|error| error.to_string())?;

        let projects = load_library_from_path(created)?;
        assert!(!projects
            .iter()
            .any(|project| project.id == STARTER_PROJECT_ID));

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn rejects_unsafe_or_existing_library_names() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-reject-{}", unix_timestamp()));
        fs::create_dir_all(root.join("已有库")).map_err(|error| error.to_string())?;
        fs::write(root.join("已有库").join("note.md"), "content")
            .map_err(|error| error.to_string())?;

        assert!(create_library_directory_at(&root, "../escape").is_err());
        assert!(create_library_directory_at(&root, "已有库").is_err());

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn moves_library_directory_and_preserves_contents() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-move-{}", unix_timestamp()));
        let source_parent = root.join("source");
        let destination_parent = root.join("destination");
        fs::create_dir_all(&source_parent).map_err(|error| error.to_string())?;
        fs::create_dir_all(&destination_parent).map_err(|error| error.to_string())?;
        let source = PathBuf::from(create_library_directory_at(&source_parent, "写作库")?);
        fs::write(source.join("notes").join("想法.md"), "内容")
            .map_err(|error| error.to_string())?;

        let moved = PathBuf::from(move_library_directory_at(&source, &destination_parent)?);

        assert!(!source.exists());
        assert_eq!(
            moved,
            fs::canonicalize(&destination_parent)
                .map_err(|error| error.to_string())?
                .join("写作库")
        );
        assert_eq!(
            fs::read_to_string(moved.join("notes").join("想法.md"))
                .map_err(|error| error.to_string())?,
            "内容"
        );

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
