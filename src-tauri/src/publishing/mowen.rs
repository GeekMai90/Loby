use super::secret_store::read_secret;
use super::{
    api_error_message, image_content_type, MowenPublishProgress, MowenPublishRequest, PublishImage,
};
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, Rgb, RgbImage};
use reqwest::Client;
use serde_json::{json, Value};
use std::{
    fs::{self, File},
    io::BufWriter,
    path::Path,
    time::Duration,
};
use tauri::ipc::Channel;
use tempfile::TempDir;

const MOWEN_BASE_URL: &str = "https://open.mowen.cn/api/open/api/v1";
const MOWEN_MCP_URL: &str = "https://open.mowen.cn/api/open/mcp/v1/note";
const OPTIMIZE_IMAGE_MIN_BYTES: u64 = 1_000_000;
const OPTIMIZED_IMAGE_MAX_DIMENSION: u32 = 2_400;
const OPTIMIZED_IMAGE_JPEG_QUALITY: u8 = 85;

pub(super) async fn validate_api_key(api_key: &str) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() || api_key.len() > 4096 || api_key.chars().any(char::is_control) {
        return Err("墨问 API Key 格式无效。".to_string());
    }

    let response = Client::new()
        .post(MOWEN_MCP_URL)
        .query(&[("key", api_key)])
        .header("Accept", "application/json, text/event-stream")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": { "name": "Nibva", "version": env!("CARGO_PKG_VERSION") }
            }
        }))
        .timeout(Duration::from_secs(12))
        .send()
        .await
        .map_err(|_| "无法连接墨问，请检查网络后重试。".to_string())?;
    let status = response.status();
    let payload = response
        .text()
        .await
        .map_err(|_| "无法读取墨问验证响应。".to_string())?;

    if !status.is_success() || !is_valid_mcp_initialize_response(&payload) {
        return Err("API Key 无效，或墨问未通过验证。".to_string());
    }
    Ok(())
}

fn is_valid_mcp_initialize_response(payload: &str) -> bool {
    payload.contains("\"result\"")
        && (payload.contains("\"protocolVersion\"") || payload.contains("\"serverInfo\""))
}

pub(super) async fn publish_note(
    request: MowenPublishRequest,
    on_progress: &Channel<MowenPublishProgress>,
) -> Result<Value, String> {
    let _ = on_progress.send(MowenPublishProgress::Preparing);
    if request.body.get("type").and_then(Value::as_str) != Some("doc") {
        return Err("墨问正文格式无效。".to_string());
    }
    validate_attachment_markers(&request.body, request.images.len())?;
    let api_key = read_secret("mowen", "default")?;
    let client = Client::new();
    let mut body = request.body;
    let publish_temp_dir = tempfile::Builder::new()
        .prefix("nibva-mowen-publish-")
        .tempdir()
        .map_err(|error| format!("无法创建发布图片临时目录：{error}"))?;
    let upload_images =
        prepare_upload_images(&request.images, &publish_temp_dir, OPTIMIZE_IMAGE_MIN_BYTES);
    let mut uploaded_images = Vec::new();
    let image_count = upload_images.len();
    for (index, image) in upload_images.iter().enumerate() {
        let _ = on_progress.send(MowenPublishProgress::Uploading {
            completed: index,
            total: image_count,
        });
        uploaded_images.push(upload_image(&client, &api_key, image).await?);
        let _ = on_progress.send(MowenPublishProgress::Uploading {
            completed: index + 1,
            total: image_count,
        });
    }
    drop(upload_images);
    drop(publish_temp_dir);
    replace_attachment_markers(&mut body, &request.images, &uploaded_images)?;
    let _ = on_progress.send(MowenPublishProgress::Creating);
    let result = post_json(
        &client,
        &api_key,
        &format!("{MOWEN_BASE_URL}/note/create"),
        note_payload(body, request.auto_publish, request.tags),
    )
    .await?;
    let _ = on_progress.send(MowenPublishProgress::Finished);
    Ok(result)
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

fn prepare_upload_images(
    images: &[PublishImage],
    temp_dir: &TempDir,
    min_source_bytes: u64,
) -> Vec<PublishImage> {
    images
        .iter()
        .enumerate()
        .map(|(index, image)| {
            let mut prepared = image.clone();
            let source_path = Path::new(&image.source);
            if image.source.starts_with("https://")
                || image.source.starts_with("http://")
                || !is_optimizable_image(source_path, min_source_bytes)
            {
                return prepared;
            }

            let optimized_path = temp_dir.path().join(format!("image-{}.jpg", index + 1));
            if create_optimized_image(source_path, &optimized_path).is_ok()
                && optimized_file_is_smaller(source_path, &optimized_path)
            {
                prepared.source = optimized_path.to_string_lossy().into_owned();
            } else {
                let _ = fs::remove_file(optimized_path);
            }
            prepared
        })
        .collect()
}

fn is_optimizable_image(path: &Path, min_source_bytes: u64) -> bool {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(extension.as_str(), "jpeg" | "jpg" | "png" | "webp")
        && fs::metadata(path)
            .map(|metadata| metadata.len() >= min_source_bytes)
            .unwrap_or(false)
}

fn create_optimized_image(source: &Path, destination: &Path) -> Result<(), String> {
    let decoded = image::open(source).map_err(|error| error.to_string())?;
    let resized = resize_for_publish(decoded);
    let flattened = flatten_onto_white(resized);
    let file = File::create(destination).map_err(|error| error.to_string())?;
    let mut encoder =
        JpegEncoder::new_with_quality(BufWriter::new(file), OPTIMIZED_IMAGE_JPEG_QUALITY);
    encoder
        .encode_image(&DynamicImage::ImageRgb8(flattened))
        .map_err(|error| error.to_string())
}

fn resize_for_publish(image: DynamicImage) -> DynamicImage {
    let width = image.width();
    let height = image.height();
    if width.max(height) <= OPTIMIZED_IMAGE_MAX_DIMENSION {
        return image;
    }
    image.resize(
        OPTIMIZED_IMAGE_MAX_DIMENSION,
        OPTIMIZED_IMAGE_MAX_DIMENSION,
        FilterType::Lanczos3,
    )
}

fn flatten_onto_white(image: DynamicImage) -> RgbImage {
    let rgba = image.to_rgba8();
    RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let pixel = rgba.get_pixel(x, y).0;
        let alpha = u16::from(pixel[3]);
        let blend =
            |channel: u8| ((u16::from(channel) * alpha + 255 * (255 - alpha) + 127) / 255) as u8;
        Rgb([blend(pixel[0]), blend(pixel[1]), blend(pixel[2])])
    })
}

