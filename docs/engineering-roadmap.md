# Engineering Roadmap

This roadmap tracks engineering maturity work that is not directly product-feature work.

## Completed Baseline

- Node and Rust toolchains are pinned.
- ESLint, Prettier, Vitest, TypeScript, Rust check, and Clippy are wired.
- `npm run check` is the main local quality gate.
- GitHub-hosted Actions are intentionally disabled; tracked Git hooks, local verification, reviewed pull requests, and the PR checklist form the merge gate.
- Initial unit tests cover pure AI context, agent run-state, and project-creation helpers.
- Frontend unit tests cover project normalization, AI change-set parsing/application, export selection ordering, and image reference parsing/export rewriting.
- Initial Rust tests cover Markdown rendering, folder-first persistence behavior, Codex runtime message construction, and filesystem path safety helpers.
- Serializable Rust models are split into `src-tauri/src/models.rs`.
- Filesystem path and filename safety helpers are split into `src-tauri/src/fs_paths.rs`.
- Markdown/frontmatter rendering and parsing helpers are split into `src-tauri/src/markdown.rs`.
- Agent stream runtime uses the Codex app-server path only; the unused legacy JSON stream fallback has been removed.
- Tauri now has a baseline CSP instead of `csp: null`.
- Current `macOSPrivateApi` usage is documented and tied to the custom-window prototype.
- Development, contribution, security, and ADR documentation exists.
- Writing-library and AI-conversation persistence is debounced, latest-wins, and serialized so rapid editor or stream updates cannot start overlapping saves.
- Managed Markdown, project metadata, library indexes, and AI conversations skip unchanged writes; macOS/Linux replacements use synced same-directory temporary files before rename.
- Native watcher, project-path, resource, and operating-system path commands are split into focused Rust modules with temporary-filesystem tests.
- AI conversation persistence and writing-library trash behavior are split from the Tauri composition root; existing round-trip and trash restore tests cover the moved boundaries.
- Writing-library commands, folder-first scanning, managed-file saving, index coordination, and trash behavior now live under the `library` Rust domain.
- Agent skill/model discovery, CLI resolution, bounded process execution, and app-server event translation now live under the `agent` Rust domain.
- Agent commands, managed run state, cancellation, app-server communication, approval waiting, and JSON-RPC construction now live under focused `agent` modules.
- Tauri menus, managed state, and command registration now live in `app.rs`; `lib.rs` is the native module root.
- Cross-domain native integration tests live in `tests.rs` instead of inflating the production module root.
- Pull requests have a risk-based review template and review guide; Dependabot covers npm and Cargo updates.
- The production build enforces a JavaScript entry-chunk size budget.
- Wastebasket session state is isolated in `useLibraryTrash`, with explicit refresh signals from trash mutations instead of reloading on every project edit.
- Project field migration state, editor/list views, and confirmation dialogs are split into focused frontend modules.
- Project and group draft dialog rendering is deduplicated in a focused lazy-loaded component without moving project state ownership.

## Current Accepted Warnings

The default local gate is warning-free for ESLint, Rust Clippy, and the Vite production build. AI, settings, and field-management surfaces are loaded on demand; Markdown export dependencies now form effective async chunks. `npm run check:bundle` caps the remaining entry chunk in both raw and gzip size.

## Next Engineering Milestones

1. Add persistence integration coverage for close/switch/rapid-edit behavior and large writing libraries.
2. Continue reducing frontend coordinator responsibilities in `App.tsx`, starting with stable dialog and library-session boundaries.
3. Continue splitting project/group dialog coordination from `App.tsx` when a stable state-owner hook is clear.
4. Add more Rust unit tests for library scanning edge cases and resource bundle writing.
5. Add frontend tests for publish export compilation and project import edge cases.
6. Continue reducing initial-load cost beyond the current bundle budget, prioritizing measured startup and editor-interaction impact.
7. Harden Tauri security:
   - narrow asset protocol scope where practical
   - keep CSP updated as asset and preview capabilities change
   - remove `macOSPrivateApi` if the final window design no longer needs it
8. Decide on a Rust dependency audit tool:
   - `cargo audit`
   - `cargo-deny`
9. Add release checklist automation once packaging stabilizes.

## Non-Goals For This Phase

- No broad feature rewrite.
- No Electron migration.
- No hosted AI provider migration.
- No aggressive security tightening that breaks user-selected local libraries before a replacement design exists.
