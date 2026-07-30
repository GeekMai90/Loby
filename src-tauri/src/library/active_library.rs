//! [INPUT]: 依赖 dirs 配置目录、fs_paths 原子写入与已成功加载/移动的写作库真实路径
//! [OUTPUT]: 向 library facade 提供跨桌面应用与 CLI 共享的活动写作库定位文件维护能力
//! [POS]: 本地写作库领域的轻量进程间发现契约，只公开路径与协议版本，不承载 registry、正文或用户设置
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const ACTIVE_LIBRARY_FILENAME: &str = "active-library.json";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActiveLibraryState {
    version: u8,
    library_path: String,
}

pub(super) fn record_active_library(path: &Path) -> Result<(), String> {
    record_active_library_at(path, &active_library_state_path()?)
}

pub(super) fn relocate_active_library(source: &Path, destination: &Path) -> Result<(), String> {
    let state_path = active_library_state_path()?;
    relocate_active_library_at(source, destination, &state_path)
}

fn relocate_active_library_at(
    source: &Path,
    destination: &Path,
    state_path: &Path,
) -> Result<(), String> {
    let Ok(raw) = fs::read_to_string(state_path) else {
        return Ok(());
    };
    let Ok(state) = serde_json::from_str::<ActiveLibraryState>(&raw) else {
        return Ok(());
    };
    let comparable_source = fs::canonicalize(source).unwrap_or_else(|_| source.to_path_buf());
    if Path::new(&state.library_path) != comparable_source {
        return Ok(());
    }
    record_active_library_at(destination, state_path)
}

fn active_library_state_path() -> Result<PathBuf, String> {
    let config_root = dirs::config_dir().ok_or_else(|| "无法定位系统配置目录。".to_string())?;
    Ok(active_library_state_path_at(&config_root))
}

fn active_library_state_path_at(config_root: &Path) -> PathBuf {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let directory = config_root.join("Loby CLI");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let directory = config_root.join("loby");
    directory.join(ACTIVE_LIBRARY_FILENAME)
}

fn record_active_library_at(path: &Path, state_path: &Path) -> Result<(), String> {
    let root =
        fs::canonicalize(path).map_err(|error| format!("无法解析活动写作库路径：{error}"))?;
    if !root.is_dir() {
        return Err("活动写作库路径不是文件夹。".to_string());
    }
    let state = ActiveLibraryState {
        version: 1,
        library_path: root.display().to_string(),
    };
    let payload = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    write_if_changed(state_path, format!("{payload}\n"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_only_the_canonical_active_library_path() -> Result<(), String> {
        let temporary = tempfile::tempdir().map_err(|error| error.to_string())?;
        let library = temporary.path().join("写作库");
        fs::create_dir_all(&library).map_err(|error| error.to_string())?;
        let state_path = temporary
            .path()
            .join("config")
            .join(ACTIVE_LIBRARY_FILENAME);

        record_active_library_at(&library, &state_path)?;

        let state = serde_json::from_str::<ActiveLibraryState>(
            &fs::read_to_string(&state_path).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        assert_eq!(state.version, 1);
        assert_eq!(
            PathBuf::from(state.library_path),
            fs::canonicalize(library).unwrap()
        );
        Ok(())
    }

    #[test]
    fn relocates_only_the_library_owned_by_the_current_state() -> Result<(), String> {
        let temporary = tempfile::tempdir().map_err(|error| error.to_string())?;
        let source = temporary.path().join("原位置");
        let destination = temporary.path().join("新位置");
        let unrelated = temporary.path().join("其他位置");
        fs::create_dir_all(&source).map_err(|error| error.to_string())?;
        fs::create_dir_all(&destination).map_err(|error| error.to_string())?;
        fs::create_dir_all(&unrelated).map_err(|error| error.to_string())?;
        let state_path = temporary.path().join(ACTIVE_LIBRARY_FILENAME);
        record_active_library_at(&source, &state_path)?;

        let raw = fs::read_to_string(&state_path).map_err(|error| error.to_string())?;
        let state =
            serde_json::from_str::<ActiveLibraryState>(&raw).map_err(|error| error.to_string())?;
        assert_eq!(
            PathBuf::from(state.library_path),
            fs::canonicalize(&source).unwrap()
        );

        relocate_active_library_at(&unrelated, &destination, &state_path)?;
        let raw = fs::read_to_string(&state_path).map_err(|error| error.to_string())?;
        let state =
            serde_json::from_str::<ActiveLibraryState>(&raw).map_err(|error| error.to_string())?;
        assert_eq!(
            PathBuf::from(state.library_path),
            fs::canonicalize(&source).unwrap()
        );

        relocate_active_library_at(&source, &destination, &state_path)?;
        let raw = fs::read_to_string(&state_path).map_err(|error| error.to_string())?;
        let state =
            serde_json::from_str::<ActiveLibraryState>(&raw).map_err(|error| error.to_string())?;
        assert_eq!(
            PathBuf::from(state.library_path),
            fs::canonicalize(destination).unwrap()
        );
        Ok(())
    }
}
