//! [INPUT]: 依赖显式选择的本地 Skill 目录、SKILL.md、ZIP/.skill 包、格式诊断与 Skill Store 安装入口
//! [OUTPUT]: 提供外部 Skill 预检、安全解包、包清单与复制安装命令
//! [POS]: Agent Skill 领域的导入适配层；只把外部来源转换为受校验的本地包，不参与运行时激活
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::skill_format::{parse_skill, COMPATIBLE, UNSUPPORTED};
use super::skill_store::{canonical_library, find_skill, library_skill_root, set_enabled_value};
use crate::models::{AgentSkill, AgentSkillImportPreview};
use std::fs;
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;

pub(super) const MAX_SKILL_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_SKILL_PACKAGE_BYTES: u64 = 24 * 1024 * 1024;
const MAX_SKILL_FILES: usize = 256;

#[derive(Debug)]
pub(super) struct PackageInventory {
    pub(super) files: Vec<String>,
    total_bytes: u64,
    pub(super) has_scripts: bool,
}

#[tauri::command]
pub(crate) fn inspect_agent_skill_import(
    source_path: String,
) -> Result<AgentSkillImportPreview, String> {
    inspect_import(Path::new(&source_path))
}

#[tauri::command]
pub(crate) fn install_agent_skill(
    app: tauri::AppHandle,
    library_path: String,
    source_path: String,
) -> Result<AgentSkill, String> {
    let library = canonical_library(&library_path)?;
    let source_path = Path::new(&source_path);
    let preview = inspect_import(source_path)?;
    if preview.compatibility == UNSUPPORTED {
        return Err("该 Skill 不符合 Agent Skills 基础规范，不能安装。".to_string());
    }
    let destination_root = library_skill_root(&library);
    fs::create_dir_all(&destination_root).map_err(|error| error.to_string())?;
    let destination = destination_root.join(&preview.name);
    if destination.exists() {
        return Err(format!("Skill“{}”已经安装。", preview.name));
    }

    let staging = destination_root.join(format!(".installing-{}", Uuid::new_v4()));
    let copied = with_source_directory(source_path, |source| copy_package(source, &staging));
    if let Err(error) = copied {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    if let Err(error) = fs::rename(&staging, &destination) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("安装 Skill 失败：{error}"));
    }
    set_enabled_value(
        &library,
        "library",
        &preview.name,
        preview.compatibility == COMPATIBLE,
    )?;
    find_skill(&app, &library, &preview.name)
}

pub(super) fn inspect_import(source_path: &Path) -> Result<AgentSkillImportPreview, String> {
    let canonical_source = source_path
        .canonicalize()
        .map_err(|_| "所选 Skill 路径不存在。".to_string())?;
    with_source_directory(&canonical_source, |directory| {
        inspect_directory(directory, &canonical_source)
    })
}

fn inspect_directory(
    directory: &Path,
    original_source: &Path,
) -> Result<AgentSkillImportPreview, String> {
    let inventory = inventory(directory)?;
    let source = fs::read_to_string(directory.join("SKILL.md"))
        .map_err(|_| "所选目录没有可读取的 SKILL.md。".to_string())?;
    let directory_name = directory
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let parsed = parse_skill(&source, directory_name, inventory.has_scripts);
    Ok(AgentSkillImportPreview {
        source_path: original_source.display().to_string(),
        name: parsed.name,
        description: parsed.description,
        compatibility: parsed.compatibility,
        diagnostics: parsed.diagnostics,
        files: inventory.files,
        has_scripts: inventory.has_scripts,
    })
}

fn resolve_source_directory(path: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|_| "所选 Skill 路径不存在。".to_string())?;
    let directory = if canonical.is_file()
        && canonical.file_name().and_then(|name| name.to_str()) == Some("SKILL.md")
    {
        canonical.parent().map(Path::to_path_buf)
    } else if canonical.is_dir() {
        Some(canonical)
    } else {
        None
    }
    .ok_or_else(|| "请选择包含 SKILL.md 的 Skill 目录。".to_string())?;
    if !directory.join("SKILL.md").is_file() {
        return Err("请选择直接包含 SKILL.md 的 Skill 目录。".to_string());
    }
    Ok(directory)
}

fn with_source_directory<T>(
    path: &Path,
    operation: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let canonical = path
        .canonicalize()
        .map_err(|_| "所选 Skill 路径不存在。".to_string())?;
    if canonical.is_dir()
        || canonical.file_name().and_then(|name| name.to_str()) == Some("SKILL.md")
    {
        let directory = resolve_source_directory(&canonical)?;
        return operation(&directory);
    }
    if !is_skill_archive(&canonical) {
        return Err("请选择 Skill 目录、SKILL.md、.skill 或 .zip 文件。".to_string());
    }
    let temporary = tempfile::tempdir().map_err(|error| error.to_string())?;
    extract_skill_archive(&canonical, temporary.path())?;
    let directory = find_extracted_skill_root(temporary.path())?;
    operation(&directory)
}

fn is_skill_archive(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("skill" | "zip")
    )
}

