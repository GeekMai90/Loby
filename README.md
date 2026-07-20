# 落笔（Loby）

Loby is a local-first, Markdown-based professional writing app designed for AI-friendly human writing workflows.

It is not an AI article generator. The core product is a focused writing environment for planning, drafting, revising, illustrating, formatting, publishing, and archiving written work. AI should act as an assistant inside specific writing actions, not as the main authoring model.

## Product Direction

Loby is built around writing projects rather than loose notes.

- Local-first storage
- Open Markdown files
- Project-based writing organization
- Project groups for topics, columns, chapters, modules, and materials
- Sheet/card-based drafting
- Focused long-form editor
- Clean Apple-style interface with light, dark, and system-following appearance
- Independent editor themes for different writing styles
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

Loby is a working pre-release desktop application. The main writing, AI, local-file, publishing, and visual-system foundations are implemented; release hardening and cross-platform validation are still in progress.

Current capability areas:

- Local-first writing libraries with readable Markdown, project groups, typed document properties, version snapshots, trash recovery, portable library preferences, and shared image storage
- CodeMirror writing across the main editor and Zen Mode, including Markdown decorations, formatting, search, outline navigation, image workflows, typewriter mode, and Chinese-writing preferences
- Divider-based document navigation with search, property filters, multi-selection, drag ordering, cross-project/group moves, quick capture, and Inbox/Notes workflows
- Daily, project, and article writing goals with activity heatmaps, progress feedback, and optional completion celebrations
- Reviewable Codex assistance with persistent conversations, live run status, mounted context, quick prompts, image attachments, structured action cards, editor-side diffs, guarded apply/undo, and local skill discovery
- Export and publishing for Markdown, HTML, plain text, WeChat, Xiaohongshu, WordPress, and Mowen, including image bundles and cross-platform secret storage
- A standalone WeChat theme studio with built-in and library-local themes, responsive previews, direct style controls, AI-assisted revisions, conversation history, and undo/redo
- A white-first Apple-style interface with light/dark/system appearance, independent editor themes, semantic design tokens, liquid-glass menus and controls, compact toasts, and focus-aware rail selections

The source of truth for the complete feature inventory is [Current Implementation](docs/current-implementation.md). Recent user-visible changes are tracked in [Changelog](CHANGELOG.md), while current engineering boundaries and remaining structural work are tracked in [Engineering Roadmap](docs/engineering-roadmap.md).

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
- [Theme System](docs/themes.md)
- [Frontend Structure](docs/frontend-structure.md)
- [Native Structure](docs/native-structure.md)
- [Security Notes](docs/security.md)
- [Engineering Roadmap](docs/engineering-roadmap.md)
- [Release Checklist](docs/release-checklist.md)
- [Architecture Decisions](docs/adr)
