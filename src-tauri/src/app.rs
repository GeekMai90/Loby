use crate::{agent, conversation_store, library, resources, system_paths, watcher};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[tauri::command]
fn app_runtime() -> &'static str {
    "Nibva Tauri runtime ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher::LibraryWatcherState::default())
        .manage(agent::runtime::AgentApprovalState::default())
        .manage(agent::runtime::AgentRunState::default())
        .menu(|handle| {
            let open_settings =
                MenuItem::with_id(handle, "open-settings", "设置", true, Some("CmdOrCtrl+,"))?;
            let rebuild_index =
                MenuItem::with_id(handle, "rebuild-index", "重建索引", true, None::<&str>)?;
            let menu = Menu::default(handle)?;
            let mut settings_inserted = false;
            let mut inserted = false;

            for item in menu.items()? {
                let Some(submenu) = item.as_submenu() else {
                    continue;
                };
                submenu.insert_items(&[&open_settings], 1)?;
                settings_inserted = true;
                break;
            }

            if !settings_inserted {
                menu.append(&Submenu::with_items(
                    handle,
                    "Nibva",
                    true,
                    &[&open_settings],
                )?)?;
            }

            for item in menu.items()? {
                let Some(submenu) = item.as_submenu() else {
                    continue;
                };
                if submenu.text()? == "File" {
                    let separator = PredefinedMenuItem::separator(handle)?;
                    submenu.insert_items(&[&rebuild_index, &separator], 0)?;
                    inserted = true;
                    break;
                }
            }

            if !inserted {
                menu.append(&Submenu::with_items(
                    handle,
                    "File",
                    true,
                    &[&rebuild_index],
                )?)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open-settings" => {
                let _ = app.emit("nibva://open-settings", ());
            }
            "rebuild-index" => {
                let _ = app.emit("nibva://rebuild-index", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            app_runtime,
            library::default_library_path,
            library::load_library,
            library::load_library_at,
            library::rebuild_library_index,
            watcher::watch_library,
            library::trash::move_project_to_trash,
            library::trash::move_sheet_to_trash,
            library::trash::list_library_trash,
            library::trash::restore_trash_entry,
            library::trash::delete_trash_entry,
            library::trash::clear_library_trash,
            library::save_library,
            library::save_library_at,
            conversation_store::load_conversations,
            conversation_store::save_conversations,
            resources::list_project_resources,
            resources::save_project_export,
            resources::save_project_export_bundle,
            resources::save_project_image,
            resources::import_project_images,
            resources::import_project_resources,
            resources::read_markdown_import_files,
            system_paths::open_local_path,
            system_paths::copy_local_file,
            system_paths::reveal_local_path,
            resources::read_project_resource_text,
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
        .expect("error while running Nibva");
}
