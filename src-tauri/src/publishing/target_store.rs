//! [INPUT]: 依赖 serde、用户平台 config 目录、写作库 project.toml 与本地 JSON 文件系统
//! [OUTPUT]: 向 publishing commands 提供 Hugo/Starlight 适配目标加载/保存、旧项目博客/帮助中心配置迁移与严格校验
//! [POS]: 发布领域的非敏感目标注册表；目标实例共享 GitHub 管线，仅由 kind 选择格式与目录适配器
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::legacy_docs_target_id;
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
    #[serde(default)]
    blog_name: String,
    #[serde(default)]
    menu_label: String,
    #[serde(default)]
    site_name: String,
    repository: String,
    branch: String,
    content_root: String,
    #[serde(default)]
    manifest_path: String,
    #[serde(default)]
    assets_root: String,
    site_url: String,
}

impl Default for PublishingTargetStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            targets: Vec::new(),
        }
    }
}

impl PublishingTarget {
    #[cfg(test)]
    fn default_github_blog() -> Self {
        Self {
            id: DEFAULT_GITHUB_BLOG_TARGET_ID.to_string(),
            kind: "githubHugoBlog".to_string(),
            enabled: false,
            blog_name: "GitHub 博客".to_string(),
            menu_label: "发布到博客".to_string(),
            site_name: String::new(),
            repository: String::new(),
            branch: "main".to_string(),
            content_root: "content/posts".to_string(),
            manifest_path: String::new(),
            assets_root: String::new(),
            site_url: String::new(),
        }
    }

    #[cfg(test)]
    fn default_github_docs() -> Self {
        Self {
            id: "github-docs-test".to_string(),
            kind: "githubDocsSite".to_string(),
            enabled: true,
            blog_name: String::new(),
            menu_label: String::new(),
            site_name: "文档站".to_string(),
            repository: "owner/docs".to_string(),
            branch: "main".to_string(),
            content_root: "src/content/docs".to_string(),
            manifest_path: "src/data/loby-docs.json".to_string(),
            assets_root: "public/images/docs".to_string(),
            site_url: "https://docs.example.com".to_string(),
        }
    }
}

