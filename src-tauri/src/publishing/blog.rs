//! [INPUT]: 依赖 GitHub 身份/传输适配器、Hugo page bundle 契约、本地图片与 Tauri IPC Channel
//! [OUTPUT]: 向 publishing command facade 提供单篇与项目批量 Hugo 发布，并向帮助中心编排器提供受写作库边界保护的内容哈希图片读取
//! [POS]: 发布领域的博客编排器，拥有发布状态顺序与内容转换，不拥有凭证生命周期和 GitHub HTTP 细节
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::github::{
    publish_bundles, publish_files, verify_repository_access, GitHubBundle, GitHubFile,
    GitHubRepositoryTarget, GitHubTarget,
};
use super::github_auth;
use super::{
    BlogPublishBatchRequest, BlogPublishBatchResult, BlogPublishProgress, BlogPublishRequest,
    BlogPublishResult, PublishImage,
};
use serde_json::json;
use serde_yaml::{Mapping as YamlMapping, Value as YamlValue};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs};
use tauri::ipc::Channel;

const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

pub(super) async fn publish_post(
    request: BlogPublishRequest,
    on_progress: &Channel<BlogPublishProgress>,
) -> Result<BlogPublishResult, String> {
    let (owner, repository) = parse_repository(&request.repository)?;
    let branch = nonempty(&request.branch, "GitHub 发布分支不能为空。")?.to_string();
    let _ = on_progress.send(BlogPublishProgress::CheckingAuthorization);
    let token = github_auth::access_token().await?;
    verify_repository_access(&token, &owner, &repository).await?;

    let _ = on_progress.send(BlogPublishProgress::Preparing);
    let _ = on_progress.send(BlogPublishProgress::Packaging {
        completed: 0,
        total: request.images.len(),
    });
    let prepared = prepare_blog_post(&request)?;
    let _ = on_progress.send(BlogPublishProgress::Packaging {
        completed: request.images.len(),
        total: request.images.len(),
    });

    let _ = on_progress.send(BlogPublishProgress::Committing);
    let target = GitHubTarget {
        owner,
        repository,
        branch,
        bundle_root: prepared.bundle_root.clone(),
    };
    let commit = publish_files(
        &token,
        &target,
        prepared.files,
        &prepared.source_id,
        &prepared.title,
        &format!("publish: {}", prepared.title),
    )
    .await?;
    let _ = on_progress.send(BlogPublishProgress::Finished);
    Ok(BlogPublishResult {
        source_id: prepared.source_id,
        slug: prepared.slug.clone(),
        url: if prepared.draft {
            String::new()
        } else {
            format!("{}/posts/{}/", prepared.site_url, prepared.slug)
        },
        commit_sha: commit.commit_sha,
        source_hash: prepared.source_hash,
        draft: prepared.draft,
        changed: commit.changed,
    })
}

pub(super) async fn publish_posts(
    request: BlogPublishBatchRequest,
    on_progress: &Channel<BlogPublishProgress>,
) -> Result<BlogPublishBatchResult, String> {
    let (owner, repository) = parse_repository(&request.repository)?;
    let branch = nonempty(&request.branch, "GitHub 发布分支不能为空。")?.to_string();
    if request.documents.is_empty() {
        return Err("当前项目没有可发布的文稿。".to_string());
    }
    let _ = on_progress.send(BlogPublishProgress::CheckingAuthorization);
    let token = github_auth::access_token().await?;
    verify_repository_access(&token, &owner, &repository).await?;
    let _ = on_progress.send(BlogPublishProgress::Preparing);
    let _ = on_progress.send(BlogPublishProgress::Packaging {
        completed: 0,
        total: request.documents.len(),
    });

    let total = request.documents.len();
    let mut prepared_posts = Vec::with_capacity(total);
    for (index, document) in request.documents.into_iter().enumerate() {
        let post_request = BlogPublishRequest {
            repository: request.repository.clone(),
            branch: branch.clone(),
            content_root: request.content_root.clone(),
            site_url: request.site_url.clone(),
            library_path: request.library_path.clone(),
            source_id: document.source_id,
            title: document.title,
            body: document.body,
            description: document.description,
            date: document.date,
            tags: document.tags,
            draft: request.draft,
            slug: document.slug,
            images: document.images,
        };
        prepared_posts.push(prepare_blog_post(&post_request)?);
        let _ = on_progress.send(BlogPublishProgress::Packaging {
            completed: index + 1,
            total,
        });
    }

    let bundles = prepared_posts
        .iter_mut()
        .map(|post| GitHubBundle {
            bundle_root: post.bundle_root.clone(),
            files: std::mem::take(&mut post.files),
            source_id: post.source_id.clone(),
            source_title: post.title.clone(),
        })
        .collect();
    let _ = on_progress.send(BlogPublishProgress::Committing);
    let commit = publish_bundles(
        &token,
        &GitHubRepositoryTarget {
            owner,
            repository,
            branch,
        },
        bundles,
        &format!("publish: {}", request.project_title.trim()),
    )
    .await?;
    let documents = prepared_posts
        .into_iter()
        .map(|post| BlogPublishResult {
            source_id: post.source_id,
            slug: post.slug.clone(),
            url: if post.draft {
                String::new()
            } else {
                format!("{}/posts/{}/", post.site_url, post.slug)
            },
            commit_sha: commit.commit_sha.clone(),
            source_hash: post.source_hash,
            draft: post.draft,
            changed: commit.changed,
        })
        .collect::<Vec<_>>();
    let _ = on_progress.send(BlogPublishProgress::Finished);
    Ok(BlogPublishBatchResult {
        commit_sha: commit.commit_sha,
        changed: commit.changed,
        published_count: documents.len(),
        documents,
    })
}

