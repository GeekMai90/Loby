//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 LibraryWatcherState、watch_library
//! [POS]: 本地写作库领域，封装扫描、保存、偏好、活动记录、监听与回收站
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 LibraryWatcherState、watch_library
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::LibraryFileChange;
use notify::{RecursiveMode, Watcher};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Emitter;

struct ActiveLibraryWatcher {
    root: PathBuf,
    _watcher: notify::RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct LibraryWatcherState {
    active: Mutex<Option<ActiveLibraryWatcher>>,
}

#[tauri::command]
pub(crate) fn watch_library(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, LibraryWatcherState>,
) -> Result<(), String> {
    let root = fs::canonicalize(PathBuf::from(path)).map_err(|error| error.to_string())?;
    if !root.is_dir() {
        return Err("Library path is not a directory.".to_string());
    }

    let mut active = state.active.lock().map_err(|error| error.to_string())?;
    if active.as_ref().map(|watcher| watcher.root.as_path()) == Some(root.as_path()) {
        return Ok(());
    }

    let event_root = root.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        let paths = event
            .paths
            .iter()
            .filter(|path| is_library_content_event_path(&event_root, path))
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();
        if paths.is_empty() {
            return;
        }
        let _ = app.emit(
            "loby://library-files-changed",
            LibraryFileChange {
                paths,
                kind: format!("{:?}", event.kind),
            },
        );
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    *active = Some(ActiveLibraryWatcher {
        root,
        _watcher: watcher,
    });
    Ok(())
}

fn is_library_content_event_path(root: &Path, path: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let mut components = relative.components();
    let Some(first) = components
        .next()
        .and_then(|component| component.as_os_str().to_str())
    else {
        return false;
    };
    if first.starts_with('.') {
        return false;
    }
    matches!(first, "assets" | "inbox" | "notes" | "projects")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_events_only_include_visible_library_areas() {
        let root = Path::new("/tmp/LobyLibrary");

        assert!(is_library_content_event_path(
            root,
            &root.join("inbox").join("draft.md")
        ));
        assert!(is_library_content_event_path(
            root,
            &root.join("notes").join("inbox.md")
        ));
        assert!(is_library_content_event_path(
            root,
            &root.join("projects").join("article").join("draft.md")
        ));
        assert!(is_library_content_event_path(
            root,
            &root.join("assets").join("images").join("cover.png")
        ));
        assert!(!is_library_content_event_path(
            root,
            &root.join(".loby").join("library.json")
        ));
        assert!(!is_library_content_event_path(
            root,
            &root.join("exports").join("article.md")
        ));
    }
}
