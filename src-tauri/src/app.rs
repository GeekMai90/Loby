//! [INPUT]: 依赖 agent/library/publishing/resources/translation/unsplash 等领域 commands、window_lifecycle 主窗口生命周期、Loby Agent Runtime managed state、Tauri menu/window/event、签名 updater 与 process restart plugins
//! [OUTPUT]: 向 crate 提供 run、macOS/Linux 原生应用菜单与其中文“关于落笔”元数据、打字机菜单状态同步 command、项目分组文件夹改名/迁移 command、AI 封面搜索词、百度翻译与 Unsplash Key/随机搜索/本地裁剪 command 注册、更新检查/安装/重启 plugin 边界，并将原生菜单动作转换为 renderer 事件；Windows 菜单由 renderer 标题栏承载
//! [POS]: Tauri composition root，注册窗口状态、平台菜单、commands 与 events，不承载持久业务实现
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::{
    agent::{self, assistant_attachments, conversation_store, quick_prompt_store, run_checkpoint},
    library::{self, library_preferences_store, watcher, writing_activity_store},
    publishing, resources, system_paths, translation, unsplash, window_lifecycle,
};
#[cfg(any(target_os = "macos", target_os = "linux"))]
use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu,
};
#[cfg(any(target_os = "macos", target_os = "linux"))]
use tauri::Runtime;
use tauri::{AppHandle, Emitter};

#[cfg(any(target_os = "macos", target_os = "linux"))]
const TYPEWRITER_MODE_MENU_ID: &str = "toggle-typewriter-mode";

#[tauri::command]
fn app_runtime() -> &'static str {
    "Loby Tauri runtime ready"
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn find_check_menu_item<R: Runtime>(menu: &Menu<R>, id: &str) -> Option<CheckMenuItem<R>> {
    for item in menu.items().ok()? {
        if let Some(check_item) = item.as_check_menuitem() {
            if check_item.id().as_ref() == id {
                return Some(check_item.clone());
            }
        }
        let Some(submenu) = item.as_submenu() else {
            continue;
        };
        let Some(nested_item) = submenu.get(id) else {
            continue;
        };
        if let Some(check_item) = nested_item.as_check_menuitem() {
            return Some(check_item.clone());
        }
    }
    None
}