fn extract_skill_archive(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|_| "Skill 压缩包格式无效。".to_string())?;
    if archive.len() > MAX_SKILL_FILES {
        return Err("Skill 包超过 256 个文件，不能安装。".to_string());
    }
    let mut total_bytes = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err("Skill 压缩包包含符号链接，不能安装。".to_string());
        }
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| "Skill 压缩包包含不安全路径。".to_string())?
            .to_path_buf();
        if enclosed.components().any(|component| {
            matches!(component, Component::Normal(name) if name == ".git" || name == ".DS_Store")
        }) {
            continue;
        }
        let output = destination.join(&enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|error| error.to_string())?;
            continue;
        }
        if entry.size() > MAX_SKILL_FILE_BYTES {
            return Err("Skill 压缩包包含超过 4 MB 的单个文件。".to_string());
        }
        total_bytes = total_bytes.saturating_add(entry.size());
        if total_bytes > MAX_SKILL_PACKAGE_BYTES {
            return Err("Skill 压缩包解压后超过 24 MB。".to_string());
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut target = fs::File::create(&output).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut target).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn find_extracted_skill_root(root: &Path) -> Result<PathBuf, String> {
    if root.join("SKILL.md").is_file() {
        return Ok(root.to_path_buf());
    }
    let mut candidates = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("SKILL.md").is_file())
        .collect::<Vec<_>>();
    candidates.sort();
    if candidates.len() == 1 {
        Ok(candidates.remove(0))
    } else {
        Err("压缩包必须包含一个明确的 Skill 根目录和 SKILL.md。".to_string())
    }
}

pub(super) fn inventory(directory: &Path) -> Result<PackageInventory, String> {
    let mut files = Vec::new();
    let mut total_bytes = 0_u64;
    let mut directories = vec![directory.to_path_buf()];
    while let Some(current) = directories.pop() {
        let mut entries = fs::read_dir(&current)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            if matches!(entry.file_name().to_str(), Some(".git" | ".DS_Store")) {
                continue;
            }
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err("Skill 包含符号链接；为避免读取包外文件，落笔不能安装它。".to_string());
            }
            if metadata.is_dir() {
                directories.push(path);
                continue;
            }
            if !metadata.is_file() || metadata.len() > MAX_SKILL_FILE_BYTES {
                return Err("Skill 包含不受支持的文件或单文件超过 4 MB。".to_string());
            }
            total_bytes = total_bytes.saturating_add(metadata.len());
            let relative = path
                .strip_prefix(directory)
                .map_err(|_| "Skill 路径无效。".to_string())?;
            files.push(relative.to_string_lossy().replace('\\', "/"));
            if files.len() > MAX_SKILL_FILES || total_bytes > MAX_SKILL_PACKAGE_BYTES {
                return Err("Skill 包超过 256 个文件或 24 MB，不能安装。".to_string());
            }
        }
    }
    files.sort();
    let has_scripts = files.iter().any(|path| path.starts_with("scripts/"));
    Ok(PackageInventory {
        files,
        total_bytes,
        has_scripts,
    })
}

fn copy_package(source: &Path, destination: &Path) -> Result<(), String> {
    let package = inventory(source)?;
    if package.total_bytes > MAX_SKILL_PACKAGE_BYTES {
        return Err("Skill 包过大。".to_string());
    }
    fs::create_dir(destination).map_err(|error| error.to_string())?;
    for relative in package.files {
        let relative_path = safe_relative_path(&relative)?;
        let from = source.join(&relative_path);
        let to = destination.join(&relative_path);
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(from, to).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(super) fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value.trim());
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Skill 资源必须使用包内相对路径。".to_string());
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::{inspect_import, inventory, safe_relative_path};
    use std::fs;
    use std::io::Write;

    #[test]
    fn previews_a_standard_skill_package() {
        let directory = tempfile::tempdir().unwrap();
        let skill = directory.path().join("article-polish");
        fs::create_dir_all(skill.join("references")).unwrap();
        fs::write(
            skill.join("SKILL.md"),
            "---\nname: article-polish\ndescription: 轻量润色\n---\n# Workflow",
        )
        .unwrap();
        fs::write(skill.join("references").join("style.md"), "简洁").unwrap();
        let preview = inspect_import(&skill).unwrap();
        assert_eq!(preview.compatibility, "compatible");
        assert_eq!(preview.files, vec!["SKILL.md", "references/style.md"]);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_in_skill_packages() {
        use std::os::unix::fs::symlink;
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join("SKILL.md"), "test").unwrap();
        symlink("SKILL.md", directory.path().join("linked.md")).unwrap();
        assert!(inventory(directory.path()).is_err());
    }

    #[test]
    fn rejects_resource_path_escape() {
        assert!(safe_relative_path("../secret.md").is_err());
        assert!(safe_relative_path("references/style.md").is_ok());
    }

    #[test]
    fn previews_a_skill_archive_without_trusting_archive_paths() {
        let directory = tempfile::tempdir().unwrap();
        let archive_path = directory.path().join("archive-skill.skill");
        let file = fs::File::create(&archive_path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file(
                "archive-skill/SKILL.md",
                zip::write::SimpleFileOptions::default(),
            )
            .unwrap();
        archive
            .write_all(b"---\nname: archive-skill\ndescription: Archive test\n---\n# Workflow")
            .unwrap();
        archive.finish().unwrap();

        let preview = inspect_import(&archive_path).unwrap();
        assert_eq!(preview.name, "archive-skill");
        assert_eq!(preview.compatibility, "compatible");
        assert_eq!(
            preview.source_path,
            archive_path.canonicalize().unwrap().display().to_string()
        );
    }
}
