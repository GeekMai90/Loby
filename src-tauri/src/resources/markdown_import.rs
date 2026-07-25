//! [INPUT]: 依赖 resources::images 的内容去重导入、fs_paths 的文件类型边界、serde YAML/JSON 与受控本地文件系统
//! [OUTPUT]: 向 crate 提供 scan_markdown_import、import_markdown_images 及其扫描/传输契约
//! [POS]: resources 的 Markdown 导入领域，负责只读发现来源、识别 Obsidian Vault、解析附件位置并复制已确认图片，不决定文稿属性语义
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::images;
use crate::fs_paths::{
    is_hidden_path, is_image_file_extension, is_markdown_import_extension, safe_resource_filename,
};
use crate::project_paths::ensure_library_image_dir;
use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_IMPORT_DOCUMENTS: usize = 5_000;
const MAX_IMPORT_DOCUMENT_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownImportScan {
    pub(crate) source_paths: Vec<String>,
    pub(crate) source_type: String,
    pub(crate) vault_root: String,
    pub(crate) attachment_root: String,
    pub(crate) documents: Vec<MarkdownImportDocument>,
    pub(crate) skipped_file_count: usize,
    pub(crate) resolved_image_count: usize,
    pub(crate) external_image_count: usize,
    pub(crate) missing_image_count: usize,
    pub(crate) ambiguous_image_count: usize,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownImportDocument {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) relative_path: String,
    pub(crate) body: String,
    pub(crate) metadata: JsonValue,
    pub(crate) size_bytes: u64,
    pub(crate) created_time_ms: Option<u64>,
    pub(crate) modified_time_ms: Option<u64>,
    pub(crate) image_references: Vec<MarkdownImportImageReference>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownImportImageReference {
    pub(crate) target: String,
    pub(crate) format: String,
    pub(crate) status: String,
    pub(crate) source_path: String,
    pub(crate) candidate_paths: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownImportImageSource {
    pub(crate) source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownImportImageTransfer {
    pub(crate) source_path: String,
    pub(crate) destination_path: String,
}

struct SourceDocument {
    path: PathBuf,
    relative_path: String,
    vault_root: Option<PathBuf>,
    attachment_root: Option<PathBuf>,
}

#[tauri::command]
pub(crate) async fn scan_markdown_import(
    source_paths: Vec<String>,
    attachment_path: Option<String>,
) -> Result<MarkdownImportScan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_markdown_import_blocking(source_paths, attachment_path)
    })
    .await
    .map_err(|error| format!("Markdown 扫描任务失败：{error}"))?
}

