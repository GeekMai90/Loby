# Nibva

Nibva is a local-first, Markdown-based professional writing app designed for AI-friendly human writing workflows.

It is not an AI article generator. The core product is a focused writing environment for planning, drafting, revising, illustrating, formatting, publishing, and archiving written work. AI should act as an assistant inside specific writing actions, not as the main authoring model.

## Product Direction

Nibva is built around writing projects rather than loose notes.

- Local-first storage
- Open Markdown files
- Project-based writing organization
- Project groups for topics, columns, chapters, modules, and materials
- Sheet/card-based drafting
- Focused long-form editor
- Clean, fresh, white-first Apple-style interface
- Reviewable AI assistance
- Export and publishing workflows
- Local Codex skill integration

## Planned Desktop Stack

- Desktop shell: Tauri 2
- Native layer: Rust
- Frontend: TypeScript + React
- Editor: CodeMirror 6
- Markdown pipeline: unified / remark / rehype
- Metadata: YAML or TOML beside Markdown files
- Search/indexing: SQLite FTS or Tantivy
- AI/skills bridge: local Codex skill runner or sidecar process

## Current Status

Nibva now has an early Tauri 2 + React + CodeMirror desktop prototype.

Implemented in the prototype:

- Local writing projects and sheet/card data model
- Library sidebar can enter a project and switch to that project's group navigation
- Project groups sit between projects and sheets, so blog posts can live as sheets inside topic/column groups while long articles can be split into multiple sheets
- Tauri persistence writes readable project README files and sheet Markdown with Nibva frontmatter
- Project folders include assets, references, and exports directories for local AI artifacts
- Project templates for blank projects, long-form articles, series, tutorials, and visual articles
- Empty writing library state with first-project template actions
- Project list and sheet list
- Project duplication and safe removal from the active library list while preserving local folders
- Project metadata editing
- Project workflow actions for advancing, publishing, archiving, and restoring completed work
- Sheet workflow actions for advancing, marking pending publish, publishing, and restoring drafts
- Project search plus active/today/published/archived and tag filters
- Project sorting by recent update, title, word count, or progress
- Import existing Markdown/text files as a new project or as writing sheets in the current project
- Sheet search and type filters
- Sheet duplication and deletion
- Drag-and-drop sheet ordering
- List, status-grouped card, and outline sheet views
- Status-grouped cards can advance or restore sheet workflow state directly
- Toolbar action to open the current sheet's local Markdown file
- Markdown editor based on CodeMirror 6
- Current-sheet find/replace panel with CodeMirror search shortcuts
- Current-sheet Markdown preview mode
- Markdown source styling for headings, links, quotes, emphasis, and inline code
- Markdown quick formatting toolbar for headings, emphasis, links, inline code, lists, task lists, quotes, and dividers
- Project writing brief fields for audience, thesis, tone, and publishing notes
- Word count and target progress
- Character, paragraph, heading, and reading-time stats
- Project-level and sheet-level progress metrics
- Current writing session start, net word gain, and remaining target metrics
- Markdown heading outline navigation
- History inspector tab for sheet version snapshots, compare, restore, and export history
- Focus mode
- Remembered project rail, sheet rail, inspector, focus mode, and typewriter layout preferences
- Remembered last active project and writing sheet
- Typewriter mode
- Reviewable AI-assist interaction prototype
- Compile/export preview
- Markdown, clean HTML, plain text, WeChat HTML, and Xiaohongshu draft download
- Copy Markdown, HTML, WeChat HTML, and Xiaohongshu draft exports to the clipboard
- Open a printable compiled article preview for system PDF export
- Save Markdown, HTML, plain text, WeChat HTML, and Xiaohongshu draft exports into the project's local `exports/` folder
- Clean HTML export powered by dynamically loaded unified / remark / rehype
- Material sheet cards excluded from publish exports by default
- Selectable sheet compilation for publish exports
- Adjustable export order independent of the project sheet order
- Save selected compilation as a publish-version sheet
- Automatic publish-readiness checks plus a persistent project publishing task checklist
- Persistent export history for files saved into the project's local `exports/` folder
- Tauri desktop library switching with remembered local writing library path
- Readable per-project `project.toml` metadata beside app-owned `project.json`
- Right-side Codex chat panel prototype
- Tauri command bridge for `codex exec`
- Multi-conversation chat tabs
- Library-scoped AI conversation persistence
- Plan Mode, slash shortcuts, and mention context controls including `@materials`
- Select specific project cards as AI context through the `@cards` picker
- Local `$skill` task file creation under the active library's `ai-tasks/` folder
- Resource inspector tab shows project resource paths for assets, references, and exports
- Resource inspector can list, preview, open, import, and select project resource files as shared `@resources` context
- Selected text resources can be read into Codex context with a guarded size limit
- Text resources can be previewed before sending them to Codex
- Project resource folders and imported/exported files can be opened in the system file viewer
- Codex inline edit into diff review
- Local sheet summary and image-idea suggestions in the AI panel
- Save AI notes as local material sheets for later reference
- Centralized design tokens for a cleaner white-first Apple-style visual direction
- The current prototype UI is not considered final; the release-quality direction must be cleaner, lighter, white-first, and closer to Apple's native writing-tool aesthetic

The AI panel now follows the Claudian-style direction: a normal chat window in the right inspector that calls the local Codex CLI. The current bridge uses `codex exec`; a later version should move to a long-lived `codex app-server` runtime.

## Development Commands

```bash
npm run dev:web
npm run dev
npm run check
npm run audit:npm
npm run build:web
npm run build
```

`npm run dev:web` starts the browser development surface.

`npm run dev` starts the Tauri desktop development app.

`npm run build` creates desktop bundles under `src-tauri/target/release/bundle/`.

`npm run check` is the main quality gate: formatting, TypeScript, ESLint, Vitest, production web build and bundle budget, Rust check and tests, and Clippy.

`npm run audit:npm` checks npm dependencies for moderate-or-higher vulnerabilities.

## Documents

- [Product Brief](docs/product-brief.md)
- [Technical Stack](docs/technical-stack.md)
- [Information Architecture](docs/information-architecture.md)
- [MVP Roadmap](docs/mvp-roadmap.md)
- [AI Integration](docs/ai-integration.md)
- [Current Implementation](docs/current-implementation.md)
- [Claudian-style AI Migration Plan](docs/claudian-migration-plan.md)
- [Design Language](docs/design-language.md)
- [Development Guide](docs/development.md)
- [Code Review Guide](docs/code-review.md)
- [Keyboard Shortcuts](docs/keyboard-shortcuts.md)
- [Frontend Structure](docs/frontend-structure.md)
- [Native Structure](docs/native-structure.md)
- [Security Notes](docs/security.md)
- [Engineering Roadmap](docs/engineering-roadmap.md)
- [Release Checklist](docs/release-checklist.md)
- [Architecture Decisions](docs/adr)
