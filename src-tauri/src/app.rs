use crate::{
    agent, assistant_attachments, conversation_store, library, library_preferences_store,
    publishing, quick_prompt_store, resources, system_paths, watcher, writing_activity_store,
    zen_mode,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::PageLoadEvent;
use tauri::Emitter;

#[tauri::command]
fn app_runtime() -> &'static str {
    "Loby Tauri runtime ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher::LibraryWatcherState::default())
        .manage(agent::runtime::AgentApprovalState::default())
        .manage(agent::runtime::AgentRunState::default())
        .manage(assistant_attachments::AssistantAttachmentState::default())
        .manage(publishing::WechatThemeStudioState::default())
        .menu(|handle| {
            let new_project = MenuItem::with_id(
                handle,
                "new-project",
                "新建项目",
                true,
                Some("CmdOrCtrl+Shift+N"),
            )?;
            let new_sheet =
                MenuItem::with_id(handle, "new-sheet", "新建文稿", true, Some("CmdOrCtrl+N"))?;
            let quick_capture = MenuItem::with_id(
                handle,
                "quick-capture",
                "快速记录",
                true,
                Some("CmdOrCtrl+D"),
            )?;
            let open_settings =
                MenuItem::with_id(handle, "open-settings", "设置", true, Some("CmdOrCtrl+,"))?;
            let open_shortcuts = MenuItem::with_id(
                handle,
                "open-shortcuts",
                "键盘快捷键",
                true,
                Some("CmdOrCtrl+/"),
            )?;
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
                if let Some(localized_title) = localized_menu_title(&submenu.text()?) {
                    submenu.set_text(localized_title)?;
                }
            }

            Ok(menu)
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
            "open-settings" => {
                let _ = app.emit("loby://open-settings", ());
            }
            "open-shortcuts" => {
                let _ = app.emit("loby://open-shortcuts", ());
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
        .on_page_load(|webview, payload| {
            let window = webview.window();
            let is_visible = window.is_visible().unwrap_or(false);
            if should_reveal_main_window(window.label(), payload.event(), is_visible) {
                if let Err(error) = window.show() {
                    eprintln!("failed to reveal the main window: {error}");
                    return;
                }
                if let Err(error) = window.set_focus() {
                    eprintln!("failed to focus the main window: {error}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            library::default_library_path,
            library::default_libraries_path,
            library::create_library_directory,
            library::move_library_directory,
            library::load_library,
            library::load_library_at,
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
            library::save_zen_sheet_at,
            zen_mode::enter_zen_mode,
            zen_mode::mark_zen_window_ready,
            zen_mode::exit_zen_mode,
            conversation_store::load_conversations,
            conversation_store::save_conversations,
            quick_prompt_store::load_quick_prompts,
            quick_prompt_store::save_quick_prompts,
            library_preferences_store::load_library_preferences,
            library_preferences_store::save_library_preferences,
            writing_activity_store::load_writing_activity,
            writing_activity_store::save_writing_activity,
            assistant_attachments::save_ai_image_attachment,
            assistant_attachments::remove_ai_image_attachment,
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
            resources::read_markdown_import_files,
            system_paths::open_local_path,
            system_paths::preview_local_image,
            system_paths::copy_local_file,
            system_paths::reveal_local_path,
            resources::read_project_resource_text,
            publishing::save_publishing_secret,
            publishing::has_publishing_secret,
            publishing::publish_wordpress_post,
            publishing::publish_mowen_note,
            publishing::validate_mowen_api_key,
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
            agent::discovery::list_codex_skills,
            agent::discovery::read_codex_skill_instructions,
            agent::discovery::list_codex_models,
            agent::runtime::run_agent_chat,
            agent::runtime::start_agent_chat_stream,
            agent::runtime::cancel_agent_chat_stream,
            agent::runtime::respond_agent_approval,
            agent::discovery::probe_agent_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Loby");
}

fn should_reveal_main_window(window_label: &str, event: PageLoadEvent, is_visible: bool) -> bool {
    window_label == "main" && event == PageLoadEvent::Finished && !is_visible
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

#[cfg(test)]
mod tests {
    use super::{localized_menu_title, should_reveal_main_window};
    use tauri::webview::PageLoadEvent;

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
    fn reveals_only_the_main_window_after_page_load_finishes() {
        assert!(!should_reveal_main_window(
            "main",
            PageLoadEvent::Started,
            false
        ));
        assert!(should_reveal_main_window(
            "main",
            PageLoadEvent::Finished,
            false
        ));
        assert!(!should_reveal_main_window(
            "main",
            PageLoadEvent::Finished,
            true
        ));
        assert!(!should_reveal_main_window(
            "wechat-theme-studio",
            PageLoadEvent::Finished,
            false
        ));
    }
}
