//! [INPUT]: 依赖 library 子模块、写作库 models、std fs/path 与用户 Documents 目录解析
//! [OUTPUT]: 向 crate 提供写作库创建/校验/空目录初始化/加载、整库与单文稿 revision 保存、重建索引、Base32 文稿公开 ID、含收藏与置顶元数据的偏好/回收站/监听/写作活动与系统项目常量
//! [POS]: 本地写作库领域，封装扫描、保存、偏好、活动记录、监听与回收站
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
mod active_library;
mod document_id;
pub(crate) mod library_preferences_store;
mod project_metadata;
mod save;
mod scan;
pub(crate) mod trash;
pub(crate) mod watcher;
pub(crate) mod writing_activity_store;

use crate::fs_paths::write_if_changed;
use crate::models::{
    DocumentProjectContext, DocumentSaveReceipt, ProjectGoal, ProjectGroup, ProjectWritingBrief,
    WritingProject, WritingSheet,
};
#[cfg(test)]
pub(crate) use document_id::canonical_sheet_id_from_uuid_bytes;
pub(crate) use document_id::sheet_public_id;
use save::write_library_index;
pub(crate) use save::{save_document_to_path, save_library_metadata_to_path, save_library_to_path};
use scan::{scan_local_first_library, scan_local_first_library_repairing_ids};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const NOTES_PROJECT_ID: &str = "notes-root";
pub(crate) const NOTES_QUICK_GROUP_ID: &str = "notes-quick";
pub(crate) const INBOX_PROJECT_ID: &str = "inbox-root";
pub(crate) const INBOX_GROUP_ID: &str = "inbox-default";
const STARTER_PROJECT_ID: &str = "loby-guide";
const STARTER_GROUP_ID: &str = "group-default";
const STARTER_SHEET_ID: &str = "sheet-00000000000000000000000001";
const STARTER_SHEET_DATE: &str = "2026-07-11";
const DEFAULT_LIBRARY_DIRECTORY_NAME: &str = "LobyLibrary";
#[cfg(test)]
const STARTER_SHEET_IMAGE_PATH: &str = "../../../assets/images/loby-welcome-cover.webp";
const STARTER_SHEET_IMAGE_BYTES: &[u8] = include_bytes!("library/loby-welcome-cover.webp");
const STARTER_SHEET_BODY: &str = r#"# 欢迎使用落笔写作 👋

![Every 风格的落笔写作封面图：人手执笔掌控本地文稿，机械助手整理卡片](../../../assets/images/loby-welcome-cover.webp)

欢迎使用落笔写作。落笔是一款本地优先的写作应用，专注于让你更专注地思考、记录与表达。你的文章以 Markdown 文件保存在本地，内容始终由你掌控，即使离开落笔，也能继续使用熟悉的工具打开和编辑。

在落笔中，你可以像使用普通编辑器一样自由写作，不需要额外学习就可以轻松上手，也可以让 AI 协助你整理思路、润色文字和完善表达，但始终谨记，不要让 AI 代替你思考。

我们为你细心的准备了一份快速上手笔记，点击你感兴趣的链接就可以直达相关功能介绍。

## 落笔入门指南

### 如何创建新文稿

单击文稿列表顶部的新建文稿按钮（⌘+N）并开始输入。每篇文稿的第一行是标题，文稿名称会与标题同步，接下来的内容就任由你发挥了！

### Markdown 编辑器

落笔采用的是一种“源文档优先的即时渲染 Markdown 编辑器”。它不像传统源码编辑器那样让你面对完整的 Markdown 标记，也不像源码与预览分栏的编辑器那样需要在两个区域之间来回切换；标题、列表、引用等 Markdown 语法会直接在当前编辑区域中呈现出接近最终文章的视觉效果，同时保留 Markdown 文件清晰、开放、可迁移的结构，让写作过程自然流畅，又不会失去对文档本身的控制。

### 添加文字样式

