//! [INPUT]: 依赖 serde、用户平台 config 目录、写作库 project.toml 与本地 JSON 文件系统
//! [OUTPUT]: 向 publishing commands 提供应用级发布目标加载/保存、旧项目博客配置一次性迁移与严格校验
//! [POS]: 发布领域的非敏感目标注册表；GitHub 凭证仍由 secret_store 独立持有，项目模型不再拥有发布配置
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

const STORE_VERSION: u8 = 1;
const DEFAULT_GITHUB_BLOG_TARGET_ID: &str = "github-blog";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishingTargetStore {
    version: u8,
    targets: Vec<PublishingTarget>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishingTarget {
    id: String,
    kind: String,
    enabled: bool,
    blog_name: String,
    menu_label: String,
    repository: String,
    branch: String,
    content_root: String,
    site_url: String,
}

impl Default for PublishingTargetStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            targets: vec![PublishingTarget::default_github_blog()],
        }
    }
}

impl PublishingTarget {
    fn default_github_blog() -> Self {
        Self {
            id: DEFAULT_GITHUB_BLOG_TARGET_ID.to_string(),
            kind: "githubHugoBlog".to_string(),
            enabled: false,
            blog_name: "GitHub 博客".to_string(),
            menu_label: "发布到博客".to_string(),
            repository: String::new(),
            branch: "main".to_string(),
            content_root: "content/posts".to_string(),
            site_url: String::new(),
        }
    }
}

pub(crate) fn load(library_path: String) -> Result<PublishingTargetStore, String> {
    let path = store_path()?;
    let store_existed = path.exists();
    let mut store = load_at(&path)?;
    if store.targets.is_empty() {
        store.targets.push(PublishingTarget::default_github_blog());
    }
    let library_root = Path::new(library_path.trim());

    let mut store_changed = !store_existed;
    if library_root.is_absolute() && !has_configured_github_blog_target(&store) {
        if let Some(target) = find_legacy_blog_target(library_root)? {
            store_changed |= merge_legacy_github_blog_target(&mut store, target);
        }
    }
    if store_changed {
        save_at(&path, &store)?;
    }

    if library_root.is_absolute() {
        remove_legacy_project_settings(library_root)?;
    }
    Ok(store)
}

fn merge_legacy_github_blog_target(
    store: &mut PublishingTargetStore,
    target: PublishingTarget,
) -> bool {
    if has_configured_github_blog_target(store) {
        return false;
    }
    if let Some(existing) = store
        .targets
        .iter_mut()
        .find(|item| item.id == DEFAULT_GITHUB_BLOG_TARGET_ID)
    {
        *existing = target;
    } else {
        store.targets.push(target);
    }
    true
}

fn has_configured_github_blog_target(store: &PublishingTargetStore) -> bool {
    store.targets.iter().any(|target| {
        target.kind == "githubHugoBlog"
            && (!target.repository.trim().is_empty() || !target.site_url.trim().is_empty())
    })
}

pub(crate) fn save(mut store: PublishingTargetStore) -> Result<PublishingTargetStore, String> {
    if store.version != STORE_VERSION {
        return Err("发布目标配置版本不受支持。".to_string());
    }
    if store.targets.is_empty() {
        store.targets.push(PublishingTarget::default_github_blog());
    }
    let mut ids = std::collections::BTreeSet::new();
    for target in &mut store.targets {
        normalize_and_validate_target(target)?;
        if !ids.insert(target.id.clone()) {
            return Err("发布目标 ID 重复。".to_string());
        }
    }
    save_at(&store_path()?, &store)?;
    Ok(store)
}

