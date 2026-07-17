use super::{image_content_type, secret_store};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

const STORE_VERSION: u8 = 1;
const OSS_SECRET_CHANNEL: &str = "aliyun-oss";
const OSS_SECRET_ACCOUNT: &str = "default";
const MAX_UPLOAD_IMAGES: usize = 100;
const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatImageHostSettings {
    region: String,
    bucket: String,
    access_key_id: String,
    custom_domain: String,
    object_prefix: String,
}

impl Default for WechatImageHostSettings {
    fn default() -> Self {
        Self {
            region: String::new(),
            bucket: String::new(),
            access_key_id: String::new(),
            custom_domain: String::new(),
            object_prefix: "wechat".to_string(),
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatImageHostStore {
    version: u8,
    settings: WechatImageHostSettings,
}

impl Default for WechatImageHostStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            settings: WechatImageHostSettings::default(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatImageHostSettingsResult {
    settings: WechatImageHostSettings,
    has_access_key_secret: bool,
    configured: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveWechatImageHostSettingsRequest {
    settings: WechatImageHostSettings,
    access_key_secret: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatImageUploadRequest {
    images: Vec<WechatImageUploadInput>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WechatImageUploadInput {
    source: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatImageUploadResult {
    source: String,
    url: String,
}

pub(crate) fn load_settings() -> Result<WechatImageHostSettingsResult, String> {
    let store = load_store_at(&store_path()?)?;
    let has_access_key_secret = secret_store::has_secret(OSS_SECRET_CHANNEL, OSS_SECRET_ACCOUNT);
    let configured = settings_are_configured(&store.settings) && has_access_key_secret;
    Ok(WechatImageHostSettingsResult {
        settings: store.settings,
        has_access_key_secret,
        configured,
    })
}

pub(crate) fn save_settings(
    request: SaveWechatImageHostSettingsRequest,
) -> Result<WechatImageHostSettingsResult, String> {
    let mut settings = request.settings;
    normalize_and_validate_settings(&mut settings)?;
    save_store_at(&store_path()?, &settings)?;
    if let Some(secret) = request.access_key_secret {
        if !secret.trim().is_empty() {
            secret_store::save_secret(OSS_SECRET_CHANNEL, OSS_SECRET_ACCOUNT, &secret)?;
        }
    }
    let has_access_key_secret = secret_store::has_secret(OSS_SECRET_CHANNEL, OSS_SECRET_ACCOUNT);
    let configured = settings_are_configured(&settings) && has_access_key_secret;
    Ok(WechatImageHostSettingsResult {
        settings,
        has_access_key_secret,
        configured,
    })
}

pub(crate) async fn upload_images(
    request: WechatImageUploadRequest,
) -> Result<Vec<WechatImageUploadResult>, String> {
    if request.images.is_empty() {
        return Ok(Vec::new());
    }
    if request.images.len() > MAX_UPLOAD_IMAGES {
        return Err(format!("一次最多上传 {MAX_UPLOAD_IMAGES} 张图片。"));
    }

    let mut settings = load_store_at(&store_path()?)?.settings;
    normalize_and_validate_settings(&mut settings)?;
    let secret = secret_store::read_secret(OSS_SECRET_CHANNEL, OSS_SECRET_ACCOUNT)?;
    let client = Client::new();
    let mut results = Vec::new();
    let mut uploaded_by_source = BTreeMap::<String, String>::new();

    for image in request.images {
        let source = validate_upload_source(&image.source)?;
        if let Some(url) = uploaded_by_source.get(source) {
            results.push(WechatImageUploadResult {
                source: source.to_string(),
                url: url.clone(),
            });
            continue;
        }
        let url = upload_image(&client, source, &settings, &secret).await?;
        uploaded_by_source.insert(source.to_string(), url.clone());
        results.push(WechatImageUploadResult {
            source: source.to_string(),
            url,
        });
    }

    Ok(results)
}

async fn upload_image(
    client: &Client,
    source: &str,
    settings: &WechatImageHostSettings,
    access_key_secret: &str,
) -> Result<String, String> {
    let path = Path::new(source);
    let metadata = fs::metadata(path).map_err(|_| format!("找不到本地图片：{source}"))?;
    if !metadata.is_file() {
        return Err(format!("图片路径不是文件：{source}"));
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(format!("图片超过 50 MB，无法上传：{source}"));
    }
    let extension = supported_image_extension(path)?;
    let bytes = fs::read(path).map_err(|_| format!("无法读取本地图片：{source}"))?;
    let object_key = build_object_key(path, &bytes, &settings.object_prefix, &extension);
    let content_type = image_content_type(
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image.png"),
    );
    let date = httpdate::fmt_http_date(SystemTime::now());
    let authorization = build_authorization(
        "PUT",
        content_type,
        &date,
        &settings.bucket,
        &object_key,
        &settings.access_key_id,
        access_key_secret,
    )?;
    let upload_url = build_oss_url(&settings.bucket, &settings.region, &object_key)?;
    let response = client
        .put(upload_url)
        .header(header::DATE, date)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::AUTHORIZATION, authorization)
        .body(bytes)
        .send()
        .await
        .map_err(|error| format!("OSS 上传失败：{error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let detail = extract_oss_error(&body);
        return Err(if detail.is_empty() {
            format!("OSS 上传失败，状态码 {status}。")
        } else {
            format!("OSS 上传失败，状态码 {status}：{detail}")
        });
    }

    build_public_url(settings, &object_key)
}

fn normalize_and_validate_settings(settings: &mut WechatImageHostSettings) -> Result<(), String> {
    settings.region = normalize_region(&settings.region)?;
    settings.bucket = settings.bucket.trim().to_ascii_lowercase();
    settings.access_key_id = settings.access_key_id.trim().to_string();
    settings.custom_domain = normalize_custom_domain(&settings.custom_domain)?;
    settings.object_prefix = trim_slashes(&settings.object_prefix);
    if settings.object_prefix.is_empty() {
        settings.object_prefix = "wechat".to_string();
    }

    if !is_valid_bucket(&settings.bucket) {
        return Err("OSS Bucket 格式不正确。".to_string());
    }
    if settings.access_key_id.is_empty()
        || settings.access_key_id.len() > 160
        || settings.access_key_id.chars().any(char::is_control)
    {
        return Err("Access Key ID 为空或格式无效。".to_string());
    }
    if settings.object_prefix.len() > 240 || settings.object_prefix.chars().any(char::is_control) {
        return Err("上传路径前缀过长或格式无效。".to_string());
    }
    Ok(())
}

fn settings_are_configured(settings: &WechatImageHostSettings) -> bool {
    !settings.region.trim().is_empty()
        && !settings.bucket.trim().is_empty()
        && !settings.access_key_id.trim().is_empty()
}

fn normalize_region(value: &str) -> Result<String, String> {
    let trimmed = value.trim().to_ascii_lowercase();
    if trimmed.is_empty() {
        return Err("请填写 OSS Region，例如 oss-cn-hangzhou。".to_string());
    }
    let without_protocol = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(&trimmed)
        .trim_end_matches('/');
    let host = without_protocol.split('/').next().unwrap_or_default();
    let host = host.strip_suffix(".aliyuncs.com").unwrap_or(host);
    let normalized = if host.starts_with("oss-") {
        host.to_ascii_lowercase()
    } else if ["cn-", "ap-", "eu-", "me-", "us-"]
        .iter()
        .any(|prefix| host.starts_with(prefix))
    {
        format!("oss-{}", host.to_ascii_lowercase())
    } else {
        String::new()
    };
    if normalized.len() < 7
        || !normalized.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err("OSS Region 格式不正确，请填写 oss-cn-hangzhou。".to_string());
    }
    Ok(normalized)
}

fn normalize_custom_domain(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    if value.is_empty() {
        return Ok(String::new());
    }
    let url = Url::parse(value).map_err(|_| "自定义域名格式不正确。".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("自定义域名需要填写完整的 http:// 或 https:// 地址。".to_string());
    }
    Ok(value.to_string())
}

fn is_valid_bucket(value: &str) -> bool {
    (3..=63).contains(&value.len())
        && value.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
        && value
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        && value
            .chars()
            .last()
            .is_some_and(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
}

fn validate_upload_source(value: &str) -> Result<&str, String> {
    let source = value.trim();
    if source.is_empty() || source.len() > 4096 || source.chars().any(char::is_control) {
        return Err("本地图片路径为空或格式无效。".to_string());
    }
    if !Path::new(source).is_absolute() {
        return Err("图床只能上传本地绝对路径图片。".to_string());
    }
    Ok(source)
}

fn supported_image_extension(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => Ok(if extension == "jpeg" {
            "jpg".to_string()
        } else {
            extension
        }),
        _ => Err(format!("不支持上传这种图片格式：{}", path.display())),
    }
}

fn build_object_key(path: &Path, bytes: &[u8], prefix: &str, extension: &str) -> String {
    let now = current_year_month();
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(slugify)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "image".to_string());
    let hash = format!("{:x}", Sha1::digest(bytes));
    [
        trim_slashes(prefix),
        now.0,
        now.1,
        format!("{stem}-{}.{}", &hash[..12], extension),
    ]
    .into_iter()
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join("/")
}

fn current_year_month() -> (String, String) {
    let date = httpdate::fmt_http_date(SystemTime::now());
    let parts = date.split_whitespace().collect::<Vec<_>>();
    let year = parts.get(3).copied().unwrap_or("1970").to_string();
    let month = match parts.get(2).copied().unwrap_or("Jan") {
        "Jan" => "01",
        "Feb" => "02",
        "Mar" => "03",
        "Apr" => "04",
        "May" => "05",
        "Jun" => "06",
        "Jul" => "07",
        "Aug" => "08",
        "Sep" => "09",
        "Oct" => "10",
        "Nov" => "11",
        "Dec" => "12",
        _ => "01",
    };
    (year, month.to_string())
}

fn build_authorization(
    method: &str,
    content_type: &str,
    date: &str,
    bucket: &str,
    object_key: &str,
    access_key_id: &str,
    access_key_secret: &str,
) -> Result<String, String> {
    let canonicalized_resource = format!("/{bucket}/{object_key}");
    let string_to_sign = format!("{method}\n\n{content_type}\n{date}\n{canonicalized_resource}");
    let mut mac = Hmac::<Sha1>::new_from_slice(access_key_secret.as_bytes())
        .map_err(|_| "Access Key Secret 格式无效。".to_string())?;
    mac.update(string_to_sign.as_bytes());
    let signature = BASE64.encode(mac.finalize().into_bytes());
    Ok(format!("OSS {access_key_id}:{signature}"))
}

fn build_oss_url(bucket: &str, region: &str, object_key: &str) -> Result<Url, String> {
    let mut url = Url::parse(&format!("https://{bucket}.{region}.aliyuncs.com"))
        .map_err(|_| "无法生成 OSS 上传地址。".to_string())?;
    url.set_path(&format!("/{object_key}"));
    Ok(url)
}

fn build_public_url(
    settings: &WechatImageHostSettings,
    object_key: &str,
) -> Result<String, String> {
    if settings.custom_domain.is_empty() {
        return Ok(build_oss_url(&settings.bucket, &settings.region, object_key)?.to_string());
    }
    let mut url =
        Url::parse(&settings.custom_domain).map_err(|_| "无法生成图片公网地址。".to_string())?;
    let base_path = url.path().trim_end_matches('/');
    url.set_path(&format!("{base_path}/{object_key}"));
    Ok(url.to_string())
}

fn extract_oss_error(payload: &str) -> String {
    let code = xml_tag_value(payload, "Code");
    let message = xml_tag_value(payload, "Message");
    [code, message]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("：")
}

fn xml_tag_value(payload: &str, tag: &str) -> String {
    let start = format!("<{tag}>");
    let end = format!("</{tag}>");
    payload
        .split_once(&start)
        .and_then(|(_, rest)| rest.split_once(&end))
        .map(|(value, _)| value.trim().to_string())
        .unwrap_or_default()
}

fn trim_slashes(value: &str) -> String {
    value.trim().trim_matches('/').to_string()
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut separator = false;
    for character in value.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            if separator && !slug.is_empty() {
                slug.push('-');
            }
            separator = false;
            slug.push(character);
        } else {
            separator = true;
        }
    }
    slug
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join("Nibva").join("wechat-image-host.json"))
        .ok_or_else(|| "无法确定 Nibva 应用数据目录。".to_string())
}

fn load_store_at(path: &Path) -> Result<WechatImageHostStore, String> {
    if !path.exists() {
        return Ok(WechatImageHostStore::default());
    }
    let payload = fs::read(path).map_err(|_| "无法读取图床设置。".to_string())?;
    let store = serde_json::from_slice::<WechatImageHostStore>(&payload)
        .map_err(|_| "图床设置文件已损坏。".to_string())?;
    if store.version != STORE_VERSION {
        return Err("图床设置版本不受支持。".to_string());
    }
    Ok(store)
}

fn save_store_at(path: &Path, settings: &WechatImageHostSettings) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "图床设置路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建 Nibva 应用数据目录。".to_string())?;
    let store = WechatImageHostStore {
        version: STORE_VERSION,
        settings: settings.clone(),
    };
    let payload =
        serde_json::to_vec_pretty(&store).map_err(|_| "无法生成图床设置。".to_string())?;
    fs::write(path, payload).map_err(|_| "无法保存图床设置。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_common_oss_region_inputs() {
        assert_eq!(
            normalize_region("oss-cn-hangzhou").unwrap(),
            "oss-cn-hangzhou"
        );
        assert_eq!(normalize_region("cn-hangzhou").unwrap(), "oss-cn-hangzhou");
        assert_eq!(
            normalize_region("https://oss-cn-hangzhou.aliyuncs.com").unwrap(),
            "oss-cn-hangzhou"
        );
        assert!(normalize_region("hangzhou").is_err());
    }

    #[test]
    fn builds_stable_content_hashed_object_keys() {
        let path = Path::new("/tmp/中文封面.png");
        let first = build_object_key(path, b"same image", "wechat", "png");
        let second = build_object_key(path, b"same image", "wechat", "png");
        assert_eq!(first, second);
        assert!(first.contains("/image-"));
        assert!(first.ends_with(".png"));
    }

    #[test]
    fn image_host_settings_round_trip_without_secret() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("nibva-wechat-image-host-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let path = root.join("wechat-image-host.json");
        let settings = WechatImageHostSettings {
            region: "oss-cn-hangzhou".to_string(),
            bucket: "example-bucket".to_string(),
            access_key_id: "LTAI-test".to_string(),
            custom_domain: "https://img.example.com".to_string(),
            object_prefix: "wechat".to_string(),
        };
        save_store_at(&path, &settings)?;
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        assert!(!raw.contains("AccessKeySecret"));
        assert_eq!(load_store_at(&path)?.settings.bucket, "example-bucket");
        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
