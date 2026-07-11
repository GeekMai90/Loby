mod keychain;
mod mowen;
mod wordpress;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WordPressPublishRequest {
    site_url: String,
    username: String,
    title: String,
    content: String,
    excerpt: String,
    status: String,
    images: Vec<PublishImage>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WordPressPublishResult {
    id: u64,
    status: String,
    link: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MowenPublishRequest {
    body: Value,
    tags: Vec<String>,
    auto_publish: bool,
    images: Vec<PublishImage>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PublishImage {
    source: String,
    alt: String,
    placeholder: String,
}

#[tauri::command]
pub(crate) fn save_publishing_secret(
    channel: String,
    account: String,
    secret: String,
) -> Result<(), String> {
    keychain::save_secret(&channel, &account, &secret)
}

#[tauri::command]
pub(crate) fn has_publishing_secret(channel: String, account: String) -> bool {
    keychain::has_secret(&channel, &account)
}

#[tauri::command]
pub(crate) async fn publish_wordpress_post(
    request: WordPressPublishRequest,
) -> Result<WordPressPublishResult, String> {
    wordpress::publish_post(request).await
}

#[tauri::command]
pub(crate) async fn publish_mowen_note(request: MowenPublishRequest) -> Result<Value, String> {
    mowen::publish_note(request).await
}

pub(super) fn api_error_message(payload: &Value) -> String {
    payload
        .get("message")
        .or_else(|| payload.get("msg"))
        .or_else(|| payload.pointer("/data/message"))
        .and_then(Value::as_str)
        .unwrap_or("未知错误")
        .to_string()
}

pub(super) fn image_content_type(filename: &str) -> &'static str {
    match filename
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
}