fn optimized_file_is_smaller(source: &Path, optimized: &Path) -> bool {
    let source_size = fs::metadata(source).map(|metadata| metadata.len());
    let optimized_size = fs::metadata(optimized).map(|metadata| metadata.len());
    matches!((source_size, optimized_size), (Ok(source), Ok(optimized)) if optimized < source)
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

fn validate_attachment_markers(body: &Value, image_count: usize) -> Result<(), String> {
    let content = body
        .get("content")
        .and_then(Value::as_array)
        .ok_or_else(|| "墨问正文缺少 content。".to_string())?;
    let mut marker_indexes = Vec::new();
    for node in content {
        if node.get("type").and_then(Value::as_str) != Some("mowen_attachment") {
            continue;
        }
        let index = node
            .pointer("/attrs/index")
            .and_then(Value::as_u64)
            .ok_or_else(|| "墨问图片标记索引无效。".to_string())? as usize;
        marker_indexes.push(index);
    }
    marker_indexes.sort_unstable();
    let expected_indexes = (0..image_count).collect::<Vec<_>>();
    if marker_indexes != expected_indexes {
        return Err(format!(
            "正文图片标记与待上传图片不一致（正文 {} 张，待上传 {} 张）。",
            marker_indexes.len(),
            image_count
        ));
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

    #[test]
    fn validates_every_uploaded_image_has_one_marker() {
        let body = json!({
            "type": "doc",
            "content": [
                { "type": "mowen_attachment", "attrs": { "index": 0 } },
                { "type": "paragraph", "content": [{ "type": "text", "text": "正文" }] },
                { "type": "mowen_attachment", "attrs": { "index": 1 } }
            ]
        });
        assert!(validate_attachment_markers(&body, 2).is_ok());
        assert!(validate_attachment_markers(&body, 3).is_err());
    }

    #[test]
    fn optimizes_large_images_in_a_self_cleaning_temp_directory() {
        let source_dir = tempfile::tempdir().unwrap();
        let source_path = source_dir.path().join("source.png");
        let source_image = RgbImage::from_fn(900, 700, |x, y| {
            let seed = x.wrapping_mul(1_103_515_245) ^ y.wrapping_mul(12_345);
            Rgb([seed as u8, (seed >> 8) as u8, (seed >> 16) as u8])
        });
        source_image.save(&source_path).unwrap();
        let original = fs::read(&source_path).unwrap();
        let temp_path;
        {
            let publish_temp_dir = tempfile::tempdir().unwrap();
            let images = vec![PublishImage {
                source: source_path.to_string_lossy().into_owned(),
                alt: "测试图".to_string(),
                placeholder: "@@MOWEN_ATTACHMENT:0@@".to_string(),
            }];
            let prepared = prepare_upload_images(&images, &publish_temp_dir, 0);
            temp_path = Path::new(&prepared[0].source).to_path_buf();
            assert_ne!(temp_path, source_path);
            assert!(temp_path.exists());
            assert!(optimized_file_is_smaller(&source_path, &temp_path));
            assert_eq!(fs::read(&source_path).unwrap(), original);
        }
        assert!(!temp_path.exists());
        assert_eq!(fs::read(&source_path).unwrap(), original);
    }

    #[test]
    fn accepts_json_and_sse_mcp_initialize_results() {
        assert!(is_valid_mcp_initialize_response(
            r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26"}}"#
        ));
        assert!(is_valid_mcp_initialize_response(
            "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"serverInfo\":{\"name\":\"mowen\"}}}\n\n"
        ));
        assert!(!is_valid_mcp_initialize_response(
            r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32000}}"#
        ));
    }
}
