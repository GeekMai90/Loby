//! [INPUT]: 依赖 UUID v4、Markdown 渲染、安全写入、写作库模型与按目标发布记录
//! [OUTPUT]: 向 library rebuild 提供统一文稿 ID 校验、生成、迁移记录与发布身份等已知元数据引用修复
//! [POS]: 本地写作库领域的文稿身份边界，不参与普通读取与编辑时序
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::fs_paths::write_if_changed;
use crate::markdown::render_sheet_markdown;
use crate::models::WritingSheet;
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const SHEET_ID_PREFIX: &str = "sheet-";
const BASE32_ALPHABET: &[u8; 32] = b"0123456789abcdefghjkmnpqrstvwxyz";
const BASE32_LENGTH: usize = 26;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SheetIdChange {
    pub(crate) project_id: String,
    pub(crate) old_id: String,
    pub(crate) new_id: String,
}

pub(super) struct SheetIdRepair {
    enabled: bool,
    used: HashSet<String>,
    changes: Vec<SheetIdChange>,
}

impl SheetIdRepair {
    pub(super) fn disabled() -> Self {
        Self {
            enabled: false,
            used: HashSet::new(),
            changes: Vec::new(),
        }
    }

    pub(super) fn enabled() -> Self {
        Self {
            enabled: true,
            used: HashSet::new(),
            changes: Vec::new(),
        }
    }

    pub(super) fn repair(
        &mut self,
        path: &Path,
        project_id: &str,
        sheet: &mut WritingSheet,
    ) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        if is_canonical_sheet_id(&sheet.id) && self.used.insert(sheet.id.clone()) {
            return Ok(());
        }

        let old_id = sheet.id.clone();
        let new_id = loop {
            let candidate = new_sheet_id();
            if self.used.insert(candidate.clone()) {
                break candidate;
            }
        };

        for publication in sheet.publications.values_mut() {
            if publication.source_id.trim().is_empty() {
                publication.source_id = old_id.clone();
            }
        }
        sheet.id = new_id.clone();
        write_if_changed(path, render_sheet_markdown(sheet))?;
        self.changes.push(SheetIdChange {
            project_id: project_id.to_string(),
            old_id,
            new_id,
        });
        Ok(())
    }

    pub(super) fn changes(&self) -> &[SheetIdChange] {
        &self.changes
    }
}

pub(crate) fn new_sheet_id() -> String {
    format!(
        "{SHEET_ID_PREFIX}{}",
        encode_base32(Uuid::new_v4().as_bytes())
    )
}

pub(crate) fn is_canonical_sheet_id(value: &str) -> bool {
    let Some(public_id) = value.strip_prefix(SHEET_ID_PREFIX) else {
        return false;
    };
    public_id.len() == BASE32_LENGTH
        && public_id
            .bytes()
            .all(|byte| BASE32_ALPHABET.contains(&byte))
}

pub(crate) fn sheet_public_id(value: &str) -> Option<&str> {
    is_canonical_sheet_id(value).then(|| value.trim_start_matches(SHEET_ID_PREFIX))
}

pub(super) fn migrate_known_sheet_references(
    root: &Path,
    changes: &[SheetIdChange],
) -> Result<(), String> {
    let mut counts = HashMap::<&str, usize>::new();
    for change in changes {
        *counts.entry(change.old_id.as_str()).or_default() += 1;
    }
    let replacements = changes
        .iter()
        .filter(|change| counts.get(change.old_id.as_str()) == Some(&1))
        .map(|change| (change.old_id.clone(), change.new_id.clone()))
        .collect::<HashMap<_, _>>();
    if replacements.is_empty() {
        return Ok(());
    }

    for path in known_metadata_paths(root) {
        if !path.is_file() {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let Ok(mut value) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        replace_json_ids(&mut value, &replacements);
        let payload = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
        write_if_changed(&path, payload)?;
    }
    Ok(())
}

fn known_metadata_paths(root: &Path) -> [PathBuf; 3] {
    [
        root.join(".loby").join("preferences.json"),
        root.join(".loby")
            .join("activity")
            .join("writing-activity.json"),
        root.join(".loby").join("ai").join("conversations.json"),
    ]
}

fn replace_json_ids(value: &mut Value, replacements: &HashMap<String, String>) {
    match value {
        Value::String(current) => {
            if let Some(replacement) = replacements.get(current) {
                *current = replacement.clone();
            }
        }
        Value::Array(items) => {
            for item in items {
                replace_json_ids(item, replacements);
            }
        }
        Value::Object(mapping) => {
            let keys = mapping.keys().cloned().collect::<Vec<_>>();
            for key in keys {
                let target_key = replacements
                    .get(&key)
                    .cloned()
                    .unwrap_or_else(|| key.clone());
                if let Some(mut item) = mapping.remove(&key) {
                    replace_json_ids(&mut item, replacements);
                    mapping.insert(target_key, item);
                }
            }
        }
        _ => {}
    }
}

fn encode_base32(bytes: &[u8; 16]) -> String {
    let mut output = String::with_capacity(BASE32_LENGTH);
    let mut buffer = 0_u16;
    let mut bits = 0_u8;
    for byte in bytes {
        buffer = (buffer << 8) | u16::from(*byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            output.push(BASE32_ALPHABET[((buffer >> bits) & 31) as usize] as char);
            buffer &= (1_u16 << bits) - 1;
        }
    }
    if bits > 0 {
        output.push(BASE32_ALPHABET[((buffer << (5 - bits)) & 31) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_canonical_unique_sheet_ids() {
        let ids = (0..100).map(|_| new_sheet_id()).collect::<HashSet<_>>();
        assert_eq!(ids.len(), 100);
        assert!(ids.iter().all(|id| is_canonical_sheet_id(id)));
    }

    #[test]
    fn rejects_legacy_and_ambiguous_base32_ids() {
        assert!(!is_canonical_sheet_id(
            "sheet-550e8400-e29b-41d4-a716-446655440000"
        ));
        assert!(!is_canonical_sheet_id("sheet-0000000000000000000000000i"));
    }
}
