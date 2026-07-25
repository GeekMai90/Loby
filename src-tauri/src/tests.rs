//! [INPUT]: 依赖 native 各领域公开/测试边界、临时文件系统与纯协议构造器
//! [OUTPUT]: 提供跨 library、agent、publishing、resources 等原生契约的集成回归覆盖
//! [POS]: native composition 的跨领域测试入口；模块内单一职责测试优先留在各自文件
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::agent::assistant_attachments::{AssistantAttachmentKind, ResolvedAssistantAttachment};
use crate::agent::events::{
    agent_stream_event_name, empty_agent_event, parse_app_server_agent_message_delta,
    parse_app_server_token_usage,
};
use crate::agent::protocol::{
    build_app_server_approval_response, build_app_server_thread_read,
    build_app_server_thread_resume, build_app_server_thread_start, build_app_server_turn_interrupt,
    build_app_server_turn_start, build_app_server_turn_steer, normalize_approval_decision,
};
use crate::agent::runtime::{apply_codex_exec_args, format_codex_exec_command_label, toml_string};
use crate::library::trash::{
    clean_empty_sheets, clear_library_trash_at, list_library_trash, move_project_to_trash,
    move_sheet_to_trash, restore_trash_entry,
};
use crate::library::{
    default_inbox_project, default_notes_project, load_library_from_path, rebuild_library_index_at,
    save_library_to_path, unix_timestamp, INBOX_GROUP_ID, INBOX_PROJECT_ID, NOTES_PROJECT_ID,
    NOTES_QUICK_GROUP_ID,
};
use crate::markdown::*;
use crate::models::*;
use std::fs;
use std::path::Path;
use std::process::Command;

fn sample_sheet() -> WritingSheet {
    WritingSheet {
        id: "sheet-1".to_string(),
        title: "测试卡片".to_string(),
        group_id: "group-main".to_string(),
        status: "构思".to_string(),
        tags: vec!["写作".to_string()],
        target_words: 1200,
        description: "摘要".to_string(),
        body: "# 正文\n\n内容".to_string(),
        created_at: "2026-07-04T11:00:00.000Z".to_string(),
        updated_at: "2026-07-04".to_string(),
        properties: std::collections::BTreeMap::from([(
            "阶段".to_string(),
            serde_json::Value::String("写作中".to_string()),
        )]),
        archived_at: String::new(),
        completed_at: "2026-07-05T11:00:00.000Z".to_string(),
        versions: Vec::new(),
        publications: std::collections::BTreeMap::from([(
            "github-blog".to_string(),
            PublishingTargetPublication {
                target_kind: "githubHugoBlog".to_string(),
                source_id: "sheet-1".to_string(),
                slug: "test-card-sheet-1".to_string(),
                url: "https://blog.example.com/posts/test-card-sheet-1/".to_string(),
                last_commit_sha: "abc123".to_string(),
                last_published_at: "2026-07-24T10:00:00.000Z".to_string(),
                source_hash: "source-hash".to_string(),
                draft: false,
            },
        )]),
    }
}

#[test]
fn render_sheet_markdown_adds_loby_frontmatter() {
    let rendered = render_sheet_markdown(&sample_sheet());
    assert!(rendered.starts_with("---\n"));
    assert!(rendered.contains("title: 测试卡片"));
    assert!(rendered.contains("阶段: 写作中"));
    assert!(!rendered.contains("lobySheet"));
    assert!(rendered.contains("description: 摘要"));
    assert!(rendered.contains("loby:"));
    assert!(rendered.contains("status: 构思"));
    assert!(rendered.contains("tags:\n- 写作"));
    assert!(rendered.contains("createdAt: 2026-07-04 11:00:00"));
    assert!(rendered.contains("updatedAt: 2026-07-04"));
    assert!(!rendered.contains("\n  createdAt:"));
    assert!(!rendered.contains("\n  updatedAt:"));
    assert!(rendered.contains("completedAt: 2026-07-05 11:00:00"));
    assert!(rendered.contains("publications:"));
    assert!(rendered.contains("github-blog:"));
    assert!(rendered.contains("slug: test-card-sheet-1"));
    assert!(!rendered.contains("\n  type:"));
    assert!(rendered.ends_with("# 正文\n\n内容"));
}

#[test]
fn strip_loby_frontmatter_removes_only_loby_metadata() {
    let rendered = render_sheet_markdown(&sample_sheet());
    assert_eq!(strip_loby_frontmatter(&rendered), "# 正文\n\n内容");
}

#[test]
fn strip_frontmatter_exposes_only_the_document_body() {
    let user_markdown = "---\ntitle: User Metadata\n---\n\n# Keep";
    assert_eq!(strip_loby_frontmatter(user_markdown), "# Keep");
    let raw = "---\ntitle: User Metadata\ntags:\n  - writing\n---\n\n# Keep";
    assert_eq!(sheet_frontmatter_tags(raw), ["writing"]);
    assert!(!sheet_frontmatter_properties(raw).contains_key("tags"));
}