你可以为文本添加各种样式，包括：**粗体**、*斜体*、~下划线~、~~删除线~~、==高亮==、标题、[链接](https://loby.geekmailab.com)、列表、待办事项、表格等——这一切都可以通过标准 Markdown 来实现，当然我们也是支持样式栏和快捷键的。

### 如何管理文章

落笔采用“项目 → 分组 → 文章”的层级方式管理内容。你可以先按照写作方向建立项目，再在项目中创建不同分组，最后将具体文章归入对应位置，让零散的灵感、系列文章和长期写作计划都拥有清晰的归属。这样的组织方式既便于快速查找和整理，也让本地文件结构保持直观、稳定，随着文章不断增加，依然能够轻松维护。

- 还没想好归属的文章，可以先放进全局“收件箱”。
- 已经确定主题的内容，可以创建项目并在项目中继续整理。
- 临时想法和灵感，可以通过“随手记”快速保存。

落笔有很多实用的功能等你来探索，但掌握以上这些就可以开始写作啦！愿落笔陪你把每一个想法写下来、沉淀好，并一步一步变成真正有价值的作品。
"#;

#[tauri::command]
pub(crate) fn default_libraries_path() -> Result<String, String> {
    Ok(documents_root()?.display().to_string())
}

#[tauri::command]
pub(crate) fn create_library_directory(
    name: String,
    parent_path: Option<String>,
) -> Result<String, String> {
    let parent = match parent_path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => documents_root()?,
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
    load_active_library_from_path(library_root()?)
}

#[tauri::command]
pub(crate) fn load_library_at(path: String) -> Result<Vec<WritingProject>, String> {
    load_active_library_from_path(PathBuf::from(path))
}

#[tauri::command]
pub(crate) fn validate_existing_library_directory(path: String) -> Result<String, String> {
    validate_existing_library_directory_at(Path::new(&path))
}

#[tauri::command]
pub(crate) fn prepare_library_directory(path: String) -> Result<String, String> {
    prepare_library_directory_at(Path::new(&path))
}

fn validate_existing_library_directory_at(path: &Path) -> Result<String, String> {
    let root =
        fs::canonicalize(path).map_err(|error| format!("无法读取所选写作文件夹：{error}"))?;
    if !root.is_dir() {
        return Err("所选路径不是文件夹。".to_string());
    }

    if !has_library_structure(&root) {
        return Err(
            "所选文件夹不是落笔写作文件夹。请选择包含 .loby，或同时包含 inbox、notes、projects 的文件夹。"
                .to_string(),
        );
    }

    Ok(root.display().to_string())
}

fn prepare_library_directory_at(path: &Path) -> Result<String, String> {
    let root =
        fs::canonicalize(path).map_err(|error| format!("无法读取所选写作文件夹：{error}"))?;
    if !root.is_dir() {
        return Err("所选路径不是文件夹。".to_string());
    }
    if has_library_structure(&root) {
        return Ok(root.display().to_string());
    }
    if root
        .read_dir()
        .map_err(|error| format!("无法读取所选写作文件夹：{error}"))?
        .next()
        .is_some()
    {
        return Err(
            "所选文件夹不是落笔写作文件夹，并且不是空文件夹。请选择已有写作文件夹或空文件夹。"
                .to_string(),
        );
    }
    initialize_library_directory_at(&root)?;
    Ok(root.display().to_string())
}

fn has_library_structure(root: &Path) -> bool {
    root.join(".loby").is_dir()
        || ["inbox", "notes", "projects"]
            .iter()
            .all(|name| root.join(name).is_dir())
}

pub(crate) fn load_library_from_path(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    let indexed_projects = load_library_index(&root)?;
    scan_local_first_library(&root, &indexed_projects)
}

fn load_active_library_from_path(root: PathBuf) -> Result<Vec<WritingProject>, String> {
    let projects = load_library_from_path(root.clone())?;
    let _ = active_library::record_active_library(&root);
    Ok(projects)
}

#[tauri::command]
pub(crate) fn rebuild_library_index(
    path: String,
    repair_sheet_ids: Option<bool>,
) -> Result<LibraryRebuildResult, String> {
    let root = PathBuf::from(path);
    if repair_sheet_ids.unwrap_or(false) {
        rebuild_library_index_with_id_repair_at(root)
    } else {
        let projects = rebuild_library_index_at(root)?;
        Ok(LibraryRebuildResult::without_id_changes(projects))
    }
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LibraryRebuildResult {
    projects: Vec<WritingProject>,
    indexed_sheet_count: usize,
    migrated_sheet_count: usize,
    id_changes: Vec<document_id::SheetIdChange>,
}

impl LibraryRebuildResult {
    fn without_id_changes(projects: Vec<WritingProject>) -> Self {
        let indexed_sheet_count = projects.iter().map(|project| project.sheets.len()).sum();
        Self {
            projects,
            indexed_sheet_count,
            migrated_sheet_count: 0,
            id_changes: Vec::new(),
        }
    }
}

fn rebuild_library_index_with_id_repair_at(root: PathBuf) -> Result<LibraryRebuildResult, String> {
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;

    let indexed_projects = load_library_index(&root)?;
    let (projects, id_changes) = scan_local_first_library_repairing_ids(&root, &indexed_projects)?;
    document_id::migrate_known_sheet_references(&root, &id_changes)?;
    write_library_index(&root, &projects)?;

    let indexed_sheet_count = projects.iter().map(|project| project.sheets.len()).sum();
    Ok(LibraryRebuildResult {
        projects,
        indexed_sheet_count,
        migrated_sheet_count: id_changes.len(),
        id_changes,
    })
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
pub(crate) fn save_document_at(
    path: String,
    project: DocumentProjectContext,
    sheet: WritingSheet,
    revision: u64,
) -> Result<DocumentSaveReceipt, String> {
    save_document_to_path(PathBuf::from(path), project, sheet, revision)
}

#[tauri::command]
pub(crate) fn save_library_metadata_at(
    path: String,
    projects: Vec<WritingProject>,
) -> Result<String, String> {
    save_library_metadata_to_path(PathBuf::from(path), projects)
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
    Ok(documents_root()?.join(DEFAULT_LIBRARY_DIRECTORY_NAME))
}

fn documents_root() -> Result<PathBuf, String> {
    let documents = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
        .ok_or_else(|| "Cannot locate a Documents directory".to_string())?;
    Ok(documents)
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
            return Err("同名文件夹已经存在。请更换名称，或使用“切换写作文件夹”。".to_string());
        }
    }
    initialize_library_directory_at(&root)?;
    Ok(root.display().to_string())
}

fn initialize_library_directory_at(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root.join("inbox")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join(".loby")).map_err(|error| error.to_string())?;
    save_library_to_path(root.to_path_buf(), vec![starter_project()])?;
    write_if_changed(
        &root
            .join("assets")
            .join("images")
            .join("loby-welcome-cover.webp"),
        STARTER_SHEET_IMAGE_BYTES,
    )?;
    Ok(())
}