fn scan_markdown_import_blocking(
    source_paths: Vec<String>,
    attachment_path: Option<String>,
) -> Result<MarkdownImportScan, String> {
    if source_paths.is_empty() {
        return Err("请选择要导入的 Markdown 文件或文件夹。".to_string());
    }

    let explicit_attachment_root = attachment_path
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .map(|path| canonical_directory(&path, "补充附件目录"))
        .transpose()?;
    let mut skipped_file_count = 0;
    let mut sources = collect_source_documents(&source_paths, &mut skipped_file_count)?;
    if sources.is_empty() {
        return Err("所选位置没有可导入的 Markdown 文稿。".to_string());
    }
    if sources.len() > MAX_IMPORT_DOCUMENTS {
        return Err(format!(
            "一次最多导入 {MAX_IMPORT_DOCUMENTS} 篇文稿，当前发现 {} 篇。",
            sources.len()
        ));
    }

    for source in &mut sources {
        source.vault_root = find_obsidian_vault(&source.path);
        source.attachment_root = explicit_attachment_root.clone().or_else(|| {
            source
                .vault_root
                .as_deref()
                .and_then(read_obsidian_attachment_root)
        });
    }

    let mut attachment_indexes = HashMap::<PathBuf, HashMap<String, Vec<PathBuf>>>::new();
    for root in sources
        .iter()
        .filter_map(|source| source.attachment_root.clone())
    {
        if !attachment_indexes.contains_key(&root) {
            attachment_indexes.insert(root.clone(), build_filename_index(&root)?);
        }
    }

    let mut documents = Vec::with_capacity(sources.len());
    let mut warnings = Vec::new();
    let mut resolved_image_count = 0;
    let mut external_image_count = 0;
    let mut missing_image_count = 0;
    let mut ambiguous_image_count = 0;

    for source in sources {
        let file_metadata = fs::metadata(&source.path).map_err(|error| error.to_string())?;
        if file_metadata.len() > MAX_IMPORT_DOCUMENT_BYTES {
            return Err(format!(
                "文稿超过 20 MB，无法导入：{}",
                source.path.display()
            ));
        }
        let raw = fs::read_to_string(&source.path)
            .map_err(|error| format!("无法读取 {}：{error}", source.path.display()))?;
        let (metadata, body, frontmatter_warning) = parse_frontmatter(&raw);
        if let Some(warning) = frontmatter_warning {
            warnings.push(format!("{}：{warning}", source.relative_path));
        }
        let image_references = collect_image_targets(body)
            .into_iter()
            .map(|(target, format)| {
                let reference = resolve_image_reference(
                    &source.path,
                    source.vault_root.as_deref(),
                    source.attachment_root.as_deref(),
                    &attachment_indexes,
                    target,
                    format,
                );
                match reference.status.as_str() {
                    "resolved" => resolved_image_count += 1,
                    "external" => external_image_count += 1,
                    "ambiguous" => ambiguous_image_count += 1,
                    _ => missing_image_count += 1,
                }
                reference
            })
            .collect();
        let name = source
            .path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("imported.md")
            .to_string();
        documents.push(MarkdownImportDocument {
            name,
            path: source.path.display().to_string(),
            relative_path: source.relative_path,
            body: body.to_string(),
            metadata,
            size_bytes: file_metadata.len(),
            created_time_ms: file_metadata.created().ok().and_then(system_time_millis),
            modified_time_ms: file_metadata.modified().ok().and_then(system_time_millis),
            image_references,
        });
    }

    let detected_vault_roots = documents
        .iter()
        .filter_map(|document| find_obsidian_vault(Path::new(&document.path)))
        .collect::<Vec<_>>();
    let source_type = if detected_vault_roots.is_empty() {
        "markdown"
    } else {
        "obsidian"
    }
    .to_string();
    let vault_roots = sources_common_path(detected_vault_roots.into_iter());
    let attachment_roots = sources_common_path(documents.iter().filter_map(|document| {
        explicit_attachment_root.clone().or_else(|| {
            find_obsidian_vault(Path::new(&document.path))
                .as_deref()
                .and_then(read_obsidian_attachment_root)
        })
    }));
    Ok(MarkdownImportScan {
        source_paths,
        source_type,
        vault_root: display_optional_path(vault_roots.as_deref()),
        attachment_root: display_optional_path(attachment_roots.as_deref()),
        documents,
        skipped_file_count,
        resolved_image_count,
        external_image_count,
        missing_image_count,
        ambiguous_image_count,
        warnings,
    })
}

#[tauri::command]
pub(crate) async fn import_markdown_images(
    path: String,
    images: Vec<MarkdownImportImageSource>,
) -> Result<Vec<MarkdownImportImageTransfer>, String> {
    tauri::async_runtime::spawn_blocking(move || import_markdown_images_blocking(path, images))
        .await
        .map_err(|error| format!("Markdown 图片导入任务失败：{error}"))?
}

fn import_markdown_images_blocking(
    path: String,
    images: Vec<MarkdownImportImageSource>,
) -> Result<Vec<MarkdownImportImageTransfer>, String> {
    let library_root = PathBuf::from(path);
    let target_dir = ensure_library_image_dir(&library_root)?;
    let mut seen = HashSet::new();
    let mut transfers = Vec::new();

    for image in images {
        let source = PathBuf::from(&image.source_path);
        let canonical_source = source
            .canonicalize()
            .map_err(|error| format!("无法读取图片 {}：{error}", source.display()))?;
        if !canonical_source.is_file() || !is_image_file_extension(&canonical_source) {
            return Err(format!(
                "不是受支持的图片文件：{}",
                canonical_source.display()
            ));
        }
        if !seen.insert(canonical_source.clone()) {
            continue;
        }
        let filename = canonical_source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image");
        let destination = images::import_image_file(
            &target_dir,
            &canonical_source,
            &safe_resource_filename(filename),
        )?;
        transfers.push(MarkdownImportImageTransfer {
            source_path: canonical_source.display().to_string(),
            destination_path: destination.display().to_string(),
        });
    }

    Ok(transfers)
}