#[test]
fn render_project_readme_links_sheets() {
    let project = sample_project();
    let rendered = render_project_readme(&project);
    assert!(rendered.contains("lobyProject: true"));
    assert!(rendered.contains("## Writing Brief"));
    assert!(rendered.contains("Audience: 专业写作者"));
    assert!(rendered.contains("[测试卡片](正文/测试卡片.md)"));
    assert!(rendered.contains("[Assets](assets/)"));
    assert!(rendered.contains("[References](references/)"));
    assert!(rendered.contains("[Exports](exports/)"));
    assert!(!rendered.contains("targetPlatform:"));
    assert!(!rendered.contains("- Status:"));
}

#[test]
fn render_project_toml_writes_readable_project_metadata() {
    let rendered = render_project_toml(&sample_project());
    assert!(rendered.contains("[loby]"));
    assert!(rendered.contains("project = true"));
    assert!(rendered.contains("[project]"));
    assert!(rendered.contains("title = \"项目\""));
    assert!(rendered.contains("icon = \"article\""));
    assert!(rendered.contains("iconColor = \"#007aff\""));
    assert!(rendered.contains("status = \"构思\""));
    assert!(rendered.contains("tags = [\"写作\"]"));
    assert!(rendered.contains("[projectGoal]"));
    assert!(rendered.contains("unit = \"articles\""));
    assert!(rendered.contains("target = 12"));
    assert!(rendered.contains("[[documentPropertyDefinitions]]"));
    assert!(rendered.contains("type = \"checkbox\""));
    assert!(rendered.contains("[writingBrief]"));
    assert!(rendered.contains("audience = \"专业写作者\""));
    assert!(!rendered.contains("[blogPublishing]"));
    assert!(rendered.contains("[[sheets]]"));
    assert!(rendered.contains("path = \"正文/测试卡片.md\""));
    assert!(!rendered.contains("type = \"正文\""));
    assert!(rendered.contains("[[publishingChecklist]]"));
    assert!(rendered.contains("done = true"));
    assert!(rendered.contains("[[exportHistory]]"));
    assert!(rendered.contains("filename = \"project.md\""));
    let project_section = rendered.split("[projectGoal]").next().unwrap_or(&rendered);
    assert!(!project_section.contains("targetWords ="));
    assert!(!project_section.contains("tags ="));
}

#[test]
fn quote_toml_escapes_control_characters() {
    assert_eq!(
        quote_toml("A \"quote\"\nC:\\Path"),
        "\"A \\\"quote\\\"\\nC:\\\\Path\""
    );
}

#[test]
fn quote_yaml_prefers_plain_scalars_when_safe() {
    assert_eq!(quote_yaml("测试卡片"), "测试卡片");
    assert_eq!(quote_yaml("2026-07-04 11:00:00"), "2026-07-04 11:00:00");
    assert_eq!(quote_yaml("A: value"), "\"A: value\"");
    assert_eq!(quote_yaml("#007aff"), "\"#007aff\"");
}

