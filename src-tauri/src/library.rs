mod project_metadata;
mod save;
mod scan;
pub(crate) mod trash;

use crate::models::{WritingProject, WritingSheet};
pub(crate) use save::save_library_to_path;
use save::write_library_index;
use scan::scan_local_first_library;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const NOTES_PROJECT_ID: &str = "notes-root";
pub(crate) const NOTES_INBOX_GROUP_ID: &str = "notes-inbox";

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
    let index_path = root.join(".nibva").join("library.json");
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
    Ok(documents.join("NibvaLibrary"))
}

fn default_libraries_root() -> Result<PathBuf, String> {
    let documents = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
        .ok_or_else(|| "Cannot locate a Documents directory".to_string())?;
    Ok(documents.join("Nibva Libraries"))
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
    fs::create_dir_all(root.join("notes")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join(".nibva")).map_err(|error| error.to_string())?;
    Ok(root.display().to_string())
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
pub(crate) use scan::default_notes_project;

#[cfg(test)]
mod library_directory_tests {
    use super::*;

    #[test]
    fn creates_named_library_structure() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("nibva-library-create-{}", unix_timestamp()));
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;

        let created = PathBuf::from(create_library_directory_at(&root, "我的写作库")?);
        assert!(created.join("notes").is_dir());
        assert!(created.join("projects").is_dir());
        assert!(created.join(".nibva").is_dir());

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn rejects_unsafe_or_existing_library_names() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("nibva-library-reject-{}", unix_timestamp()));
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
        let root = std::env::temp_dir().join(format!("nibva-library-move-{}", unix_timestamp()));
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