fn collect_source_documents(
    source_paths: &[String],
    skipped_file_count: &mut usize,
) -> Result<Vec<SourceDocument>, String> {
    let mut documents = Vec::new();
    let mut seen = HashSet::new();
    for value in source_paths {
        let selected = PathBuf::from(value);
        let canonical = selected
            .canonicalize()
            .map_err(|error| format!("无法访问 {}：{error}", selected.display()))?;
        if canonical.is_file() {
            if !is_markdown_import_extension(&canonical) {
                return Err(format!(
                    "不是受支持的 Markdown 文件：{}",
                    canonical.display()
                ));
            }
            if seen.insert(canonical.clone()) {
                documents.push(SourceDocument {
                    relative_path: canonical
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("imported.md")
                        .to_string(),
                    path: canonical,
                    vault_root: None,
                    attachment_root: None,
                });
            }
            continue;
        }
        if !canonical.is_dir() {
            return Err(format!("不是文件或文件夹：{}", canonical.display()));
        }
        collect_directory_documents(
            &canonical,
            &canonical,
            &mut seen,
            &mut documents,
            skipped_file_count,
        )?;
    }
    documents.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(documents)
}

fn collect_directory_documents(
    root: &Path,
    current: &Path,
    seen: &mut HashSet<PathBuf>,
    documents: &mut Vec<SourceDocument>,
    skipped_file_count: &mut usize,
) -> Result<(), String> {
    let mut entries = fs::read_dir(current)
        .map_err(|error| format!("无法读取文件夹 {}：{error}", current.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let path = entry.path();
        if file_type.is_symlink() || is_hidden_path(&path) {
            continue;
        }
        if file_type.is_dir() {
            collect_directory_documents(root, &path, seen, documents, skipped_file_count)?;
        } else if file_type.is_file() && is_markdown_import_extension(&path) {
            let canonical = path.canonicalize().map_err(|error| error.to_string())?;
            if seen.insert(canonical.clone()) {
                documents.push(SourceDocument {
                    relative_path: canonical
                        .strip_prefix(root)
                        .unwrap_or(&canonical)
                        .to_string_lossy()
                        .replace('\\', "/"),
                    path: canonical,
                    vault_root: None,
                    attachment_root: None,
                });
            }
        } else if file_type.is_file() && !is_image_file_extension(&path) {
            *skipped_file_count += 1;
        }
    }
    Ok(())
}

fn find_obsidian_vault(path: &Path) -> Option<PathBuf> {
    let mut current = if path.is_dir() { path } else { path.parent()? };
    loop {
        if current.join(".obsidian").is_dir() {
            return current
                .canonicalize()
                .ok()
                .or_else(|| Some(current.to_path_buf()));
        }
        current = current.parent()?;
    }
}

fn read_obsidian_attachment_root(vault_root: &Path) -> Option<PathBuf> {
    let raw = fs::read_to_string(vault_root.join(".obsidian").join("app.json")).ok()?;
    let parsed = serde_json::from_str::<JsonValue>(&raw).ok()?;
    let configured = parsed.get("attachmentFolderPath")?.as_str()?.trim();
    if configured.is_empty() || configured == "./" || configured == "." {
        return None;
    }
    let relative = configured.trim_start_matches('/');
    let path = vault_root.join(relative);
    canonical_directory(&path, "Obsidian 附件目录").ok()
}

fn canonical_directory(path: &Path, label: &str) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("{label}不可用：{}（{error}）", path.display()))?;
    if !canonical.is_dir() {
        return Err(format!("{label}不是文件夹：{}", canonical.display()));
    }
    Ok(canonical)
}

fn build_filename_index(root: &Path) -> Result<HashMap<String, Vec<PathBuf>>, String> {
    let mut index = HashMap::<String, Vec<PathBuf>>::new();
    collect_image_index(root, &mut index)?;
    Ok(index)
}

fn collect_image_index(
    root: &Path,
    index: &mut HashMap<String, Vec<PathBuf>>,
) -> Result<(), String> {
    let mut pending = vec![root.to_path_buf()];
    while let Some(current) = pending.pop() {
        for entry in fs::read_dir(&current).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            let path = entry.path();
            if file_type.is_symlink() || is_hidden_path(&path) {
                continue;
            }
            if file_type.is_dir() {
                pending.push(path);
            } else if file_type.is_file() && is_image_file_extension(&path) {
                let canonical = path.canonicalize().unwrap_or(path);
                let key = canonical
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_lowercase();
                index.entry(key).or_default().push(canonical);
            }
        }
    }
    Ok(())
}

