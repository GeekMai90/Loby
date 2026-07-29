//! [INPUT]: 依赖 notify 递归 watcher、LibraryFileChange 模型、Tauri Emitter 与受管写作库路径过滤
//! [OUTPUT]: 向 crate 提供过滤内部临时文件的 LibraryWatcherState、watch_library
//! [POS]: 本地写作库领域，封装可见内容监听并阻断原子写入临时文件形成的自触发刷新
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::LibraryFileChange;
use notify::{RecursiveMode, Watcher};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Emitter;

const INTERNAL_WRITE_TTL: Duration = Duration::from_secs(3);

fn internal_write_paths() -> &'static Mutex<HashMap<PathBuf, Instant>> {
    static PATHS: OnceLock<Mutex<HashMap<PathBuf, Instant>>> = OnceLock::new();
    PATHS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn record_internal_write(path: &Path) {
    if let Ok(mut paths) = internal_write_paths().lock() {
        paths.insert(path.to_path_buf(), Instant::now() + INTERNAL_WRITE_TTL);
    }
}

fn is_recent_internal_write(path: &Path) -> bool {
    let Ok(mut paths) = internal_write_paths().lock() else {
        return false;
    };
    let now = Instant::now();
    paths.retain(|_, expires_at| *expires_at > now);
    paths.contains_key(path)
}

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
            .filter(|path| !is_recent_internal_write(path))
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
    if relative.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|value| value.starts_with('.'))
    }) {
        return false;
    }
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
        assert!(!is_library_content_event_path(
            root,
            &root
                .join("projects")
                .join("article")
                .join(".draft.md.loby-tmp-1")
        ));
    }

    #[test]
    fn recent_internal_document_write_is_filtered_by_exact_path() {
        let target = Path::new("/tmp/LobyLibrary/projects/article/draft.md");
        let external = Path::new("/tmp/LobyLibrary/projects/article/external.md");

        record_internal_write(target);

        assert!(is_recent_internal_write(target));
        assert!(!is_recent_internal_write(external));
    }
}
