//! [INPUT]: 依赖百度翻译开放平台通用文本翻译 HTTP API、agent credential store 与 serde/reqwest
//! [OUTPUT]: 向 renderer 提供百度开放平台凭证状态、保存/验证/删除与中文搜索词翻译 commands，并归一化 HTTP/业务错误
//! [POS]: native 翻译领域边界；凭证只留在 app-config，renderer 只接收去敏状态和英文结果
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use crate::agent::credentials::{delete_secret, read_provider_secret, save_secret};
use md5::{Digest, Md5};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{sync::OnceLock, time::Duration};

const BAIDU_CREDENTIAL_OWNER: &str = "baidu-translate";
const OPEN_PLATFORM_TRANSLATE_URL: &str = "https://fanyi-api.baidu.com/api/trans/vip/translate";
const MAX_CREDENTIAL_LENGTH: usize = 4096;
const MAX_QUERY_LENGTH: usize = 160;
const MAX_ERROR_DETAIL_LENGTH: usize = 160;

static TRANSLATION_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BaiduTranslateCredentials {
    app_id: String,
    secret_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BaiduTranslationSettings {
    pub(crate) configured: bool,
}

#[derive(Debug, Deserialize)]
struct OpenPlatformTranslationResponse {
    trans_result: Option<Vec<TranslatedText>>,
    error_code: Option<serde_json::Value>,
    error_msg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TranslatedText {
    dst: String,
}

#[tauri::command]
pub(crate) fn get_baidu_translation_settings() -> Result<BaiduTranslationSettings, String> {
    let credentials = read_credentials().ok();
    Ok(BaiduTranslationSettings {
        configured: credentials.as_ref().is_some_and(credentials_are_complete),
    })
}

#[tauri::command]
pub(crate) fn save_baidu_translation_credentials(
    app_id: String,
    secret_key: String,
) -> Result<BaiduTranslationSettings, String> {
    let previous = read_credentials().ok();
    let credentials = BaiduTranslateCredentials {
        app_id: merge_credential_value(
            &app_id,
            previous.as_ref().map(|value| value.app_id.as_str()),
        ),
        secret_key: merge_credential_value(
            &secret_key,
            previous.as_ref().map(|value| value.secret_key.as_str()),
        ),
    };
    validate_credentials(&credentials)?;
    let serialized =
        serde_json::to_string(&credentials).map_err(|_| "无法保存百度翻译凭证。".to_string())?;
    save_secret(BAIDU_CREDENTIAL_OWNER, &serialized)?;
    Ok(settings_from_credentials(&credentials))
}

#[tauri::command]
pub(crate) fn delete_baidu_translation_credentials() -> Result<(), String> {
    delete_secret(BAIDU_CREDENTIAL_OWNER)
}

#[tauri::command]
pub(crate) async fn validate_baidu_translation_credentials() -> Result<(), String> {
    let credentials = read_credentials()?;
    translate_with_credentials(&credentials, "宁静的湖面")
        .await
        .map(|_| ())
}

#[tauri::command]
pub(crate) async fn translate_baidu_search_query(query: String) -> Result<String, String> {
    let query = normalize_query(&query)?;
    let credentials = read_credentials()?;
    translate_with_credentials(&credentials, &query).await
}

async fn translate_with_credentials(
    credentials: &BaiduTranslateCredentials,
    query: &str,
) -> Result<String, String> {
    validate_credentials(credentials)?;
    let client = translation_client()?;
    translate_with_open_platform(&client, credentials, query).await
}

async fn translate_with_open_platform(
    client: &Client,
    credentials: &BaiduTranslateCredentials,
    query: &str,
) -> Result<String, String> {
    let salt = uuid::Uuid::new_v4().simple().to_string();
    let sign = open_platform_sign(&credentials.app_id, query, &salt, &credentials.secret_key);
    let response = client
        .post(OPEN_PLATFORM_TRANSLATE_URL)
        .form(&[
            ("q", query),
            ("from", "auto"),
            ("to", "en"),
            ("appid", credentials.app_id.as_str()),
            ("salt", salt.as_str()),
            ("sign", sign.as_str()),
        ])
        .send()
        .await
        .map_err(|error| network_error("百度开放平台翻译", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|_| "百度开放平台翻译响应读取失败。".to_string())?;
    parse_translation_response(status, &body)
}

fn read_credentials() -> Result<BaiduTranslateCredentials, String> {
    let serialized = read_provider_secret(BAIDU_CREDENTIAL_OWNER)?;
    serde_json::from_str(&serialized).map_err(|_| "百度翻译凭证格式无效，请重新保存。".to_string())
}

fn validate_credentials(credentials: &BaiduTranslateCredentials) -> Result<(), String> {
    validate_credential_part("百度翻译 App ID", &credentials.app_id, true)?;
    validate_credential_part("百度翻译密钥", &credentials.secret_key, true)
}

fn credentials_are_complete(credentials: &BaiduTranslateCredentials) -> bool {
    !credentials.app_id.trim().is_empty() && !credentials.secret_key.trim().is_empty()
}

fn settings_from_credentials(credentials: &BaiduTranslateCredentials) -> BaiduTranslationSettings {
    BaiduTranslationSettings {
        configured: credentials_are_complete(credentials),
    }
}

fn merge_credential_value(value: &str, previous: Option<&str>) -> String {
    let value = value.trim();
    if value.is_empty() {
        previous.unwrap_or_default().trim().to_string()
    } else {
        value.to_string()
    }
}

fn validate_credential_part(label: &str, value: &str, required: bool) -> Result<(), String> {
    let value = value.trim();
    if required && value.is_empty() {
        return Err(format!("{label}不能为空。"));
    }
    if value.len() > MAX_CREDENTIAL_LENGTH || value.chars().any(char::is_control) {
        return Err(format!("{label}格式无效。"));
    }
    Ok(())
}

fn normalize_query(query: &str) -> Result<String, String> {
    let value = query.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() {
        return Err("请输入要翻译的搜索词。".to_string());
    }
    if value.chars().count() > MAX_QUERY_LENGTH || value.chars().any(char::is_control) {
        return Err("搜索词过长或包含无效字符。".to_string());
    }
    Ok(value)
}

fn translation_client() -> Result<Client, String> {
    TRANSLATION_CLIENT
        .get_or_init(|| {
            Client::builder()
                .timeout(Duration::from_secs(20))
                .user_agent(format!("Loby/{}", env!("CARGO_PKG_VERSION")))
                .build()
                .map_err(|_| "无法初始化百度翻译网络连接。".to_string())
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

fn translation_error_message(code: &serde_json::Value, detail: Option<&str>) -> String {
    let code = match code {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Number(value) => value.to_string(),
        _ => "unknown".to_string(),
    };
    let message = match code.as_str() {
        "1" | "2" | "4" | "31001" | "31006" | "31101" | "31102" | "282000" => {
            "百度翻译服务暂时不可用，请稍后重试。"
        }
        "6" | "100" | "282003" | "282004" => "百度翻译请求参数或接口权限无效，请检查服务配置。",
        "18" | "31104" | "54003" => "访问频率受限，请稍后重试。",
        "19" | "31005" | "54004" => "百度翻译额度已用尽，请检查账户额度。",
        "110" | "111" | "52003" | "54001" => "百度翻译授权已失效，请重新保存凭证。",
        "20003" => "搜索词未通过百度翻译的内容安全检查。",
        "31103" | "31105" | "31106" | "31201" | "31202" | "31203" | "54005" => {
            "百度翻译无法处理当前搜索词，请检查内容和目标语言。"
        }
        _ => "百度翻译请求失败，请检查凭证和服务权限。",
    };
    let detail = normalize_error_detail(detail);
    if detail.is_empty() {
        format!("{message}（错误码 {code}）")
    } else {
        format!("{message}（错误码 {code}：{detail}）")
    }
}

fn parse_translation_response(status: reqwest::StatusCode, body: &str) -> Result<String, String> {
    let payload = serde_json::from_str::<OpenPlatformTranslationResponse>(body).ok();
    if !status.is_success() {
        let detail = payload
            .as_ref()
            .and_then(|value| value.error_msg.as_deref());
        return Err(format_http_error(status.as_u16(), detail));
    }
    let payload = payload.ok_or_else(|| "百度开放平台翻译返回了无法解析的响应。".to_string())?;
    if let Some(error_code) = payload.error_code {
        return Err(translation_error_message(
            &error_code,
            payload.error_msg.as_deref(),
        ));
    }

    payload
        .trans_result
        .and_then(|items| items.into_iter().next())
        .map(|item| item.dst.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "百度开放平台翻译没有返回有效结果。".to_string())
}

fn format_http_error(status: u16, detail: Option<&str>) -> String {
    let detail = normalize_error_detail(detail);
    if detail.is_empty() {
        format!("百度开放平台翻译失败（HTTP {status}）。")
    } else {
        format!("百度开放平台翻译失败（HTTP {status}：{detail}）。")
    }
}

fn normalize_error_detail(detail: Option<&str>) -> String {
    detail
        .unwrap_or_default()
        .replace(['\r', '\n'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(MAX_ERROR_DETAIL_LENGTH)
        .collect()
}

fn open_platform_sign(app_id: &str, query: &str, salt: &str, secret_key: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(format!("{app_id}{query}{salt}{secret_key}").as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credentials_require_app_id_and_secret_key() {
        let valid = BaiduTranslateCredentials {
            app_id: "app-id".to_string(),
            secret_key: "secret-key".to_string(),
        };
        assert!(validate_credentials(&valid).is_ok());
        assert!(validate_credentials(&BaiduTranslateCredentials {
            app_id: String::new(),
            ..valid.clone()
        })
        .is_err());
        assert!(validate_credentials(&BaiduTranslateCredentials {
            secret_key: String::new(),
            ..valid
        })
        .is_err());
    }

    #[test]
    fn blank_values_preserve_existing_credentials() {
        assert_eq!(merge_credential_value("  ", Some("saved")), "saved");
        assert_eq!(merge_credential_value("new", Some("saved")), "new");
    }

    #[test]
    fn query_normalization_collapses_whitespace() -> Result<(), String> {
        assert_eq!(normalize_query("  安静   的湖面  ")?, "安静 的湖面");
        assert!(normalize_query("   ").is_err());
        Ok(())
    }

    #[test]
    fn open_platform_sign_uses_the_raw_query_before_encoding() {
        assert_eq!(
            open_platform_sign("app", "query", "salt", "secret"),
            "524045ceb9d8f4019dc4423d9ef61180"
        );
    }

    #[test]
    fn non_success_json_response_keeps_http_status_and_provider_detail() {
        let error = parse_translation_response(
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"error_code":"54003","error_msg":"rate limited"}"#,
        )
        .expect_err("HTTP errors should not produce a translation");
        assert_eq!(error, "百度开放平台翻译失败（HTTP 400：rate limited）。");
    }

    #[test]
    fn non_success_non_json_response_reports_http_status() {
        let error = parse_translation_response(reqwest::StatusCode::BAD_GATEWAY, "upstream down")
            .expect_err("non-JSON HTTP errors should still be classified");
        assert_eq!(error, "百度开放平台翻译失败（HTTP 502）。");
    }
}
