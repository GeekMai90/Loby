# Changelog

All notable changes to Nibva should be recorded here.

This project uses a pragmatic changelog format while it is still pre-release.

## Unreleased

- Added a macOS Zen Mode with a simple-fullscreen background layer and a separate movable, resizable, tileable writing window that edits the active Markdown file directly, reuses the main editor's Markdown rendering and format controls, and includes persistent background and offline sound controls.
- Added read-only historical-version previews in the editor with a persistent return-to-current control, direct restore action, and automatic backup of the current body before restoration.
- Unified Select, dropdown, and context menus around liquid-glass triggers and panels, collision-aware placement, and clearer neutral hover states.
- Added an editor publishing center with extensible WeChat layout previews and rich HTML copy, plus Keychain-backed WordPress and Mowen draft/public publishing with image upload.
- Fixed Mowen notes dropping a trailing image, added attachment-count validation, and optimized large local publishing images through self-cleaning temporary JPEG copies without modifying source files.
- Refined the shared confirmation-dialog layout and fixed moving notes from the special inbox area into the library trash.
- Fixed pasted image references disappearing when resource file events arrived before the edited Markdown had been saved.
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
- Added a pull request review template, risk-based review guide, Dependabot updates, bounded CI runs, and a production bundle budget.
- Lazy-loaded AI, settings, and field-management surfaces, reducing the main production JavaScript chunk and making Markdown export imports effective async chunks.
- Split project-field migration coordination from editor/list views and destructive-change confirmation dialogs.
- Added a repository-level Codex branch/PR policy and tracked Git hooks that prevent accidental direct commits or pushes to `main`.
- Added ESLint, Prettier, Vitest, Rust check, and Clippy quality gates.
- Added GitHub Actions CI for pushes and pull requests.
- Added initial unit tests for AI context helpers, agent run state merging, and project creation helpers.
- Added development, security, and contribution documentation.
- Pinned Node and Rust toolchain versions for reproducible local development.
