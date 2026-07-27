//! [INPUT]: 依赖 agent/library/publishing/resources 等领域 commands、window_lifecycle 主窗口生命周期、Loby Agent Runtime managed state、Tauri menu/window/event 与平台 plugins
//! [OUTPUT]: 向 crate 提供 run，并将原生菜单动作转换为 renderer 事件；易与编辑器冲突的动作不重复注册 native accelerator
//! [POS]: Tauri composition root，注册窗口状态、菜单、commands 与 events，不承载持久业务实现
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::{
    agent::{self, assistant_attachments, conversation_store, quick_prompt_store},
    library::{self, library_preferences_store, watcher, writing_activity_store},
    publishing, resources, system_paths, window_lifecycle,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[tauri::command]
fn app_runtime() -> &'static str {
    "Loby Tauri runtime ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher::LibraryWatcherState::default())
        .manage(agent::runtime::AgentApprovalState::default())
        .manage(agent::runtime::AgentRunState::default())
        .manage(agent::chatgpt_auth::ChatGptDeviceFlowState::default())
        .manage(assistant_attachments::AssistantAttachmentState::default())
        .manage(system_paths::ImagePreviewState::default())
        .manage(publishing::WechatThemeStudioState::default())
        .manage(publishing::GitHubDeviceFlowState::default())
        .menu(|handle| {
            let new_project =
                MenuItem::with_id(handle, "new-project", "新建项目", true, None::<&str>)?;
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
            let menu = Menu::default(handle)?;
            let mut settings_inserted = false;
            let mut inserted = false;
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
        })
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
            _ => {}
        })
        .on_window_event(window_lifecycle::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            window_lifecycle::mark_main_window_ready,
            window_lifecycle::dismiss_main_window,
            library::default_library_path,
            library::default_libraries_path,
            library::create_library_directory,
            library::move_library_directory,
            library::load_library,
            library::load_library_at,
            library::validate_existing_library_directory,
            library::rebuild_library_index,
            watcher::watch_library,
            library::trash::move_project_to_trash,
            library::trash::move_sheet_to_trash,
            library::trash::clean_empty_sheets,
            library::trash::list_library_trash,
            library::trash::restore_trash_entry,
            library::trash::delete_trash_entry,
            library::trash::clear_library_trash,
            library::save_library,
            library::save_library_at,
            conversation_store::load_conversations,
            conversation_store::save_conversations,
            quick_prompt_store::load_quick_prompts,
            quick_prompt_store::save_quick_prompts,
            library_preferences_store::load_library_preferences,
            library_preferences_store::save_library_preferences,
            writing_activity_store::load_writing_activity,
            writing_activity_store::save_writing_activity,
            assistant_attachments::save_ai_attachment,
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
            publishing::load_publishing_targets,
            publishing::save_publishing_targets,
            publishing::publish_wordpress_post,
            publishing::publish_mowen_note,
            publishing::validate_mowen_api_key,
            publishing::validate_saved_mowen_api_key,
            publishing::start_github_device_flow,
            publishing::complete_github_device_flow,
            publishing::get_github_connection,
            publishing::list_github_repositories,
            publishing::disconnect_github,
            publishing::publish_blog_post,
            publishing::load_wechat_image_host_settings,
            publishing::save_wechat_image_host_settings,
            publishing::upload_wechat_images,
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
            agent::discovery::list_agent_skills,
            agent::discovery::read_agent_skill_instructions,
            agent::discovery::list_agent_models,
            agent::credentials::save_agent_credential,
            agent::credentials::delete_agent_credential,
            agent::credentials::get_agent_credential_status,
            agent::chatgpt_auth::start_chatgpt_device_flow,
            agent::chatgpt_auth::complete_chatgpt_device_flow,
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

fn localized_menu_title(title: &str) -> Option<&'static str> {
    match title {
        "File" => Some("文件"),
        "Edit" => Some("编辑"),
        "View" => Some("显示"),
        "Window" => Some("窗口"),
        "Help" => Some("帮助"),
        _ => None,
    }
}

fn is_help_menu_title(title: &str) -> bool {
    matches!(title, "Help" | "帮助")
}

#[cfg(test)]
mod tests {
    use super::{is_help_menu_title, localized_menu_title};

    #[test]
    fn localizes_default_desktop_menu_titles() {
        assert_eq!(localized_menu_title("File"), Some("文件"));
        assert_eq!(localized_menu_title("Edit"), Some("编辑"));
        assert_eq!(localized_menu_title("View"), Some("显示"));
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
}
