//! [INPUT]: 依赖 Unsplash API、原生私有配置、resources::images 的本地资源保存与 image 图片编解码
//! [OUTPUT]: 向 renderer 提供用户自有 Unsplash Key 的状态/保存/删除/验证、横版搜索与随机图片批次、下载追踪、受限尺寸下载、裁剪与 assets/images 落盘 commands
//! [POS]: native Unsplash 领域边界；凭证只留在应用配置，远程图片只在原生层下载并转换为本地 JPEG，renderer 不接触 API Key
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use crate::{
    agent::credentials::{delete_secret, has_secret, read_provider_secret, save_secret},
    models::ProjectResourceFile,
    resources::images::save_project_image_bytes,
};
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, GenericImageView, ImageReader};
use reqwest::{Client, Response, Url};
use serde::{Deserialize, Serialize};
use std::{io::Cursor, path::PathBuf, sync::OnceLock, time::Duration};

const API_ROOT: &str = "https://api.unsplash.com";
const UNSPLASH_CREDENTIAL_OWNER: &str = "unsplash-api";
const MAX_API_KEY_LENGTH: usize = 256;
const MAX_QUERY_LENGTH: usize = 160;
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_OUTPUT_IMAGE_EDGE: u32 = 2560;
const DOWNLOAD_IMAGE_WIDTH: u32 = 2400;
const DOWNLOAD_IMAGE_QUALITY: &str = "85";
const UNSPLASH_API_VERSION: &str = "v1";
const SEARCH_PAGE_SIZE: u32 = 24;
const MAX_RANDOM_PHOTO_COUNT: u32 = 30;

