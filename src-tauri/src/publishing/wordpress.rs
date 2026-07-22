//! [INPUT]: 依赖发布 secret store/共享 payload、reqwest、serde_json 与受控本地图片读取
//! [OUTPUT]: 向 publishing command facade 提供 publish_post WordPress 发布流程
//! [POS]: 发布领域，封装渠道适配、主题存储、凭证与上传流程
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::secret_store::{read_secret, validate_account};
use super::{
    api_error_message, image_content_type, PublishImage, WordPressPublishRequest,
    WordPressPublishResult,
};
use reqwest::Client;
use serde_json::{json, Value};
use std::{fs, path::Path};

pub(super) async fn publish_post(
    request: WordPressPublishRequest,
) -> Result<WordPressPublishResult, String> {
    let site_url = normalize_site_url(&request.site_url)?;
    let username = validate_account(&request.username)?.to_string();
    let status = validate_publish_status(&request.status)?;
    if request.title.trim().is_empty() || request.content.trim().is_empty() {
        return Err("标题和正文不能为空。".to_string());
    }
    let password = read_secret("wordpress", &username)?;
    let client = Client::new();
    let mut content = request.content;
    for image in request.images {
        let url = upload_image(&client, &site_url, &username, &password, &image).await?;
        content = content.replace(&image.placeholder, &url);
    }
    let response = client
        .post(format!("{site_url}/wp-json/wp/v2/posts"))
        .basic_auth(&username, Some(password))
        .json(&post_payload(
            request.title.trim(),
            &content,
            request.excerpt.trim(),
            status,
        ))
        .send()
        .await
        .map_err(|error| format!("WordPress 网络错误：{error}"))?;
    let code = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("WordPress 返回了无法解析的响应：{error}"))?;
    if !code.is_success() {
        return Err(format!(
            "WordPress API 错误 {}：{}",
            code.as_u16(),
            api_error_message(&payload)
        ));
    }
    Ok(WordPressPublishResult {
        id: payload
            .get("id")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
        status: payload
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or(status)
            .to_string(),
        link: payload
            .get("link")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

fn post_payload(title: &str, content: &str, excerpt: &str, status: &str) -> Value {
    json!({ "title": title, "content": content, "excerpt": excerpt, "status": status })
}

async fn upload_image(
    client: &Client,
    site_url: &str,
    username: &str,
    password: &str,
    image: &PublishImage,
) -> Result<String, String> {
    let path = Path::new(&image.source);
    let bytes =
        fs::read(path).map_err(|error| format!("无法读取发布图片 {}：{error}", image.source))?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("loby-image.png");
    let safe_filename = filename
        .chars()
        .map(|character| {
            if character == '"' || character.is_control() {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    let response = client
        .post(format!("{site_url}/wp-json/wp/v2/media"))
        .basic_auth(username, Some(password))
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{safe_filename}\""),
        )
        .header("Content-Type", image_content_type(filename))
        .body(bytes)
        .send()
        .await
        .map_err(|error| format!("WordPress 图片上传失败：{error}"))?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("WordPress 图片响应无效：{error}"))?;
    if !status.is_success() {
        return Err(format!(
            "WordPress 图片上传错误 {}：{}",
            status.as_u16(),
            api_error_message(&payload)
        ));
    }
    payload
        .get("source_url")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "WordPress 图片响应缺少 source_url。".to_string())
}

fn normalize_site_url(value: &str) -> Result<String, String> {
    let site_url = value.trim().trim_end_matches('/');
    let parsed =
        reqwest::Url::parse(site_url).map_err(|_| "WordPress 地址格式无效。".to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") || parsed.host_str().is_none() {
        return Err("WordPress 地址必须以 https:// 或 http:// 开头。".to_string());
    }
    Ok(site_url.to_string())
}

fn validate_publish_status(value: &str) -> Result<&str, String> {
    match value {
        "draft" | "publish" => Ok(value),
        _ => Err("发布状态必须是 draft 或 publish。".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_wordpress_site_urls() {
        assert_eq!(
            normalize_site_url("https://example.com/blog/").unwrap(),
            "https://example.com/blog"
        );
        assert!(normalize_site_url("example.com").is_err());
    }

    #[test]
    fn accepts_only_safe_publish_statuses() {
        assert_eq!(validate_publish_status("draft").unwrap(), "draft");
        assert_eq!(validate_publish_status("publish").unwrap(), "publish");
        assert!(validate_publish_status("delete").is_err());
    }

    #[test]
    fn builds_wordpress_post_payload() {
        assert_eq!(
            post_payload("标题", "<p>正文</p>", "摘要", "draft"),
            json!({ "title": "标题", "content": "<p>正文</p>", "excerpt": "摘要", "status": "draft" })
        );
    }
}
