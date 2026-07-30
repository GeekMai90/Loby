//! [INPUT]: 依赖 reqwest、GitHub REST Git Database API 与 base64
//! [OUTPUT]: 向博客与帮助中心发布器提供仓库写权限、远端文件快照、预期 HEAD 校验、受控删除与非强制 Git object 原子提交能力
//! [POS]: 发布领域的通用 GitHub 传输适配器，处理授权、远端并发与 Git object 写入，不理解 Hugo 或 Starlight 内容
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::{header, Client, Response};
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

const GITHUB_API: &str = "https://api.github.com";

pub(super) struct GitHubTarget {
    pub(super) owner: String,
    pub(super) repository: String,
    pub(super) branch: String,
    pub(super) bundle_root: String,
}

pub(super) struct GitHubRepositoryTarget {
    pub(super) owner: String,
    pub(super) repository: String,
    pub(super) branch: String,
}

pub(super) struct GitHubFileChanges {
    pub(super) expected_head_sha: String,
    pub(super) files: Vec<GitHubFile>,
    pub(super) deleted_paths: BTreeSet<String>,
    pub(super) commit_message: String,
}

pub(super) struct GitHubFile {
    pub(super) path: String,
    pub(super) bytes: Vec<u8>,
}

pub(super) struct GitHubCommitResult {
    pub(super) commit_sha: String,
    pub(super) changed: bool,
}

pub(super) struct GitHubFileSnapshot {
    pub(super) bytes: Option<Vec<u8>>,
    pub(super) head_sha: String,
}

#[derive(Deserialize)]
struct GitHubRefResponse {
    object: GitHubObject,
}

#[derive(Deserialize)]
struct GitHubObject {
    sha: String,
}

#[derive(Deserialize)]
struct GitHubCommitResponse {
    sha: String,
    tree: GitHubObject,
}

#[derive(Deserialize)]
struct GitHubTreeResponse {
    sha: String,
    tree: Vec<GitHubTreeItem>,
    #[serde(default)]
    truncated: bool,
}

#[derive(Deserialize)]
struct GitHubTreeItem {
    path: String,
    #[serde(rename = "type")]
    object_type: String,
    sha: String,
}

#[derive(Deserialize)]
struct GitHubShaResponse {
    sha: String,
}

#[derive(Deserialize)]
struct GitHubBlobResponse {
    content: String,
    encoding: String,
}

#[derive(Deserialize)]
struct GitHubRepositoryResponse {
    archived: bool,
    disabled: bool,
    permissions: Option<GitHubRepositoryPermissions>,
}