fn starter_project() -> WritingProject {
    WritingProject {
        id: STARTER_PROJECT_ID.to_string(),
        title: "落笔指南".to_string(),
        icon: "book".to_string(),
        icon_color: "#007aff".to_string(),
        status: "构思".to_string(),
        project_goal: ProjectGoal::default(),
        groups: vec![ProjectGroup {
            id: STARTER_GROUP_ID.to_string(),
            title: "待整理".to_string(),
            icon: "library".to_string(),
            icon_color: "#007aff".to_string(),
            description: String::new(),
        }],
        sheets: vec![WritingSheet {
            id: STARTER_SHEET_ID.to_string(),
            title: "欢迎使用落笔写作 👋".to_string(),
            favorite: false,
            pinned: false,
            group_id: STARTER_GROUP_ID.to_string(),
            legacy_status: String::new(),
            tags: vec!["落笔".to_string(), "使用指南".to_string()],
            target_words: 0,
            description: "了解落笔的本地写作方式，以及收件箱、项目和随手记的基本用途。".to_string(),
            body: STARTER_SHEET_BODY.to_string(),
            created_at: STARTER_SHEET_DATE.to_string(),
            updated_at: STARTER_SHEET_DATE.to_string(),
            properties: Default::default(),
            archived_at: String::new(),
            versions: Vec::new(),
            publications: Default::default(),
        }],
        updated_at: String::new(),
        document_property_definitions: Vec::new(),
        archived_at: String::new(),
        publishing_checklist: Vec::new(),
        export_history: Vec::new(),
        writing_brief: ProjectWritingBrief::default(),
        publishing_binding: None,
    }
}

