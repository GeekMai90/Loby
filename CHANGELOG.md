# Changelog

All notable changes to Loby should be recorded here.

This project uses a pragmatic changelog format while it is still pre-release.

## Unreleased

- Added a system-level writing inbox, renamed project default groups to `待整理` and the notes default group to `随手记`, routed new drafts by context, and added `Command+D` quick capture with persistent unsent drafts and matching timestamp document titles/H1 headings plus drag- and dialog-based document moves with legacy-folder migration.
- Added focused external-library refresh, large-library selection, Markdown import, project-field rendering, and project-export compilation tests; split WeChat theme studio, Zen Mode, project-field presentation, and browser export effects from their coordinators or pure logic.
- Escaped user-authored project titles in compiled HTML exports so title markup remains text.
- Made folder-first library rebuilds deterministic, ignored hidden Markdown files, and restored generated `project.toml` metadata plus sheet order when the library index is missing.
- Split native export writing into a focused module and reject unsafe or conflicting bundle destinations before creating partial output.
- Fixed publishing settings treating the initial secret-status lookup as a missing Mowen API Key after restart, and now surface saved, loading, and read-failure states without returning secret values to the renderer.
- Added Aliyun OSS image-host settings and a WeChat preview upload action that uploads local article images in the desktop backend, rerenders preview/copy HTML with public URLs, and leaves source Markdown unchanged.
- Redesigned the WeChat publishing preview as a full-height two-column workspace with card-style blue theme selection, complete iPhone and 677px desktop canvases, a right-side liquid-glass preview toolbar, and aligned icon-only liquid-glass copy and close actions.
- Refined the WeChat theme studio article rail with the shared sliding function switcher, a dedicated built-in example section, a flat recent-first all-articles list, progressive loading, and library-wide search.
- Redesigned the WeChat theme studio's manual style controls with compact measurement steppers, direct numeric and keyboard input, single-row color fields, and a perceptual shadow-strength slider.
- Simplified the WeChat theme preview by removing its toolbar and zoom controls, centering the shared phone/desktop switcher above a fixed outer canvas, rendering the 402-by-874-point iPhone 17 Pro viewport inside a Silver device-frame asset at 100% when space allows, matching the public WeChat desktop article width at 677px without a device frame, adding preview-only light/dark appearance controls, keeping article scrolling inside the preview, using a solid window toolbar, and adding a tested rich-layout copy action beside Save Theme.
- Refined the WeChat-theme AI assistant with a wider responsive column, a clipped fading header, balanced edge spacing for header actions, and warmer 2–3 sentence replies that explain the visible change and what to check next.
- Compressed the built-in WeChat sample cover and embedded it as clipboard-safe image data, with copy-time inlining as a fallback for other app-local article images.
- Added live Codex run steps, reasoning progress, read-only tool activity, token usage, cancellation, and per-theme multi-conversation history to the WeChat-theme AI assistant using the same run and conversation controls as the main assistant, with autonomous reading of user-provided local references and no step-by-step approvals.
- Unified the main and WeChat-theme AI assistants around shared panel chrome, message surfaces, thread spacing, composer framing, and toolbar controls while keeping their runtime and domain workflows separate.
- Added temporary pasted, dropped, and file-picked image attachments to the main and WeChat-theme AI assistants, with native Codex multimodal input, thumbnail previews, guarded process-scoped temporary storage, and no image persistence in projects or conversations.
- Added a standalone WeChat theme studio with direct universal typography, color, and layout controls; unrestricted AI-authored presentation CSS and reusable HTML transforms; inline WeChat compatibility compilation; reusable personal themes; live article preview; automatic app-data persistence; per-theme conversation history; and bounded undo/redo history.
- Added a macOS Zen Mode with a simple-fullscreen background layer and a separate movable, resizable, tileable writing window that edits the active Markdown file directly, reuses the main editor's Markdown rendering and format controls, and includes persistent background and offline sound controls.
- Added read-only historical-version previews in the editor with a persistent return-to-current control, direct restore action, and automatic backup of the current body before restoration.
- Unified Select, dropdown, and context menus around liquid-glass triggers and panels, collision-aware placement, and clearer neutral hover states.
- Added an editor publishing center with extensible WeChat layout previews and rich HTML copy, plus cross-platform app-config-backed WordPress and Mowen draft/public publishing with image upload.
- Fixed Mowen notes dropping a trailing image, added attachment-count validation, and optimized large local publishing images through self-cleaning temporary JPEG copies without modifying source files.
- Refined the shared confirmation-dialog layout and fixed moving notes from the special inbox area into the library trash.
- Fixed pasted image references disappearing when resource file events arrived before the edited Markdown had been saved.
- Replaced numeric suffixes on conflicting imported image names with stable short hashes while preserving every copied file.
- Added light, dark, and system-following application appearance plus four independently selectable editor themes with matched light/dark palettes.
- Added a centralized, extensible keyboard-shortcut system with common project, sheet, navigation, view, application, and Markdown editing actions plus an in-app shortcut overview.
- Debounced and serialized writing-library and AI-conversation saves so rapid editing and streaming updates persist only the latest pending state without overlapping writes.
- Skipped unchanged managed-file writes and added safe temporary-file replacement for macOS/Linux persistence.
- Split native watcher, project-path, resource, and system-path responsibilities out of the Tauri composition root.
- Split AI conversation storage and writing-library trash operations into focused native modules.
- Split writing-library scanning, index coordination, and managed-file persistence into `library` domain modules.
- Split Agent discovery, process resolution, timeout handling, and app-server event translation into focused native modules.
- Split Agent runtime, app-server transport, JSON-RPC protocol construction, and Tauri application composition into focused native modules.
- Split wastebasket session state and restore/delete actions out of the frontend app coordinator.
- Added a pull request review template, risk-based review guide, Dependabot updates, tracked local verification hooks, and a production bundle budget.
- Lazy-loaded AI, settings, and field-management surfaces, reducing the main production JavaScript chunk and making Markdown export imports effective async chunks.
- Split project-field migration coordination from editor/list views and destructive-change confirmation dialogs.
- Added a repository-level Codex branch/PR policy and tracked Git hooks that prevent accidental direct commits or pushes to `main`.
- Added ESLint, Prettier, Vitest, Rust check, and Clippy quality gates.
- Added the local `npm run check` quality gate used by Git hooks and reviewed pull requests.
- Added initial unit tests for AI context helpers, agent run state merging, and project creation helpers.
- Added development, security, and contribution documentation.
- Pinned Node and Rust toolchain versions for reproducible local development.