#[derive(Deserialize)]
struct GitHubRepositoryPermissions {
    push: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishManifest {
    source_id: Option<String>,
    #[serde(default)]
    title: String,
    #[serde(default)]
    migrated_from: Option<String>,
}

pub(super) async fn verify_repository_access(
    token: &str,
    owner: &str,
    repository: &str,
) -> Result<(), String> {
    let token = validate_token_value(token)?;
    if !safe_repository_segment(owner) || !safe_repository_segment(repository) {
        return Err("GitHub 仓库格式无效，请使用 owner/repository。".to_string());
    }
    let response = github_request(
        Client::new().get(format!("{GITHUB_API}/repos/{owner}/{repository}")),
        token,
    )
    .send()
    .await
    .map_err(|_| "无法检查 GitHub 仓库权限，请检查网络后重试。".to_string())?;
    if response.status().as_u16() == 404 {
        return Err("当前 GitHub 仓库不存在或尚未授权，请在设置中管理仓库权限。".to_string());
    }
    let repository =
        github_json::<GitHubRepositoryResponse>(response, "检查 GitHub 仓库权限").await?;
    if repository.archived || repository.disabled {
        return Err("当前 GitHub 仓库已归档或停用，无法继续发布。".to_string());
    }
    if !repository
        .permissions
        .is_some_and(|permissions| permissions.push)
    {
        return Err(
            "落笔没有目标 GitHub 仓库的 Contents 写权限，请在设置中管理仓库权限。".to_string(),
        );
    }
    Ok(())
}

pub(super) async fn publish_files(
    token: &str,
    target: &GitHubTarget,
    files: Vec<GitHubFile>,
    source_id: &str,
    source_title: &str,
    commit_message: &str,
) -> Result<GitHubCommitResult, String> {
    let token = validate_token_value(token)?;
    validate_target(target)?;
    if files.is_empty() {
        return Err("没有可提交的博客文件。".to_string());
    }
    let client = Client::new();
    let repository_api = format!("{GITHUB_API}/repos/{}/{}", target.owner, target.repository);
    let encoded_branch = urlencoding::encode(&target.branch);
    let reference: GitHubRefResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/ref/heads/{encoded_branch}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 分支，请检查网络后重试。".to_string())?,
        "读取 GitHub 分支",
    )
    .await?;
    let head_sha = reference.object.sha;
    let head_commit: GitHubCommitResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/commits/{head_sha}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 提交。".to_string())?,
        "读取 GitHub 提交",
    )
    .await?;
    let base_tree_sha = head_commit.tree.sha;
    let existing_tree: GitHubTreeResponse = github_json(
        github_request(
            client.get(format!(
                "{repository_api}/git/trees/{base_tree_sha}?recursive=1"
            )),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 仓库目录。".to_string())?,
        "读取 GitHub 仓库目录",
    )
    .await?;
    if existing_tree.truncated {
        return Err("GitHub 仓库目录过大，无法安全确认文章覆盖范围。".to_string());
    }

    validate_bundle_ownership(
        &client,
        token,
        &repository_api,
        &target.bundle_root,
        source_id,
        source_title,
        &existing_tree.tree,
    )
    .await?;

    let desired_paths = files
        .iter()
        .map(|file| file.path.clone())
        .collect::<BTreeSet<_>>();
    let existing_bundle_files = existing_tree
        .tree
        .iter()
        .filter(|item| {
            item.object_type == "blob" && is_inside_bundle(&item.path, &target.bundle_root)
        })
        .map(|item| item.path.clone())
        .collect::<BTreeSet<_>>();

    let mut blobs = BTreeMap::new();
    for file in files {
        let blob: GitHubShaResponse = github_json(
            github_request(client.post(format!("{repository_api}/git/blobs")), token)
                .json(&json!({
                    "content": STANDARD.encode(file.bytes),
                    "encoding": "base64"
                }))
                .send()
                .await
                .map_err(|_| format!("无法上传博客文件：{}", file.path))?,
            "上传博客文件",
        )
        .await?;
        blobs.insert(file.path, blob.sha);
    }

    let mut entries = blobs
        .into_iter()
        .map(|(path, sha)| json!({ "path": path, "mode": "100644", "type": "blob", "sha": sha }))
        .collect::<Vec<_>>();
    entries.extend(
        existing_bundle_files.difference(&desired_paths).map(
            |path| json!({ "path": path, "mode": "100644", "type": "blob", "sha": Value::Null }),
        ),
    );

    let next_tree: GitHubTreeResponse = github_json(
        github_request(client.post(format!("{repository_api}/git/trees")), token)
            .json(&json!({ "base_tree": base_tree_sha, "tree": entries }))
            .send()
            .await
            .map_err(|_| "无法创建 GitHub 文件树。".to_string())?,
        "创建 GitHub 文件树",
    )
    .await?;
    if next_tree.sha == existing_tree.sha {
        return Ok(GitHubCommitResult {
            commit_sha: head_commit.sha,
            changed: false,
        });
    }

    let next_commit: GitHubShaResponse = github_json(
        github_request(client.post(format!("{repository_api}/git/commits")), token)
            .json(&json!({
                "message": commit_message,
                "tree": next_tree.sha,
                "parents": [head_sha]
            }))
            .send()
            .await
            .map_err(|_| "无法创建 GitHub 提交。".to_string())?,
        "创建 GitHub 提交",
    )
    .await?;

    github_empty(
        github_request(
            client.patch(format!("{repository_api}/git/refs/heads/{encoded_branch}")),
            token,
        )
        .json(&json!({ "sha": next_commit.sha, "force": false }))
        .send()
        .await
        .map_err(|_| "无法更新 GitHub 分支。".to_string())?,
        "更新 GitHub 分支",
    )
    .await?;
    Ok(GitHubCommitResult {
        commit_sha: next_commit.sha,
        changed: true,
    })
}

