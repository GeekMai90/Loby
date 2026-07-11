mod save;
mod scan;
pub(crate) mod trash;

use crate::models::WritingProject;
pub(crate) use save::save_library_to_path;
use save::write_library_index;
use scan::scan_local_first_library;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const NOTES_PROJECT_ID: &str = "notes-root";
pub(crate) const NOTES_INBOX_GROUP_ID: &str = "notes-inbox";

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

#[cfg(test)]
pub(crate) use save::unix_timestamp;
#[cfg(test)]
pub(crate) use scan::default_notes_project;
