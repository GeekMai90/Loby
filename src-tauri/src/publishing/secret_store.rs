//! [INPUT]: 依赖 serde、用户平台 config 目录、环境变量与本地 JSON secret store
//! [OUTPUT]: 向 GitHub、微信公众号与内容发布渠道提供单项/成组 secret 的保存、运行时读取、用户已保存值回填查询与删除能力
//! [POS]: 发布领域，封装渠道适配、主题存储、凭证与上传流程
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

const STORE_VERSION: u8 = 1;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishingSecretStore {
    version: u8,
    secrets: BTreeMap<String, String>,
}

impl Default for PublishingSecretStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            secrets: BTreeMap::new(),
        }
    }
}

pub(super) fn save_secret(channel: &str, account: &str, secret: &str) -> Result<(), String> {
    let account = validate_account(account)?;
    validate_channel(channel)?;
    let secret = secret.trim();
    if secret.is_empty() || secret.len() > 4096 || secret.chars().any(char::is_control) {
        return Err("密钥为空或格式无效。".to_string());
    }
    save_secret_at(&store_path()?, channel, account, secret)
}

pub(super) fn save_secret_group(channel: &str, entries: &[(&str, &str)]) -> Result<(), String> {
    validate_channel(channel)?;
    if entries.is_empty() {
        return Err("没有可保存的密钥。".to_string());
    }
    let path = store_path()?;
    let mut store = load_store(&path)?;
    for (account, secret) in entries {
        let account = validate_account(account)?;
        let secret = secret.trim();
        if secret.is_empty() || secret.len() > 4096 || secret.chars().any(char::is_control) {
            return Err("密钥为空或格式无效。".to_string());
        }
        store
            .secrets
            .insert(secret_key(channel, account), secret.to_string());
    }
    save_store(&path, &store)
}

pub(super) fn delete_secret_group(channel: &str, accounts: &[&str]) -> Result<(), String> {
    validate_channel(channel)?;
    let path = store_path()?;
    delete_secret_group_at(&path, channel, accounts)
}

fn delete_secret_group_at(path: &Path, channel: &str, accounts: &[&str]) -> Result<(), String> {
    validate_channel(channel)?;
    if !path.exists() {
        return Ok(());
    }
    let mut store = load_store(path)?;
    for account in accounts {
        let account = validate_account(account)?;
        store.secrets.remove(&secret_key(channel, account));
    }
    save_store(path, &store)
}

pub(super) fn delete_secret(channel: &str, account: &str) -> Result<(), String> {
    delete_secret_group(channel, &[account])
}

pub(super) fn has_secret(channel: &str, account: &str) -> Result<bool, String> {
    let account = validate_account(account)?;
    validate_channel(channel)?;
    if account == "default" {
        let environment_name = environment_name(channel);
        if let Ok(secret) = std::env::var(environment_name) {
            if !secret.trim().is_empty() {
                return Ok(true);
            }
        }
    }
    Ok(load_store(&store_path()?)?
        .secrets
        .get(&secret_key(channel, account))
        .is_some_and(|value| !value.trim().is_empty()))
}

pub(super) fn read_secret(channel: &str, account: &str) -> Result<String, String> {
    let account = validate_account(account)?;
    validate_channel(channel)?;
    if account == "default" {
        let environment_name = environment_name(channel);
        if let Ok(secret) = std::env::var(environment_name) {
            if !secret.trim().is_empty() {
                return Ok(secret);
            }
        }
    }
    read_secret_at(&store_path()?, channel, account).map_err(|_| match channel {
        "mowen" => "未找到墨问 API Key，请先在设置的“发布”中配置。".to_string(),
        "wordpress" => "未找到 WordPress 应用密码，请先在发布窗口中保存。".to_string(),
        "aliyun-oss" => "未找到 OSS Access Key Secret，请先在设置的“图床”中配置。".to_string(),
        "github" => "尚未连接 GitHub，请先在设置的“发布”中完成浏览器授权。".to_string(),
        "wechat-official-account" => {
            "未找到微信公众号 AppSecret，请先在设置的“发布”中配置。".to_string()
        }
        _ => unreachable!("validated publishing secret channel"),
    })
}

pub(super) fn read_saved_secret(channel: &str, account: &str) -> Result<Option<String>, String> {
    let account = validate_account(account)?;
    validate_channel(channel)?;
    read_saved_secret_at(&store_path()?, channel, account)
}

fn environment_name(channel: &str) -> &'static str {
    match channel {
        "mowen" => "MOWEN_API_KEY",
        "wordpress" => "WORDPRESS_APP_PASSWORD",
        "aliyun-oss" => "ALIYUN_OSS_ACCESS_KEY_SECRET",
        "github" => "LOBY_GITHUB_TOKEN",
        "wechat-official-account" => "WECHAT_OFFICIAL_ACCOUNT_APP_SECRET",
        _ => unreachable!("validated publishing secret channel"),
    }
}