fn normalize_and_validate_target(target: &mut PublishingTarget) -> Result<(), String> {
    target.id = target.id.trim().to_string();
    target.kind = target.kind.trim().to_string();
    target.blog_name = target.blog_name.trim().to_string();
    target.menu_label = target.menu_label.trim().to_string();
    target.repository = target
        .repository
        .trim()
        .trim_end_matches(".git")
        .to_string();
    target.branch = target.branch.trim().to_string();
    target.content_root = target.content_root.trim().trim_matches('/').to_string();
    target.site_url = target.site_url.trim().trim_end_matches('/').to_string();

    if target.id.is_empty()
        || target.id.len() > 160
        || target
            .id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("发布目标 ID 无效。".to_string());
    }
    if target.kind != "githubHugoBlog" {
        return Err("暂不支持该发布目标类型。".to_string());
    }
    if target.blog_name.is_empty()
        || target.blog_name.len() > 120
        || target.blog_name.chars().any(char::is_control)
    {
        return Err("请填写有效的博客名称。".to_string());
    }
    if target.menu_label.is_empty()
        || target.menu_label.len() > 40
        || target.menu_label.chars().any(char::is_control)
    {
        return Err("请填写有效的发布菜单名称。".to_string());
    }
    if !target.enabled {
        return Ok(());
    }
    validate_repository(&target.repository)?;
    validate_branch(&target.branch)?;
    validate_content_root(&target.content_root)?;
    validate_site_url(&target.site_url)
}

fn validate_repository(value: &str) -> Result<(), String> {
    let parts = value.split('/').collect::<Vec<_>>();
    if parts.len() != 2
        || parts
            .iter()
            .any(|part| part.is_empty() || part.chars().any(char::is_whitespace))
    {
        return Err("GitHub 仓库格式无效，请使用 owner/repository。".to_string());
    }
    Ok(())
}

fn validate_branch(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 240 || value.chars().any(char::is_control) {
        return Err("发布分支为空或格式无效。".to_string());
    }
    Ok(())
}

fn validate_content_root(value: &str) -> Result<(), String> {
    if !value.starts_with("content/")
        || value
            .split('/')
            .any(|part| part.is_empty() || matches!(part, "." | "..") || part.starts_with('.'))
    {
        return Err("文章目录必须位于 content/ 下。".to_string());
    }
    Ok(())
}

fn validate_site_url(value: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(value).map_err(|_| "站点地址格式无效。".to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") || parsed.host_str().is_none() {
        return Err("站点地址必须以 https:// 或 http:// 开头。".to_string());
    }
    Ok(())
}

fn store_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join("Loby").join("publishing-targets.json"))
        .ok_or_else(|| "无法确定落笔应用数据目录。".to_string())
}

fn load_at(path: &Path) -> Result<PublishingTargetStore, String> {
    if !path.exists() {
        return Ok(PublishingTargetStore::default());
    }
    let payload = fs::read(path).map_err(|_| "无法读取发布目标配置。".to_string())?;
    let store = serde_json::from_slice::<PublishingTargetStore>(&payload)
        .map_err(|_| "发布目标配置文件已损坏。".to_string())?;
    if store.version != STORE_VERSION {
        return Err("发布目标配置版本不受支持。".to_string());
    }
    Ok(store)
}

fn save_at(path: &Path, store: &PublishingTargetStore) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "发布目标配置路径无效。".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建落笔应用数据目录。".to_string())?;
    let payload =
        serde_json::to_vec_pretty(store).map_err(|_| "无法生成发布目标配置。".to_string())?;
    fs::write(path, payload).map_err(|_| "无法保存发布目标配置。".to_string())
}

fn find_legacy_blog_target(library_root: &Path) -> Result<Option<PublishingTarget>, String> {
    let projects_root = library_root.join("projects");
    if !projects_root.is_dir() {
        return Ok(None);
    }
    let mut project_dirs = fs::read_dir(projects_root)
        .map_err(|error| format!("无法读取旧项目发布配置：{error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();
    project_dirs.sort();

    let mut fallback = None;
    for project_dir in project_dirs {
        let Ok(raw) = fs::read_to_string(project_dir.join("project.toml")) else {
            continue;
        };
        let Ok(document) = raw.parse::<toml::Value>() else {
            continue;
        };
        let Some(table) = document
            .get("blogPublishing")
            .and_then(toml::Value::as_table)
        else {
            continue;
        };
        let repository = table_string(table, "repository").unwrap_or_default();
        let site_url = table_string(table, "siteUrl").unwrap_or_default();
        if repository.trim().is_empty() && site_url.trim().is_empty() {
            continue;
        }
        let name = table_string(table, "name")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "GitHub 博客".to_string());
        let target = PublishingTarget {
            id: DEFAULT_GITHUB_BLOG_TARGET_ID.to_string(),
            kind: "githubHugoBlog".to_string(),
            enabled: table
                .get("enabled")
                .and_then(toml::Value::as_bool)
                .unwrap_or(false),
            blog_name: name.clone(),
            menu_label: name,
            repository,
            branch: table_string(table, "branch")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "main".to_string()),
            content_root: table_string(table, "contentRoot")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "content/posts".to_string()),
            site_url,
        };
        if target.enabled {
            return Ok(Some(target));
        }
        fallback.get_or_insert(target);
    }
    Ok(fallback)
}