#[test]
fn save_library_writes_visible_folder_first_markdown() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-folder-first-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let mut notes = default_notes_project();
    notes.sheets = vec![WritingSheet {
        id: "note-1".to_string(),
        title: "随手记".to_string(),
        group_id: NOTES_QUICK_GROUP_ID.to_string(),
        status: "构思".to_string(),
        tags: Vec::new(),
        target_words: 0,
        description: String::new(),
        body: "这是一个临时想法。".to_string(),
        created_at: "2026-07-04T11:00:00.000Z".to_string(),
        updated_at: "2026-07-04".to_string(),
        properties: std::collections::BTreeMap::new(),
        archived_at: String::new(),
        completed_at: String::new(),
        versions: Vec::new(),
        publications: Default::default(),
    }];
    let mut inbox = default_inbox_project();
    inbox.sheets = vec![WritingSheet {
        id: "inbox-1".to_string(),
        title: "待归类文稿".to_string(),
        group_id: INBOX_GROUP_ID.to_string(),
        body: "准备继续写。".to_string(),
        ..sample_sheet()
    }];

    save_library_to_path(root.clone(), vec![sample_project(), inbox, notes])?;

    assert!(root
        .join("projects")
        .join("项目")
        .join("正文")
        .join("测试卡片.md")
        .exists());
    assert!(root.join("notes").join("随手记").join("随手记.md").exists());
    assert!(root.join("inbox").join("待归类文稿.md").is_file());
    assert!(root.join(".loby").join("library.json").exists());
    assert!(!root.join("library.json").exists());
    assert!(!root
        .join("projects")
        .join("项目")
        .join("project.json")
        .exists());

    let loaded = load_library_from_path(root.clone())?;
    assert!(loaded.iter().any(|project| project.title == "项目"
        && project.sheets.iter().any(|sheet| {
            sheet.title == "测试卡片"
                && sheet.properties.get("阶段") == Some(&serde_json::json!("写作中"))
        })));
    assert!(loaded.iter().any(|project| project.id == NOTES_PROJECT_ID
        && project.sheets.iter().any(|sheet| sheet.title == "随手记")));
    assert!(loaded.iter().any(|project| project.id == INBOX_PROJECT_ID
        && project
            .sheets
            .iter()
            .any(|sheet| sheet.title == "待归类文稿")));

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn save_library_moves_known_sheet_paths_without_sweeping_untracked_markdown() -> Result<(), String>
{
    let root = std::env::temp_dir().join(format!(
        "loby-precise-sheet-relocation-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let mut source = sample_project();
    save_library_to_path(root.clone(), vec![source.clone()])?;
    let source_path = root
        .join("projects")
        .join("项目")
        .join("正文")
        .join("测试卡片.md");
    assert!(source_path.is_file());

    let mut moved_sheet = source.sheets.remove(0);
    moved_sheet.title = "迁移后的文稿".to_string();
    moved_sheet.group_id = "group-target".to_string();
    let mut target = sample_project();
    target.id = "project-target".to_string();
    target.title = "目标项目".to_string();
    target.groups = vec![ProjectGroup {
        id: "group-target".to_string(),
        title: "发布".to_string(),
        icon: "article".to_string(),
        icon_color: "#007aff".to_string(),
        description: String::new(),
    }];
    target.sheets = vec![moved_sheet];

    save_library_to_path(root.clone(), vec![source.clone(), target.clone()])?;
    let target_path = root
        .join("projects")
        .join("目标项目")
        .join("发布")
        .join("迁移后的文稿.md");
    assert!(!source_path.exists());
    assert!(target_path.is_file());
    let moved_markdown = fs::read_to_string(&target_path).map_err(|error| error.to_string())?;
    assert!(moved_markdown.contains("description: 摘要"));
    assert!(!moved_markdown.contains("lobySheet"));

    target.sheets.clear();
    save_library_to_path(root.clone(), vec![source, target])?;
    assert!(target_path.is_file());

    fs::remove_dir_all(root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn save_library_does_not_overwrite_unrecognized_frontmatter() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-legacy-sheet-path-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let group_dir = root.join("projects").join("项目").join("正文");
    fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
    fs::write(
        group_dir.join("测试卡片.md"),
        "---\ntitle: 测试卡片\nnibvaSheet: true\nnibva:\n  id: sheet-1\n  groupId: group-main\n---\n\n# 旧正文",
    )
    .map_err(|error| error.to_string())?;

    save_library_to_path(root.clone(), vec![sample_project()])?;

    let original = group_dir.join("测试卡片.md");
    let canonical = group_dir.join("测试卡片 2.md");
    assert!(original.is_file());
    assert!(canonical.is_file());
    assert!(fs::read_to_string(original)
        .map_err(|error| error.to_string())?
        .contains("nibvaSheet: true"));
    let rendered = fs::read_to_string(canonical).map_err(|error| error.to_string())?;
    assert!(!rendered.contains("lobySheet"));
    assert!(!rendered.contains("nibvaSheet"));
    assert!(!rendered.contains("nibva:"));

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn save_library_creates_empty_note_group_folders() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-empty-note-group-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    save_library_to_path(root.clone(), vec![default_notes_project()])?;

    assert!(root.join("notes").join("随手记").is_dir());

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn rebuild_library_index_scans_finder_added_folders_and_markdown() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-rebuild-index-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let inbox_dir = root.join("notes").join("收件箱");
    let project_dir = root.join("projects").join("外部导入项目");
    let group_dir = project_dir.join("文章");
    let legacy_default_dir = project_dir.join("默认组");
    fs::create_dir_all(&inbox_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&group_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&legacy_default_dir).map_err(|error| error.to_string())?;
    fs::write(
        inbox_dir.join("临时想法.md"),
        "# 临时想法\n\n从 Finder 加入。",
    )
    .map_err(|error| error.to_string())?;
    fs::write(
            group_dir.join("分组文章.md"),
            "---\ntitle: 分组文章\nrating: 5\nchannels:\n  - 微信\ncustom:\n  nested: true\n---\n\n# 分组文章\n\n从 Finder 加入。",
        )
        .map_err(|error| error.to_string())?;
    fs::write(
        project_dir.join("根目录文章.md"),
        "# 根目录文章\n\n直接放在项目根目录。",
    )
    .map_err(|error| error.to_string())?;
    fs::write(
        legacy_default_dir.join("旧默认组文稿.md"),
        "# 旧默认组文稿\n\n等待整理。",
    )
    .map_err(|error| error.to_string())?;

    let rebuilt = rebuild_library_index_at(root.clone())?;

    assert!(root.join(".loby").join("library.json").exists());
    assert!(rebuilt.iter().any(|project| {
        project.id == NOTES_PROJECT_ID
            && project.sheets.iter().any(|sheet| sheet.title == "临时想法")
    }));
    save_library_to_path(root.clone(), rebuilt.clone())?;
    assert!(!root.join("notes").join("收件箱").exists());
    assert!(root
        .join("notes")
        .join("随手记")
        .join("临时想法.md")
        .exists());
    assert!(!project_dir.join("默认组").exists());
    assert!(project_dir.join("待整理").join("旧默认组文稿.md").exists());
    assert!(rebuilt.iter().any(|project| {
        project.title == "外部导入项目"
            && project.groups.iter().any(|group| group.title == "文章")
            && project.sheets.iter().any(|sheet| {
                sheet.title == "分组文章"
                    && sheet.properties.get("rating") == Some(&serde_json::json!(5))
                    && sheet.properties.get("channels") == Some(&serde_json::json!(["微信"]))
                    && sheet.properties.get("custom")
                        == Some(&serde_json::json!({ "nested": true }))
            })
            && project
                .sheets
                .iter()
                .any(|sheet| sheet.title == "根目录文章")
    }));
    assert!(project_dir.join("根目录文章.md").exists());

    save_library_to_path(root.clone(), rebuilt)?;
    let round_tripped =
        fs::read_to_string(group_dir.join("分组文章.md")).map_err(|error| error.to_string())?;
    let properties = sheet_frontmatter_properties(&round_tripped);
    assert_eq!(properties.get("rating"), Some(&serde_json::json!(5)));
    assert_eq!(
        properties.get("channels"),
        Some(&serde_json::json!(["微信"]))
    );
    assert_eq!(
        properties.get("custom"),
        Some(&serde_json::json!({ "nested": true }))
    );

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn load_library_recovers_generated_project_metadata_without_the_index() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-project-metadata-recovery-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }
    let mut project = sample_project();
    project.title = "项目 \"重建\"".to_string();
    project.project_goal = ProjectGoal {
        enabled: true,
        unit: "articles".to_string(),
        target: 12,
    };
    project.sheets[0].tags = vec!["标签,二".to_string(), "#重点".to_string()];
    project.updated_at = "2026-07-17 18:30:00".to_string();
    project.archived_at = "2026-07-17 19:00:00".to_string();
    project.groups[0].description = "正文 \"分组\"".to_string();
    project.writing_brief.publishing_notes = "第一条\n第二条".to_string();
    project.export_history[0].path = "C:\\Exports\\\"final\".md".to_string();
    let mut second_sheet = sample_sheet();
    second_sheet.id = "sheet-2".to_string();
    second_sheet.title = "Alpha second sheet".to_string();
    second_sheet.body = "# Alpha second sheet\n\nSecond body".to_string();
    project.sheets.push(second_sheet);

    save_library_to_path(root.clone(), vec![project.clone()])?;
    fs::remove_file(root.join(".loby").join("library.json")).map_err(|error| error.to_string())?;

    let loaded = load_library_from_path(root.clone())?;
    let recovered = loaded
        .iter()
        .find(|item| item.id == project.id)
        .ok_or_else(|| "找不到从 project.toml 恢复的项目".to_string())?;

    assert_eq!(recovered.title, project.title);
    assert!(recovered.project_goal.enabled);
    assert_eq!(recovered.project_goal.unit, "articles");
    assert_eq!(recovered.project_goal.target, 12);
    assert_eq!(recovered.sheets[0].tags, project.sheets[0].tags);
    assert_eq!(recovered.updated_at, project.updated_at);
    assert_eq!(recovered.archived_at, project.archived_at);
    assert_eq!(recovered.groups[0].id, project.groups[0].id);
    assert_eq!(recovered.sheets[0].completed_at, "2026-07-05 11:00:00");
    assert_eq!(
        recovered.sheets[0]
            .publications
            .get("github-blog")
            .map(|publication| publication.slug.as_str()),
        Some("test-card-sheet-1")
    );
    assert_eq!(
        recovered.groups[0].description,
        project.groups[0].description
    );
    assert_eq!(
        recovered
            .sheets
            .iter()
            .map(|sheet| sheet.id.as_str())
            .collect::<Vec<_>>(),
        vec!["sheet-1", "sheet-2"]
    );
    assert_eq!(recovered.document_property_definitions.len(), 1);
    assert_eq!(
        recovered.document_property_definitions[0].default_value,
        project.document_property_definitions[0].default_value
    );
    assert_eq!(recovered.publishing_checklist.len(), 1);
    assert!(recovered.publishing_checklist[0].done);
    assert_eq!(recovered.export_history.len(), 1);
    assert_eq!(
        recovered.export_history[0].path,
        project.export_history[0].path
    );
    assert_eq!(
        recovered.writing_brief.audience,
        project.writing_brief.audience
    );
    assert_eq!(recovered.writing_brief.thesis, project.writing_brief.thesis);
    assert_eq!(recovered.writing_brief.tone, project.writing_brief.tone);
    assert_eq!(
        recovered.writing_brief.publishing_notes,
        project.writing_brief.publishing_notes
    );

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn move_project_to_trash_keeps_files_until_trash_is_cleared() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-trash-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let project = sample_project();
    save_library_to_path(root.clone(), vec![project.clone(), default_notes_project()])?;

    let next_projects = move_project_to_trash(
        root.display().to_string(),
        project.id.clone(),
        project.title.clone(),
    )?;

    assert!(!next_projects.iter().any(|item| item.id == project.id));
    assert!(!root.join("projects").join("项目").exists());
    assert!(root.join(".loby").join("trash").join("projects").exists());

    let trash_entries = list_library_trash(root.display().to_string())?;
    assert_eq!(trash_entries.len(), 1);
    assert_eq!(trash_entries[0].kind, "project");
    let restored = restore_trash_entry(root.display().to_string(), trash_entries[0].id.clone())?;
    assert!(restored.iter().any(|item| item.id == project.id));
    assert!(root.join("projects").join("项目").exists());

    move_project_to_trash(
        root.display().to_string(),
        project.id.clone(),
        project.title.clone(),
    )?;

    let moved_to_system_trash = std::cell::Cell::new(false);
    clear_library_trash_at(&root, |trash_root| {
        assert_eq!(trash_root, root.join(".loby").join("trash"));
        moved_to_system_trash.set(true);
        fs::remove_dir_all(trash_root).map_err(|error| error.to_string())
    })?;
    assert!(moved_to_system_trash.get());
    assert!(!root.join(".loby").join("trash").exists());

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn cleaning_empty_sheets_moves_only_blank_documents_to_library_trash() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-empty-sheet-cleanup-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let mut project = sample_project();
    let mut blank = sample_sheet();
    blank.id = "sheet-blank".to_string();
    blank.title = "无标题".to_string();
    blank.body = " \n\t".to_string();
    let mut blank_without_title = sample_sheet();
    blank_without_title.id = "sheet-blank-title".to_string();
    blank_without_title.title = "  ".to_string();
    blank_without_title.body.clear();
    let mut titled = sample_sheet();
    titled.id = "sheet-titled".to_string();
    titled.title = "只有标题".to_string();
    titled.body.clear();
    let mut untitled_with_body = sample_sheet();
    untitled_with_body.id = "sheet-body".to_string();
    untitled_with_body.title = "无标题".to_string();
    untitled_with_body.body = "正文内容".to_string();
    project.sheets = vec![blank, blank_without_title, titled, untitled_with_body];
    save_library_to_path(root.clone(), vec![project, default_notes_project()])?;

    let result = clean_empty_sheets(root.display().to_string())?;

    assert_eq!(result.removed_count, 2);
    let remaining_ids = result
        .projects
        .iter()
        .flat_map(|project| &project.sheets)
        .map(|sheet| sheet.id.as_str())
        .collect::<Vec<_>>();
    assert!(!remaining_ids.contains(&"sheet-blank"));
    assert!(!remaining_ids.contains(&"sheet-blank-title"));
    assert!(remaining_ids.contains(&"sheet-titled"));
    assert!(remaining_ids.contains(&"sheet-body"));

    let trash_entries = list_library_trash(root.display().to_string())?;
    assert_eq!(trash_entries.len(), 2);
    assert!(trash_entries
        .iter()
        .any(|entry| entry.sheet_id == "sheet-blank"));
    assert!(trash_entries
        .iter()
        .any(|entry| entry.sheet_id == "sheet-blank-title"));
    assert!(root.join(".loby").join("trash").join("documents").exists());

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn move_document_to_trash_can_restore_its_markdown_and_metadata() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-document-trash-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let project = sample_project();
    let sheet = project.sheets[0].clone();
    save_library_to_path(root.clone(), vec![project.clone(), default_notes_project()])?;
    let next_projects = move_sheet_to_trash(
        root.display().to_string(),
        project.id.clone(),
        project.title.clone(),
        sheet.id.clone(),
        sheet.title.clone(),
        sheet.group_id.clone(),
    )?;
    assert!(!next_projects
        .iter()
        .flat_map(|project| &project.sheets)
        .any(|item| item.id == sheet.id));

    let trash_entries = list_library_trash(root.display().to_string())?;
    assert_eq!(trash_entries.len(), 1);
    assert_eq!(trash_entries[0].kind, "document");
    assert_eq!(trash_entries[0].body, "# 正文\n\n内容");

    let restored = restore_trash_entry(root.display().to_string(), trash_entries[0].id.clone())?;
    let restored_sheet = restored
        .iter()
        .flat_map(|project| &project.sheets)
        .find(|item| item.id == sheet.id)
        .expect("restored sheet");
    assert_eq!(
        restored_sheet.properties.get("阶段"),
        Some(&serde_json::json!("写作中"))
    );
    assert!(list_library_trash(root.display().to_string())?.is_empty());

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn move_quick_note_to_trash_uses_the_notes_content_root() -> Result<(), String> {
    let root = std::env::temp_dir().join(format!(
        "loby-inbox-trash-test-{}-{}",
        std::process::id(),
        unix_timestamp()
    ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }

    let mut notes = default_notes_project();
    let mut sheet = sample_sheet();
    sheet.id = "note-quick-1".to_string();
    sheet.title = "你好呀，我是一篇新笔记".to_string();
    sheet.group_id = NOTES_QUICK_GROUP_ID.to_string();
    notes.sheets = vec![sheet.clone()];
    save_library_to_path(root.clone(), vec![sample_project(), notes.clone()])?;

    let source = root
        .join("notes")
        .join("随手记")
        .join("你好呀，我是一篇新笔记.md");
    assert!(source.exists());

    let next_projects = move_sheet_to_trash(
        root.display().to_string(),
        notes.id,
        notes.title,
        sheet.id.clone(),
        sheet.title.clone(),
        sheet.group_id,
    )?;
    assert!(!source.exists());
    assert!(!next_projects
        .iter()
        .flat_map(|project| &project.sheets)
        .any(|item| item.id == sheet.id));

    let trash_entries = list_library_trash(root.display().to_string())?;
    assert_eq!(trash_entries.len(), 1);
    assert_eq!(trash_entries[0].title, sheet.title);
    restore_trash_entry(root.display().to_string(), trash_entries[0].id.clone())?;
    assert!(source.exists());

    fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(())
}

#[test]
fn toml_string_escapes_runtime_config_values() {
    assert_eq!(toml_string("high"), "\"high\"");
    assert_eq!(toml_string("a\"b\\c"), "\"a\\\"b\\\\c\"");
}

#[test]
fn codex_exec_command_label_includes_runtime_overrides() {
    let runtime = AgentRuntimeSettings {
        model: "gpt-5.5".to_string(),
        reasoning_effort: "high".to_string(),
        quick_mode: true,
        execution_mode: String::new(),
    };
    let label =
        format_codex_exec_command_label("/tmp/codex", Path::new("/tmp/project"), 2, true, &runtime);

    assert!(label.contains("exec --json"));
    assert!(label.contains("--model gpt-5.5"));
    assert!(label.contains("--image <2 attachment(s)>"));
    assert!(label.contains("-c model_reasoning_effort=\"high\""));
    assert!(label.contains("-c service_tier=\"priority\""));
    assert!(label.contains("--cd /tmp/project"));
}

#[test]
fn codex_exec_args_attach_every_image_before_the_prompt() {
    let runtime = AgentRuntimeSettings::default();
    let mut command = Command::new("/tmp/codex");
    apply_codex_exec_args(
        &mut command,
        Path::new("/tmp/project"),
        "inspect these images",
        &[
            Path::new("/tmp/one.png").to_path_buf(),
            Path::new("/tmp/two.jpg").to_path_buf(),
        ],
        false,
        &runtime,
    );
    let args = command
        .get_args()
        .map(|value| value.to_string_lossy().to_string())
        .collect::<Vec<_>>();

    assert!(args
        .windows(2)
        .any(|pair| pair == ["--image", "/tmp/one.png"]));
    assert!(args
        .windows(2)
        .any(|pair| pair == ["--image", "/tmp/two.jpg"]));
    assert_eq!(
        args.last().map(String::as_str),
        Some("inspect these images")
    );
}

#[test]
fn app_server_thread_start_uses_native_runtime_fields() {
    let runtime = AgentRuntimeSettings {
        model: "gpt-5.5".to_string(),
        reasoning_effort: "high".to_string(),
        quick_mode: true,
        execution_mode: String::new(),
    };
    let message = build_app_server_thread_start(21, Path::new("/tmp/project"), &runtime);
    let params = message.get("params").expect("params");

    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("thread/start")
    );
    assert_eq!(message.get("id").and_then(|value| value.as_u64()), Some(21));
    assert_eq!(
        params.get("model").and_then(|value| value.as_str()),
        Some("gpt-5.5")
    );
    assert_eq!(
        params.get("serviceTier").and_then(|value| value.as_str()),
        Some("priority")
    );
    assert_eq!(
        params
            .get("approvalPolicy")
            .and_then(|value| value.as_str()),
        Some("on-request")
    );
    assert_eq!(
        params
            .get("approvalsReviewer")
            .and_then(|value| value.as_str()),
        Some("user")
    );
    assert_eq!(
        params.get("sandbox").and_then(|value| value.as_str()),
        Some("workspace-write")
    );
}

#[test]
fn app_server_autonomous_read_mode_uses_read_only_sandbox_without_approvals() {
    let runtime = AgentRuntimeSettings {
        model: "gpt-5.5".to_string(),
        reasoning_effort: "high".to_string(),
        quick_mode: false,
        execution_mode: "autonomous-read".to_string(),
    };
    let message = build_app_server_thread_start(22, Path::new("/tmp/project"), &runtime);
    let params = message.get("params").expect("params");

    assert_eq!(
        params
            .get("approvalPolicy")
            .and_then(|value| value.as_str()),
        Some("never")
    );
    assert_eq!(
        params.get("sandbox").and_then(|value| value.as_str()),
        Some("read-only")
    );
}

#[test]
fn app_server_turn_start_uses_native_effort_and_input() {
    let runtime = AgentRuntimeSettings {
        model: "gpt-5.5".to_string(),
        reasoning_effort: "low".to_string(),
        quick_mode: false,
        execution_mode: String::new(),
    };
    let attachments = vec![
        ResolvedAssistantAttachment {
            name: "one.png".to_string(),
            path: Path::new("/tmp/one.png").to_path_buf(),
            kind: AssistantAttachmentKind::Image,
        },
        ResolvedAssistantAttachment {
            name: "brief.pdf".to_string(),
            path: Path::new("/tmp/brief.pdf").to_path_buf(),
            kind: AssistantAttachmentKind::Document,
        },
    ];
    let message = build_app_server_turn_start(
        23,
        "thread-1",
        Path::new("/tmp/project"),
        "hello",
        &attachments,
        &runtime,
    );
    let params = message.get("params").expect("params");
    let inputs = params
        .get("input")
        .and_then(|value| value.as_array())
        .expect("input items");
    let input = inputs.first().expect("text input");

    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("turn/start")
    );
    assert_eq!(message.get("id").and_then(|value| value.as_u64()), Some(23));
    assert_eq!(
        params.get("threadId").and_then(|value| value.as_str()),
        Some("thread-1")
    );
    assert_eq!(
        params.get("effort").and_then(|value| value.as_str()),
        Some("low")
    );
    assert_eq!(
        params.get("serviceTier").and_then(|value| value.as_str()),
        Some("default")
    );
    assert_eq!(
        input.get("type").and_then(|value| value.as_str()),
        Some("text")
    );
    assert_eq!(
        input.get("text").and_then(|value| value.as_str()),
        Some("hello")
    );
    assert_eq!(inputs.len(), 3);
    assert_eq!(
        inputs[1].get("type").and_then(|value| value.as_str()),
        Some("localImage")
    );
    assert_eq!(
        inputs[1].get("path").and_then(|value| value.as_str()),
        Some("/tmp/one.png")
    );
    assert_eq!(
        inputs[2].get("type").and_then(|value| value.as_str()),
        Some("mention")
    );
    assert_eq!(
        inputs[2].get("name").and_then(|value| value.as_str()),
        Some("brief.pdf")
    );
    assert_eq!(
        inputs[2].get("path").and_then(|value| value.as_str()),
        Some("/tmp/brief.pdf")
    );
}

#[test]
fn app_server_turn_steer_targets_the_active_turn() {
    let message = build_app_server_turn_steer(4, "thread-1", "turn-1", "先保留当前结构");
    let params = message.get("params").expect("params");
    let input = params
        .get("input")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .expect("text input");

    assert_eq!(message.get("id").and_then(|value| value.as_u64()), Some(4));
    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("turn/steer")
    );
    assert_eq!(
        params.get("threadId").and_then(|value| value.as_str()),
        Some("thread-1")
    );
    assert_eq!(
        params
            .get("expectedTurnId")
            .and_then(|value| value.as_str()),
        Some("turn-1")
    );
    assert_eq!(
        input.get("type").and_then(|value| value.as_str()),
        Some("text")
    );
    assert_eq!(
        input.get("text").and_then(|value| value.as_str()),
        Some("先保留当前结构")
    );
}

#[test]
fn app_server_turn_interrupt_targets_the_active_turn() {
    let message = build_app_server_turn_interrupt(24, "thread-1", "turn-1");
    let params = message.get("params").expect("params");

    assert_eq!(message.get("id").and_then(|value| value.as_u64()), Some(24));
    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("turn/interrupt")
    );
    assert_eq!(
        params.get("threadId").and_then(|value| value.as_str()),
        Some("thread-1")
    );
    assert_eq!(
        params.get("turnId").and_then(|value| value.as_str()),
        Some("turn-1")
    );
}

