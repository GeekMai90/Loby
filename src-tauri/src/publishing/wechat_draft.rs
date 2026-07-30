//! [INPUT]: 依赖发布 secret store、reqwest/serde、写作库内图片与 Tauri IPC Channel
//! [OUTPUT]: 向 publishing facade 提供公众号 AppID 配置、显式连接验证、正文图片/封面上传与草稿新增或更新能力
//! [POS]: 发布领域的微信公众号草稿适配器；原生持有 AppSecret、access token 缓存与微信 API 错误翻译，不执行正式发布
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::{image_content_type, secret_store, PublishImage};
use reqwest::{multipart, Client};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::ipc::Channel;
use tokio::{sync::Mutex, time::Instant};

const STORE_VERSION: u8 = 1;
const SECRET_CHANNEL: &str = "wechat-official-account";
const SECRET_ACCOUNT: &str = "default";
const API_ROOT: &str = "https://api.weixin.qq.com/cgi-bin";
const MAX_IMAGES: usize = 100;
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;
const TOKEN_SAFETY_SECONDS: u64 = 300;

#[derive(Default)]
pub(crate) struct WechatDraftState {
    token: Mutex<Option<CachedToken>>,
}

struct CachedToken {
    app_id: String,
    value: String,
    expires_at: Instant,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatDraftSettings {
    app_id: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatDraftStore {
    version: u8,
    settings: WechatDraftSettings,
}

impl Default for WechatDraftStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            settings: WechatDraftSettings::default(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatDraftSettingsResult {
    app_id: String,
    has_app_secret: bool,
    configured: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveWechatDraftSettingsRequest {
    app_id: String,
    app_secret: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatDraftPublishRequest {
    library_path: String,
    source_id: String,
    title: String,
    author: String,
    digest: String,
    html: String,
    images: Vec<PublishImage>,
    cover_source: String,
    existing_media_id: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub(crate) enum WechatDraftPublishProgress {
    CheckingConnection,
    UploadingImages { completed: usize, total: usize },
    UploadingCover,
    Creating,
    Updating,
    Finished,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WechatDraftPublishResult {
    app_id: String,
    media_id: String,
    source_hash: String,
    updated: bool,
}

pub(crate) fn load_settings() -> Result<WechatDraftSettingsResult, String> {
    let settings = load_store(&store_path()?)?.settings;
    settings_result(settings)
}

pub(crate) async fn save_settings(
    state: &WechatDraftState,
    request: SaveWechatDraftSettingsRequest,
) -> Result<WechatDraftSettingsResult, String> {
    let app_id = normalize_app_id(&request.app_id)?;
    save_store(
        &store_path()?,
        &WechatDraftSettings {
            app_id: app_id.clone(),
        },
    )?;
    if let Some(secret) = request.app_secret.filter(|value| !value.trim().is_empty()) {
        secret_store::save_secret(SECRET_CHANNEL, SECRET_ACCOUNT, &secret)?;
    }
    *state.token.lock().await = None;
    settings_result(WechatDraftSettings { app_id })
}

pub(crate) async fn delete_settings(state: &WechatDraftState) -> Result<(), String> {
    let path = store_path()?;
    if path.exists() {
        fs::remove_file(path).map_err(|_| "无法删除微信公众号发布配置。".to_string())?;
    }
    secret_store::delete_secret(SECRET_CHANNEL, SECRET_ACCOUNT)?;
    *state.token.lock().await = None;
    Ok(())
}

pub(crate) async fn validate_connection(state: &WechatDraftState) -> Result<(), String> {
    let settings = configured_settings()?;
    *state.token.lock().await = None;
    let _ = access_token(state, &settings.app_id).await?;
    Ok(())
}

pub(crate) async fn publish_draft(
    state: &WechatDraftState,
    request: WechatDraftPublishRequest,
    on_progress: &Channel<WechatDraftPublishProgress>,
) -> Result<WechatDraftPublishResult, String> {
    validate_publish_request(&request)?;
    let settings = configured_settings()?;
    let _ = on_progress.send(WechatDraftPublishProgress::CheckingConnection);
    let token = access_token(state, &settings.app_id).await?;
    let client = http_client()?;
    let library_root = fs::canonicalize(&request.library_path)
        .map_err(|_| "无法读取当前写作文件夹，不能上传公众号图片。".to_string())?;

    let mut html = request.html.clone();
    let _ = on_progress.send(WechatDraftPublishProgress::UploadingImages {
        completed: 0,
        total: request.images.len(),
    });
    for (index, image) in request.images.iter().enumerate() {
        let image_file = read_image(&library_root, &image.source)?;
        let url = upload_content_image(&client, &token, image_file).await?;
        html = html.replace(&image.placeholder, &url);
        let _ = on_progress.send(WechatDraftPublishProgress::UploadingImages {
            completed: index + 1,
            total: request.images.len(),
        });
    }
    if request
        .images
        .iter()
        .any(|image| html.contains(&image.placeholder))
    {
        return Err("公众号正文中仍有未处理的图片占位符。".to_string());
    }

    let _ = on_progress.send(WechatDraftPublishProgress::UploadingCover);
    let cover = read_image(&library_root, &request.cover_source)?;
    let thumb_media_id = upload_cover(&client, &token, cover).await?;
    let article = json!({
        "article_type": "news",
        "title": request.title.trim(),
        "author": request.author.trim(),
        "digest": request.digest.trim(),
        "content": html,
        "thumb_media_id": thumb_media_id,
        "need_open_comment": 1,
        "only_fans_can_comment": 0
    });

    let (media_id, updated) = if request.existing_media_id.trim().is_empty() {
        let _ = on_progress.send(WechatDraftPublishProgress::Creating);
        (add_draft(&client, &token, &article).await?, false)
    } else {
        let _ = on_progress.send(WechatDraftPublishProgress::Updating);
        match update_draft(&client, &token, request.existing_media_id.trim(), &article).await {
            Ok(()) => (request.existing_media_id.trim().to_string(), true),
            Err(error) if error.contains("errcode 40007") => {
                let _ = on_progress.send(WechatDraftPublishProgress::Creating);
                (add_draft(&client, &token, &article).await?, false)
            }
            Err(error) => return Err(error),
        }
    };
    let _ = on_progress.send(WechatDraftPublishProgress::Finished);
    Ok(WechatDraftPublishResult {
        app_id: settings.app_id,
        media_id,
        source_hash: source_hash(&request, &html),
        updated,
    })
}

fn settings_result(settings: WechatDraftSettings) -> Result<WechatDraftSettingsResult, String> {
    let has_app_secret = secret_store::has_secret(SECRET_CHANNEL, SECRET_ACCOUNT)?;
    let configured = !settings.app_id.trim().is_empty() && has_app_secret;
    Ok(WechatDraftSettingsResult {
        app_id: settings.app_id,
        has_app_secret,
        configured,
    })
}

fn configured_settings() -> Result<WechatDraftSettings, String> {
    let settings = load_store(&store_path()?)?.settings;
    if settings.app_id.trim().is_empty()
        || !secret_store::has_secret(SECRET_CHANNEL, SECRET_ACCOUNT)?
    {
        return Err("请先在设置的“发布”中配置微信公众号 AppID 和 AppSecret。".to_string());
    }
    Ok(settings)
}

async fn access_token(state: &WechatDraftState, app_id: &str) -> Result<String, String> {
    let mut cache = state.token.lock().await;
    if let Some(token) = cache.as_ref() {
        if token.app_id == app_id && token.expires_at > Instant::now() {
            return Ok(token.value.clone());
        }
    }
    let secret = secret_store::read_secret(SECRET_CHANNEL, SECRET_ACCOUNT)?;
    let payload = http_client()?
        .get(format!("{API_ROOT}/token"))
        .query(&[
            ("grant_type", "client_credential"),
            ("appid", app_id),
            ("secret", secret.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "连接微信公众号失败，请检查网络后重试。".to_string())?
        .json::<Value>()
        .await
        .map_err(|_| "微信公众号返回了无法解析的连接响应。".to_string())?;
    ensure_wechat_success(&payload)?;
    let value = payload
        .get("access_token")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "微信公众号连接响应缺少 access_token。".to_string())?
        .to_string();
    let expires_in = payload
        .get("expires_in")
        .and_then(Value::as_u64)
        .unwrap_or(7200);
    let ttl = expires_in.saturating_sub(TOKEN_SAFETY_SECONDS).max(60);
    *cache = Some(CachedToken {
        app_id: app_id.to_string(),
        value: value.clone(),
        expires_at: Instant::now() + Duration::from_secs(ttl),
    });
    Ok(value)
}

struct ImageFile {
    bytes: Vec<u8>,
    filename: String,
    content_type: &'static str,
}

fn read_image(library_root: &Path, source: &str) -> Result<ImageFile, String> {
    let path = fs::canonicalize(source).map_err(|_| format!("找不到公众号图片：{source}"))?;
    if !path.starts_with(library_root) || !path.is_file() {
        return Err(format!("公众号图片不在当前写作文件夹中：{source}"));
    }
    let metadata = fs::metadata(&path).map_err(|_| format!("无法读取公众号图片：{source}"))?;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(format!("公众号图片超过 10 MB：{source}"));
    }
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image.png")
        .to_string();
    let content_type = image_content_type(&filename);
    if !matches!(content_type, "image/png" | "image/jpeg" | "image/gif") {
        return Err(format!("公众号只支持 PNG、JPG 或 GIF 图片：{source}"));
    }
    let bytes = fs::read(&path).map_err(|_| format!("无法读取公众号图片：{source}"))?;
    Ok(ImageFile {
        bytes,
        filename,
        content_type,
    })
}

async fn upload_content_image(
    client: &Client,
    token: &str,
    image: ImageFile,
) -> Result<String, String> {
    let payload = upload_multipart(
        client,
        &format!("{API_ROOT}/media/uploadimg"),
        token,
        image,
        None,
    )
    .await?;
    payload
        .get("url")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "微信公众号图片上传响应缺少 url。".to_string())
}

async fn upload_cover(client: &Client, token: &str, image: ImageFile) -> Result<String, String> {
    let payload = upload_multipart(
        client,
        &format!("{API_ROOT}/material/add_material"),
        token,
        image,
        Some(("type", "image")),
    )
    .await?;
    payload
        .get("media_id")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "微信公众号封面上传响应缺少 media_id。".to_string())
}

async fn upload_multipart(
    client: &Client,
    endpoint: &str,
    token: &str,
    image: ImageFile,
    extra_query: Option<(&str, &str)>,
) -> Result<Value, String> {
    let part = multipart::Part::bytes(image.bytes)
        .file_name(image.filename)
        .mime_str(image.content_type)
        .map_err(|_| "公众号图片类型无效。".to_string())?;
    let mut request = client.post(endpoint).query(&[("access_token", token)]);
    if let Some(query) = extra_query {
        request = request.query(&[query]);
    }
    let payload = request
        .multipart(multipart::Form::new().part("media", part))
        .send()
        .await
        .map_err(|_| "上传微信公众号图片失败，请检查网络后重试。".to_string())?
        .json::<Value>()
        .await
        .map_err(|_| "微信公众号返回了无法解析的图片上传响应。".to_string())?;
    ensure_wechat_success(&payload)?;
    Ok(payload)
}

async fn add_draft(client: &Client, token: &str, article: &Value) -> Result<String, String> {
    let payload = post_json(
        client,
        "draft/add",
        token,
        &json!({ "articles": [article] }),
    )
    .await?;
    payload
        .get("media_id")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "微信公众号草稿响应缺少 media_id。".to_string())
}

async fn update_draft(
    client: &Client,
    token: &str,
    media_id: &str,
    article: &Value,
) -> Result<(), String> {
    let _ = post_json(
        client,
        "draft/update",
        token,
        &json!({ "media_id": media_id, "index": 0, "articles": article }),
    )
    .await?;
    Ok(())
}

async fn post_json(
    client: &Client,
    path: &str,
    token: &str,
    body: &Value,
) -> Result<Value, String> {
    let payload = client
        .post(format!("{API_ROOT}/{path}"))
        .query(&[("access_token", token)])
        .json(body)
        .send()
        .await
        .map_err(|_| "连接微信公众号失败，请检查网络后重试。".to_string())?
        .json::<Value>()
        .await
        .map_err(|_| "微信公众号返回了无法解析的草稿响应。".to_string())?;
    ensure_wechat_success(&payload)?;
    Ok(payload)
}

fn ensure_wechat_success(payload: &Value) -> Result<(), String> {
    let code = payload.get("errcode").and_then(Value::as_i64).unwrap_or(0);
    if code == 0 {
        return Ok(());
    }
    let message = payload
        .get("errmsg")
        .and_then(Value::as_str)
        .unwrap_or("未知错误");
    if code == 40164 {
        let subject = extract_invalid_ip(message)
            .map(|ip| format!("当前公网 IP {ip}"))
            .unwrap_or_else(|| "当前公网 IP".to_string());
        return Err(format!("{subject} 不在公众号白名单中。请前往“微信开发者平台 → 域名与消息推送配置 → IP 白名单”添加后重试。"));
    }
    let friendly = match code {
        40013 => "AppID 无效，请检查公众号开发配置。",
        40125 => "AppSecret 无效，请重新保存公众号开发密钥。",
        48001 => "当前公众号未获得草稿接口权限。",
        _ => message,
    };
    Err(format!("微信公众号接口失败（errcode {code}）：{friendly}"))
}

fn extract_invalid_ip(message: &str) -> Option<&str> {
    let tail = message.split("invalid ip ").nth(1)?;
    tail.split(|character: char| character.is_whitespace() || character == ',' || character == ';')
        .find(|value| !value.is_empty())
}

fn validate_publish_request(request: &WechatDraftPublishRequest) -> Result<(), String> {
    if request.title.trim().is_empty() {
        return Err("公众号草稿标题不能为空。".to_string());
    }
    if request.title.chars().count() > 64 {
        return Err("公众号草稿标题不能超过 64 个字符。".to_string());
    }
    if request.source_id.trim().is_empty() {
        return Err("文稿发布身份无效。".to_string());
    }
    if request.html.trim().is_empty() {
        return Err("公众号草稿正文不能为空。".to_string());
    }
    if request.images.is_empty() || request.cover_source.trim().is_empty() {
        return Err("请先在正文中添加一张本地 PNG、JPG 或 GIF 图片作为公众号封面。".to_string());
    }
    if request.images.len() > MAX_IMAGES {
        return Err(format!("一篇公众号文章最多处理 {MAX_IMAGES} 张本地图片。"));
    }
    Ok(())
}

fn source_hash(request: &WechatDraftPublishRequest, html: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(request.source_id.as_bytes());
    digest.update(request.title.as_bytes());
    digest.update(html.as_bytes());
    format!("{:x}", digest.finalize())
}

fn normalize_app_id(value: &str) -> Result<String, String> {
    let app_id = value.trim();
    if app_id.is_empty() || app_id.len() > 128 || app_id.chars().any(char::is_control) {
        return Err("微信公众号 AppID 为空或格式无效。".to_string());
    }
    Ok(app_id.to_string())
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| "无法初始化微信公众号网络客户端。".to_string())
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join("Loby").join("wechat-draft.json"))
        .ok_or_else(|| "无法确定落笔应用数据目录。".to_string())
}

fn load_store(path: &Path) -> Result<WechatDraftStore, String> {
    if !path.exists() {
        return Ok(WechatDraftStore::default());
    }
    let payload = fs::read(path).map_err(|_| "无法读取微信公众号发布配置。".to_string())?;
    let store = serde_json::from_slice::<WechatDraftStore>(&payload)
        .map_err(|_| "微信公众号发布配置已损坏。".to_string())?;
    if store.version != STORE_VERSION {
        return Err("微信公众号发布配置版本不受支持。".to_string());
    }
    Ok(store)
}

fn save_store(path: &Path, settings: &WechatDraftSettings) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "微信公众号发布配置路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建落笔应用数据目录。".to_string())?;
    let payload = serde_json::to_vec_pretty(&WechatDraftStore {
        version: STORE_VERSION,
        settings: settings.clone(),
    })
    .map_err(|_| "无法生成微信公众号发布配置。".to_string())?;
    fs::write(path, payload).map_err(|_| "无法保存微信公众号发布配置。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translates_whitelist_error_with_current_ip() {
        let error = ensure_wechat_success(
            &json!({ "errcode": 40164, "errmsg": "invalid ip 203.0.113.9, not in whitelist" }),
        )
        .unwrap_err();
        assert!(error.contains("203.0.113.9"));
        assert!(error.contains("微信开发者平台 → 域名与消息推送配置 → IP 白名单"));
        assert!(error.contains("IP 白名单"));
    }

    #[test]
    fn translates_invalid_secret_without_exposing_it() {
        let error =
            ensure_wechat_success(&json!({ "errcode": 40125, "errmsg": "invalid appsecret" }))
                .unwrap_err();
        assert!(error.contains("AppSecret 无效"));
    }

    #[test]
    fn whitelist_error_without_ip_keeps_a_clean_fallback() {
        let error =
            ensure_wechat_success(&json!({ "errcode": 40164, "errmsg": "not in whitelist" }))
                .unwrap_err();
        assert!(error.starts_with("当前公网 IP 不在公众号白名单中"));
    }
}
