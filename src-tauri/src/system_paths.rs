use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "macos")]
use quicklook::{PreviewItem, QuickLookPanel};
#[cfg(target_os = "macos")]
use std::cell::RefCell;

#[cfg(target_os = "macos")]
thread_local! {
    static QUICK_LOOK_PANEL: RefCell<Option<QuickLookPanel>> = const { RefCell::new(None) };
}

#[tauri::command]
pub(crate) fn open_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&target).status()
    } else {
        Command::new("xdg-open").arg(&target).status()
    }
    .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Open command failed with status: {}", status))
    }
}

#[tauri::command]
pub(crate) fn preview_local_image(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.is_file() {
        return Err("Image file does not exist.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let preview_item = PreviewItem::from_file_url(&target, None)
            .ok_or_else(|| "Image path cannot be previewed.".to_string())?;
        QUICK_LOOK_PANEL
            .try_with(|panel_slot| {
                let mut panel_slot = panel_slot.borrow_mut();
                if panel_slot.is_none() {
                    *panel_slot = QuickLookPanel::shared();
                }
                let panel = panel_slot
                    .as_ref()
                    .ok_or_else(|| "Quick Look is unavailable.".to_string())?;
                panel.set_items(vec![preview_item]);
                panel.reload_if_dirty();
                panel.set_current_preview_item_index(0);
                panel.show();
                Ok(())
            })
            .map_err(|error| error.to_string())?
    }

    #[cfg(not(target_os = "macos"))]
    open_local_path(target.display().to_string())
}

#[tauri::command]
pub(crate) fn copy_local_file(source_path: String, destination_path: String) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let destination = PathBuf::from(destination_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn reveal_local_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(&target).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .status()
    } else {
        let folder = if target.is_dir() {
            target.as_path()
        } else {
            target.parent().unwrap_or_else(|| Path::new("."))
        };
        Command::new("xdg-open").arg(folder).status()
    }
    .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err("Failed to reveal local path.".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_local_file_creates_destination_directories() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("loby-copy-local-file-test-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;
        let source = root.join("source.txt");
        let destination = root.join("nested").join("destination.txt");
        fs::write(&source, "content").map_err(|error| error.to_string())?;

        copy_local_file(
            source.display().to_string(),
            destination.display().to_string(),
        )?;

        assert_eq!(
            fs::read_to_string(&destination).map_err(|error| error.to_string())?,
            "content"
        );
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
