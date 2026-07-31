//! [INPUT]: 依赖 Tantivy、Jieba 中文分词、写作库 Markdown/frontmatter 解析与受管写作库路径
//! [OUTPUT]: 向 renderer 提供本地全文搜索、全量建立索引与文件变化路径级增量同步 command；查询仅在索引尚未可靠同步时触发全量校验，索引只保存于当前写作库 `.loby/search/v1`
//! [POS]: native 搜索领域，持有倒排索引与文件指纹，不改变 Markdown 事实来源，也不把全文搜索工作放回 renderer
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use crate::fs_paths::is_hidden_path;
use crate::markdown::{markdown_h1_title, sheet_frontmatter_value, strip_loby_frontmatter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Field, IndexRecordOption, Schema, TextFieldIndexing, TextOptions, Value};
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy, Term};
use tantivy_jieba::JiebaTokenizer;
use tauri::State;

const SEARCH_INDEX_VERSION: u32 = 1;
const SEARCH_INDEX_MEMORY_BYTES: usize = 32 * 1024 * 1024;
const DEFAULT_SEARCH_LIMIT: usize = 50;

#[derive(Default)]
pub(crate) struct SearchIndexState {
    indexes: Mutex<HashMap<PathBuf, Arc<Mutex<SearchIndex>>>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchHit {
    pub(crate) sheet_id: String,
    pub(crate) title: String,
    pub(crate) score: f32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct SearchManifest {
    version: u32,
    files: HashMap<String, IndexedFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IndexedFile {
    sheet_id: String,
    size: u64,
    modified_at_nanos: u128,
}

struct SearchIndex {
    root: PathBuf,
    manifest_path: PathBuf,
    index: Index,
    reader: IndexReader,
    writer: IndexWriter,
    sheet_id_field: Field,
    title_field: Field,
    body_field: Field,
    manifest: SearchManifest,
    needs_full_scan: bool,
}

impl SearchIndexState {
    fn index_for(&self, root: PathBuf) -> Result<Arc<Mutex<SearchIndex>>, String> {
        let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
        let mut indexes = self.indexes.lock().map_err(|error| error.to_string())?;
        if let Some(index) = indexes.get(&root) {
            return Ok(index.clone());
        }
        let index = Arc::new(Mutex::new(SearchIndex::open(root.clone())?));
        indexes.insert(root, index.clone());
        Ok(index)
    }
}

impl SearchIndex {
    fn open(root: PathBuf) -> Result<Self, String> {
        let index_dir = root.join(".loby").join("search").join("v1");
        fs::create_dir_all(&index_dir).map_err(|error| error.to_string())?;
        let manifest_path = index_dir.join("manifest.json");
        let schema = search_schema();
        let index = if index_dir.join("meta.json").exists() {
            Index::open_in_dir(&index_dir).map_err(|error| error.to_string())?
        } else {
            Index::create_in_dir(&index_dir, schema).map_err(|error| error.to_string())?
        };

        let sheet_id_field = index
            .schema()
            .get_field("sheet_id")
            .map_err(|error| error.to_string())?;
        let title_field = index
            .schema()
            .get_field("title")
            .map_err(|error| error.to_string())?;
        let body_field = index
            .schema()
            .get_field("body")
            .map_err(|error| error.to_string())?;

        index
            .tokenizers()
            .register("jieba", JiebaTokenizer::with_search_mode(true));
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .map_err(|error: tantivy::TantivyError| error.to_string())?;
        let writer = index
            .writer(SEARCH_INDEX_MEMORY_BYTES)
            .map_err(|error| error.to_string())?;
        let manifest = load_manifest(&manifest_path)?;

        Ok(Self {
            root,
            manifest_path,
            index,
            reader,
            writer,
            sheet_id_field,
            title_field,
            body_field,
            manifest,
            needs_full_scan: true,
        })
    }

    fn ensure_current(&mut self) -> Result<(), String> {
        let mut current_files = HashMap::new();
        for path in collect_markdown_files(&self.root)? {
            let Ok(metadata) = fs::metadata(&path) else {
                continue;
            };
            let key = path.display().to_string();
            let size = metadata.len();
            let modified_at_nanos = modified_at_nanos(&metadata);
            if let Some(previous) = self.manifest.files.get(&key) {
                if previous.size == size && previous.modified_at_nanos == modified_at_nanos {
                    current_files.insert(key, (path, previous.clone(), None));
                    continue;
                }
            }

            let Ok(raw) = fs::read_to_string(&path) else {
                continue;
            };
            let Some(document) = IndexedDocument::from_markdown(&path, &raw) else {
                continue;
            };
            let fingerprint = IndexedFile {
                sheet_id: document.sheet_id.clone(),
                size,
                modified_at_nanos,
            };
            current_files.insert(key, (path, fingerprint, Some(document)));
        }

        let mut changed = false;
        for (path, indexed) in &self.manifest.files {
            if !current_files.contains_key(path) {
                self.writer.delete_term(Term::from_field_text(
                    self.sheet_id_field,
                    &indexed.sheet_id,
                ));
                changed = true;
            }
        }

        for (path, (_, _fingerprint, document)) in &current_files {
            if let Some(document) = document {
                let previous_sheet_id = self
                    .manifest
                    .files
                    .get(path)
                    .map(|file| file.sheet_id.clone());
                self.upsert(document, previous_sheet_id.as_deref())?;
                changed = true;
            }
        }

        if changed {
            self.writer.commit().map_err(|error| error.to_string())?;
            self.reader.reload().map_err(|error| error.to_string())?;
            self.manifest.files = current_files
                .into_iter()
                .map(|(path, (_, fingerprint, _))| (path, fingerprint))
                .collect();
            self.manifest.version = SEARCH_INDEX_VERSION;
            save_manifest(&self.manifest_path, &self.manifest)?;
        }

        self.needs_full_scan = false;
        Ok(())
    }

    fn update_paths(&mut self, paths: &[String]) -> Result<(), String> {
        let mut changed = false;
        let mut requires_full_scan = false;
        for raw_path in paths {
            let path = PathBuf::from(raw_path);
            let key = path.display().to_string();
            if !path.exists() {
                if let Some(previous) = self.manifest.files.remove(&key) {
                    self.writer.delete_term(Term::from_field_text(
                        self.sheet_id_field,
                        &previous.sheet_id,
                    ));
                    changed = true;
                }
                continue;
            }
            let Ok(metadata) = fs::metadata(&path) else {
                requires_full_scan = true;
                continue;
            };
            let Ok(raw) = fs::read_to_string(&path) else {
                requires_full_scan = true;
                continue;
            };
            let Some(document) = IndexedDocument::from_markdown(&path, &raw) else {
                requires_full_scan = true;
                continue;
            };
            let fingerprint = IndexedFile {
                sheet_id: document.sheet_id.clone(),
                size: metadata.len(),
                modified_at_nanos: modified_at_nanos(&metadata),
            };
            let unchanged = self.manifest.files.get(&key).is_some_and(|previous| {
                previous.sheet_id == fingerprint.sheet_id
                    && previous.size == fingerprint.size
                    && previous.modified_at_nanos == fingerprint.modified_at_nanos
            });
            if unchanged {
                continue;
            }
            let previous_sheet_id = self
                .manifest
                .files
                .get(&key)
                .map(|file| file.sheet_id.clone());
            self.upsert(&document, previous_sheet_id.as_deref())?;
            self.manifest.files.insert(key, fingerprint);
            changed = true;
        }

        if changed {
            self.writer.commit().map_err(|error| error.to_string())?;
            self.reader.reload().map_err(|error| error.to_string())?;
            self.manifest.version = SEARCH_INDEX_VERSION;
            save_manifest(&self.manifest_path, &self.manifest)?;
        }
        if requires_full_scan {
            self.needs_full_scan = true;
        }
        Ok(())
    }

    fn ensure_ready(&mut self) -> Result<(), String> {
        if self.needs_full_scan {
            self.ensure_current()?;
        }
        Ok(())
    }

    fn upsert(
        &mut self,
        document: &IndexedDocument,
        previous_sheet_id: Option<&str>,
    ) -> Result<(), String> {
        if let Some(previous_sheet_id) =
            previous_sheet_id.filter(|value| *value != document.sheet_id)
        {
            self.writer.delete_term(Term::from_field_text(
                self.sheet_id_field,
                previous_sheet_id,
            ));
        }
        self.writer.delete_term(Term::from_field_text(
            self.sheet_id_field,
            &document.sheet_id,
        ));
        self.writer
            .add_document(doc!(
                self.sheet_id_field => document.sheet_id.clone(),
                self.title_field => document.title.clone(),
                self.body_field => document.body.clone(),
            ))
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn search(&self, query_text: &str, limit: usize) -> Result<Vec<SearchHit>, String> {
        let query_text = query_text.trim();
        if query_text.is_empty() {
            return Ok(Vec::new());
        }
        let searcher = self.reader.searcher();
        let mut parser =
            QueryParser::for_index(&self.index, vec![self.title_field, self.body_field]);
        parser.set_field_boost(self.title_field, 4.0);
        let (query, _parse_errors) = parser.parse_query_lenient(query_text);
        let documents = searcher
            .search(
                &query,
                &TopDocs::with_limit(limit.clamp(1, 100)).order_by_score(),
            )
            .map_err(|error| error.to_string())?;
        documents
            .into_iter()
            .map(|(score, address)| {
                let document = searcher
                    .doc::<tantivy::TantivyDocument>(address)
                    .map_err(|error| error.to_string())?;
                let sheet_id = document
                    .get_first(self.sheet_id_field)
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| "搜索索引文稿 ID 无效。".to_string())?;
                let title = document
                    .get_first(self.title_field)
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                Ok(SearchHit {
                    sheet_id: sheet_id.to_string(),
                    title: title.to_string(),
                    score,
                })
            })
            .collect()
    }
}

#[derive(Debug)]
struct IndexedDocument {
    sheet_id: String,
    title: String,
    body: String,
}

impl IndexedDocument {
    fn from_markdown(path: &Path, raw: &str) -> Option<Self> {
        let body = strip_loby_frontmatter(raw).to_string();
        let title = sheet_frontmatter_value(raw, "title")
            .or_else(|| markdown_h1_title(&body))
            .unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("未命名文稿")
                    .to_string()
            });
        let sheet_id = sheet_frontmatter_value(raw, "id")?;
        Some(Self {
            sheet_id,
            title,
            body,
        })
    }
}

fn search_schema() -> Schema {
    let mut builder = Schema::builder();
    let text_indexing = TextFieldIndexing::default()
        .set_tokenizer("jieba")
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let title_options = TextOptions::default()
        .set_indexing_options(text_indexing)
        .set_stored();
    let body_options = TextOptions::default().set_indexing_options(
        TextFieldIndexing::default()
            .set_tokenizer("jieba")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions),
    );
    builder.add_text_field(
        "sheet_id",
        TextOptions::default().set_stored().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("raw")
                .set_index_option(IndexRecordOption::Basic),
        ),
    );
    builder.add_text_field("title", title_options);
    builder.add_text_field("body", body_options);
    builder.build()
}