fn remove_legacy_project_settings(library_root: &Path) -> Result<(), String> {
    let projects_root = library_root.join("projects");
    if !projects_root.is_dir() {
        return Ok(());
    }
    for entry in
        fs::read_dir(projects_root).map_err(|error| format!("无法清理旧项目发布配置：{error}"))?
    {
        let Ok(entry) = entry else { continue };
        let path = entry.path().join("project.toml");
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let cleaned = remove_toml_table(&raw, "blogPublishing");
        if cleaned != raw {
            fs::write(path, cleaned).map_err(|error| format!("无法清理旧项目发布配置：{error}"))?;
        }
    }
    Ok(())
}

fn remove_toml_table(raw: &str, table_name: &str) -> String {
    let header = format!("[{table_name}]");
    let mut skipping = false;
    let mut output = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed == header {
            skipping = true;
            while output
                .last()
                .is_some_and(|line: &&str| line.trim().is_empty())
            {
                output.pop();
            }
            continue;
        }
        if skipping && trimmed.starts_with('[') {
            skipping = false;
        }
        if !skipping {
            output.push(line);
        }
    }
    let mut cleaned = output.join("\n");
    if raw.ends_with('\n') {
        cleaned.push('\n');
    }
    cleaned
}

fn table_string(table: &toml::value::Table, key: &str) -> Option<String> {
    table
        .get(key)
        .and_then(toml::Value::as_str)
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_project_target_moves_to_global_store_and_is_removed() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "loby-publishing-target-migration-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let project = root.join("projects").join("博客");
        fs::create_dir_all(&project).map_err(|error| error.to_string())?;
        let raw = "[project]\ntitle = \"博客\"\n\n[blogPublishing]\nenabled = true\nname = \"麦先生说博客\"\nrepository = \"owner/site\"\nbranch = \"main\"\ncontentRoot = \"content/posts\"\nsiteUrl = \"https://example.com\"\n\n[[groups]]\nid = \"group-1\"\n";
        fs::write(project.join("project.toml"), raw).map_err(|error| error.to_string())?;

        let target = find_legacy_blog_target(&root)?.expect("legacy target");
        assert!(target.enabled);
        assert_eq!(target.blog_name, "麦先生说博客");
        assert_eq!(target.repository, "owner/site");

        remove_legacy_project_settings(&root)?;
        let cleaned =
            fs::read_to_string(project.join("project.toml")).map_err(|error| error.to_string())?;
        assert!(!cleaned.contains("[blogPublishing]"));
        assert!(cleaned.contains("[[groups]]"));
        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn enabled_target_requires_complete_repository_settings() {
        let mut target = PublishingTarget::default_github_blog();
        target.enabled = true;
        assert_eq!(
            normalize_and_validate_target(&mut target),
            Err("GitHub 仓库格式无效，请使用 owner/repository。".to_string())
        );
    }

    #[test]
    fn existing_empty_global_store_still_accepts_the_legacy_project_target() {
        let mut store = PublishingTargetStore::default();
        let mut target = PublishingTarget::default_github_blog();
        target.enabled = true;
        target.blog_name = "麦先生说博客".to_string();
        target.repository = "owner/site".to_string();
        target.site_url = "https://example.com".to_string();

        assert!(merge_legacy_github_blog_target(&mut store, target));
        assert!(has_configured_github_blog_target(&store));
        assert_eq!(store.targets[0].repository, "owner/site");
    }
}
