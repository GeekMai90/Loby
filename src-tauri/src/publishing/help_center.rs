//! [INPUT]: 依赖 GitHub 身份/原子文件提交、本地图片安全读取、Starlight Markdown 与版本化帮助中心清单
//! [OUTPUT]: 向 publishing command facade 提供单篇和整项目共用的 sync，将写入限定在用户配置的安全 Starlight 内容、清单与 public 图片路径
//! [POS]: 发布领域的帮助中心编排器；本地项目是内容事实源，远端清单负责所有权、增量合并和显式删除，不触碰站点代码与样式
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::blog::prepare_image;
use super::github::{
    commit_file_changes, read_repository_file, verify_repository_access, GitHubFile,
    GitHubFileChanges, GitHubRepositoryTarget,
};
use super::github_auth;
use super::{
    HelpCenterSyncProgress, HelpCenterSyncRequest, HelpCenterSyncResult, HelpCenterSyncedDocument,
};
use serde::{Deserialize, Serialize};
use serde_yaml::{Mapping as YamlMapping, Value as YamlValue};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use tauri::ipc::Channel;

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HelpCenterManifest {
    #[serde(default = "manifest_schema_version")]
    schema_version: u8,
    #[serde(default)]
    project_id: String,
    #[serde(default)]
    project_title: String,
    #[serde(default)]
    groups: Vec<HelpCenterManifestGroup>,
    #[serde(default)]
    documents: Vec<HelpCenterManifestDocument>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HelpCenterManifestGroup {
    id: String,
    label: String,
    directory: String,
    order: usize,
    enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HelpCenterManifestDocument {
    source_id: String,
    title: String,
    slug: String,
    group_id: String,
    path: String,
    #[serde(default)]
    assets: Vec<String>,
    source_hash: String,
}

fn manifest_schema_version() -> u8 {
    1
}

pub(super) async fn sync(
    request: HelpCenterSyncRequest,
    on_progress: &Channel<HelpCenterSyncProgress>,
) -> Result<HelpCenterSyncResult, String> {
    sync_with_progress(request, |progress| {
        let _ = on_progress.send(progress);
    })
    .await
}

async fn sync_with_progress(
    request: HelpCenterSyncRequest,
    mut emit_progress: impl FnMut(HelpCenterSyncProgress),
) -> Result<HelpCenterSyncResult, String> {
    validate_request(&request)?;
    let (owner, repository) = parse_repository(&request.repository)?;
    emit_progress(HelpCenterSyncProgress::CheckingAuthorization);
    let token = github_auth::access_token().await?;
    verify_repository_access(&token, &owner, &repository).await?;

    emit_progress(HelpCenterSyncProgress::Preparing);
    let snapshot = read_repository_file(
        &token,
        &owner,
        &repository,
        &request.branch,
        &request.manifest_path,
    )
    .await?;
    let mut manifest = read_manifest(snapshot.bytes.as_deref())?;
    claim_manifest(&mut manifest, &request.project_id, &request.project_title)?;
    manifest.groups = request
        .groups
        .iter()
        .map(|group| HelpCenterManifestGroup {
            id: group.id.clone(),
            label: group.label.clone(),
            directory: group.directory.clone(),
            order: group.order,
            enabled: group.enabled,
        })
        .collect();

    let mut files = Vec::new();
    let mut deletions = BTreeSet::new();
    let mut next_documents = manifest
        .documents
        .iter()
        .cloned()
        .map(|document| (document.source_id.clone(), document))
        .collect::<BTreeMap<_, _>>();
    let mut deleted_source_ids = Vec::new();
    if request.mode == "project" && request.delete_missing {
        let requested = request
            .documents
            .iter()
            .map(|document| document.source_id.clone())
            .collect::<BTreeSet<_>>();
        let stale = remove_stale_documents(&mut next_documents, &requested);
        deleted_source_ids = stale.0;
        deletions.extend(stale.1);
    }

    let total = request.documents.len()
        + request
            .documents
            .iter()
            .map(|document| document.images.len())
            .sum::<usize>();
    let mut completed = 0;
    emit_progress(HelpCenterSyncProgress::Packaging { completed, total });
    let mut synced = Vec::new();
    for document in &request.documents {
        remove_existing_document(&mut next_documents, &document.source_id, &mut deletions);
        let document_path = format!(
            "{}/{}/{}.md",
            request.content_root, document.group_directory, document.slug
        );
        let asset_directory = format!("{}/{}", request.assets_root, document.slug);
        let mut body = document.body.clone();
        let mut assets = Vec::new();
        for image in &document.images {
            let prepared = prepare_image(&request.library_path, image)?;
            let path = format!("{asset_directory}/{}", prepared.name);
            let public_path = format!("/{}", path.strip_prefix("public/").unwrap_or(&path));
            body = body.replace(&image.placeholder, &public_path);
            if !assets.contains(&path) {
                files.push(GitHubFile {
                    path: path.clone(),
                    bytes: prepared.bytes,
                });
                assets.push(path);
            }
            completed += 1;
            emit_progress(HelpCenterSyncProgress::Packaging { completed, total });
        }
        if document
            .images
            .iter()
            .any(|image| body.contains(&image.placeholder))
        {
            return Err(format!("「{}」仍有未处理的图片占位符。", document.title));
        }
        let body = strip_matching_h1(&body, &document.title);
        let markdown = render_starlight_markdown(
            &document.title,
            &document.description,
            &document.slug,
            &body,
        )?;
        let source_hash = content_hash(document, &markdown, &assets);
        files.push(GitHubFile {
            path: document_path.clone(),
            bytes: markdown.into_bytes(),
        });
        let manifest_document = HelpCenterManifestDocument {
            source_id: document.source_id.clone(),
            title: document.title.clone(),
            slug: document.slug.clone(),
            group_id: document.group_id.clone(),
            path: document_path,
            assets,
            source_hash: source_hash.clone(),
        };
        next_documents.insert(document.source_id.clone(), manifest_document);
        synced.push(HelpCenterSyncedDocument {
            source_id: document.source_id.clone(),
            slug: document.slug.clone(),
            url: format!(
                "{}/{}/",
                request.site_url.trim_end_matches('/'),
                document.slug
            ),
            source_hash,
        });
        completed += 1;
        emit_progress(HelpCenterSyncProgress::Packaging { completed, total });
    }
    deletions.retain(|path| !files.iter().any(|file| &file.path == path));
    manifest.documents = next_documents.into_values().collect();
    manifest
        .documents
        .sort_by(|left, right| left.path.cmp(&right.path));
    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|_| "无法生成帮助中心同步清单。".to_string())?;
    files.push(GitHubFile {
        path: request.manifest_path.clone(),
        bytes: [manifest_bytes, b"\n".to_vec()].concat(),
    });

    emit_progress(HelpCenterSyncProgress::Committing);
    let commit_message = if request.mode == "project" {
        format!("docs: 同步{}", request.project_title)
    } else {
        format!("docs: 更新{}", request.documents[0].title)
    };
    let commit = commit_file_changes(
        &token,
        &GitHubRepositoryTarget {
            owner,
            repository,
            branch: request.branch.clone(),
        },
        GitHubFileChanges {
            expected_head_sha: snapshot.head_sha,
            files,
            deleted_paths: deletions,
            commit_message,
        },
    )
    .await?;
    emit_progress(HelpCenterSyncProgress::Finished);
    Ok(HelpCenterSyncResult {
        commit_sha: commit.commit_sha,
        changed: commit.changed,
        synced_count: synced.len(),
        documents: synced,
        deleted_count: deleted_source_ids.len(),
        deleted_source_ids,
    })
}

fn read_manifest(bytes: Option<&[u8]>) -> Result<HelpCenterManifest, String> {
    let Some(bytes) = bytes else {
        return Ok(HelpCenterManifest::default());
    };
    let manifest: HelpCenterManifest = serde_json::from_slice(bytes)
        .map_err(|_| "远端帮助中心清单已损坏，已停止覆盖。".to_string())?;
    if manifest.schema_version != manifest_schema_version() {
        return Err("远端帮助中心清单版本不受支持，已停止覆盖。".to_string());
    }
    Ok(manifest)
}

fn claim_manifest(
    manifest: &mut HelpCenterManifest,
    project_id: &str,
    project_title: &str,
) -> Result<(), String> {
    if !manifest.project_id.is_empty() && manifest.project_id != project_id {
        return Err("这个帮助中心已经绑定到另一个落笔项目，已停止覆盖。".to_string());
    }
    manifest.project_id = project_id.to_string();
    manifest.project_title = project_title.to_string();
    Ok(())
}

fn remove_stale_documents(
    documents: &mut BTreeMap<String, HelpCenterManifestDocument>,
    requested: &BTreeSet<String>,
) -> (Vec<String>, BTreeSet<String>) {
    let stale_source_ids = documents
        .keys()
        .filter(|source_id| !requested.contains(*source_id))
        .cloned()
        .collect::<Vec<_>>();
    let mut paths = BTreeSet::new();
    for source_id in &stale_source_ids {
        if let Some(existing) = documents.remove(source_id) {
            paths.insert(existing.path);
            paths.extend(existing.assets);
        }
    }
    (stale_source_ids, paths)
}

fn remove_existing_document(
    documents: &mut BTreeMap<String, HelpCenterManifestDocument>,
    source_id: &str,
    deletions: &mut BTreeSet<String>,
) {
    if let Some(existing) = documents.remove(source_id) {
        deletions.insert(existing.path);
        deletions.extend(existing.assets);
    }
}

fn render_starlight_markdown(
    title: &str,
    description: &str,
    slug: &str,
    body: &str,
) -> Result<String, String> {
    let mut frontmatter = YamlMapping::new();
    frontmatter.insert(
        YamlValue::String("title".to_string()),
        YamlValue::String(title.to_string()),
    );
    if !description.trim().is_empty() {
        frontmatter.insert(
            YamlValue::String("description".to_string()),
            YamlValue::String(description.trim().to_string()),
        );
    }
    frontmatter.insert(
        YamlValue::String("slug".to_string()),
        YamlValue::String(slug.to_string()),
    );
    let yaml = serde_yaml::to_string(&frontmatter)
        .map_err(|_| "无法生成帮助中心文稿元数据。".to_string())?;
    Ok(format!("---\n{yaml}---\n\n{}\n", body.trim()))
}

fn content_hash(
    document: &super::HelpCenterSyncDocument,
    markdown: &str,
    assets: &[String],
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(document.source_id.as_bytes());
    hasher.update([0]);
    hasher.update(markdown.as_bytes());
    for asset in assets {
        hasher.update([0]);
        hasher.update(asset.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

fn strip_matching_h1(body: &str, title: &str) -> String {
    let mut removed = false;
    body.lines()
        .filter(|line| {
            if !removed
                && line
                    .strip_prefix("# ")
                    .is_some_and(|value| value.trim() == title.trim())
            {
                removed = true;
                false
            } else {
                true
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn parse_repository(value: &str) -> Result<(String, String), String> {
    let parts = value.trim().split('/').collect::<Vec<_>>();
    if parts.len() != 2 || parts.iter().any(|part| part.trim().is_empty()) {
        return Err("GitHub 仓库格式无效，请使用 owner/repository。".to_string());
    }
    Ok((
        parts[0].to_string(),
        parts[1].trim_end_matches(".git").to_string(),
    ))
}

fn validate_request(request: &HelpCenterSyncRequest) -> Result<(), String> {
    if request.project_id.trim().is_empty() || request.project_title.trim().is_empty() {
        return Err("帮助中心项目身份无效。".to_string());
    }
    if request.documents.is_empty() && !(request.mode == "project" && request.delete_missing) {
        return Err("没有可同步的帮助中心文稿。".to_string());
    }
    if !matches!(request.mode.as_str(), "project" | "document") {
        return Err("帮助中心同步模式无效。".to_string());
    }
    if request.mode == "document" && request.documents.len() != 1 {
        return Err("单篇同步一次只能提交一篇文稿。".to_string());
    }
    validate_managed_repository_path(&request.content_root, "Starlight 文档目录")?;
    validate_managed_repository_path(&request.manifest_path, "Starlight 文档清单")?;
    validate_managed_repository_path(&request.assets_root, "Starlight 图片目录")?;
    if request.content_root != "src/content/docs"
        && !request.content_root.starts_with("src/content/docs/")
    {
        return Err("Starlight 文档目录必须位于 src/content/docs 下。".to_string());
    }
    if !request.assets_root.starts_with("public/") {
        return Err("Starlight 图片目录必须位于 public/ 下。".to_string());
    }
    if !request.manifest_path.ends_with(".json") {
        return Err("Starlight 文档清单必须是 JSON 文件。".to_string());
    }
    if !request.site_url.starts_with("https://") && !request.site_url.starts_with("http://") {
        return Err("帮助中心地址无效。".to_string());
    }
    let enabled_groups = request
        .groups
        .iter()
        .filter(|group| group.enabled)
        .map(|group| group.id.as_str())
        .collect::<BTreeSet<_>>();
    for document in &request.documents {
        if !enabled_groups.contains(document.group_id.as_str())
            || document.group_directory.is_empty()
            || document.slug.is_empty()
            || document.body.trim().is_empty()
        {
            return Err(format!("「{}」的帮助中心分类或正文无效。", document.title));
        }
    }
    Ok(())
}

fn validate_managed_repository_path(path: &str, label: &str) -> Result<(), String> {
    if path.is_empty()
        || path.starts_with('/')
        || path.len() > 1000
        || path.split('/').any(|segment| {
            segment.is_empty()
                || matches!(segment, "." | "..")
                || segment.starts_with('.')
                || segment.contains('\\')
                || segment.chars().any(char::is_control)
        })
    {
        return Err(format!("{label}格式无效。"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_a_manifest_owned_by_another_project() {
        let mut manifest = HelpCenterManifest {
            schema_version: 1,
            project_id: "project-other".to_string(),
            ..Default::default()
        };
        assert!(claim_manifest(&mut manifest, "project-help", "帮助中心").is_err());
    }

    #[test]
    fn removes_only_stale_manifest_owned_paths_when_cleanup_is_explicit() {
        let document = |source_id: &str, path: &str| HelpCenterManifestDocument {
            source_id: source_id.to_string(),
            title: source_id.to_string(),
            slug: source_id.to_string(),
            group_id: "group-guide".to_string(),
            path: path.to_string(),
            assets: vec![format!("public/images/docs/{source_id}/cover.webp")],
            source_hash: "hash".to_string(),
        };
        let mut documents = [
            (
                "keep".to_string(),
                document("keep", "src/content/docs/guide/keep.md"),
            ),
            (
                "stale".to_string(),
                document("stale", "src/content/docs/guide/stale.md"),
            ),
        ]
        .into_iter()
        .collect();
        let requested = BTreeSet::from(["keep".to_string()]);

        let (source_ids, paths) = remove_stale_documents(&mut documents, &requested);

        assert_eq!(source_ids, vec!["stale"]);
        assert_eq!(documents.keys().cloned().collect::<Vec<_>>(), vec!["keep"]);
        assert_eq!(
            paths,
            BTreeSet::from([
                "public/images/docs/stale/cover.webp".to_string(),
                "src/content/docs/guide/stale.md".to_string(),
            ])
        );
    }

    #[test]
    fn allows_an_empty_project_only_for_explicit_remote_cleanup() {
        let request = |mode: &str, delete_missing: bool| HelpCenterSyncRequest {
            repository: "owner/docs".to_string(),
            branch: "main".to_string(),
            content_root: "src/content/docs".to_string(),
            manifest_path: "src/data/loby-docs.json".to_string(),
            assets_root: "public/images/docs".to_string(),
            site_url: "https://docs.example.com".to_string(),
            library_path: "/tmp/library".to_string(),
            project_id: "project-help".to_string(),
            project_title: "帮助中心".to_string(),
            mode: mode.to_string(),
            delete_missing,
            groups: Vec::new(),
            documents: Vec::new(),
        };

        assert!(validate_request(&request("project", true)).is_ok());
        assert!(validate_request(&request("project", false)).is_err());
        assert!(validate_request(&request("document", true)).is_err());
    }

    #[test]
    fn removes_the_previous_managed_path_when_a_document_moves_groups() {
        let mut documents = BTreeMap::from([(
            "sheet-a".to_string(),
            HelpCenterManifestDocument {
                source_id: "sheet-a".to_string(),
                title: "文章 A".to_string(),
                slug: "stable-a".to_string(),
                group_id: "group-start".to_string(),
                path: "src/content/docs/开始使用/stable-a.md".to_string(),
                assets: vec!["public/images/docs/stable-a/cover.webp".to_string()],
                source_hash: "hash".to_string(),
            },
        )]);
        let mut deletions = BTreeSet::new();

        remove_existing_document(&mut documents, "sheet-a", &mut deletions);

        assert!(documents.is_empty());
        assert_eq!(
            deletions,
            BTreeSet::from([
                "public/images/docs/stable-a/cover.webp".to_string(),
                "src/content/docs/开始使用/stable-a.md".to_string(),
            ])
        );
    }

    #[test]
    fn accepts_custom_safe_starlight_paths_and_rejects_hidden_or_escaping_paths() {
        assert!(validate_managed_repository_path(
            "src/content/docs/产品手册",
            "Starlight 文档目录"
        )
        .is_ok());
        assert!(validate_managed_repository_path(
            "src/data/product-docs.json",
            "Starlight 文档清单"
        )
        .is_ok());
        assert!(validate_managed_repository_path(
            "public/images/product-docs",
            "Starlight 图片目录"
        )
        .is_ok());
        assert!(validate_managed_repository_path("../docs", "Starlight 文档目录").is_err());
        assert!(
            validate_managed_repository_path(".github/workflows", "Starlight 文档目录").is_err()
        );
        assert!(validate_managed_repository_path("docs\\secret", "Starlight 文档目录").is_err());
    }

    #[test]
    fn renders_stable_starlight_slug() {
        let markdown =
            render_starlight_markdown("安装", "开始使用", "abc123", "# 安装\n\n正文").unwrap();
        assert!(markdown.contains("slug: abc123"));
        assert!(markdown.contains("# 安装"));
    }

    #[tokio::test]
    #[ignore = "requires an explicit GitHub token and a disposable or intended documentation repository"]
    async fn syncs_an_explicit_external_request() {
        let payload = std::env::var("LOBY_HELP_CENTER_TEST_REQUEST")
            .expect("LOBY_HELP_CENTER_TEST_REQUEST must contain a serialized request");
        let request: HelpCenterSyncRequest = serde_json::from_str(&payload).unwrap();
        let result = sync_with_progress(request, |_| {}).await.unwrap();
        assert!(!result.commit_sha.is_empty());
        assert!(!result.documents.is_empty());
        if std::env::var("LOBY_HELP_CENTER_EXPECT_CHANGED").as_deref() == Ok("false") {
            assert!(!result.changed);
        }
    }
}