fn parse_frontmatter(raw: &str) -> (JsonValue, &str, Option<String>) {
    let normalized = raw.strip_prefix('\u{feff}').unwrap_or(raw);
    let Some((frontmatter, body)) = split_frontmatter(normalized) else {
        return (JsonValue::Object(JsonMap::new()), normalized, None);
    };
    match serde_yaml::from_str::<serde_yaml::Value>(frontmatter) {
        Ok(value) => match serde_json::to_value(value) {
            Ok(JsonValue::Object(mapping)) => (JsonValue::Object(mapping), body, None),
            Ok(_) => (
                JsonValue::Object(JsonMap::new()),
                normalized,
                Some("Front Matter 不是对象，已作为正文保留。".to_string()),
            ),
            Err(error) => (
                JsonValue::Object(JsonMap::new()),
                normalized,
                Some(format!("Front Matter 无法转换，已作为正文保留：{error}")),
            ),
        },
        Err(error) => (
            JsonValue::Object(JsonMap::new()),
            normalized,
            Some(format!("Front Matter 无法解析，已作为正文保留：{error}")),
        ),
    }
}

fn split_frontmatter(markdown: &str) -> Option<(&str, &str)> {
    let opening_len = if markdown.starts_with("---\n") {
        4
    } else if markdown.starts_with("---\r\n") {
        5
    } else {
        return None;
    };
    let remainder = &markdown[opening_len..];
    for marker in ["\n---\n", "\r\n---\r\n", "\n---\r\n"] {
        if let Some(index) = remainder.find(marker) {
            return Some((&remainder[..index], &remainder[index + marker.len()..]));
        }
    }
    None
}

fn collect_image_targets(markdown: &str) -> Vec<(String, String)> {
    let mut targets = Vec::new();
    let mut cursor = 0;
    while let Some(start) = markdown[cursor..].find("![[") {
        let content_start = cursor + start + 3;
        let Some(end) = markdown[content_start..].find("]]") else {
            break;
        };
        let content = &markdown[content_start..content_start + end];
        let target = content.split('|').next().unwrap_or_default().trim();
        if looks_like_image_path(target) {
            targets.push((target.to_string(), "obsidian".to_string()));
        }
        cursor = content_start + end + 2;
    }

    cursor = 0;
    while let Some(start) = markdown[cursor..].find("![") {
        let alt_start = cursor + start + 2;
        if markdown[alt_start..].starts_with('[') {
            cursor = alt_start + 1;
            continue;
        }
        let Some(alt_end) = markdown[alt_start..].find("](") else {
            break;
        };
        let target_start = alt_start + alt_end + 2;
        let Some(target_end) = markdown[target_start..].find(')') else {
            break;
        };
        let target = parse_markdown_destination(&markdown[target_start..target_start + target_end]);
        if !target.is_empty() {
            targets.push((target, "markdown".to_string()));
        }
        cursor = target_start + target_end + 1;
    }
    targets
}

fn parse_markdown_destination(value: &str) -> String {
    let trimmed = value.trim();
    if let Some(inner) = trimmed
        .strip_prefix('<')
        .and_then(|value| value.split('>').next())
    {
        return inner.trim().to_string();
    }
    let title_index = trimmed
        .char_indices()
        .find(|(index, character)| *index > 0 && character.is_whitespace())
        .map(|(index, _)| index);
    title_index
        .map(|index| trimmed[..index].trim())
        .unwrap_or(trimmed)
        .to_string()
}