static IMAGE_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashSettings {
    pub(crate) configured: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashSearchResult {
    pub(crate) total: u32,
    pub(crate) total_pages: u32,
    pub(crate) results: Vec<UnsplashPhoto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashPhoto {
    pub(crate) id: String,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) alt_description: String,
    pub(crate) description: String,
    pub(crate) user: UnsplashUser,
    pub(crate) urls: UnsplashPhotoUrls,
    pub(crate) links: UnsplashPhotoLinks,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashUser {
    pub(crate) name: String,
    pub(crate) username: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashPhotoUrls {
    pub(crate) thumb: String,
    pub(crate) small: String,
    pub(crate) regular: String,
    pub(crate) raw: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsplashPhotoLinks {
    pub(crate) download_location: String,
    pub(crate) html: String,
}

#[derive(Debug, Deserialize)]
struct UnsplashSearchResponse {
    #[serde(default)]
    total: u32,
    #[serde(default, rename = "total_pages")]
    total_pages: u32,
    #[serde(default)]
    results: Vec<UnsplashPhotoResponse>,
}

#[derive(Debug, Deserialize, Default)]
struct UnsplashPhotoResponse {
    #[serde(default)]
    id: String,
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
    #[serde(default)]
    alt_description: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    user: UnsplashUserResponse,
    #[serde(default)]
    urls: UnsplashPhotoUrlsResponse,
    #[serde(default)]
    links: UnsplashPhotoLinksResponse,
}

#[derive(Debug, Deserialize, Default)]
struct UnsplashUserResponse {
    #[serde(default)]
    name: String,
    #[serde(default)]
    username: String,
}

#[derive(Debug, Deserialize, Default)]
struct UnsplashPhotoUrlsResponse {
    #[serde(default)]
    thumb: String,
    #[serde(default)]
    small: String,
    #[serde(default)]
    regular: String,
    #[serde(default)]
    raw: String,
}

#[derive(Debug, Deserialize, Default)]
struct UnsplashPhotoLinksResponse {
    #[serde(default)]
    download_location: String,
    #[serde(default)]
    html: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveUnsplashImageRequest {
    pub(crate) path: String,
    pub(crate) project_id: String,
    pub(crate) project_title: String,
    pub(crate) photo_id: String,
    pub(crate) image_url: String,
    pub(crate) download_location: String,
    pub(crate) crop: CropSelection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CropSelection {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
    pub(crate) aspect_width: u32,
    pub(crate) aspect_height: u32,
}

#[tauri::command]
pub(crate) fn get_unsplash_settings() -> Result<UnsplashSettings, String> {
    Ok(UnsplashSettings {
        configured: has_secret(UNSPLASH_CREDENTIAL_OWNER)?,
    })
}

#[tauri::command]
pub(crate) fn save_unsplash_api_key(api_key: String) -> Result<UnsplashSettings, String> {
    validate_api_key(&api_key)?;
    save_secret(UNSPLASH_CREDENTIAL_OWNER, api_key.trim())?;
    Ok(UnsplashSettings { configured: true })
}

#[tauri::command]
pub(crate) fn delete_unsplash_api_key() -> Result<(), String> {
    delete_secret(UNSPLASH_CREDENTIAL_OWNER)
}

#[tauri::command]
pub(crate) async fn validate_unsplash_api_key() -> Result<(), String> {
    let api_key = read_required_api_key()?;
    search_photos_with_key(&api_key, "landscape", 1)
        .await
        .map(|_| ())
}

#[tauri::command]
pub(crate) async fn search_unsplash_photos(
    query: String,
    page: u32,
) -> Result<UnsplashSearchResult, String> {
    let query = normalize_query(&query)?;
    let api_key = read_required_api_key()?;
    search_photos_with_key(&api_key, &query, page.max(1)).await
}

#[tauri::command]
pub(crate) async fn get_random_unsplash_photos(count: u32) -> Result<Vec<UnsplashPhoto>, String> {
    let count = normalize_random_photo_count(count)?;
    let api_key = read_required_api_key()?;
    random_photos_with_key(&api_key, count).await
}

#[tauri::command]
pub(crate) async fn save_unsplash_image(
    request: SaveUnsplashImageRequest,
) -> Result<ProjectResourceFile, String> {
    validate_photo_id(&request.photo_id)?;
    let image_url = constrain_unsplash_image_url(validate_unsplash_image_url(&request.image_url)?);
    let download_location = validate_download_location(&request.download_location)?;
    let api_key = read_required_api_key()?;
    let client = image_client()?;

    // Unsplash 要求在用户选择图片时触发下载统计；统计失败不阻断本地保存。
    let _ = trigger_download_tracking(&client, &api_key, &download_location).await;
    let response = client
        .get(image_url)
        .header("Authorization", format!("Client-ID {api_key}"))
        .send()
        .await
        .map_err(|error| network_error("下载 Unsplash 图片", error))?;
    let bytes = read_image_bytes(response).await?;
    let cropped = crop_and_encode_jpeg(&bytes, &request.crop)?;
    let root = PathBuf::from(&request.path);
    let _ = (&request.project_id, &request.project_title);
    save_project_image_bytes(
        &root,
        &format!("unsplash-{}.jpg", request.photo_id),
        &cropped,
    )
}

async fn search_photos_with_key(
    api_key: &str,
    query: &str,
    page: u32,
) -> Result<UnsplashSearchResult, String> {
    let client = image_client()?;
    let page_value = page.to_string();
    let per_page_value = SEARCH_PAGE_SIZE.to_string();
    let response = client
        .get(format!("{API_ROOT}/search/photos"))
        .header("Authorization", format!("Client-ID {api_key}"))
        .header("Accept-Version", UNSPLASH_API_VERSION)
        .query(&[
            ("query", query),
            ("page", page_value.as_str()),
            ("per_page", per_page_value.as_str()),
            ("orientation", "landscape"),
        ])
        .send()
        .await
        .map_err(|error| network_error("Unsplash 搜索", error))?;
    let response = ensure_success(response, "Unsplash 搜索").await?;
    let payload = response
        .json::<UnsplashSearchResponse>()
        .await
        .map_err(|_| "Unsplash 返回了无法解析的搜索结果。".to_string())?;
    Ok(UnsplashSearchResult {
        total: payload.total,
        total_pages: payload.total_pages,
        results: payload
            .results
            .into_iter()
            .map(UnsplashPhoto::from)
            .collect(),
    })
}

async fn random_photos_with_key(api_key: &str, count: u32) -> Result<Vec<UnsplashPhoto>, String> {
    let client = image_client()?;
    let count_value = count.to_string();
    let response = client
        .get(format!("{API_ROOT}/photos/random"))
        .header("Authorization", format!("Client-ID {api_key}"))
        .header("Accept-Version", UNSPLASH_API_VERSION)
        .query(&[
            ("count", count_value.as_str()),
            ("orientation", "landscape"),
        ])
        .send()
        .await
        .map_err(|error| network_error("Unsplash 随机图片", error))?;
    let response = ensure_success(response, "Unsplash 随机图片").await?;
    let payload = response
        .json::<Vec<UnsplashPhotoResponse>>()
        .await
        .map_err(|_| "Unsplash 返回了无法解析的随机图片结果。".to_string())?;
    Ok(payload.into_iter().map(UnsplashPhoto::from).collect())
}

async fn trigger_download_tracking(
    client: &Client,
    api_key: &str,
    location: &Url,
) -> Result<(), String> {
    let response = client
        .get(location.clone())
        .header("Authorization", format!("Client-ID {api_key}"))
        .header("Accept-Version", UNSPLASH_API_VERSION)
        .send()
        .await
        .map_err(|error| network_error("Unsplash 下载统计", error))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Unsplash 下载统计失败（HTTP {}）。",
            response.status().as_u16()
        ))
    }
}

async fn ensure_success(response: Response, service: &str) -> Result<Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let detail = response
        .text()
        .await
        .unwrap_or_default()
        .replace(['\r', '\n'], " ")
        .chars()
        .take(240)
        .collect::<String>();
    let suffix = if detail.is_empty() {
        String::new()
    } else {
        format!("：{detail}")
    };
    Err(format!("{service}失败（HTTP {}）{suffix}", status.as_u16()))
}

async fn read_image_bytes(response: Response) -> Result<Vec<u8>, String> {
    let response = ensure_success(response, "下载 Unsplash 图片").await?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_IMAGE_BYTES)
    {
        return Err("Unsplash 图片不能超过 25 MB。".to_string());
    }
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| network_error("读取 Unsplash 图片", error))?
    {
        if bytes.len() as u64 + chunk.len() as u64 > MAX_IMAGE_BYTES {
            return Err("Unsplash 图片不能超过 25 MB。".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn crop_and_encode_jpeg(bytes: &[u8], crop: &CropSelection) -> Result<Vec<u8>, String> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "无法识别 Unsplash 图片格式。".to_string())?;
    let image = reader
        .decode()
        .map_err(|_| "无法读取 Unsplash 图片。".to_string())?;
    let (x, y, width, height) = resolve_crop_pixels(image.dimensions(), crop)?;
    let cropped = image.crop_imm(x, y, width, height);
    let cropped = resize_for_output(cropped);
    let mut output = Vec::new();
    JpegEncoder::new_with_quality(&mut output, 92)
        .encode_image(&cropped)
        .map_err(|_| "无法生成裁剪后的图片。".to_string())?;
    Ok(output)
}

fn resize_for_output(image: image::DynamicImage) -> image::DynamicImage {
    let (width, height) = image.dimensions();
    if width.max(height) <= MAX_OUTPUT_IMAGE_EDGE {
        return image;
    }
    let scale = MAX_OUTPUT_IMAGE_EDGE as f64 / width.max(height) as f64;
    let target_width = ((width as f64 * scale).round() as u32).max(1);
    let target_height = ((height as f64 * scale).round() as u32).max(1);
    image.resize(target_width, target_height, FilterType::Lanczos3)
}

fn resolve_crop_pixels(
    (source_width, source_height): (u32, u32),
    crop: &CropSelection,
) -> Result<(u32, u32, u32, u32), String> {
    if source_width == 0
        || source_height == 0
        || crop.aspect_width == 0
        || crop.aspect_height == 0
        || ![crop.x, crop.y, crop.width, crop.height]
            .into_iter()
            .all(|value| value.is_finite())
        || crop.width <= 0.0
        || crop.height <= 0.0
        || crop.x < 0.0
        || crop.y < 0.0
        || crop.x + crop.width > 1.0001
        || crop.y + crop.height > 1.0001
    {
        return Err("图片裁剪区域无效。".to_string());
    }

    let target_ratio = crop.aspect_width as f64 / crop.aspect_height as f64;
    let normalized_target_ratio = target_ratio * source_height as f64 / source_width as f64;
    let mut x = crop.x;
    let mut y = crop.y;
    let mut width = crop.width.min(1.0 - x);
    let mut height = crop.height.min(1.0 - y);
    if width / height > normalized_target_ratio {
        let next_width = height * normalized_target_ratio;
        x += (width - next_width) / 2.0;
        width = next_width;
    } else {
        let next_height = width / normalized_target_ratio;
        y += (height - next_height) / 2.0;
        height = next_height;
    }

    let pixel_x = (x * source_width as f64).round() as u32;
    let pixel_y = (y * source_height as f64).round() as u32;
    let pixel_width = ((width * source_width as f64).round() as u32)
        .max(1)
        .min(source_width.saturating_sub(pixel_x).max(1));
    let pixel_height = ((height * source_height as f64).round() as u32)
        .max(1)
        .min(source_height.saturating_sub(pixel_y).max(1));
    Ok((
        pixel_x.min(source_width.saturating_sub(1)),
        pixel_y.min(source_height.saturating_sub(1)),
        pixel_width,
        pixel_height,
    ))
}

fn validate_api_key(api_key: &str) -> Result<(), String> {
    let value = api_key.trim();
    if value.is_empty() || value.len() > MAX_API_KEY_LENGTH || value.chars().any(char::is_control) {
        return Err("Unsplash API Key 为空或格式无效。".to_string());
    }
    Ok(())
}

fn normalize_query(query: &str) -> Result<String, String> {
    let value = query.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() {
        return Err("请输入 Unsplash 搜索关键词。".to_string());
    }
    if value.chars().count() > MAX_QUERY_LENGTH {
        return Err("Unsplash 搜索关键词过长。".to_string());
    }
    Ok(value)
}

fn normalize_random_photo_count(count: u32) -> Result<u32, String> {
    if count == 0 || count > MAX_RANDOM_PHOTO_COUNT {
        return Err(format!(
            "Unsplash 随机图片数量必须在 1 到 {MAX_RANDOM_PHOTO_COUNT} 之间。"
        ));
    }
    Ok(count)
}

fn validate_photo_id(photo_id: &str) -> Result<(), String> {
    if photo_id.is_empty()
        || photo_id.len() > 128
        || !photo_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Unsplash 图片标识无效。".to_string());
    }
    Ok(())
}

fn validate_unsplash_image_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "Unsplash 图片地址无效。".to_string())?;
    if url.scheme() != "https"
        || !matches!(
            url.host_str(),
            Some("images.unsplash.com") | Some("plus.unsplash.com")
        )
    {
        return Err("Unsplash 图片地址不受支持。".to_string());
    }
    Ok(url)
}

