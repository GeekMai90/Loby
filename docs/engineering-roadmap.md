# Engineering Roadmap

This roadmap tracks engineering maturity work that is not directly product-feature work.

## 2026-07-20 Structure Refresh

The pre-change repository baseline passes with 110 frontend test files / 463 tests and 94 Rust tests. Formatting, TypeScript, ESLint, production build, bundle budget, Rust check, and Clippy are clean; the production entry chunk is 1266.9 KiB raw / 422.7 KiB gzip.

This pass keeps product behavior, persistence formats, native command contracts, editor input behavior, and visual output unchanged while closing the highest-value frontend coordination gap from the previous audit:

- `useWorkspaceNavigation` now applies the pure `workspaceSelection` model to React state, coordinates rail/filter actions, and owns project, Notes, and filtered-list selection repair effects
- a rendered hook harness proves project entry, remembered groups, cross-project sheet selection, action side effects, and recovery after a selected project group or sheet disappears
- `App.tsx` keeps project collections and top-level selection state, but no longer contains the navigation transition and repair implementation
- README and architecture documents now distinguish the concise project overview from the exhaustive implementation inventory, and they reflect the current UI, writing-goal, AI, publishing, theme-studio, and validation state

The post-change `npm run check` passes with 111 frontend test files / 465 tests and 94 Rust tests. The production entry chunk is 1268.0 KiB raw / 422.8 KiB gzip, effectively unchanged from the pre-change baseline while the new rendered coordination coverage adds one test file and two tests.

The audit deliberately keeps `useAiAssistant`, `WechatThemeStudioWindow`, `ZenModeWindow`, and native cross-domain tests intact. Each is large, but each still has one recognizable controller or integration responsibility; splitting them without a new tested boundary would add indirection or risk runtime, preview, IME, or persistence behavior.

Highest-value remaining engineering work:

1. Add failure-path coverage for image centralization when a source becomes unreadable between scan and transfer; cleanup must remain a separate explicit phase.
2. Identify and cover a library-session boundary before moving any library switching or persistence coordination out of `App.tsx`.
3. Use measured startup/editor interaction data before changing async chunk boundaries or introducing further performance work.

## 2026-07-19 Follow-up Audit

The current repository-wide gate passes with 86 frontend test files / 374 tests and 88 Rust tests. Formatting, TypeScript, ESLint, the production build, bundle budget, Rust check, and Clippy are also clean. The largest production entry chunk is 1207.8 KiB raw / 407.2 KiB gzip and remains within the enforced budget.

This pass kept product behavior and persistence formats unchanged while improving two boundaries that had grown with recent features:

- project, group, smart-list, and sheet navigation transitions now live in the pure `workspaceSelection` model; focused tests cover remembered groups, Inbox selection, Notes fallback, cross-project selection, and repair after a visible group or sheet disappears
- the `useSheetPointerDrag` event lifecycle now has hook-level coverage for the movement threshold, Escape cancellation, delayed project/library navigation, move commit, and suppression of the click generated after a drag
- shared-image saving, importing, deduplication, legacy migration, and cleanup now live in `resources/images.rs`; cleanup tests prove that central images and paths outside the active writing library are never deleted
- current implementation and architecture docs now match the single user-facing `Documents/LobyLibrary` writing folder, the one-time `落笔指南` starter project, and the root-level `assets/images` directory; the multi-root registry remains an internal compatibility boundary

The remaining large files are not automatically refactor targets. `App.tsx` still owns top-level React state and persistence callbacks; `WechatThemeStudioWindow`, `useAiAssistant`, and `tests.rs` each have one broad but recognizable responsibility. Split them only when a change exposes a stable boundary and focused regression coverage can be added first.

Highest-value remaining coverage gaps:

1. Add a small rendered integration harness for workspace navigation so the tested pure selection updates are also proven against the React coordinator wiring.
2. Add failure-path coverage for image centralization when a source becomes unreadable between scan and transfer; source cleanup must remain a second explicit phase.

## July 2026 Maintenance Audit

The 2026-07-17 pre-change repository baseline is healthy: `npm run check` passes with 70 frontend test files / 303 tests and 71 Rust tests, alongside formatting, TypeScript, ESLint, production-build, bundle-budget, Rust check, and Clippy gates.