pub(crate) fn load(library_path: String) -> Result<PublishingTargetStore, String> {
    let path = store_path()?;
    let store_existed = path.exists();
    let mut store = load_at(&path)?;
    let stored_target_count = store.targets.len();
    store
        .targets
        .retain(|target| !is_implicit_default_target(target));
    let library_root = Path::new(library_path.trim());

    let mut store_changed = !store_existed || store.targets.len() != stored_target_count;
    if library_root.is_absolute() && !has_configured_github_blog_target(&store) {
        if let Some(target) = find_legacy_blog_target(library_root)? {
            store_changed |= merge_legacy_github_blog_target(&mut store, target);
        }
    }
    if library_root.is_absolute() {
        for target in find_legacy_docs_targets(library_root)? {
            store_changed |= merge_target_by_id(&mut store, target);
        }
    }
    if store_changed {
        save_at(&path, &store)?;
    }

    if library_root.is_absolute() {
        migrate_legacy_project_settings(library_root)?;
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

fn merge_target_by_id(store: &mut PublishingTargetStore, target: PublishingTarget) -> bool {
    if store.targets.iter().any(|item| item.id == target.id) {
        return false;
    }
    store.targets.push(target);
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

fn is_implicit_default_target(target: &PublishingTarget) -> bool {
    target.id == DEFAULT_GITHUB_BLOG_TARGET_ID
        && target.kind == "githubHugoBlog"
        && !target.enabled
        && target.blog_name == "GitHub 博客"
        && target.menu_label == "发布到博客"
        && target.repository.trim().is_empty()
        && target.branch == "main"
        && target.content_root == "content/posts"
        && target.site_url.trim().is_empty()
}

fn normalize_and_validate_target(target: &mut PublishingTarget) -> Result<(), String> {
    target.id = target.id.trim().to_string();
    target.kind = target.kind.trim().to_string();
    target.blog_name = target.blog_name.trim().to_string();
    target.menu_label = target.menu_label.trim().to_string();
    target.site_name = target.site_name.trim().to_string();
    target.repository = target
        .repository
        .trim()
        .trim_end_matches(".git")
        .to_string();
    target.branch = target.branch.trim().to_string();
    target.content_root = target.content_root.trim().trim_matches('/').to_string();
    target.manifest_path = target.manifest_path.trim().trim_matches('/').to_string();
    target.assets_root = target.assets_root.trim().trim_matches('/').to_string();
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
    if !matches!(target.kind.as_str(), "githubHugoBlog" | "githubDocsSite") {
        return Err("暂不支持该发布目标类型。".to_string());
    }
    let target_name = if target.kind == "githubHugoBlog" {
        &target.blog_name
    } else {
        &target.site_name
    };
    if target_name.is_empty()
        || target_name.len() > 120
        || target_name.chars().any(char::is_control)
    {
        return Err("请填写有效的发布目标名称。".to_string());
    }
    if target.kind == "githubHugoBlog"
        && (target.menu_label.is_empty()
            || target.menu_label.len() > 40
            || target.menu_label.chars().any(char::is_control))
    {
        return Err("请填写有效的发布菜单名称。".to_string());
    }
    if !target.enabled {
        return Ok(());
    }
    validate_repository(&target.repository)?;
    validate_branch(&target.branch)?;
    validate_repository_path(&target.content_root, "内容目录")?;
    if target.kind == "githubHugoBlog" && !target.content_root.starts_with("content/") {
        return Err("Hugo 文章目录必须位于 content/ 下。".to_string());
    }
    if target.kind == "githubDocsSite" {
        validate_repository_path(&target.manifest_path, "Starlight 文档清单")?;
        validate_repository_path(&target.assets_root, "Starlight 图片目录")?;
        if target.content_root != "src/content/docs"
            && !target.content_root.starts_with("src/content/docs/")
        {
            return Err("Starlight 文档目录必须位于 src/content/docs 下。".to_string());
        }
        if !target.assets_root.starts_with("public/") {
            return Err("Starlight 图片目录必须位于 public/ 下。".to_string());
        }
        if !target.manifest_path.ends_with(".json") {
            return Err("Starlight 文档清单必须是 JSON 文件。".to_string());
        }
    }
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

fn validate_repository_path(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.split('/').any(|part| {
            part.is_empty()
                || matches!(part, "." | "..")
                || part.starts_with('.')
                || part.contains('\\')
        })
    {
        return Err(format!("{label}格式无效。"));
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
            site_name: String::new(),
            repository,
            branch: table_string(table, "branch")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "main".to_string()),
            content_root: table_string(table, "contentRoot")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "content/posts".to_string()),
            manifest_path: String::new(),
            assets_root: String::new(),
            site_url,
        };
        if target.enabled {
            return Ok(Some(target));
        }
        fallback.get_or_insert(target);
    }
    Ok(fallback)
}

fn find_legacy_docs_targets(library_root: &Path) -> Result<Vec<PublishingTarget>, String> {
    let projects_root = library_root.join("projects");
    if !projects_root.is_dir() {
        return Ok(Vec::new());
    }
    let mut targets = Vec::new();
    for entry in
        fs::read_dir(projects_root).map_err(|error| format!("无法读取旧帮助中心配置：{error}"))?
    {
        let Ok(entry) = entry else { continue };
        let Ok(raw) = fs::read_to_string(entry.path().join("project.toml")) else {
            continue;
        };
        let Ok(document) = raw.parse::<toml::Value>() else {
            continue;
        };
        let Some(table) = document.get("helpCenter").and_then(toml::Value::as_table) else {
            continue;
        };
        let project_id = document
            .get("project")
            .and_then(toml::Value::as_table)
            .and_then(|project| table_string(project, "id"))
            .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());
        let project_title = document
            .get("project")
            .and_then(toml::Value::as_table)
            .and_then(|project| table_string(project, "title"))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "GitHub 文档网站".to_string());
        let repository = table_string(table, "repository").unwrap_or_default();
        let site_url = table_string(table, "siteUrl").unwrap_or_default();
        if repository.trim().is_empty() && site_url.trim().is_empty() {
            continue;
        }
        targets.push(PublishingTarget {
            id: legacy_docs_target_id(&project_id),
            kind: "githubDocsSite".to_string(),
            enabled: true,
            blog_name: String::new(),
            menu_label: String::new(),
            site_name: project_title,
            repository,
            branch: table_string(table, "branch")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "main".to_string()),
            content_root: table_string(table, "contentRoot")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "src/content/docs".to_string()),
            manifest_path: table_string(table, "manifestPath")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "src/data/loby-docs.json".to_string()),
            assets_root: table_string(table, "assetsRoot")
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "public/images/docs".to_string()),
            site_url,
        });
    }
    Ok(targets)
}

