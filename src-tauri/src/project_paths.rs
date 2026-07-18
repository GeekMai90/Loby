use crate::markdown::safe_visible_path_segment;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn ensure_project_resource_dirs(project_dir: &Path) -> Result<(), String> {
    for directory in ["assets", "references", "exports"] {
        fs::create_dir_all(project_dir.join(directory)).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(project_dir.join("assets").join("images"))
        .map_err(|error| error.to_string())?;
    Ok(())
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

        assert!(root.join("assets").join("images").is_dir());
        assert!(root.join("references").is_dir());
        assert!(root.join("exports").is_dir());
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
