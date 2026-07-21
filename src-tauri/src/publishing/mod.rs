mod mowen;
mod secret_store;
pub(crate) mod wechat_image_host;
pub(crate) mod wechat_theme_store;
pub(crate) mod wechat_theme_studio;
mod wordpress;

pub(crate) use wechat_theme_studio::WechatThemeStudioState;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;

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

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub(crate) enum MowenPublishProgress {
    Preparing,
    Uploading { completed: usize, total: usize },
    Creating,
    SettingPrivacy,
    Finished,
}

#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(super) enum MowenVisibility {
    Public,
    Private,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MowenPublishRequest {
    body: Value,
    tags: Vec<String>,
    visibility: MowenVisibility,
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
    secret_store::save_secret(&channel, &account, &secret)
}

#[tauri::command]
pub(crate) fn has_publishing_secret(channel: String, account: String) -> Result<bool, String> {
    secret_store::has_secret(&channel, &account)
}

#[tauri::command]
pub(crate) async fn publish_wordpress_post(
    request: WordPressPublishRequest,
) -> Result<WordPressPublishResult, String> {
    wordpress::publish_post(request).await
}

#[tauri::command]
pub(crate) async fn publish_mowen_note(
    request: MowenPublishRequest,
    on_progress: Channel<MowenPublishProgress>,
) -> Result<Value, String> {
    mowen::publish_note(request, &on_progress).await
}

#[tauri::command]
pub(crate) async fn validate_mowen_api_key(api_key: String) -> Result<(), String> {
    mowen::validate_api_key(&api_key).await
}

#[tauri::command]
pub(crate) fn load_wechat_image_host_settings(
) -> Result<wechat_image_host::WechatImageHostSettingsResult, String> {
    wechat_image_host::load_settings()
}

#[tauri::command]
pub(crate) fn save_wechat_image_host_settings(
    request: wechat_image_host::SaveWechatImageHostSettingsRequest,
) -> Result<wechat_image_host::WechatImageHostSettingsResult, String> {
    wechat_image_host::save_settings(request)
}

#[tauri::command]
pub(crate) async fn upload_wechat_images(
    request: wechat_image_host::WechatImageUploadRequest,
) -> Result<Vec<wechat_image_host::WechatImageUploadResult>, String> {
    wechat_image_host::upload_images(request).await
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn mowen_progress_serializes_for_the_frontend_channel() {
        let value = serde_json::to_value(MowenPublishProgress::Uploading {
            completed: 1,
            total: 3,
        })
        .unwrap();
        assert_eq!(
            value,
            json!({ "stage": "uploading", "completed": 1, "total": 3 })
        );
        assert_eq!(
            serde_json::to_value(MowenPublishProgress::SettingPrivacy).unwrap(),
            json!({ "stage": "settingPrivacy" })
        );
    }
}