fn migrate_legacy_project_settings(library_root: &Path) -> Result<(), String> {
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
        let Ok(document) = raw.parse::<toml::Value>() else {
            continue;
        };
        let has_publishing = document
            .get("publishing")
            .and_then(toml::Value::as_table)
            .is_some();
        let legacy_target_id = if document
            .get("helpCenter")
            .and_then(toml::Value::as_table)
            .is_some()
        {
            let project_id = document
                .get("project")
                .and_then(toml::Value::as_table)
                .and_then(|project| table_string(project, "id"))
                .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());
            Some(legacy_docs_target_id(&project_id))
        } else if document
            .get("blogPublishing")
            .and_then(toml::Value::as_table)
            .is_some()
        {
            Some(DEFAULT_GITHUB_BLOG_TARGET_ID.to_string())
        } else {
            None
        };
        let Some(target_id) = legacy_target_id else {
            continue;
        };
        let mut migrated = remove_toml_table(&raw, "blogPublishing");
        migrated = remove_toml_table(&migrated, "helpCenter");
        migrated = migrated.replace("[[helpCenterGroups]]", "[[publishingGroups]]");
        if !has_publishing {
            if !migrated.ends_with('\n') {
                migrated.push('\n');
            }
            migrated.push_str(&format!("\n[publishing]\ntargetId = \"{target_id}\"\n"));
        }
        if migrated != raw {
            fs::write(path, migrated)
                .map_err(|error| format!("无法迁移旧项目发布配置：{error}"))?;
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

        migrate_legacy_project_settings(&root)?;
        let cleaned =
            fs::read_to_string(project.join("project.toml")).map_err(|error| error.to_string())?;
        assert!(!cleaned.contains("[blogPublishing]"));
        assert!(cleaned.contains("[publishing]"));
        assert!(cleaned.contains("targetId = \"github-blog\""));
        assert!(cleaned.contains("[[groups]]"));
        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[test]
    fn legacy_help_center_becomes_a_starlight_target_and_project_binding() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("loby-docs-target-migration-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        let project = root.join("projects").join("帮助中心");
        fs::create_dir_all(&project).map_err(|error| error.to_string())?;
        let raw = "[project]\nid = \"project-help\"\ntitle = \"落笔帮助中心\"\n\n[helpCenter]\nrepository = \"owner/docs\"\nbranch = \"main\"\ncontentRoot = \"src/content/docs\"\nmanifestPath = \"src/data/loby-docs.json\"\nassetsRoot = \"public/images/docs\"\nsiteUrl = \"https://docs.example.com\"\n\n[[helpCenterGroups]]\ngroupId = \"group-guide\"\ndirectory = \"guide\"\nenabled = true\n";
        fs::write(project.join("project.toml"), raw).map_err(|error| error.to_string())?;

        let targets = find_legacy_docs_targets(&root)?;
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].kind, "githubDocsSite");
        assert_eq!(targets[0].site_name, "落笔帮助中心");
        assert_eq!(targets[0].id, "github-docs-project-help");

        migrate_legacy_project_settings(&root)?;
        let migrated =
            fs::read_to_string(project.join("project.toml")).map_err(|error| error.to_string())?;
        assert!(!migrated.contains("[helpCenter]"));
        assert!(migrated.contains("targetId = \"github-docs-project-help\""));
        assert!(migrated.contains("[[publishingGroups]]"));
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
    fn starlight_target_accepts_safe_subpaths_and_rejects_unserved_assets() {
        let mut target = PublishingTarget::default_github_docs();
        target.content_root = "src/content/docs/产品手册".to_string();
        target.manifest_path = "src/data/product-docs.json".to_string();
        target.assets_root = "public/images/product-docs".to_string();
        assert!(normalize_and_validate_target(&mut target).is_ok());

        target.assets_root = "src/assets/product-docs".to_string();
        assert_eq!(
            normalize_and_validate_target(&mut target),
            Err("Starlight 图片目录必须位于 public/ 下。".to_string())
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

    #[test]
    fn default_store_does_not_create_an_implicit_target() {
        assert!(PublishingTargetStore::default().targets.is_empty());
    }

    #[test]
    fn old_implicit_default_target_is_not_a_user_added_target() {
        assert!(is_implicit_default_target(
            &PublishingTarget::default_github_blog()
        ));
    }
}