fn move_library_directory_at(source: &Path, destination_parent: &Path) -> Result<String, String> {
    let source =
        fs::canonicalize(source).map_err(|error| format!("无法读取写作文件夹：{error}"))?;
    if !source.is_dir() {
        return Err("写作文件夹路径不是文件夹。".to_string());
    }

    let destination_parent = fs::canonicalize(destination_parent)
        .map_err(|error| format!("无法读取目标位置：{error}"))?;
    if !destination_parent.is_dir() {
        return Err("目标位置不是文件夹。".to_string());
    }
    if destination_parent.starts_with(&source) {
        return Err("不能把写作文件夹移动到它自己的内部。".to_string());
    }

    let directory_name = source
        .file_name()
        .ok_or_else(|| "无法确定写作文件夹名称。".to_string())?;
    let destination = destination_parent.join(directory_name);
    if destination == source {
        return Ok(source.display().to_string());
    }
    if destination.exists() {
        return Err("目标位置已经存在同名文件夹。".to_string());
    }

    fs::rename(&source, &destination).map_err(|error| format!("移动写作文件夹失败：{error}"))?;
    let _ = active_library::relocate_active_library(&source, &destination);
    Ok(destination.display().to_string())
}

fn validate_library_name(value: &str) -> Result<&str, String> {
    let name = value.trim();
    if name.is_empty() {
        return Err("写作文件夹名称不能为空。".to_string());
    }
    if name == "." || name == ".." {
        return Err("写作文件夹名称无效。".to_string());
    }
    if name.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err("写作文件夹名称不能包含路径或系统保留字符。".to_string());
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
    fn validates_existing_loby_and_legacy_library_structures() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-validate-{}", unix_timestamp()));
        let metadata_library = root.join("metadata-library");
        let legacy_library = root.join("legacy-library");
        let ordinary_folder = root.join("ordinary-folder");
        fs::create_dir_all(metadata_library.join(".loby")).map_err(|error| error.to_string())?;
        for directory in ["inbox", "notes", "projects"] {
            fs::create_dir_all(legacy_library.join(directory))
                .map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&ordinary_folder).map_err(|error| error.to_string())?;

        assert_eq!(
            PathBuf::from(validate_existing_library_directory_at(&metadata_library)?),
            fs::canonicalize(&metadata_library).map_err(|error| error.to_string())?
        );
        assert!(validate_existing_library_directory_at(&legacy_library).is_ok());
        assert!(validate_existing_library_directory_at(&ordinary_folder).is_err());
        assert!(validate_existing_library_directory_at(&root.join("missing")).is_err());

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn creates_named_library_structure() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-create-{}", unix_timestamp()));
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;

        let created = PathBuf::from(create_library_directory_at(&root, "我的写作库")?);
        assert!(created.join("inbox").is_dir());
        assert!(created.join("notes").is_dir());
        assert!(created.join("projects").is_dir());
        assert!(created.join(".loby").is_dir());
        let projects = load_library_from_path(created.clone())?;
        let guide = projects
            .iter()
            .find(|project| project.id == STARTER_PROJECT_ID)
            .ok_or_else(|| "没有找到内置的落笔指南".to_string())?;
        let welcome = guide
            .sheets
            .iter()
            .find(|sheet| sheet.id == STARTER_SHEET_ID)
            .ok_or_else(|| "没有找到落笔指南文稿".to_string())?;
        assert_eq!(welcome.group_id, STARTER_GROUP_ID);
        assert_eq!(welcome.title, "欢迎使用落笔写作 👋");
        assert!(welcome.body.contains(STARTER_SHEET_IMAGE_PATH));
        assert_eq!(welcome.created_at, STARTER_SHEET_DATE);
        assert_eq!(welcome.updated_at, STARTER_SHEET_DATE);
        assert_eq!(welcome.tags, ["落笔", "使用指南"]);
        assert_eq!(
            fs::read(created.join("assets/images/loby-welcome-cover.webp"))
                .map_err(|error| error.to_string())?,
            STARTER_SHEET_IMAGE_BYTES
        );

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn prepares_an_empty_folder_but_rejects_an_ordinary_non_empty_folder() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("loby-library-prepare-{}", unix_timestamp()));
        let empty_folder = root.join("empty-folder");
        let ordinary_folder = root.join("ordinary-folder");
        fs::create_dir_all(&empty_folder).map_err(|error| error.to_string())?;
        fs::create_dir_all(&ordinary_folder).map_err(|error| error.to_string())?;
        fs::write(ordinary_folder.join("notes.txt"), "not a loby library")
            .map_err(|error| error.to_string())?;

        let prepared = PathBuf::from(prepare_library_directory_at(&empty_folder)?);
        assert!(prepared.join(".loby").is_dir());
        assert!(prepared.join("inbox").is_dir());
        assert!(prepared.join("notes").is_dir());
        assert!(prepared.join("projects").is_dir());
        assert!(prepare_library_directory_at(&ordinary_folder).is_err());

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn rebuild_repairs_legacy_sheet_ids_and_local_references() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-library-id-repair-{}-{}",
            std::process::id(),
            unix_timestamp()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let project_dir = root.join("projects").join("博客");
        fs::create_dir_all(&project_dir).map_err(|error| error.to_string())?;
        fs::write(
            project_dir.join("已发布.md"),
            "---\ntitle: 已发布\nlobySheet: true\nloby:\n  id: sheet-legacy\n  blog:\n    slug: existing-url\n    url: https://example.com/posts/existing-url/\n---\n\n# 已发布\n\n正文",
        )
        .map_err(|error| error.to_string())?;
        fs::write(project_dir.join("无元数据.md"), "# 无元数据\n\n正文")
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(root.join(".loby").join("activity"))
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(root.join(".loby").join("ai")).map_err(|error| error.to_string())?;
        fs::write(
            root.join(".loby").join("preferences.json"),
            r#"{"version":1,"lastSheetId":"sheet-legacy","sheetManualOrders":{"project":["sheet-legacy"]}}"#,
        )
        .map_err(|error| error.to_string())?;
        fs::write(
            root.join(".loby")
                .join("activity")
                .join("writing-activity.json"),
            r#"{"version":1,"checkIns":[{"sheetId":"sheet-legacy"}],"celebratedTargets":{"sheet-legacy":[500]}}"#,
        )
        .map_err(|error| error.to_string())?;
        fs::write(
            root.join(".loby").join("ai").join("conversations.json"),
            r#"[{"id":"chat","messages":[{"contexts":[{"sheetId":"sheet-legacy"}]}]}]"#,
        )
        .map_err(|error| error.to_string())?;

        let result = rebuild_library_index_with_id_repair_at(root.clone())?;
        assert_eq!(result.migrated_sheet_count, 2);
        let sheet = result
            .projects
            .iter()
            .find(|project| project.title == "博客")
            .and_then(|project| project.sheets.iter().find(|sheet| sheet.title == "已发布"))
            .ok_or_else(|| "没有找到迁移后的文稿".to_string())?;
        assert!(document_id::is_canonical_sheet_id(&sheet.id));
        assert_eq!(
            sheet
                .publications
                .get("github-blog")
                .map(|item| item.slug.as_str()),
            Some("existing-url")
        );
        assert_eq!(
            sheet
                .publications
                .get("github-blog")
                .map(|item| item.source_id.as_str()),
            Some("sheet-legacy")
        );

        for relative_path in [
            ".loby/preferences.json",
            ".loby/activity/writing-activity.json",
            ".loby/ai/conversations.json",
        ] {
            let migrated =
                fs::read_to_string(root.join(relative_path)).map_err(|error| error.to_string())?;
            assert!(!migrated.contains("sheet-legacy"));
            assert!(migrated.contains(&sheet.id));
        }
        let markdown =
            fs::read_to_string(project_dir.join("已发布.md")).map_err(|error| error.to_string())?;
        assert!(markdown.contains(&format!("id: {}", sheet.id)));
        assert!(markdown.contains("sourceId: sheet-legacy"));
        let metadata_free_sheet = result
            .projects
            .iter()
            .find(|project| project.title == "博客")
            .and_then(|project| {
                project
                    .sheets
                    .iter()
                    .find(|sheet| sheet.title == "无元数据")
            })
            .ok_or_else(|| "没有找到补齐元数据的文稿".to_string())?;
        assert!(document_id::is_canonical_sheet_id(&metadata_free_sheet.id));
        let metadata_free_markdown = fs::read_to_string(project_dir.join("无元数据.md"))
            .map_err(|error| error.to_string())?;
        assert!(metadata_free_markdown.contains(&format!("id: {}", metadata_free_sheet.id)));

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn uses_the_compact_default_library_directory_name() -> Result<(), String> {
        assert_eq!(
            library_root()?.file_name().and_then(|name| name.to_str()),
            Some("LobyLibrary")
        );
        Ok(())
    }

    #[test]
    fn offers_documents_as_the_first_run_parent() -> Result<(), String> {
        assert_eq!(
            PathBuf::from(default_libraries_path()?).join(DEFAULT_LIBRARY_DIRECTORY_NAME),
            library_root()?
        );
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
