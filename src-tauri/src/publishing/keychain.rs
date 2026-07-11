use std::process::Command;

const MOWEN_KEYCHAIN_SERVICE: &str = "mowen-api-key";
const WORDPRESS_KEYCHAIN_SERVICE: &str = "nibva-wordpress-app-password";

pub(super) fn save_secret(channel: &str, account: &str, secret: &str) -> Result<(), String> {
    let service = service_name(channel)?;
    let account = resolved_account(channel, validate_account(account)?);
    if secret.trim().is_empty() || secret.len() > 4096 || secret.chars().any(char::is_control) {
        return Err("密钥为空或格式无效。".to_string());
    }
    save_keychain_secret(service, &account, secret)
}

pub(super) fn has_secret(channel: &str, account: &str) -> bool {
    let Ok(service) = service_name(channel) else {
        return false;
    };
    let Ok(account) = validate_account(account) else {
        return false;
    };
    let account = resolved_account(channel, account);
    read_secret(channel, &account)
        .or_else(|_| read_keychain_secret(service, &account))
        .is_ok()
}

pub(super) fn read_secret(channel: &str, account: &str) -> Result<String, String> {
    let service = service_name(channel)?;
    let account = resolved_account(channel, validate_account(account)?);
    let environment_name = if channel == "mowen" {
        "MOWEN_API_KEY"
    } else {
        "WORDPRESS_APP_PASSWORD"
    };
    if let Ok(secret) = std::env::var(environment_name) {
        if !secret.trim().is_empty() {
            return Ok(secret);
        }
    }
    read_keychain_secret(service, &account).map_err(|_| {
        if channel == "mowen" {
            "未找到墨问 API Key，请先在发布窗口中保存。".to_string()
        } else {
            "未找到 WordPress 应用密码，请先在发布窗口中保存。".to_string()
        }
    })
}

pub(super) fn validate_account(value: &str) -> Result<&str, String> {
    let account = value.trim();
    if account.is_empty() || account.len() > 160 || account.chars().any(char::is_control) {
        return Err("发布账户名称无效。".to_string());
    }
    Ok(account)
}

fn service_name(channel: &str) -> Result<&'static str, String> {
    match channel {
        "mowen" => Ok(MOWEN_KEYCHAIN_SERVICE),
        "wordpress" => Ok(WORDPRESS_KEYCHAIN_SERVICE),
        _ => Err("不支持的发布渠道。".to_string()),
    }
}

fn resolved_account(channel: &str, requested: &str) -> String {
    if channel == "mowen" {
        return std::env::var("USER").unwrap_or_else(|_| requested.to_string());
    }
    requested.to_string()
}

#[cfg(target_os = "macos")]
fn save_keychain_secret(service: &str, account: &str, secret: &str) -> Result<(), String> {
    let status = Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            service,
            "-a",
            account,
            "-w",
            secret,
        ])
        .status()
        .map_err(|error| format!("无法调用系统钥匙串：{error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("保存到系统钥匙串失败。".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
fn save_keychain_secret(_service: &str, _account: &str, _secret: &str) -> Result<(), String> {
    Err("当前平台暂不支持安全保存发布密钥。".to_string())
}

#[cfg(target_os = "macos")]
fn read_keychain_secret(service: &str, account: &str) -> Result<String, String> {
    let output = Command::new("security")
        .args(["find-generic-password", "-s", service, "-a", account, "-w"])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("钥匙串中没有匹配的密钥。".to_string());
    }
    String::from_utf8(output.stdout)
        .map(|secret| secret.trim().to_string())
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn read_keychain_secret(_service: &str, _account: &str) -> Result<String, String> {
    Err("当前平台暂不支持读取发布密钥。".to_string())
}