pub(super) async fn read_repository_file(
    token: &str,
    owner: &str,
    repository: &str,
    branch: &str,
    path: &str,
) -> Result<GitHubFileSnapshot, String> {
    let token = validate_token_value(token)?;
    validate_repository_coordinates(owner, repository, branch)?;
    validate_repository_path(path)?;
    let client = Client::new();
    let repository_api = format!("{GITHUB_API}/repos/{owner}/{repository}");
    let encoded_branch = urlencoding::encode(branch);
    let reference: GitHubRefResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/ref/heads/{encoded_branch}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 分支，请检查网络后重试。".to_string())?,
        "读取 GitHub 分支",
    )
    .await?;
    let head_sha = reference.object.sha;
    let head_commit: GitHubCommitResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/commits/{head_sha}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 提交。".to_string())?,
        "读取 GitHub 提交",
    )
    .await?;
    let tree: GitHubTreeResponse = github_json(
        github_request(
            client.get(format!(
                "{repository_api}/git/trees/{}?recursive=1",
                head_commit.tree.sha
            )),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 仓库目录。".to_string())?,
        "读取 GitHub 仓库目录",
    )
    .await?;
    if tree.truncated {
        return Err("GitHub 仓库目录过大，无法安全读取帮助中心清单。".to_string());
    }
    let Some(item) = tree
        .tree
        .iter()
        .find(|item| item.object_type == "blob" && item.path == path)
    else {
        return Ok(GitHubFileSnapshot {
            bytes: None,
            head_sha,
        });
    };
    let blob: GitHubBlobResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/blobs/{}", item.sha)),
            token,
        )
        .send()
        .await
        .map_err(|_| format!("无法读取 GitHub 文件：{path}"))?,
        "读取 GitHub 文件",
    )
    .await?;
    if blob.encoding != "base64" {
        return Err(format!("GitHub 文件编码无效：{path}"));
    }
    let bytes = STANDARD
        .decode(blob.content.replace(['\n', '\r'], ""))
        .map_err(|_| format!("无法解码 GitHub 文件：{path}"))?;
    Ok(GitHubFileSnapshot {
        bytes: Some(bytes),
        head_sha,
    })
}

pub(super) async fn commit_file_changes(
    token: &str,
    target: &GitHubRepositoryTarget,
    changes: GitHubFileChanges,
) -> Result<GitHubCommitResult, String> {
    let token = validate_token_value(token)?;
    validate_repository_coordinates(&target.owner, &target.repository, &target.branch)?;
    if changes.files.is_empty() && changes.deleted_paths.is_empty() {
        return Err("没有可提交的帮助中心文件。".to_string());
    }
    let mut desired_paths = BTreeSet::new();
    for file in &changes.files {
        validate_repository_path(&file.path)?;
        if !desired_paths.insert(file.path.clone()) {
            return Err(format!("帮助中心同步包含重复文件：{}", file.path));
        }
    }
    for path in &changes.deleted_paths {
        validate_repository_path(path)?;
        if desired_paths.contains(path) {
            return Err(format!("帮助中心文件同时被写入和删除：{path}"));
        }
    }

    let client = Client::new();
    let repository_api = format!("{GITHUB_API}/repos/{}/{}", target.owner, target.repository);
    let encoded_branch = urlencoding::encode(&target.branch);
    let reference: GitHubRefResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/ref/heads/{encoded_branch}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 分支，请检查网络后重试。".to_string())?,
        "读取 GitHub 分支",
    )
    .await?;
    if reference.object.sha != changes.expected_head_sha {
        return Err("远端分支刚刚发生了变化，请重新同步以避免覆盖其他提交。".to_string());
    }
    let head_sha = reference.object.sha;
    let head_commit: GitHubCommitResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/commits/{head_sha}")),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 提交。".to_string())?,
        "读取 GitHub 提交",
    )
    .await?;
    let base_tree_sha = head_commit.tree.sha;
    let existing_tree: GitHubTreeResponse = github_json(
        github_request(
            client.get(format!(
                "{repository_api}/git/trees/{base_tree_sha}?recursive=1"
            )),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取 GitHub 仓库目录。".to_string())?,
        "读取 GitHub 仓库目录",
    )
    .await?;
    if existing_tree.truncated {
        return Err("GitHub 仓库目录过大，无法安全提交帮助中心文件。".to_string());
    }
    let existing_paths = existing_tree
        .tree
        .iter()
        .filter(|item| item.object_type == "blob")
        .map(|item| item.path.as_str())
        .collect::<BTreeSet<_>>();
    let mut entries = Vec::new();
    for file in changes.files {
        let blob: GitHubShaResponse = github_json(
            github_request(client.post(format!("{repository_api}/git/blobs")), token)
                .json(&json!({
                    "content": STANDARD.encode(file.bytes),
                    "encoding": "base64"
                }))
                .send()
                .await
                .map_err(|_| format!("无法上传帮助中心文件：{}", file.path))?,
            "上传帮助中心文件",
        )
        .await?;
        entries
            .push(json!({ "path": file.path, "mode": "100644", "type": "blob", "sha": blob.sha }));
    }
    entries.extend(
        changes.deleted_paths.into_iter().filter(|path| existing_paths.contains(path.as_str())).map(
            |path| json!({ "path": path, "mode": "100644", "type": "blob", "sha": Value::Null }),
        ),
    );
    let next_tree: GitHubTreeResponse = github_json(
        github_request(client.post(format!("{repository_api}/git/trees")), token)
            .json(&json!({ "base_tree": base_tree_sha, "tree": entries }))
            .send()
            .await
            .map_err(|_| "无法创建 GitHub 文件树。".to_string())?,
        "创建 GitHub 文件树",
    )
    .await?;
    if next_tree.sha == base_tree_sha {
        return Ok(GitHubCommitResult {
            commit_sha: head_sha,
            changed: false,
        });
    }
    let next_commit: GitHubShaResponse = github_json(
        github_request(client.post(format!("{repository_api}/git/commits")), token)
            .json(
                &json!({ "message": changes.commit_message, "tree": next_tree.sha, "parents": [head_sha] }),
            )
            .send()
            .await
            .map_err(|_| "无法创建 GitHub 提交。".to_string())?,
        "创建 GitHub 提交",
    )
    .await?;
    github_empty(
        github_request(
            client.patch(format!("{repository_api}/git/refs/heads/{encoded_branch}")),
            token,
        )
        .json(&json!({ "sha": next_commit.sha, "force": false }))
        .send()
        .await
        .map_err(|_| "无法更新 GitHub 分支。".to_string())?,
        "更新 GitHub 分支",
    )
    .await?;
    Ok(GitHubCommitResult {
        commit_sha: next_commit.sha,
        changed: true,
    })
}