#[test]
fn app_server_thread_resume_uses_existing_thread_id() {
    let runtime = AgentRuntimeSettings {
        model: "gpt-5.5".to_string(),
        reasoning_effort: "medium".to_string(),
        quick_mode: false,
        execution_mode: String::new(),
    };
    let message =
        build_app_server_thread_resume(25, "thread-1", Path::new("/tmp/project"), &runtime);
    let params = message.get("params").expect("params");

    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("thread/resume")
    );
    assert_eq!(
        params.get("threadId").and_then(|value| value.as_str()),
        Some("thread-1")
    );
    assert_eq!(
        params.get("serviceTier").and_then(|value| value.as_str()),
        Some("default")
    );
    assert_eq!(
        params
            .get("approvalPolicy")
            .and_then(|value| value.as_str()),
        Some("on-request")
    );
}

#[test]
fn app_server_thread_read_requests_complete_turn_history() {
    let message = build_app_server_thread_read(26, "thread-1");
    let params = message.get("params").expect("params");

    assert_eq!(message.get("id").and_then(|value| value.as_u64()), Some(26));
    assert_eq!(
        message.get("method").and_then(|value| value.as_str()),
        Some("thread/read")
    );
    assert_eq!(
        params.get("threadId").and_then(|value| value.as_str()),
        Some("thread-1")
    );
    assert_eq!(
        params.get("includeTurns").and_then(|value| value.as_bool()),
        Some(true)
    );
}

