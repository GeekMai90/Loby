//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 ensure_project_resource_dirs、ensure_library_image_dir、resolve_project_content_dir、resolve_project_resource_dir、read_project_id_from_toml
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 ensure_project_resource_dirs、ensure_library_image_dir、resolve_project_content_dir、resolve_project_resource_dir、read_project_id_from_toml
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::library::{INBOX_PROJECT_ID, NOTES_PROJECT_ID};
use crate::markdown::safe_visible_path_segment;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn ensure_project_resource_dirs(project_dir: &Path) -> Result<(), String> {
    for directory in ["assets", "references", "exports"] {
        fs::create_dir_all(project_dir.join(directory)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(crate) fn ensure_library_image_dir(root: &Path) -> Result<PathBuf, String> {
    let image_dir = root.join("assets").join("images");
    fs::create_dir_all(&image_dir).map_err(|error| error.to_string())?;
    Ok(image_dir)
}

pub(crate) fn resolve_project_content_dir(
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

pub(crate) fn resolve_project_resource_dir(
    root: &Path,
    project_id: &str,
    project_title: Option<&str>,
) -> PathBuf {
    if matches!(project_id, INBOX_PROJECT_ID | NOTES_PROJECT_ID) {
        return root.to_path_buf();
    }
    resolve_project_content_dir(root, project_id, project_title)
}

pub(crate) fn read_project_id_from_toml(project_dir: &Path) -> Option<String> {
    let raw = fs::read_to_string(project_dir.join("project.toml")).ok()?;
    let prefix = "id = ";
    raw.lines().find_map(|line| {
        let value = line.trim().strip_prefix(prefix)?;
        Some(value.trim().trim_matches('"').to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("loby-project-paths-{name}-{}", std::process::id()))
    }

    #[test]
    fn resolves_renamed_project_folder_by_stable_id() -> Result<(), String> {
        let root = test_root("resolve");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let project_dir = root.join("projects").join("用户重命名的目录");
        fs::create_dir_all(&project_dir).map_err(|error| error.to_string())?;
        fs::write(
            project_dir.join("project.toml"),
            "[project]\nid = \"project-stable\"\ntitle = \"新标题\"\n",
        )
        .map_err(|error| error.to_string())?;

        assert_eq!(
            resolve_project_content_dir(&root, "project-stable", Some("旧标题")),
            project_dir
        );

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn creates_the_complete_project_resource_shape() -> Result<(), String> {
        let root = test_root("resources");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        ensure_project_resource_dirs(&root)?;

        assert!(root.join("assets").is_dir());
        assert!(root.join("references").is_dir());
        assert!(root.join("exports").is_dir());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn creates_the_shared_library_image_directory() -> Result<(), String> {
        let root = test_root("shared-images");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let image_dir = ensure_library_image_dir(&root)?;

        assert_eq!(image_dir, root.join("assets").join("images"));
        assert!(image_dir.is_dir());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