struct PreparedBlogPost {
    source_id: String,
    title: String,
    slug: String,
    source_hash: String,
    draft: bool,
    site_url: String,
    bundle_root: String,
    files: Vec<GitHubFile>,
}

fn prepare_blog_post(request: &BlogPublishRequest) -> Result<PreparedBlogPost, String> {
    let title = nonempty(&request.title, "博客标题不能为空。")?;
    let source_id = nonempty(&request.source_id, "文稿发布身份无效。")?;
    let content_root = normalize_content_root(&request.content_root)?;
    let site_url = normalize_site_url(&request.site_url)?;
    let slug = if request.slug.trim().is_empty() {
        inferred_slug(title, source_id)?
    } else {
        normalize_slug(&request.slug)?
    };
    let date = normalize_date(&request.date)?;
    if request.body.trim().is_empty() {
        return Err("博客正文不能为空。".to_string());
    }

    let source_hash = source_hash(request, &slug);
    let mut body = request.body.clone();
    let mut bundle_files = Vec::new();
    let mut published_resource_names = BTreeMap::<String, String>::new();
    for image in &request.images {
        let resource = prepare_image(&request.library_path, image)?;
        body = body.replace(&image.placeholder, &resource.name);
        if !body.contains(&resource.name) {
            return Err(format!("无法在正文中定位发布图片：{}", image.alt));
        }
        if published_resource_names
            .insert(resource.name.clone(), image.source.clone())
            .is_none()
        {
            bundle_files.push(GitHubFile {
                path: format!("{content_root}/{slug}/{}", resource.name),
                bytes: resource.bytes,
            });
        }
    }
    if request
        .images
        .iter()
        .any(|image| body.contains(&image.placeholder))
    {
        return Err("正文中仍有未处理的图片占位符。".to_string());
    }

    let body = strip_matching_h1(&body, title);
    let cover = first_markdown_image_destination(&body);
    let index_markdown = render_hugo_markdown(
        title,
        &date,
        request.draft,
        &request.tags,
        request.description.trim(),
        cover.as_deref(),
        &body,
    )?;
    let manifest = serde_json::to_vec_pretty(&json!({
        "version": 1,
        "sourceId": source_id,
        "sourceHash": source_hash,
        "slug": slug,
        "title": title,
    }))
    .map_err(|_| "无法生成 GitHub 发布标识。".to_string())?;
    let bundle_root = format!("{content_root}/{slug}");
    bundle_files.push(GitHubFile {
        path: format!("{bundle_root}/index.md"),
        bytes: index_markdown.into_bytes(),
    });
    bundle_files.push(GitHubFile {
        path: format!("{bundle_root}/.publish.json"),
        bytes: [manifest, b"\n".to_vec()].concat(),
    });
    Ok(PreparedBlogPost {
        source_id: source_id.to_string(),
        title: title.to_string(),
        slug,
        source_hash,
        draft: request.draft,
        site_url,
        bundle_root,
        files: bundle_files,
    })
}