fn resolve_image_reference(
    document_path: &Path,
    vault_root: Option<&Path>,
    attachment_root: Option<&Path>,
    attachment_indexes: &HashMap<PathBuf, HashMap<String, Vec<PathBuf>>>,
    target: String,
    format: String,
) -> MarkdownImportImageReference {
    if is_external_reference(&target) {
        return MarkdownImportImageReference {
            target,
            format,
            status: "external".to_string(),
            source_path: String::new(),
            candidate_paths: Vec::new(),
        };
    }
    let decoded = urlencoding::decode(&target)
        .map(|value| value.into_owned())
        .unwrap_or_else(|_| target.clone());
    let clean_target = decoded.trim_start_matches('/');
    let mut exact_candidates = Vec::new();
    if Path::new(&decoded).is_absolute() {
        exact_candidates.push(PathBuf::from(&decoded));
    }
    if let Some(parent) = document_path.parent() {
        exact_candidates.push(parent.join(&decoded));
    }
    if let Some(root) = vault_root {
        exact_candidates.push(root.join(clean_target));
    }
    if let Some(root) = attachment_root {
        exact_candidates.push(root.join(clean_target));
    }
    for candidate in exact_candidates {
        if candidate.is_file() && is_image_file_extension(&candidate) {
            let canonical = candidate.canonicalize().unwrap_or(candidate);
            return MarkdownImportImageReference {
                target,
                format,
                status: "resolved".to_string(),
                source_path: canonical.display().to_string(),
                candidate_paths: Vec::new(),
            };
        }
    }

    let basename = Path::new(clean_target)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(clean_target)
        .to_lowercase();
    let candidates = attachment_root
        .and_then(|root| attachment_indexes.get(root))
        .and_then(|index| index.get(&basename))
        .cloned()
        .unwrap_or_default();
    if candidates.len() == 1 {
        return MarkdownImportImageReference {
            target,
            format,
            status: "resolved".to_string(),
            source_path: candidates[0].display().to_string(),
            candidate_paths: Vec::new(),
        };
    }
    MarkdownImportImageReference {
        target,
        format,
        status: if candidates.len() > 1 {
            "ambiguous"
        } else {
            "missing"
        }
        .to_string(),
        source_path: String::new(),
        candidate_paths: candidates
            .into_iter()
            .map(|candidate| candidate.display().to_string())
            .collect(),
    }
}

fn looks_like_image_path(value: &str) -> bool {
    let clean = value.split('#').next().unwrap_or(value);
    is_image_file_extension(Path::new(clean))
}

fn is_external_reference(value: &str) -> bool {
    let lower = value.trim().to_ascii_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
}

fn system_time_millis(value: SystemTime) -> Option<u64> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

fn sources_common_path(paths: impl Iterator<Item = PathBuf>) -> Option<PathBuf> {
    let mut unique = paths.collect::<HashSet<_>>();
    if unique.len() == 1 {
        unique.drain().next()
    } else {
        None
    }
}

