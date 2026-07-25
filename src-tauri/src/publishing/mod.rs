//! [INPUT]: 依赖 blog/github/github_auth/mowen/wordpress 渠道、secret/target store、微信图床/主题/窗口子模块、serde payload 与 Tauri IPC Channel
//! [OUTPUT]: 向 crate 提供应用级发布目标、博客、GitHub 浏览器连接与仓库查询、墨问/WordPress/微信发布 command 及受控契约
//! [POS]: 发布领域，封装渠道适配、主题存储、凭证与上传流程
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
mod blog;
mod github;
mod github_auth;
mod mowen;
mod secret_store;
mod target_store;
pub(crate) mod wechat_image_host;
pub(crate) mod wechat_theme_store;
pub(crate) mod wechat_theme_studio;
mod wordpress;

pub(crate) use github_auth::GitHubDeviceFlowState;
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

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub(crate) enum BlogPublishProgress {
    CheckingAuthorization,
    Preparing,
    Packaging { completed: usize, total: usize },
    Committing,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct BlogPublishRequest {
    repository: String,
    branch: String,
    content_root: String,
    site_url: String,
    library_path: String,
    source_id: String,
    title: String,
    body: String,
    summary: String,
    date: String,
    tags: Vec<String>,
    draft: bool,
    slug: String,
    images: Vec<PublishImage>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BlogPublishResult {
    slug: String,
    url: String,
    commit_sha: String,
    source_hash: String,
    draft: bool,
    changed: bool,
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
pub(crate) fn load_publishing_targets(
    library_path: String,
) -> Result<target_store::PublishingTargetStore, String> {
    target_store::load(library_path)
}

#[tauri::command]
pub(crate) fn save_publishing_targets(
    store: target_store::PublishingTargetStore,
) -> Result<target_store::PublishingTargetStore, String> {
    target_store::save(store)
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
pub(crate) async fn validate_saved_mowen_api_key() -> Result<(), String> {
    let api_key = secret_store::read_secret("mowen", "default")?;
    mowen::validate_api_key(&api_key).await
}

#[tauri::command]
pub(crate) async fn start_github_device_flow(
    state: tauri::State<'_, github_auth::GitHubDeviceFlowState>,
) -> Result<github_auth::GitHubDeviceAuthorization, String> {
    github_auth::start_device_flow(state).await
}

#[tauri::command]
pub(crate) async fn complete_github_device_flow(
    state: tauri::State<'_, github_auth::GitHubDeviceFlowState>,
    flow_id: String,
) -> Result<github_auth::GitHubConnection, String> {
    github_auth::complete_device_flow(state, flow_id).await
}

#[tauri::command]
pub(crate) async fn get_github_connection() -> Result<github_auth::GitHubConnection, String> {
    github_auth::connection().await
}

#[tauri::command]
pub(crate) async fn list_github_repositories() -> Result<Vec<github_auth::GitHubRepository>, String>
{
    github_auth::repositories().await
}

#[tauri::command]
pub(crate) fn disconnect_github() -> Result<(), String> {
    github_auth::disconnect()
}

#[tauri::command]
pub(crate) async fn publish_blog_post(
    request: BlogPublishRequest,
    on_progress: Channel<BlogPublishProgress>,
) -> Result<BlogPublishResult, String> {
    blog::publish_post(request, &on_progress).await
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
        assert_eq!(
            serde_json::to_value(BlogPublishProgress::CheckingAuthorization).unwrap(),
            json!({ "stage": "checkingAuthorization" })
        );
    }
}
