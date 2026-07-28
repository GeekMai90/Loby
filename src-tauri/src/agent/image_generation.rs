//! [INPUT]: 依赖 ChatGPT OAuth、Provider credential store、AgentRuntimeSettings、reqwest、base64、image 与受控缓存目录
//! [OUTPUT]: 向内置 generate_image 工具提供 ChatGPT 订阅与 OpenAI API 图片生成适配、能力路由及本地成果
//! [POS]: 本地 Agent 的图片 Provider 边界；对话模型只表达意图，本模块选择真实图片服务且不写正文
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::chatgpt_auth;
use super::credentials::{has_secret, read_provider_secret};
use super::tools::ToolExecution;
use crate::models::AgentRuntimeSettings;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use std::time::Duration;
use uuid::Uuid;

const CHATGPT_IMAGES_URL: &str = "https://chatgpt.com/backend-api/codex/images";
const OPENAI_IMAGES_URL: &str = "https://api.openai.com/v1/images";
const IMAGE_MODEL: &str = "gpt-image-2";
const IMAGE_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ImageRoute {
    ChatGptSubscription,
    OpenAiApi,
}

pub(super) async fn generate_image(
    conversation_provider: &str,
    runtime: &AgentRuntimeSettings,
    prompt: &str,
    size: &str,
    reference_paths: &[PathBuf],
) -> Result<ToolExecution, String> {
    validate_size(size)?;
    let route = resolve_image_route(
        &runtime.image_generation_provider,
        conversation_provider,
        has_secret("chatgpt-subscription")?,
        has_secret("openai-api")?,
    )?;
    let encoded = match route {
        ImageRoute::ChatGptSubscription => {
            generate_with_chatgpt(prompt, size, reference_paths).await?
        }
        ImageRoute::OpenAiApi => generate_with_openai(prompt, size, reference_paths).await?,
    };
    save_generated_image(encoded, route)
}

fn resolve_image_route(
    preference: &str,
    conversation_provider: &str,
    chatgpt_connected: bool,
    openai_configured: bool,
) -> Result<ImageRoute, String> {
    match preference.trim().to_ascii_lowercase().as_str() {
        "" | "auto" => {
            if conversation_provider == "chatgpt-subscription" && chatgpt_connected {
                return Ok(ImageRoute::ChatGptSubscription);
            }
            if conversation_provider == "openai-api" && openai_configured {
                return Ok(ImageRoute::OpenAiApi);
            }
            if chatgpt_connected {
                return Ok(ImageRoute::ChatGptSubscription);
            }
            if openai_configured {
                return Ok(ImageRoute::OpenAiApi);
            }
            Err("尚未添加支持图片生成的连接。请先在 AI 设置的连接区域添加 ChatGPT 订阅或 OpenAI API。".to_string())
        }
        "chatgpt-subscription" if chatgpt_connected => Ok(ImageRoute::ChatGptSubscription),
        "chatgpt-subscription" => {
            Err("图片生成已指定使用 ChatGPT 订阅，但当前尚未连接 ChatGPT。".to_string())
        }
        "openai-api" if openai_configured => Ok(ImageRoute::OpenAiApi),
        "openai-api" => {
            Err("图片生成已指定使用 OpenAI API，但尚未配置 OpenAI API 凭证。".to_string())
        }
        _ => Err("图片生成服务设置无效。".to_string()),
    }
}