fn display_optional_path(path: Option<&Path>) -> String {
    path.map(|value| value.display().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_without_losing_body() {
        let (metadata, body, warning) =
            parse_frontmatter("---\ntitle: 测试\ndate: 2026-07-25\n---\n\n# 正文");
        assert_eq!(
            metadata.get("title").and_then(JsonValue::as_str),
            Some("测试")
        );
        assert_eq!(
            metadata.get("date").and_then(JsonValue::as_str),
            Some("2026-07-25")
        );
        assert_eq!(body, "\n# 正文");
        assert!(warning.is_none());
    }

    #[test]
    fn preserves_malformed_frontmatter_as_visible_body() {
        let raw = "---\ntitle: [未闭合\n---\n# 正文";
        let (metadata, body, warning) = parse_frontmatter(raw);
        assert_eq!(metadata, JsonValue::Object(JsonMap::new()));
        assert_eq!(body, raw);
        assert!(warning.is_some());
    }

    #[test]
    fn scans_obsidian_folder_and_resolves_configured_attachments() -> Result<(), String> {
        let temp = tempfile::tempdir().map_err(|error| error.to_string())?;
        let vault = temp.path().join("Vault");
        let source = vault.join("文章").join("已发布");
        let attachments = vault.join("附件");
        fs::create_dir_all(vault.join(".obsidian")).map_err(|error| error.to_string())?;
        fs::create_dir_all(&source).map_err(|error| error.to_string())?;
        fs::create_dir_all(&attachments).map_err(|error| error.to_string())?;
        fs::write(
            vault.join(".obsidian").join("app.json"),
            r#"{"attachmentFolderPath":"附件"}"#,
        )
        .map_err(|error| error.to_string())?;
        fs::write(attachments.join("封面.png"), b"image").map_err(|error| error.to_string())?;
        fs::write(
            source.join("文章.md"),
            "---\ntitle: 文章\ndate: 2026-07-25\n---\n\n# 文章\n\n![[封面.png]]",
        )
        .map_err(|error| error.to_string())?;

        let scan = scan_markdown_import_blocking(vec![source.display().to_string()], None)?;
        assert_eq!(scan.source_type, "obsidian");
        assert_eq!(scan.documents.len(), 1);
        assert_eq!(scan.resolved_image_count, 1);
        assert_eq!(scan.missing_image_count, 0);
        assert_eq!(scan.documents[0].relative_path, "文章.md");
        assert_eq!(scan.documents[0].image_references[0].status, "resolved");
        assert_eq!(
            scan.documents[0]
                .metadata
                .get("date")
                .and_then(JsonValue::as_str),
            Some("2026-07-25")
        );
        Ok(())
    }

    #[test]
    fn reports_ambiguous_bare_attachment_names() -> Result<(), String> {
        let temp = tempfile::tempdir().map_err(|error| error.to_string())?;
        let source = temp.path().join("文章");
        let attachments = temp.path().join("附件");
        fs::create_dir_all(&source).map_err(|error| error.to_string())?;
        fs::create_dir_all(attachments.join("一")).map_err(|error| error.to_string())?;
        fs::create_dir_all(attachments.join("二")).map_err(|error| error.to_string())?;
        fs::write(source.join("文章.md"), "# 文章\n\n![[封面.png]]")
            .map_err(|error| error.to_string())?;
        fs::write(attachments.join("一").join("封面.png"), b"one")
            .map_err(|error| error.to_string())?;
        fs::write(attachments.join("二").join("封面.png"), b"two")
            .map_err(|error| error.to_string())?;

        let scan = scan_markdown_import_blocking(
            vec![source.display().to_string()],
            Some(attachments.display().to_string()),
        )?;
        assert_eq!(scan.ambiguous_image_count, 1);
        assert_eq!(
            scan.documents[0].image_references[0].candidate_paths.len(),
            2
        );
        Ok(())
    }

    #[test]
    fn recursively_scans_nested_documents_and_relative_markdown_images() -> Result<(), String> {
        let temp = tempfile::tempdir().map_err(|error| error.to_string())?;
        let source = temp.path().join("来源");
        let nested = source.join("专题").join("年度");
        fs::create_dir_all(&nested).map_err(|error| error.to_string())?;
        fs::write(source.join("根目录.md"), "# 根目录").map_err(|error| error.to_string())?;
        fs::write(nested.join("图片.png"), b"image").map_err(|error| error.to_string())?;
        fs::write(nested.join("文章.md"), "# 文章\n\n![图片](图片.png)")
            .map_err(|error| error.to_string())?;
        fs::write(nested.join("忽略.html"), "<p>忽略</p>").map_err(|error| error.to_string())?;

        let scan = scan_markdown_import_blocking(vec![source.display().to_string()], None)?;
        assert_eq!(scan.documents.len(), 2);
        assert_eq!(scan.skipped_file_count, 1);
        assert_eq!(scan.resolved_image_count, 1);
        assert!(scan
            .documents
            .iter()
            .any(|document| document.relative_path == "专题/年度/文章.md"));
        Ok(())
    }

    #[test]
    fn imports_each_unique_image_once_and_reuses_existing_content() -> Result<(), String> {
        let temp = tempfile::tempdir().map_err(|error| error.to_string())?;
        let source = temp.path().join("来源").join("封面.png");
        let library = temp.path().join("写作库");
        fs::create_dir_all(source.parent().unwrap_or(temp.path()))
            .map_err(|error| error.to_string())?;
        fs::write(&source, b"same-image").map_err(|error| error.to_string())?;
        let images = vec![
            MarkdownImportImageSource {
                source_path: source.display().to_string(),
            },
            MarkdownImportImageSource {
                source_path: source.display().to_string(),
            },
        ];

        let first = import_markdown_images_blocking(library.display().to_string(), images.clone())?;
        let second = import_markdown_images_blocking(library.display().to_string(), images)?;
        assert_eq!(first.len(), 1);
        assert_eq!(second.len(), 1);
        assert_eq!(first[0].destination_path, second[0].destination_path);
        assert!(Path::new(&first[0].destination_path).is_file());
        Ok(())
    }
}