fn collect_markdown_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for area in ["inbox", "notes", "projects"] {
        let path = root.join(area);
        if path.exists() {
            collect_markdown_files_from(&path, &mut files)?;
        }
    }
    Ok(files)
}

fn collect_markdown_files_from(directory: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if is_hidden_path(&path) {
            continue;
        }
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            if matches!(name, "assets" | "references" | "exports") {
                continue;
            }
            collect_markdown_files_from(&path, files)?;
        } else if path.extension().and_then(|value| value.to_str()) == Some("md") {
            files.push(path);
        }
    }
    Ok(())
}

fn modified_at_nanos(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}

fn load_manifest(path: &Path) -> Result<SearchManifest, String> {
    if !path.exists() {
        return Ok(SearchManifest {
            version: SEARCH_INDEX_VERSION,
            files: HashMap::new(),
        });
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let manifest =
        serde_json::from_str::<SearchManifest>(&raw).map_err(|error| error.to_string())?;
    if manifest.version != SEARCH_INDEX_VERSION {
        return Ok(SearchManifest {
            version: SEARCH_INDEX_VERSION,
            files: HashMap::new(),
        });
    }
    Ok(manifest)
}

fn save_manifest(path: &Path, manifest: &SearchManifest) -> Result<(), String> {
    let temporary = path.with_extension("json.tmp");
    let raw = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(&temporary, raw).map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn ensure_search_index(
    path: String,
    state: State<'_, SearchIndexState>,
) -> Result<(), String> {
    let index = state.index_for(PathBuf::from(path))?;
    tokio::task::spawn_blocking(move || {
        index
            .lock()
            .map_err(|error| error.to_string())?
            .ensure_current()
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn update_search_index_paths(
    path: String,
    paths: Vec<String>,
    state: State<'_, SearchIndexState>,
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let index = state.index_for(PathBuf::from(path))?;
    tokio::task::spawn_blocking(move || {
        index
            .lock()
            .map_err(|error| error.to_string())?
            .update_paths(&paths)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn search_library(
    path: String,
    query: String,
    limit: Option<usize>,
    state: State<'_, SearchIndexState>,
) -> Result<Vec<SearchHit>, String> {
    let index = state.index_for(PathBuf::from(path))?;
    tokio::task::spawn_blocking(move || {
        let mut index = index.lock().map_err(|error| error.to_string())?;
        index.ensure_ready()?;
        index.search(&query, limit.unwrap_or(DEFAULT_SEARCH_LIMIT))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn indexes_markdown_body_and_returns_title_weighted_hits() {
        let root = tempdir().expect("temp directory");
        let inbox = root.path().join("inbox");
        fs::create_dir_all(&inbox).expect("inbox");
        fs::write(
            inbox.join("first.md"),
            "---\ntitle: 第一篇\nloby:\n  id: sheet-first\n---\n\n这是搜索目标。",
        )
        .expect("first document");
        fs::write(
            inbox.join("second.md"),
            "---\ntitle: 第二篇\nloby:\n  id: sheet-second\n---\n\n这是另一篇。",
        )
        .expect("second document");

        let mut index = SearchIndex::open(root.path().to_path_buf()).expect("open search index");
        index.ensure_current().expect("build search index");
        let hits = index.search("搜索目标", 10).expect("search");

        assert_eq!(
            hits.first().map(|hit| hit.sheet_id.as_str()),
            Some("sheet-first")
        );
        assert_eq!(hits.first().map(|hit| hit.title.as_str()), Some("第一篇"));
    }

    #[test]
    fn path_updates_before_initial_scan_keep_full_reconciliation_required() {
        let root = tempdir().expect("temp directory");
        let inbox = root.path().join("inbox");
        fs::create_dir_all(&inbox).expect("inbox");
        let first_path = inbox.join("first.md");
        fs::write(
            &first_path,
            "---\ntitle: 第一篇\nloby:\n  id: sheet-first\n---\n\n第一篇正文",
        )
        .expect("first document");
        fs::write(
            inbox.join("second.md"),
            "---\ntitle: 第二篇\nloby:\n  id: sheet-second\n---\n\n第二篇正文",
        )
        .expect("second document");

        let mut index = SearchIndex::open(root.path().to_path_buf()).expect("open search index");
        index
            .update_paths(&[first_path.display().to_string()])
            .expect("update first path");
        assert!(index.needs_full_scan);
        index.ensure_ready().expect("reconcile full search index");

        assert_eq!(index.search("第二篇正文", 10).expect("search").len(), 1);
    }

    #[test]
    fn updates_and_removes_changed_documents_incrementally() {
        let root = tempdir().expect("temp directory");
        let inbox = root.path().join("inbox");
        fs::create_dir_all(&inbox).expect("inbox");
        let path = inbox.join("note.md");
        fs::write(
            &path,
            "---\ntitle: 笔记\nloby:\n  id: sheet-note\n---\n\n旧词",
        )
        .expect("document");

        let mut index = SearchIndex::open(root.path().to_path_buf()).expect("open search index");
        index.ensure_current().expect("build search index");
        assert_eq!(index.search("旧词", 10).expect("old search").len(), 1);

        fs::write(
            &path,
            "---\ntitle: 笔记\nloby:\n  id: sheet-note\n---\n\n新词",
        )
        .expect("updated document");
        index
            .update_paths(&[path.display().to_string()])
            .expect("update search index");
        assert!(index.search("旧词", 10).expect("old search").is_empty());
        assert_eq!(index.search("新词", 10).expect("new search").len(), 1);

        fs::remove_file(&path).expect("remove document");
        index
            .update_paths(&[path.display().to_string()])
            .expect("remove from search index");
        assert!(index.search("新词", 10).expect("removed search").is_empty());
    }
}