async fn validate_bundle_ownership(
    client: &Client,
    token: &str,
    repository_api: &str,
    bundle_root: &str,
    source_id: &str,
    source_title: &str,
    tree: &[GitHubTreeItem],
) -> Result<(), String> {
    let existing = tree
        .iter()
        .filter(|item| is_inside_bundle(&item.path, bundle_root))
        .collect::<Vec<_>>();
    if existing.is_empty() {
        return Ok(());
    }
    let manifest_path = format!("{bundle_root}/.publish.json");
    let manifest = existing
        .iter()
        .find(|item| item.object_type == "blob" && item.path == manifest_path)
        .ok_or_else(|| "目标文章目录不是由落笔发布器管理的，已停止覆盖。".to_string())?;
    let blob: GitHubBlobResponse = github_json(
        github_request(
            client.get(format!("{repository_api}/git/blobs/{}", manifest.sha)),
            token,
        )
        .send()
        .await
        .map_err(|_| "无法读取远端文章发布标识。".to_string())?,
        "读取远端文章发布标识",
    )
    .await?;
    if blob.encoding != "base64" {
        return Err("远端文章发布标识编码无效。".to_string());
    }
    let decoded = STANDARD
        .decode(blob.content.replace(['\n', '\r'], ""))
        .map_err(|_| "远端文章发布标识无法解码。".to_string())?;
    let manifest: PublishManifest =
        serde_json::from_slice(&decoded).map_err(|_| "远端文章发布标识已损坏。".to_string())?;
    let belongs_to_source = manifest.source_id.as_deref() == Some(source_id);
    let adoptable_migration = manifest.source_id.is_none()
        && manifest.migrated_from.is_some()
        && manifest.title.trim() == source_title.trim();
    if !belongs_to_source && !adoptable_migration {
        return Err("这个博客 slug 已被另一篇文章占用，请更换 slug 后重试。".to_string());
    }
    Ok(())
}