This maintenance pass is intentionally limited to behavior-preserving engineering work:

- add focused coverage before changing external-file refresh and large-library selection boundaries
- split presentation-only sections from the oversized WeChat theme studio coordinator
- split project-field presentation by responsibility and cover Markdown import failure, metadata, and batch-identity boundaries
- separate pure export compilation from browser effects and cover publish-output boundaries
- harden deterministic library scanning, rebuildable project metadata, and export bundle writes
- update architecture, publishing-secret, and verification documentation to match the current implementation

`App.tsx`, editor input/IME behavior, AI runtime state, and native persistence formats are not being reorganized merely to reduce line counts. They should move only when a stable ownership boundary has focused regression coverage.

The current post-change gate passes with 75 frontend test files / 329 tests and 77 Rust tests. Moving Markdown import/YAML parsing behind its user-triggered boundary reduced the production entry chunk from 1302.1 KiB raw / 437.1 KiB gzip to 1194.9 KiB raw / 403.4 KiB gzip.

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
- Writing-library persistence integration tests cover rapid-edit collapse, old-library path capture and flush-before-switch ordering, plus flush-before-close behavior through the production save coordinator.
- External-file refresh selection reconciliation is isolated from the React hook and covered for removed projects, sheets, project groups, note groups, and a 2,000-project library without mutating the loaded model.
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
- Project field list, creation, definition, default-value, and type-icon views are split by presentation responsibility; focused rendering tests preserve locked-field, field-type, option, default-value, and move-control states.
- Markdown import tests preserve malformed frontmatter as visible content, retain supported nested custom metadata while excluding app-owned keys, and verify deterministic unique IDs across a 500-file batch.
- Pure project export compilation stays in `src/features/publishing/model/export.ts`; download, clipboard, and print-window effects live in `src/features/publishing/model/exportBrowser.ts`. Tests cover material exclusion, explicit ordering, bundle body transforms, portable text, WeChat markup, XHS fallback copy, browser effects, and HTML title escaping.
- Folder-first scanning now preserves stored order, deterministically sorts newly discovered projects/groups/sheets, and ignores hidden Markdown. Typed `project.toml` recovery restores all generated project metadata and sheet order when `.loby/library.json` is unavailable.
- Project export commands live in `resources/exports.rs`; bundle paths are validated together before filesystem creation, with traversal and portable case-insensitive destination collisions rejected. Nested file/asset writes and failure boundaries are covered by temporary-filesystem tests.
- Project and group draft rendering is deduplicated in a focused lazy-loaded component; draft state, edit/create mode, target project, and dialog transitions live in `useProjectDraftDialogs` without moving project collection ownership.
- Sheet-list context derivation and sort/manual-order updates live in the tested `sheetListModel` and `useSheetList` boundary. `App.tsx` continues to own top-level state and persistence callbacks.
- WeChat theme studio header/menu/dialog presentation and conversation helpers are split from the studio state coordinator; Zen Mode settings presentation is split from editor and persistence behavior.

## Current Accepted Warnings

The default local gate is warning-free for ESLint, Rust Clippy, and the Vite production build. AI, settings, field-management, Markdown import/YAML parsing, and Markdown export processing are loaded on demand. `npm run check:bundle` caps the remaining entry chunk in both raw and gzip size.

## Next Engineering Milestones

1. Add failure-path coverage for image centralization when a source becomes unreadable between scan and transfer.
2. Continue reducing `App.tsx` only at a tested library-session or another stable coordination boundary; do not move the whole persistence hook merely to reduce line count.
3. Continue reducing initial-load cost only when startup or editor-interaction measurements identify a real bottleneck.
4. Harden Tauri security:
   - narrow asset protocol scope where practical
   - keep CSP updated as asset and preview capabilities change
   - remove `macOSPrivateApi` if the final window design no longer needs it
5. Decide on a Rust dependency audit tool:
   - `cargo audit`
   - `cargo-deny`
6. Add release checklist automation once packaging stabilizes.

## Non-Goals For This Phase

- No broad feature rewrite.
- No Electron migration.
- No hosted AI provider migration.
- No aggressive security tightening that breaks user-selected local libraries before a replacement design exists.