#[test]
fn app_server_runtime_omits_auto_model_and_blank_effort() {
    let runtime = AgentRuntimeSettings {
        model: "auto".to_string(),
        reasoning_effort: " ".to_string(),
        quick_mode: false,
        execution_mode: String::new(),
    };
    let thread_message = build_app_server_thread_start(26, Path::new("/tmp/project"), &runtime);
    let thread_params = thread_message.get("params").expect("params");
    let turn_message = build_app_server_turn_start(
        27,
        "thread-1",
        Path::new("/tmp/project"),
        "hello",
        &[],
        &runtime,
    );
    let turn_params = turn_message.get("params").expect("params");

    assert!(thread_params
        .get("model")
        .is_some_and(|value| value.is_null()));
    assert!(turn_params
        .get("model")
        .is_some_and(|value| value.is_null()));
    assert!(turn_params
        .get("effort")
        .is_some_and(|value| value.is_null()));
    assert_eq!(
        turn_params
            .get("serviceTier")
            .and_then(|value| value.as_str()),
        Some("default")
    );
}

#[test]
fn approval_decisions_are_normalized_for_app_server() {
    assert_eq!(normalize_approval_decision("accept"), "accept");
    assert_eq!(
        normalize_approval_decision("acceptForSession"),
        "acceptForSession"
    );
    assert_eq!(normalize_approval_decision("cancel"), "cancel");
    assert_eq!(normalize_approval_decision("decline"), "decline");
    assert_eq!(normalize_approval_decision("unexpected"), "decline");
}

