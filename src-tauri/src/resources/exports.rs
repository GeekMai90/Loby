use crate::fs_paths::{safe_export_filename, safe_relative_path};
use crate::models::{ProjectExportBundleAsset, ProjectExportBundleFile};
use crate::project_paths::{ensure_project_resource_dirs, resolve_project_content_dir};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn save_project_export(
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
pub(crate) fn save_project_export_bundle(
    path: String,
    project_id: String,
    project_title: String,
    directory_name: String,
    files: Vec<ProjectExportBundleFile>,
    assets: Vec<ProjectExportBundleAsset>,
) -> Result<String, String> {
    let (files, assets) = validate_bundle_entries(files, assets)?;
    let root = PathBuf::from(path);
    let project_dir = resolve_project_content_dir(&root, &project_id, Some(&project_title));
    ensure_project_resource_dirs(&project_dir)?;
    let bundle_name = safe_export_filename(&directory_name);
    let bundle_dir = project_dir.join("exports").join(bundle_name);
    fs::create_dir_all(&bundle_dir).map_err(|error| error.to_string())?;

    for (relative_path, content) in files {
        let destination = bundle_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(destination, content).map_err(|error| error.to_string())?;
    }

    for (relative_path, source) in assets {
        if !source.is_file() {
            continue;
        }
        let destination = bundle_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(source, destination).map_err(|error| error.to_string())?;
    }

    Ok(bundle_dir.display().to_string())
}

type ValidatedBundleFiles = Vec<(PathBuf, String)>;
type ValidatedBundleAssets = Vec<(PathBuf, PathBuf)>;

fn validate_bundle_entries(
    files: Vec<ProjectExportBundleFile>,
    assets: Vec<ProjectExportBundleAsset>,
) -> Result<(ValidatedBundleFiles, ValidatedBundleAssets), String> {
    let mut destinations = HashSet::new();
    let mut validated_files = Vec::with_capacity(files.len());
    let mut validated_assets = Vec::with_capacity(assets.len());

    for file in files {
        let relative_path = safe_relative_path(&file.relative_path)?;
        ensure_unique_destination(&mut destinations, &relative_path)?;
        validated_files.push((relative_path, file.content));
    }
    for asset in assets {
        let relative_path = safe_relative_path(&asset.relative_path)?;
        ensure_unique_destination(&mut destinations, &relative_path)?;
        validated_assets.push((relative_path, PathBuf::from(asset.source_path)));
    }

    Ok((validated_files, validated_assets))
}

fn ensure_unique_destination(
    destinations: &mut HashSet<String>,
    relative_path: &Path,
) -> Result<(), String> {
    let portable_key = relative_path
        .to_string_lossy()
        .replace('\\', "/")
        .to_lowercase();
    if destinations.insert(portable_key) {
        Ok(())
    } else {
        Err(format!(
            "Duplicate export bundle path: {}",
            relative_path.display()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("loby-export-bundle-{name}-{}", std::process::id()))
    }

    #[test]
    fn writes_nested_bundle_files_and_assets() -> Result<(), String> {
        let root = test_root("nested");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;
        let source = root.join("source.png");
        fs::write(&source, b"image-bytes").map_err(|error| error.to_string())?;

        let saved = save_project_export_bundle(
            root.display().to_string(),
            "project-one".to_string(),
            "Project One".to_string(),
            "article-bundle".to_string(),
            vec![
                ProjectExportBundleFile {
                    relative_path: "index.html".to_string(),
                    content: "<main>Article</main>".to_string(),
                },
                ProjectExportBundleFile {
                    relative_path: "styles/article.css".to_string(),
                    content: "main { color: black; }".to_string(),
                },
            ],
            vec![ProjectExportBundleAsset {
                source_path: source.display().to_string(),
                relative_path: "assets/images/cover.png".to_string(),
            }],
        )?;
        let bundle = PathBuf::from(saved);

        assert_eq!(
            fs::read_to_string(bundle.join("index.html")).map_err(|error| error.to_string())?,
            "<main>Article</main>"
        );
        assert!(bundle.join("styles").join("article.css").is_file());
        assert_eq!(
            fs::read(bundle.join("assets").join("images").join("cover.png"))
                .map_err(|error| error.to_string())?,
            b"image-bytes"
        );

        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn rejects_unsafe_paths_before_creating_a_partial_bundle() -> Result<(), String> {
        let root = test_root("unsafe");
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }

        let result = save_project_export_bundle(
            root.display().to_string(),
            "project-one".to_string(),
            "Project One".to_string(),
            "article-bundle".to_string(),
            vec![
                ProjectExportBundleFile {
                    relative_path: "index.html".to_string(),
                    content: "safe".to_string(),
                },
                ProjectExportBundleFile {
                    relative_path: "../outside.html".to_string(),
                    content: "unsafe".to_string(),
                },
            ],
            Vec::new(),
        );

        assert!(result.is_err());
        assert!(!root.join("projects").exists());
        assert!(!root.join("outside.html").exists());
        Ok(())
    }

    #[test]
    fn rejects_duplicate_file_and_asset_destinations() -> Result<(), String> {
        let files = vec![ProjectExportBundleFile {
            relative_path: "assets/cover.png".to_string(),
            content: "generated".to_string(),
        }];
        let assets = vec![ProjectExportBundleAsset {
            source_path: "/tmp/source.png".to_string(),
            relative_path: "Assets/Cover.png".to_string(),
        }];

        let result = validate_bundle_entries(files, assets);

        assert!(result
            .expect_err("duplicate bundle paths must be rejected")
            .contains("Duplicate export bundle path"));
        Ok(())
    }
}