pub(super) struct PreparedImage {
    pub(super) name: String,
    pub(super) bytes: Vec<u8>,
}

pub(super) fn prepare_image(
    library_path: &str,
    image: &PublishImage,
) -> Result<PreparedImage, String> {
    let library_root = fs::canonicalize(library_path)
        .map_err(|_| "无法读取当前写作文件夹，不能发布本地图片。".to_string())?;
    let source =
        fs::canonicalize(&image.source).map_err(|_| format!("找不到发布图片：{}", image.source))?;
    if !source.starts_with(&library_root) || !source.is_file() {
        return Err(format!("发布图片不在当前写作文件夹中：{}", image.source));
    }
    let metadata =
        fs::metadata(&source).map_err(|_| format!("无法读取发布图片：{}", image.source))?;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(format!("发布图片超过 25 MB：{}", image.source));
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "avif"
    ) {
        return Err(format!("不支持的博客图片格式：{}", source.display()));
    }
    let bytes = fs::read(&source).map_err(|_| format!("无法读取发布图片：{}", source.display()))?;
    let digest = hex_digest(&bytes);
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .map(normalize_resource_stem)
        .unwrap_or_else(|| "image".to_string());
    Ok(PreparedImage {
        name: format!("{}-{stem}.{extension}", &digest[..12]),
        bytes,
    })
}

fn render_hugo_markdown(
    title: &str,
    date: &str,
    draft: bool,
    tags: &[String],
    description: &str,
    cover: Option<&str>,
    body: &str,
) -> Result<String, String> {
    let mut frontmatter = YamlMapping::new();
    frontmatter.insert(
        YamlValue::String("title".to_string()),
        YamlValue::String(title.to_string()),
    );
    frontmatter.insert(
        YamlValue::String("date".to_string()),
        YamlValue::String(date.to_string()),
    );
    frontmatter.insert(
        YamlValue::String("draft".to_string()),
        YamlValue::Bool(draft),
    );
    frontmatter.insert(
        YamlValue::String("tags".to_string()),
        YamlValue::Sequence(
            tags.iter()
                .map(|tag| tag.trim())
                .filter(|tag| !tag.is_empty())
                .map(|tag| YamlValue::String(tag.to_string()))
                .collect(),
        ),
    );
    if !description.is_empty() {
        frontmatter.insert(
            YamlValue::String("description".to_string()),
            YamlValue::String(description.to_string()),
        );
    }
    if let Some(cover) = cover.filter(|value| !value.trim().is_empty()) {
        let mut cover_mapping = YamlMapping::new();
        cover_mapping.insert(
            YamlValue::String("image".to_string()),
            YamlValue::String(cover.to_string()),
        );
        cover_mapping.insert(
            YamlValue::String("relative".to_string()),
            YamlValue::Bool(!is_remote_url(cover)),
        );
        frontmatter.insert(
            YamlValue::String("cover".to_string()),
            YamlValue::Mapping(cover_mapping),
        );
    }
    let yaml = serde_yaml::to_string(&frontmatter)
        .map_err(|_| "无法生成 Hugo 文章元数据。".to_string())?;
    Ok(format!("---\n{yaml}---\n\n{}\n", body.trim()))
}