async fn generate_with_chatgpt(
    prompt: &str,
    size: &str,
    reference_paths: &[PathBuf],
) -> Result<String, String> {
    let access = chatgpt_auth::access().await?;
    if access.plan_type.eq_ignore_ascii_case("free") {
        return Err("当前 ChatGPT Free 账号不包含 Codex 图片生成额度。请在 AI 设置中选择其他支持生图的连接。".to_string());
    }
    let client = image_client()?;
    let endpoint = if reference_paths.is_empty() {
        format!("{CHATGPT_IMAGES_URL}/generations")
    } else {
        format!("{CHATGPT_IMAGES_URL}/edits")
    };
    let body = if reference_paths.is_empty() {
        json!({
            "prompt": prompt,
            "background": "auto",
            "model": IMAGE_MODEL,
            "quality": "auto",
            "size": size
        })
    } else {
        json!({
            "images": reference_image_urls(reference_paths)?,
            "prompt": prompt,
            "background": "auto",
            "model": IMAGE_MODEL,
            "quality": "auto",
            "size": size
        })
    };
    let response = client
        .post(endpoint)
        .bearer_auth(access.token)
        .header("ChatGPT-Account-ID", access.account_id)
        .header("originator", "loby")
        .json(&body)
        .send()
        .await
        .map_err(|error| image_network_error("ChatGPT 订阅图片服务", error))?;
    parse_image_response(response, "ChatGPT 订阅图片服务").await
}

async fn generate_with_openai(
    prompt: &str,
    size: &str,
    reference_paths: &[PathBuf],
) -> Result<String, String> {
    let secret = read_provider_secret("openai-api")?;
    let client = image_client()?;
    let request = if reference_paths.is_empty() {
        client
            .post(format!("{OPENAI_IMAGES_URL}/generations"))
            .bearer_auth(&secret)
            .json(&json!({
                "model": IMAGE_MODEL,
                "prompt": prompt,
                "background": "auto",
                "quality": "auto",
                "size": size,
                "output_format": "png"
            }))
    } else {
        let mut form = reqwest::multipart::Form::new()
            .text("model", IMAGE_MODEL)
            .text("prompt", prompt.to_string())
            .text("background", "auto")
            .text("quality", "auto")
            .text("size", size.to_string())
            .text("output_format", "png");
        for path in reference_paths {
            let bytes = fs::read(path).map_err(|error| error.to_string())?;
            let mime = validated_image_mime(&bytes)?;
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("reference.png")
                .to_string();
            let part = reqwest::multipart::Part::bytes(bytes)
                .file_name(file_name)
                .mime_str(mime)
                .map_err(|error| error.to_string())?;
            form = form.part("image[]", part);
        }
        client
            .post(format!("{OPENAI_IMAGES_URL}/edits"))
            .bearer_auth(&secret)
            .multipart(form)
    };
    let response = request
        .send()
        .await
        .map_err(|error| image_network_error("OpenAI API 图片服务", error))?;
    parse_image_response(response, "OpenAI API 图片服务").await
}

fn reference_image_urls(reference_paths: &[PathBuf]) -> Result<Vec<Value>, String> {
    reference_paths
        .iter()
        .map(|path| {
            let bytes = fs::read(path).map_err(|error| error.to_string())?;
            let mime = validated_image_mime(&bytes)?;
            Ok(json!({
                "image_url": format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
            }))
        })
        .collect()
}

async fn parse_image_response(
    response: reqwest::Response,
    service: &str,
) -> Result<String, String> {
    let status = response.status();
    let payload = response
        .bytes()
        .await
        .map_err(|error| format!("{service}返回了无法读取的响应：{error}"))?;
    let value = serde_json::from_slice::<Value>(&payload).unwrap_or(Value::Null);
    if !status.is_success() {
        let message = value["error"]["message"]
            .as_str()
            .or_else(|| value["message"].as_str())
            .unwrap_or("服务返回错误")
            .chars()
            .take(500)
            .collect::<String>();
        return Err(format!(
            "{service}请求失败（HTTP {}）：{message}",
            status.as_u16()
        ));
    }
    value["data"][0]["b64_json"]
        .as_str()
        .filter(|encoded| !encoded.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("{service}没有返回图片数据。"))
}

