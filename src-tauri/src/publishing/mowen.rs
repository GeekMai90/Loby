use super::keychain::read_secret;
use super::{api_error_message, image_content_type, MowenPublishRequest, PublishImage};
use reqwest::Client;
use serde_json::{json, Value};
use std::{fs, path::Path};

const MOWEN_BASE_URL: &str = "https://open.mowen.cn/api/open/api/v1";

pub(super) async fn publish_note(request: MowenPublishRequest) -> Result<Value, String> {
    if request.body.get("type").and_then(Value::as_str) != Some("doc") {
        return Err("墨问正文格式无效。".to_string());
    }
    let api_key = read_secret("mowen", "default")?;
    let client = Client::new();
    let mut body = request.body;
    let mut uploaded_images = Vec::new();
    for image in &request.images {
        uploaded_images.push(upload_image(&client, &api_key, image).await?);
    }
    replace_attachment_markers(&mut body, &request.images, &uploaded_images)?;
    post_json(
        &client,
        &api_key,
        &format!("{MOWEN_BASE_URL}/note/create"),
        note_payload(body, request.auto_publish, request.tags),
    )
    .await
}

fn note_payload(body: Value, auto_publish: bool, tags: Vec<String>) -> Value {
    json!({ "body": body, "settings": { "autoPublish": auto_publish, "tags": tags } })
}

async fn upload_image(
    client: &Client,
    api_key: &str,
    image: &PublishImage,
) -> Result<String, String> {
    if image.source.starts_with("https://") || image.source.starts_with("http://") {
        let filename = image
            .source
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .unwrap_or("nibva-image.png");
        let payload = post_json(
            client,
            api_key,
            &format!("{MOWEN_BASE_URL}/upload/url"),
            json!({ "fileType": 1, "url": image.source, "fileName": filename }),
        )
        .await?;
        return extract_file_id(&payload);
    }

    let path = Path::new(&image.source);
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("nibva-image.png");
    let prepared = post_json(
        client,
        api_key,
        &format!("{MOWEN_BASE_URL}/upload/prepare"),
        json!({ "fileType": 1, "fileName": filename }),
    )
    .await?;
    let form = prepared
        .get("form")
        .and_then(Value::as_object)
        .ok_or_else(|| "墨问图片上传准备响应无效。".to_string())?;
    let endpoint = form
        .get("endpoint")
        .and_then(Value::as_str)
        .ok_or_else(|| "墨问图片上传缺少 endpoint。".to_string())?;
    let bytes =
        fs::read(path).map_err(|error| format!("无法读取发布图片 {}：{error}", image.source))?;
    let mut multipart = reqwest::multipart::Form::new();
    for (key, value) in form {
        if key == "endpoint" || key == "file" {
            continue;
        }
        multipart = multipart.text(
            key.clone(),
            value
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| value.to_string()),
        );
    }
    multipart = multipart.part(
        "file",
        reqwest::multipart::Part::bytes(bytes)
            .file_name(filename.to_string())
            .mime_str(image_content_type(filename))
            .map_err(|error| error.to_string())?,
    );
    let response = client
        .post(endpoint)
        .multipart(multipart)
        .send()
        .await
        .map_err(|error| format!("墨问图片上传失败：{error}"))?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("墨问图片响应无效：{error}"))?;
    if !status.is_success() {
        return Err(format!(
            "墨问图片上传错误 {}：{}",
            status.as_u16(),
            api_error_message(&payload)
        ));
    }
    extract_file_id(&payload)
}

async fn post_json(
    client: &Client,
    api_key: &str,
    url: &str,
    body: Value,
) -> Result<Value, String> {
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("墨问网络错误：{error}"))?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("墨问响应无效：{error}"))?;
    if !status.is_success() {
        return Err(format!(
            "墨问 API 错误 {}：{}",
            status.as_u16(),
            api_error_message(&payload)
        ));
    }
    Ok(payload)
}

fn extract_file_id(payload: &Value) -> Result<String, String> {
    payload
        .pointer("/file/fileId")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "墨问图片响应缺少 file.fileId。".to_string())
}

fn replace_attachment_markers(
    body: &mut Value,
    images: &[PublishImage],
    file_ids: &[String],
) -> Result<(), String> {
    let content = body
        .get_mut("content")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "墨问正文缺少 content。".to_string())?;
    for node in content.iter_mut() {
        if node.get("type").and_then(Value::as_str) != Some("mowen_attachment") {
            continue;
        }
        let index = node
            .pointer("/attrs/index")
            .and_then(Value::as_u64)
            .unwrap_or(u64::MAX) as usize;
        let image = images
            .get(index)
            .ok_or_else(|| "墨问图片标记索引无效。".to_string())?;
        let file_id = file_ids
            .get(index)
            .ok_or_else(|| "墨问图片上传结果缺失。".to_string())?;
        *node = json!({ "type": "image", "attrs": { "uuid": file_id, "align": "center", "alt": image.alt } });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_mowen_note_payload_with_draft_default() {
        let body = json!({ "type": "doc", "content": [] });
        assert_eq!(
            note_payload(body.clone(), false, vec!["写作".to_string()]),
            json!({ "body": body, "settings": { "autoPublish": false, "tags": ["写作"] } })
        );
    }

    #[test]
    fn replaces_image_markers_with_uploaded_file_ids() {
        let mut body = json!({ "type": "doc", "content": [{ "type": "mowen_attachment", "attrs": { "index": 0 } }] });
        let images = vec![PublishImage {
            source: "/tmp/image.png".to_string(),
            alt: "封面".to_string(),
            placeholder: "@@MOWEN_ATTACHMENT:0@@".to_string(),
        }];
        replace_attachment_markers(&mut body, &images, &["file-1".to_string()]).unwrap();
        assert_eq!(body.pointer("/content/0/type"), Some(&json!("image")));
        assert_eq!(
            body.pointer("/content/0/attrs/uuid"),
            Some(&json!("file-1"))
        );
        assert_eq!(body.pointer("/content/0/attrs/alt"), Some(&json!("封面")));
    }
}