fn github_request(builder: reqwest::RequestBuilder, token: &str) -> reqwest::RequestBuilder {
    builder
        .bearer_auth(token)
        .header(header::ACCEPT, "application/vnd.github+json")
        .header(header::USER_AGENT, "Loby")
        .header("X-GitHub-Api-Version", "2022-11-28")
}

async fn github_json<T: DeserializeOwned>(response: Response, action: &str) -> Result<T, String> {
    let status = response.status();
    let payload = response
        .text()
        .await
        .map_err(|_| format!("{action}时无法读取 GitHub 响应。"))?;
    if !status.is_success() {
        return Err(github_error(action, status.as_u16(), &payload));
    }
    serde_json::from_str(&payload).map_err(|_| format!("{action}时 GitHub 返回了无效响应。"))
}

async fn github_empty(response: Response, action: &str) -> Result<(), String> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let payload = response.text().await.unwrap_or_default();
    Err(github_error(action, status.as_u16(), &payload))
}

fn github_error(action: &str, status: u16, payload: &str) -> String {
    let message = serde_json::from_str::<Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("message")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| "未知错误".to_string());
    match status {
        401 => "GitHub 连接已失效，请在设置中重新连接。".to_string(),
        403 => "落笔没有目标仓库的 Contents 写权限，请在设置中管理 GitHub 仓库权限。".to_string(),
        404 => format!("{action}失败：找不到仓库、分支或文件。"),
        409 | 422 if action == "更新 GitHub 分支" => {
            "远端分支刚刚发生了变化，请重新发布以避免覆盖其他提交。".to_string()
        }
        _ => format!("{action}失败（GitHub {status}）：{message}"),
    }
}

fn validate_token_value(value: &str) -> Result<&str, String> {
    let token = value.trim();
    if token.is_empty() || token.len() > 4096 || token.chars().any(char::is_control) {
        return Err("GitHub 连接凭证格式无效，请重新连接。".to_string());
    }
    Ok(token)
}

fn validate_target(target: &GitHubTarget) -> Result<(), String> {
    validate_repository_coordinates(&target.owner, &target.repository, &target.branch)?;
    if target.bundle_root.is_empty()
        || target.bundle_root.starts_with('/')
        || !target.bundle_root.starts_with("content/")
        || target.bundle_root.split('/').any(|part| {
            part.is_empty()
                || part == "."
                || part == ".."
                || part.starts_with('.')
                || part.chars().any(char::is_control)
        })
    {
        return Err("文章目录无效。".to_string());
    }
    Ok(())
}

fn validate_repository_coordinates(
    owner: &str,
    repository: &str,
    branch: &str,
) -> Result<(), String> {
    if !safe_repository_segment(owner) || !safe_repository_segment(repository) {
        return Err("GitHub 仓库格式无效，请使用 owner/repository。".to_string());
    }
    if branch.trim().is_empty() || branch.len() > 240 || branch.chars().any(char::is_control) {
        return Err("GitHub 发布分支无效。".to_string());
    }
    Ok(())
}

fn validate_repository_path(path: &str) -> Result<(), String> {
    if path.is_empty()
        || path.starts_with('/')
        || path.len() > 1000
        || path.split('/').any(|part| {
            part.is_empty() || part == "." || part == ".." || part.chars().any(char::is_control)
        })
    {
        return Err(format!("GitHub 文件路径无效：{path}"));
    }
    Ok(())
}

fn safe_repository_segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
}

fn is_inside_bundle(path: &str, bundle_root: &str) -> bool {
    path == bundle_root || path.starts_with(&format!("{bundle_root}/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_repository_and_bundle_paths() {
        assert!(validate_target(&GitHubTarget {
            owner: "GeekMai90".to_string(),
            repository: "maixiansheng-blog".to_string(),
            branch: "main".to_string(),
            bundle_root: "content/posts/article-1".to_string(),
        })
        .is_ok());
        assert!(validate_target(&GitHubTarget {
            owner: "owner".to_string(),
            repository: "repo".to_string(),
            branch: "main".to_string(),
            bundle_root: "../secrets".to_string(),
        })
        .is_err());
    }

    #[test]
    fn detects_only_paths_inside_the_managed_bundle() {
        assert!(is_inside_bundle(
            "content/posts/slug/index.md",
            "content/posts/slug"
        ));
        assert!(!is_inside_bundle(
            "content/posts/slug-copy/index.md",
            "content/posts/slug"
        ));
    }
}