pub(super) fn validate_account(value: &str) -> Result<&str, String> {
    let account = value.trim();
    if account.is_empty() || account.len() > 160 || account.chars().any(char::is_control) {
        return Err("发布账户名称无效。".to_string());
    }
    Ok(account)
}

fn validate_channel(channel: &str) -> Result<(), String> {
    match channel {
        "mowen" | "wordpress" | "aliyun-oss" | "github" | "wechat-official-account" => Ok(()),
        _ => Err("不支持的发布渠道。".to_string()),
    }
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join("Loby").join("publishing-secrets.json"))
        .ok_or_else(|| "无法确定落笔应用数据目录。".to_string())
}

fn save_secret_at(path: &Path, channel: &str, account: &str, secret: &str) -> Result<(), String> {
    let mut store = load_store(path)?;
    store
        .secrets
        .insert(secret_key(channel, account), secret.to_string());
    save_store(path, &store)
}

fn save_store(path: &Path, store: &PublishingSecretStore) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "发布配置路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建落笔应用数据目录。".to_string())?;
    restrict_directory_permissions(parent)?;
    let payload = serde_json::to_vec_pretty(store).map_err(|_| "无法生成发布配置。".to_string())?;
    fs::write(path, payload).map_err(|_| "无法保存发布配置。".to_string())?;
    restrict_file_permissions(path)
}

fn read_secret_at(path: &Path, channel: &str, account: &str) -> Result<String, String> {
    load_store(path)?
        .secrets
        .get(&secret_key(channel, account))
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .ok_or_else(|| "发布配置中没有匹配的密钥。".to_string())
}

fn read_saved_secret_at(
    path: &Path,
    channel: &str,
    account: &str,
) -> Result<Option<String>, String> {
    Ok(load_store(path)?
        .secrets
        .get(&secret_key(channel, account))
        .filter(|value| !value.trim().is_empty())
        .cloned())
}

fn load_store(path: &Path) -> Result<PublishingSecretStore, String> {
    if !path.exists() {
        return Ok(PublishingSecretStore::default());
    }
    let payload = fs::read(path).map_err(|_| "无法读取发布配置。".to_string())?;
    let store = serde_json::from_slice::<PublishingSecretStore>(&payload)
        .map_err(|_| "发布配置文件已损坏。".to_string())?;
    if store.version != STORE_VERSION {
        return Err("发布配置版本不受支持。".to_string());
    }
    Ok(store)
}

fn secret_key(channel: &str, account: &str) -> String {
    format!("{channel}:{account}")
}

#[cfg(unix)]
fn restrict_directory_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "无法限制落笔应用数据目录权限。".to_string())
}

#[cfg(not(unix))]
fn restrict_directory_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn restrict_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|_| "无法限制发布配置文件权限。".to_string())
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn publishing_secrets_survive_reload_and_preserve_channels() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-publishing-secret-store-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let path = root.join("publishing-secrets.json");

        save_secret_at(&path, "mowen", "default", "mowen-secret")?;
        save_secret_at(&path, "aliyun-oss", "default", "oss-secret")?;
        save_secret_group_at(
            &path,
            "github",
            &[("default", "access-token"), ("refresh", "refresh-token")],
        )?;

        assert_eq!(read_secret_at(&path, "mowen", "default")?, "mowen-secret");
        assert_eq!(
            read_secret_at(&path, "aliyun-oss", "default")?,
            "oss-secret"
        );
        assert_eq!(read_secret_at(&path, "github", "default")?, "access-token");
        assert_eq!(read_secret_at(&path, "github", "refresh")?, "refresh-token");
        assert_eq!(
            read_saved_secret_at(&path, "aliyun-oss", "default")?,
            Some("oss-secret".to_string())
        );
        assert_eq!(read_saved_secret_at(&path, "wordpress", "default")?, None);
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        assert!(!raw.contains("keychain"));
        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn deleting_one_publishing_secret_preserves_other_channels() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-publishing-secret-delete-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let path = root.join("publishing-secrets.json");

        save_secret_at(&path, "mowen", "default", "mowen-secret")?;
        save_secret_at(&path, "aliyun-oss", "default", "oss-secret")?;
        delete_secret_group_at(&path, "mowen", &["default"])?;

        assert!(read_secret_at(&path, "mowen", "default").is_err());
        assert_eq!(
            read_secret_at(&path, "aliyun-oss", "default")?,
            "oss-secret"
        );
        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    fn save_secret_group_at(
        path: &Path,
        channel: &str,
        entries: &[(&str, &str)],
    ) -> Result<(), String> {
        let mut store = load_store(path)?;
        for (account, secret) in entries {
            store
                .secrets
                .insert(secret_key(channel, account), (*secret).to_string());
        }
        save_store(path, &store)
    }
}