fn source_hash(request: &BlogPublishRequest, slug: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(request.source_id.as_bytes());
    hasher.update([0]);
    hasher.update(request.title.as_bytes());
    hasher.update([0]);
    hasher.update(slug.as_bytes());
    hasher.update([0]);
    hasher.update(request.body.as_bytes());
    for image in &request.images {
        hasher.update([0]);
        hasher.update(image.source.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

fn inferred_slug(_title: &str, source_id: &str) -> Result<String, String> {
    if let Some(public_id) = crate::library::sheet_public_id(source_id) {
        return Ok(public_id.to_string());
    }
    Err("当前文稿仍使用旧 ID，请先在设置中重建索引。".to_string())
}

fn normalize_slug(value: &str) -> Result<String, String> {
    let mut slug = String::new();
    let mut pending_dash = false;
    for character in value.trim().to_lowercase().chars() {
        if character.is_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            slug.push(character);
            pending_dash = false;
        } else if matches!(character, '-' | '_' | ' ' | '.') {
            pending_dash = true;
        }
        if slug.chars().count() >= 120 {
            break;
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() || slug == "." || slug == ".." {
        return Err("博客 slug 无效，请使用文字、字母、数字或连字符。".to_string());
    }
    Ok(slug)
}

fn normalize_resource_stem(value: &str) -> String {
    let mut output = String::new();
    let mut pending_dash = false;
    for character in value.trim().chars() {
        if character.is_alphanumeric() || matches!(character, '-' | '_') {
            if pending_dash && !output.is_empty() {
                output.push('-');
            }
            output.push(character);
            pending_dash = false;
        } else if matches!(character, ' ' | '.') {
            pending_dash = true;
        }
        if output.chars().count() >= 80 {
            break;
        }
    }
    let output = output.trim_matches(['-', '_']).to_string();
    if output.is_empty() {
        "image".to_string()
    } else {
        output
    }
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

fn first_markdown_image_destination(body: &str) -> Option<String> {
    let image_start = body.find("![")?;
    let target_start = body[image_start..].find("](")? + image_start + 2;
    let target_end = body[target_start..].find(')')? + target_start;
    let target = body[target_start..target_end]
        .trim()
        .trim_matches(['<', '>']);
    (!target.is_empty()).then(|| target.to_string())
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

fn normalize_content_root(value: &str) -> Result<String, String> {
    let root = value.trim().trim_matches('/');
    if root.is_empty()
        || !root.starts_with("content/")
        || root.split('/').any(|part| {
            part.is_empty()
                || part == "."
                || part == ".."
                || part.starts_with('.')
                || part.chars().any(char::is_control)
        })
    {
        return Err("文章目录必须位于 content/ 下。".to_string());
    }
    Ok(root.to_string())
}

fn normalize_site_url(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(value).map_err(|_| "站点地址格式无效。".to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") || parsed.host_str().is_none() {
        return Err("站点地址必须以 https:// 或 http:// 开头。".to_string());
    }
    Ok(value.to_string())
}

fn normalize_date(value: &str) -> Result<String, String> {
    let value = value.trim();
    let valid = value.len() == 10
        && value.as_bytes()[4] == b'-'
        && value.as_bytes()[7] == b'-'
        && value
            .chars()
            .enumerate()
            .all(|(index, character)| matches!(index, 4 | 7) || character.is_ascii_digit());
    if !valid {
        return Err("文章发布日期必须使用 YYYY-MM-DD 格式。".to_string());
    }
    Ok(value.to_string())
}

fn nonempty<'a>(value: &'a str, message: &str) -> Result<&'a str, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().any(char::is_control) {
        return Err(message.to_string());
    }
    Ok(value)
}

fn is_remote_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn hex_digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_uses_canonical_sheet_identity() {
        assert!(inferred_slug("为什么 Markdown 对 AI 更友好", "sheet-1").is_err());
        assert!(normalize_slug("../bad").is_ok());
        assert!(normalize_slug("---").is_err());
        assert_eq!(
            inferred_slug("标题不会进入地址", "sheet-0123456789abcdefghjkmnpqrs").unwrap(),
            "0123456789abcdefghjkmnpqrs"
        );
    }

    #[test]
    fn removes_only_a_matching_first_level_title() {
        assert_eq!(strip_matching_h1("# 标题\n\n正文", "标题"), "正文");
        assert_eq!(
            strip_matching_h1("# 另一标题\n\n正文", "标题"),
            "# 另一标题\n\n正文"
        );
    }

    #[test]
    fn renders_hugo_frontmatter_and_relative_cover() {
        let rendered = render_hugo_markdown(
            "标题",
            "2026-07-24",
            false,
            &["AI".to_string()],
            "摘要",
            Some("abc-image.png"),
            "正文",
        )
        .unwrap();
        assert!(rendered.contains("title: 标题"));
        assert!(rendered.contains("draft: false"));
        assert!(rendered.contains("relative: true"));
        assert!(rendered.ends_with("正文\n"));
    }

    #[test]
    fn omits_optional_description_when_the_sheet_has_no_description() {
        let rendered =
            render_hugo_markdown("标题", "2026-07-24", false, &[], "", None, "正文").unwrap();

        assert!(!rendered.contains("description:"));
    }
}