fn save_generated_image(encoded: String, route: ImageRoute) -> Result<ToolExecution, String> {
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|_| "图片服务返回了无效图片数据。".to_string())?;
    validated_image_mime(&bytes).map_err(|_| "图片服务返回的文件不是有效图片。".to_string())?;
    let directory = generated_image_directory()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let filename = format!("loby-generated-{}.png", Uuid::new_v4());
    let artifact_path = directory.join(&filename);
    fs::write(&artifact_path, bytes).map_err(|error| error.to_string())?;
    let provider = match route {
        ImageRoute::ChatGptSubscription => "chatgpt-subscription",
        ImageRoute::OpenAiApi => "openai-api",
    };
    let suggested_path = format!("assets/images/{filename}");
    let artifact_path = artifact_path.display().to_string();
    Ok(ToolExecution {
        output: serde_json::to_string(&json!({
            "status": "completed",
            "provider": provider,
            "model": IMAGE_MODEL,
            "path": suggested_path,
            "artifactPath": artifact_path,
            "requiresInsertConfirmation": true
        }))
        .map_err(|error| error.to_string())?,
        artifact_path: Some(artifact_path),
    })
}

fn validate_size(size: &str) -> Result<(), String> {
    if matches!(size, "1024x1024" | "1536x1024" | "1024x1536") {
        Ok(())
    } else {
        Err("图片尺寸无效。".to_string())
    }
}

fn image_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(IMAGE_TIMEOUT)
        .user_agent(format!("Loby/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())
}

fn image_network_error(service: &str, error: reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{service}请求超时，请稍后重试。")
    } else {
        format!("无法连接{service}：{error}")
    }
}

fn validated_image_mime(bytes: &[u8]) -> Result<&'static str, String> {
    let reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "无法识别图片格式。".to_string())?;
    let format = reader
        .format()
        .ok_or_else(|| "无法识别图片格式。".to_string())?;
    let (width, height) = reader
        .into_dimensions()
        .map_err(|_| "图片数据无效。".to_string())?;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > 40_000_000 {
        return Err("图片尺寸无效或超过 4000 万像素。".to_string());
    }
    match format {
        image::ImageFormat::Png => Ok("image/png"),
        image::ImageFormat::Jpeg => Ok("image/jpeg"),
        image::ImageFormat::WebP => Ok("image/webp"),
        _ => Err("参考图只支持 PNG、JPEG 和 WebP。".to_string()),
    }
}

fn generated_image_directory() -> Result<PathBuf, String> {
    dirs::cache_dir()
        .map(|root| root.join("Loby").join("generated-images"))
        .ok_or_else(|| "无法确定 Loby 图片缓存目录。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, RgbImage};

    #[test]
    fn automatic_route_prefers_current_capable_provider() {
        assert_eq!(
            resolve_image_route("auto", "chatgpt-subscription", true, true).unwrap(),
            ImageRoute::ChatGptSubscription
        );
        assert_eq!(
            resolve_image_route("auto", "openai-api", true, true).unwrap(),
            ImageRoute::OpenAiApi
        );
        assert_eq!(
            resolve_image_route("auto", "anthropic-api", true, true).unwrap(),
            ImageRoute::ChatGptSubscription
        );
    }

    #[test]
    fn explicit_route_never_silently_switches_billing_service() {
        assert!(resolve_image_route("chatgpt-subscription", "anthropic-api", false, true).is_err());
        assert!(resolve_image_route("openai-api", "chatgpt-subscription", true, false).is_err());
    }

    #[test]
    fn reference_image_validation_checks_content_not_only_extension() -> Result<(), String> {
        let image = DynamicImage::ImageRgb8(RgbImage::new(2, 2));
        let mut png = Cursor::new(Vec::new());
        image
            .write_to(&mut png, ImageFormat::Png)
            .map_err(|error| error.to_string())?;
        assert_eq!(validated_image_mime(png.get_ref())?, "image/png");
        assert!(validated_image_mime(b"not an image").is_err());
        Ok(())
    }
}