#[tauri::command]
fn set_typewriter_mode_menu_checked(app: AppHandle, checked: bool) -> Result<(), String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let menu = app.menu().ok_or_else(|| "应用菜单尚未就绪。".to_string())?;
        let check_item = find_check_menu_item(&menu, TYPEWRITER_MODE_MENU_ID)
            .ok_or_else(|| "打字机模式菜单项类型无效。".to_string())?;
        check_item
            .set_checked(checked)
            .map_err(|error| error.to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = (app, checked);
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .with_filter(|label| label == window_lifecycle::MAIN_WINDOW_LABEL)
                .build(),
        )
        .manage(watcher::LibraryWatcherState::default())
        .manage(crate::search::SearchIndexState::default())
        .manage(agent::runtime::AgentApprovalState::default())
        .manage(agent::runtime::AgentRunState::default())
        .manage(agent::chatgpt_auth::ChatGptDeviceFlowState::default())
        .manage(assistant_attachments::AssistantAttachmentState::default())
        .manage(system_paths::ImagePreviewState::default())
        .manage(publishing::WechatThemeStudioState::default())
        .manage(publishing::GitHubDeviceFlowState::default())
        .manage(publishing::WechatDraftState::default());

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let builder = builder.menu(|handle| {
        let new_project = MenuItem::with_id(handle, "new-project", "新建项目", true, None::<&str>)?;
        let new_sheet =
            MenuItem::with_id(handle, "new-sheet", "新建文稿", true, Some("CmdOrCtrl+N"))?;
        let quick_capture = MenuItem::with_id(
            handle,
            "quick-capture",
            "快速记录",
            true,
            Some("CmdOrCtrl+D"),
        )?;
        let import_markdown =
            MenuItem::with_id(handle, "import-markdown", "导入…", true, None::<&str>)?;
        let open_settings =
            MenuItem::with_id(handle, "open-settings", "设置", true, Some("CmdOrCtrl+,"))?;
        let about_icon =
            tauri::image::Image::from_bytes(include_bytes!("../icons/128x128@2x.png"))?;
        let about_metadata = AboutMetadataBuilder::new()
            .name(Some("落笔"))
            .version(Some(handle.package_info().version.to_string()))
            .copyright(Some("版权所有 麦先生"))
            .icon(Some(about_icon))
            .build();
        let open_about = PredefinedMenuItem::about(handle, Some("关于落笔"), Some(about_metadata))?;
        let open_shortcuts =
            MenuItem::with_id(handle, "open-shortcuts", "键盘快捷键", true, None::<&str>)?;
        let open_welcome =
            MenuItem::with_id(handle, "open-welcome", "欢迎界面", true, None::<&str>)?;
        let rebuild_index =
            MenuItem::with_id(handle, "rebuild-index", "重建索引", true, None::<&str>)?;
        let clean_empty_sheets = MenuItem::with_id(
            handle,
            "clean-empty-sheets",
            "清理空白文稿",
            true,
            None::<&str>,
        )?;
        let clean_unused_images = MenuItem::with_id(
            handle,
            "clean-unused-images",
            "清理未使用的图片…",
            true,
            None::<&str>,
        )?;
        let typewriter_mode = CheckMenuItem::with_id(
            handle,
            TYPEWRITER_MODE_MENU_ID,
            "打字机模式",
            true,
            false,
            None::<&str>,
        )?;
        let view_separator = PredefinedMenuItem::separator(handle)?;
        let menu = Menu::default(handle)?;
        replace_default_about_menu_item(&menu, &open_about)?;
        let mut settings_inserted = false;
        let mut inserted = false;
        let mut view_inserted = false;
        let mut help_inserted = false;

        for item in menu.items()? {
            let Some(submenu) = item.as_submenu() else {
                continue;
            };
            submenu.insert_items(&[&open_settings, &open_shortcuts], 1)?;
            settings_inserted = true;
            break;
        }

        if !settings_inserted {
            menu.append(&Submenu::with_items(
                handle,
                "落笔",
                true,
                &[&open_settings, &open_shortcuts],
            )?)?;
        }

        for item in menu.items()? {
            let Some(submenu) = item.as_submenu() else {
                continue;
            };
            if submenu.text()? == "File" {
                let create_separator = PredefinedMenuItem::separator(handle)?;
                let rebuild_separator = PredefinedMenuItem::separator(handle)?;
                submenu.insert_items(
                    &[
                        &new_project,
                        &new_sheet,
                        &quick_capture,
                        &import_markdown,
                        &create_separator,
                        &clean_unused_images,
                        &clean_empty_sheets,
                        &rebuild_index,
                        &rebuild_separator,
                    ],
                    0,
                )?;
                inserted = true;
                break;
            }
        }

        if !inserted {
            menu.append(&Submenu::with_items(
                handle,
                "File",
                true,
                &[
                    &new_project,
                    &new_sheet,
                    &quick_capture,
                    &import_markdown,
                    &clean_unused_images,
                    &clean_empty_sheets,
                    &rebuild_index,
                ],
            )?)?;
        }

        for item in menu.items()? {
            let Some(submenu) = item.as_submenu() else {
                continue;
            };
            if matches!(submenu.text()?.as_str(), "View" | "视图") {
                submenu.insert_items(&[&typewriter_mode, &view_separator], 0)?;
                view_inserted = true;
                break;
            }
        }

        if !view_inserted {
            menu.append(&Submenu::with_items(
                handle,
                "View",
                true,
                &[&typewriter_mode],
            )?)?;
        }

        for item in menu.items()? {
            let Some(submenu) = item.as_submenu() else {
                continue;
            };
            if is_help_menu_title(&submenu.text()?) {
                submenu.insert(&open_welcome, 0)?;
                help_inserted = true;
                break;
            }
        }

        if !help_inserted {
            menu.append(&Submenu::with_items(
                handle,
                "Help",
                true,
                &[&open_welcome],
            )?)?;
        }

        for item in menu.items()? {
            let Some(submenu) = item.as_submenu() else {
                continue;
            };
            if let Some(localized_title) = localized_menu_title(&submenu.text()?) {
                submenu.set_text(localized_title)?;
            }
        }

        Ok(menu)
    });

    let app = builder
        .setup(|app| {
            window_lifecycle::install_platform_window_observers(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "new-project" => {
                let _ = app.emit("loby://new-project", ());
            }
            "new-sheet" => {
                let _ = app.emit("loby://new-sheet", ());
            }
            "quick-capture" => {
                let _ = app.emit("loby://quick-capture", ());
            }
            "import-markdown" => {
                let _ = app.emit("loby://import-markdown", ());
            }
            "open-settings" => {
                let _ = app.emit("loby://open-settings", ());
            }
            "open-shortcuts" => {
                let _ = app.emit("loby://open-shortcuts", ());
            }
            "open-welcome" => {
                let _ = app.emit("loby://open-welcome", ());
            }
            "rebuild-index" => {
                let _ = app.emit("loby://rebuild-index", ());
            }
            "clean-empty-sheets" => {
                let _ = app.emit("loby://clean-empty-sheets", ());
            }
            "clean-unused-images" => {
                let _ = app.emit("loby://clean-unused-images", ());
            }
            "toggle-typewriter-mode" => {
                let _ = app.emit("loby://toggle-typewriter-mode", ());
            }
            _ => {}
        })
        .on_window_event(window_lifecycle::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            set_typewriter_mode_menu_checked,
            window_lifecycle::mark_main_window_ready,
            window_lifecycle::dismiss_main_window,
            library::default_library_path,
            library::default_libraries_path,
            library::create_library_directory,
            library::move_library_directory,
            library::load_library,
            library::load_library_at,
            library::resolve_sheet_path,
            library::rename_project_group_folder,
            library::move_project_group_files_to_default,
            library::prepare_library_directory,
            library::validate_existing_library_directory,
            library::rebuild_library_index,
            crate::search::ensure_search_index,
            crate::search::update_search_index_paths,
            crate::search::search_library,
            watcher::watch_library,
            library::trash::move_project_to_trash,
            library::trash::move_sheet_to_trash,
            library::trash::move_sheets_to_trash,
            library::trash::clean_empty_sheets,
            library::trash::list_library_trash,
            library::trash::restore_trash_entry,
            library::trash::delete_trash_entry,
            library::trash::clear_library_trash,
            library::save_library,
            library::save_library_at,
            library::save_document_at,
            library::save_library_metadata_at,
            conversation_store::load_conversations,
            conversation_store::save_conversations,
            run_checkpoint::list_agent_run_checkpoints,
            run_checkpoint::dismiss_agent_run_checkpoint,
            quick_prompt_store::load_quick_prompts,
            quick_prompt_store::save_quick_prompts,
            library_preferences_store::load_library_preferences,
            library_preferences_store::save_library_preferences,
            writing_activity_store::load_writing_activity,
            writing_activity_store::save_writing_activity,
            assistant_attachments::save_ai_attachment,
            assistant_attachments::persist_ai_attachments,
            assistant_attachments::remove_ai_attachment,
            resources::list_project_resources,
            resources::exports::save_project_export,
            resources::exports::save_project_export_bundle,
            resources::images::save_project_image,
            resources::images::import_project_images,
            resources::images::centralize_library_images,
            resources::images::remove_centralized_image_sources,
            resources::images::scan_unused_library_images,
            resources::images::trash_unused_library_images,
            unsplash::get_unsplash_settings,
            unsplash::save_unsplash_api_key,
            unsplash::delete_unsplash_api_key,
            unsplash::validate_unsplash_api_key,
            unsplash::search_unsplash_photos,
            unsplash::get_random_unsplash_photos,
            unsplash::save_unsplash_image,
            translation::get_baidu_translation_settings,
            translation::save_baidu_translation_credentials,
            translation::delete_baidu_translation_credentials,
            translation::validate_baidu_translation_credentials,
            translation::translate_baidu_search_query,
            resources::import_project_resources,
            resources::markdown_import::scan_markdown_import,
            resources::markdown_import::import_markdown_images,
            system_paths::open_local_path,
            system_paths::preview_local_image,
            system_paths::prepare_image_preview,
            system_paths::copy_local_file,
            system_paths::reveal_local_path,
            resources::read_project_resource_text,
            publishing::save_publishing_secret,
            publishing::has_publishing_secret,
            publishing::delete_publishing_secret,
            publishing::load_publishing_targets,
            publishing::save_publishing_targets,
            publishing::publish_wordpress_post,
            publishing::publish_mowen_note,
            publishing::validate_mowen_api_key,
            publishing::validate_saved_mowen_api_key,
            publishing::start_github_device_flow,
            publishing::complete_github_device_flow,
            publishing::get_github_connection,
            publishing::refresh_github_connection,
            publishing::list_github_repositories,
            publishing::disconnect_github,
            publishing::publish_blog_post,
            publishing::publish_blog_posts,
            publishing::sync_help_center,
            publishing::load_wechat_image_host_settings,
            publishing::save_wechat_image_host_settings,
            publishing::upload_wechat_images,
            publishing::load_wechat_draft_settings,
            publishing::save_wechat_draft_settings,
            publishing::delete_wechat_draft_settings,
            publishing::validate_wechat_draft_connection,
            publishing::publish_wechat_draft,
            publishing::clipboard::write_wechat_clipboard_prelude,
            publishing::wechat_theme_store::load_wechat_theme_store,
            publishing::wechat_theme_store::save_wechat_theme,
            publishing::wechat_theme_store::save_wechat_theme_preferences,
            publishing::wechat_theme_store::undo_wechat_theme,
            publishing::wechat_theme_store::redo_wechat_theme,
            publishing::wechat_theme_store::save_wechat_theme_conversations,
            publishing::wechat_theme_store::delete_wechat_theme,
            publishing::wechat_theme_store::read_wechat_theme_file,
            publishing::wechat_theme_store::write_wechat_theme_file,
            publishing::wechat_theme_studio::open_wechat_theme_studio,
            publishing::wechat_theme_studio::get_wechat_theme_studio_session,
            agent::skill_store::list_agent_skills,
            agent::skill_store::read_agent_skill_instructions,
            agent::skill_import::inspect_agent_skill_import,
            agent::skill_import::install_agent_skill,
            agent::skill_store::create_agent_skill,
            agent::skill_store::set_agent_skill_enabled,
            agent::skill_store::delete_agent_skill,
            agent::skill_store::ensure_agent_skill_directory,
            agent::discovery::list_agent_models,
            agent::conversation_title::generate_conversation_title,
            agent::document_summary::generate_document_summary,
            agent::image_search_query::generate_image_search_query,
            agent::image_search_query::translate_image_search_query,
            agent::credentials::save_agent_credential,
            agent::credentials::delete_agent_credential,
            agent::credentials::get_agent_credential_status,
            agent::connection_validation::validate_agent_connection,
            agent::chatgpt_auth::start_chatgpt_device_flow,
            agent::chatgpt_auth::complete_chatgpt_device_flow,
            agent::chatgpt_auth::cancel_chatgpt_device_flow,
            agent::chatgpt_auth::get_chatgpt_connection,
            agent::chatgpt_auth::disconnect_chatgpt,
            agent::mcp::list_mcp_servers,
            agent::mcp::save_mcp_server,
            agent::mcp::delete_mcp_server,
            agent::mcp::list_mcp_tools,
            agent::runtime::run_agent_chat,
            agent::runtime::prewarm_agent_runtime,
            agent::runtime::start_agent_chat_stream,
            agent::runtime::steer_agent_chat_stream,
            agent::runtime::cancel_agent_chat_stream,
            agent::runtime::respond_agent_approval,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Loby");

    app.run(window_lifecycle::handle_run_event);
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn localized_menu_title(title: &str) -> Option<&'static str> {
    match title {
        "File" => Some("文件"),
        "Edit" => Some("编辑"),
        "View" => Some("视图"),
        "Window" => Some("窗口"),
        "Help" => Some("帮助"),
        _ => None,
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn is_help_menu_title(title: &str) -> bool {
    matches!(title, "Help" | "帮助")
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn replace_default_about_menu_item<R: Runtime>(
    menu: &Menu<R>,
    replacement: &PredefinedMenuItem<R>,
) -> tauri::Result<()> {
    for item in menu.items()? {
        let Some(submenu) = item.as_submenu() else {
            continue;
        };
        for (index, child) in submenu.items()?.iter().enumerate() {
            let Some(predefined) = child.as_predefined_menuitem() else {
                continue;
            };
            if is_default_about_menu_title(&predefined.text()?) {
                submenu.remove_at(index)?;
                submenu.insert(replacement, index)?;
                return Ok(());
            }
        }
    }
    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn is_default_about_menu_title(title: &str) -> bool {
    title.to_ascii_lowercase().contains("about") || title.contains("关于")
}

#[cfg(all(test, any(target_os = "macos", target_os = "linux")))]
mod tests {
    use super::{is_default_about_menu_title, is_help_menu_title, localized_menu_title};

    #[test]
    fn localizes_default_desktop_menu_titles() {
        assert_eq!(localized_menu_title("File"), Some("文件"));
        assert_eq!(localized_menu_title("Edit"), Some("编辑"));
        assert_eq!(localized_menu_title("View"), Some("视图"));
        assert_eq!(localized_menu_title("Window"), Some("窗口"));
        assert_eq!(localized_menu_title("Help"), Some("帮助"));
        assert_eq!(localized_menu_title("落笔"), None);
    }

    #[test]
    fn recognizes_help_menu_before_and_after_localization() {
        assert!(is_help_menu_title("Help"));
        assert!(is_help_menu_title("帮助"));
        assert!(!is_help_menu_title("文件"));
    }

    #[test]
    fn recognizes_default_about_menu_before_and_after_localization() {
        assert!(is_default_about_menu_title("About 落笔"));
        assert!(is_default_about_menu_title("关于落笔"));
        assert!(!is_default_about_menu_title("设置"));
    }
}