fn constrain_unsplash_image_url(mut url: Url) -> Url {
    let preserved_query = url
        .query_pairs()
        .filter(|(key, _)| !matches!(key.as_ref(), "w" | "q" | "fm" | "fit"))
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    {
        let mut query = url.query_pairs_mut();
        query.clear();
        for (key, value) in preserved_query {
            query.append_pair(&key, &value);
        }
        query
            .append_pair("w", &DOWNLOAD_IMAGE_WIDTH.to_string())
            .append_pair("q", DOWNLOAD_IMAGE_QUALITY)
            .append_pair("fm", "jpg")
            .append_pair("fit", "max");
    }
    url
}

fn validate_download_location(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "Unsplash 下载统计地址无效。".to_string())?;
    if url.scheme() != "https" || url.host_str() != Some("api.unsplash.com") {
        return Err("Unsplash 下载统计地址不受支持。".to_string());
    }
    Ok(url)
}

fn read_required_api_key() -> Result<String, String> {
    read_provider_secret(UNSPLASH_CREDENTIAL_OWNER)
}

fn image_client() -> Result<Client, String> {
    IMAGE_CLIENT
        .get_or_init(|| {
            Client::builder()
                .timeout(Duration::from_secs(30))
                .user_agent(format!("Loby/{}", env!("CARGO_PKG_VERSION")))
                .build()
                .map_err(|_| "无法初始化 Unsplash 网络连接。".to_string())
        })
        .clone()
}