#[test]
fn app_server_approval_response_preserves_request_id() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 42,
        "method": "item/commandExecution/requestApproval",
        "params": {
            "command": "pwd",
        },
    });
    let response = build_app_server_approval_response(&request, "decline");

    assert_eq!(
        response.get("id").and_then(|value| value.as_i64()),
        Some(42)
    );
    assert_eq!(
        response
            .get("result")
            .and_then(|result| result.get("decision"))
            .and_then(|value| value.as_str()),
        Some("decline")
    );
}

#[test]
fn app_server_token_usage_uses_missing_fields_as_zero() {
    let usage = parse_app_server_token_usage(&serde_json::json!({
        "inputTokens": 120,
        "outputTokens": 24,
    }));

    assert_eq!(usage.input_tokens, 120);
    assert_eq!(usage.cached_input_tokens, 0);
    assert_eq!(usage.output_tokens, 24);
    assert_eq!(usage.reasoning_output_tokens, 0);
}

#[test]
fn app_server_agent_message_delta_preserves_item_id() {
    let delta = parse_app_server_agent_message_delta(&serde_json::json!({
        "params": {
            "itemId": "message-2",
            "delta": "第二段回复",
        }
    }));

    assert_eq!(
        delta,
        Some(("message-2".to_string(), "第二段回复".to_string()))
    );
}

