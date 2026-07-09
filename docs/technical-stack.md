# Technical Stack

## Current Decision

Nibva should start with:

- Tauri 2
- Rust
- TypeScript
- React
- CodeMirror 6
- unified / remark / rehype

This stack is selected to balance cross-platform desktop support, local system integration, app size, performance, and editor extensibility.

## Desktop Shell

### Preferred: Tauri 2

Tauri 2 is the preferred desktop shell because it gives Nibva:

- Smaller app bundles than Electron
- Strong local native capability through Rust
- Cross-platform desktop support for macOS and Windows
- A possible future path to mobile
- Clear separation between frontend UI and native capabilities

Known risk: Tauri uses system WebViews. macOS uses WebKit, while Windows uses WebView2. This means long-form editing, Chinese IME behavior, selection, scrolling, and Markdown decorations must be tested carefully on both platforms.

### Fallback: Electron

Electron should remain a fallback if the editor prototype shows unacceptable WebView differences or input behavior.

Electron gives more consistent Chromium behavior across platforms, but the cost is larger app bundles, heavier memory usage, and a product feel closer to web-app packaging.

## Native Layer

Rust should own:

- Local file system access
- Project creation and metadata updates
- Search indexing
- Export pipeline orchestration
- Local process calls
- Codex skill invocation
- Security-sensitive boundaries

Current structure:

- `src-tauri/src/lib.rs` still owns Tauri command wiring and most native behavior.
- `src-tauri/src/models.rs` owns serializable app, resource, agent, and stream event models.
- `src-tauri/src/fs_paths.rs` owns filesystem path, filename, extension, and path-safety helpers.
- `src-tauri/src/markdown.rs` owns Markdown/frontmatter rendering, parsing, and readable metadata serialization helpers.

Continue moving stable native domains out of `lib.rs` as focused modules. Good next candidates are library persistence, resource/export operations, agent process streaming, and watcher state.

## Frontend

React is the preferred frontend layer because the product will need:

- Complex editor-adjacent panels
- Command palette
- Inspector panels
- Diff review UI
- Drag-and-drop sheet ordering
- Virtualized lists
- Mature ecosystem support

Frontend quality gates:

- TypeScript strict mode
- ESLint with React Hooks rules
- Prettier formatting
- Vitest for pure TypeScript logic
- Vite production build
- Rust unit tests for native helper behavior

The primary local command is `npm run check`.

## Editor

CodeMirror 6 is the preferred editor foundation.

Reasons:

- Strong source-text editing model
- Good extensibility
- Suitable for Markdown-as-source workflows
- Better fit than heavy WYSIWYG for preserving open Markdown
- Allows iA Writer / Bear-like hybrid Markdown display

Avoid building a text editor from scratch. Input methods, undo history, selection, scrolling, accessibility, and long-document performance are too expensive to reimplement safely.

## Markdown Pipeline

Use the unified ecosystem:

- remark for Markdown parsing and transformation
- rehype for HTML processing
- frontmatter parsing for metadata

The editor source should remain Markdown. Export output may be transformed into HTML, publishing-specific HTML, PDF, or other formats later.

Current prototype note: clean HTML export now dynamically loads unified with `remark-parse`, `remark-gfm`, `remark-rehype`, and `rehype-stringify`. Keeping this pipeline out of the initial editor bundle protects the writing surface from export-only dependency weight. Platform-specific exports can still use custom renderers when they need strict inline styles.

## Storage Model

Nibva should use regular local folders.

Suggested project shape:

```text
NibvaLibrary/
  notes/
    收件箱/
      一个想法.md
  projects/
    知识管理/
      README.md
      project.toml
      正文/
        第一篇文章.md
      资料/
        参考资料.md
      assets/
      exports/
      references/
  .nibva/
    library.json
    ai/
      conversations.json
```

Project metadata should be lightweight and human-readable.

Current prototype note: `.nibva/library.json` remains a pragmatic app index, while project `README.md`, `project.toml`, and folder-visible sheet `.md` files carry readable Markdown/frontmatter for human and AI access outside Nibva. The folder tree and Markdown files are the durable writing surface; indexes should be rebuildable support state where practical.

The Tauri runtime creates `assets/`, `references/`, and `exports/` in each project folder. These directories are stable local targets for generated images, imported references, and publish-ready output.

## Prototype Validation

Before building the full product, create a focused Tauri + CodeMirror prototype to test:

- 1 MB, 5 MB, and 10 MB Markdown files
- Chinese input with macOS Pinyin, Microsoft Pinyin, and common third-party IMEs
- Selection across headings, lists, quotes, and code blocks
- Markdown decoration performance
- AI diff decoration overlays
- Scroll sync with outline
- File save and recovery behavior