fn network_error(service: &str, error: reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{service}超时，请稍后重试。")
    } else {
        format!("{service}失败，请检查网络后重试。")
    }
}

impl From<UnsplashPhotoResponse> for UnsplashPhoto {
    fn from(value: UnsplashPhotoResponse) -> Self {
        Self {
            id: value.id,
            width: value.width,
            height: value.height,
            alt_description: value.alt_description.unwrap_or_default(),
            description: value.description.unwrap_or_default(),
            user: UnsplashUser {
                name: value.user.name,
                username: value.user.username,
            },
            urls: UnsplashPhotoUrls {
                thumb: value.urls.thumb,
                small: value.urls.small,
                regular: value.urls.regular,
                raw: value.urls.raw,
            },
            links: UnsplashPhotoLinks {
                download_location: value.links.download_location,
                html: value.links.html,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_key_validation_rejects_blank_and_control_values() {
        assert!(validate_api_key("key-example").is_ok());
        assert!(validate_api_key("   ").is_err());
        assert!(validate_api_key("key\nexample").is_err());
    }

    #[test]
    fn crop_resolution_keeps_requested_landscape_ratio() -> Result<(), String> {
        let crop = CropSelection {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            aspect_width: 16,
            aspect_height: 9,
        };
        let (_, _, width, height) = resolve_crop_pixels((1200, 900), &crop)?;
        assert!((width as f64 / height as f64 - 16.0 / 9.0).abs() < 0.01);
        Ok(())
    }

    #[test]
    fn output_resize_caps_the_long_edge_without_upscaling() {
        let large = image::DynamicImage::new_rgb8(5000, 3000);
        let resized = resize_for_output(large);
        assert_eq!(resized.dimensions(), (2560, 1536));

        let small = image::DynamicImage::new_rgb8(1600, 900);
        assert_eq!(resize_for_output(small).dimensions(), (1600, 900));
    }

    #[test]
    fn constrained_image_url_preserves_safe_query_parameters() -> Result<(), String> {
        let url = validate_unsplash_image_url(
            "https://images.unsplash.com/photo-example?ixlib=abc&w=1080&q=80",
        )?;
        let constrained = constrain_unsplash_image_url(url);
        let query = constrained.query().unwrap_or_default();
        assert!(query.contains("ixlib=abc"));
        assert!(query.contains("w=2400"));
        assert!(query.contains("q=85"));
        assert!(query.contains("fm=jpg"));
        assert!(query.contains("fit=max"));
        assert!(!query.contains("w=1080"));
        Ok(())
    }

    #[test]
    fn query_normalization_collapses_whitespace() -> Result<(), String> {
        assert_eq!(normalize_query("  quiet   mountain  ")?, "quiet mountain");
        assert!(normalize_query("   ").is_err());
        Ok(())
    }

    #[test]
    fn random_photo_count_stays_within_unsplash_limit() {
        assert_eq!(normalize_random_photo_count(24), Ok(24));
        assert!(normalize_random_photo_count(0).is_err());
        assert!(normalize_random_photo_count(MAX_RANDOM_PHOTO_COUNT + 1).is_err());
    }
}