#[test]
fn agent_metric_event_serializes_elapsed_milliseconds() {
    let mut event = empty_agent_event("request-1", "metric");
    event.raw_type = "response/first-delta".to_string();
    event.elapsed_ms = Some(384);

    let value = serde_json::to_value(event).expect("metric event should serialize");
    assert_eq!(
        value.get("kind").and_then(|value| value.as_str()),
        Some("metric")
    );
    assert_eq!(
        value.get("rawType").and_then(|value| value.as_str()),
        Some("response/first-delta")
    );
    assert_eq!(
        value.get("elapsedMs").and_then(|value| value.as_u64()),
        Some(384)
    );
}

#[test]
fn agent_stream_events_are_isolated_by_request_id() {
    assert_eq!(
        agent_stream_event_name("agent-123-safe"),
        "loby://agent-chat-stream/agent-123-safe"
    );
    assert_ne!(
        agent_stream_event_name("agent-123-safe"),
        agent_stream_event_name("agent-456-safe")
    );
    assert_eq!(
        agent_stream_event_name("agent:unsafe/path"),
        "loby://agent-chat-stream/agent_unsafe_path"
    );
}

fn sample_project() -> WritingProject {
    WritingProject {
        id: "project-1".to_string(),
        title: "项目".to_string(),
        icon: "article".to_string(),
        icon_color: "#007aff".to_string(),
        status: "构思".to_string(),
        project_goal: ProjectGoal {
            enabled: true,
            unit: "articles".to_string(),
            target: 12,
        },
        groups: vec![ProjectGroup {
            id: "group-main".to_string(),
            title: "正文".to_string(),
            icon: "article".to_string(),
            icon_color: "#007aff".to_string(),
            description: String::new(),
        }],
        sheets: vec![sample_sheet()],
        updated_at: "2026-07-04".to_string(),
        document_property_definitions: vec![DocumentPropertyDefinition {
            id: "wechat-published".to_string(),
            key: "公众号发布".to_string(),
            label: "公众号发布".to_string(),
            field_type: "checkbox".to_string(),
            description: "是否发布到公众号".to_string(),
            options: Vec::new(),
            default_value: Some(serde_json::json!(false)),
            show_when_empty: true,
            locked: false,
        }],
        archived_at: String::new(),
        publishing_checklist: vec![PublishingChecklistItem {
            id: "title".to_string(),
            label: "标题已确认".to_string(),
            done: true,
        }],
        export_history: vec![ExportHistoryItem {
            id: "export-1".to_string(),
            label: "Markdown".to_string(),
            filename: "project.md".to_string(),
            path: "/tmp/project.md".to_string(),
            exported_at: "2026-07-04T00:00:00.000Z".to_string(),
            sheet_count: 1,
            word_count: 4,
            target_platform: "公众号".to_string(),
        }],
        writing_brief: ProjectWritingBrief {
            audience: "专业写作者".to_string(),
            thesis: "写作项目需要清楚的上下文".to_string(),
            tone: "清楚、克制".to_string(),
            publishing_notes: "保持白色 Apple 风格".to_string(),
        },
    }
}
