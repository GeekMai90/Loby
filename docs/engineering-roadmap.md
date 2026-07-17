# Engineering Roadmap

This roadmap tracks engineering maturity work that is not directly product-feature work.

## July 2026 Maintenance Audit

The 2026-07-17 pre-change repository baseline is healthy: `npm run check` passes with 70 frontend test files / 303 tests and 71 Rust tests, alongside formatting, TypeScript, ESLint, production-build, bundle-budget, Rust check, and Clippy gates.

This maintenance pass is intentionally limited to behavior-preserving engineering work:

- add focused coverage before changing external-file refresh and large-library selection boundaries
- split presentation-only sections from the oversized WeChat theme studio coordinator
- update architecture, publishing-secret, and verification documentation to match the current implementation

`App.tsx`, editor input/IME behavior, AI runtime state, and native persistence formats are not being reorganized merely to reduce line counts. They should move only when a stable ownership boundary has focused regression coverage.

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
- Project and group draft rendering is deduplicated in a focused lazy-loaded component; draft state, edit/create mode, target project, and dialog transitions live in `useProjectDraftDialogs` without moving project collection ownership.
- WeChat theme studio header/menu/dialog presentation and conversation helpers are split from the studio state coordinator; Zen Mode settings presentation is split from editor and persistence behavior.

## Current Accepted Warnings

The default local gate is warning-free for ESLint, Rust Clippy, and the Vite production build. AI, settings, and field-management surfaces are loaded on demand; Markdown export dependencies now form effective async chunks. `npm run check:bundle` caps the remaining entry chunk in both raw and gzip size.

## Next Engineering Milestones

1. Continue reducing frontend coordinator responsibilities in `App.tsx` at a stable library-session or workspace-selection boundary, using the new refresh-selection coverage as one guard rather than moving the whole persistence hook at once.
2. Add more Rust unit tests for library scanning edge cases and resource bundle writing.
3. Add frontend tests for publish export compilation and project import edge cases.
4. Continue reducing initial-load cost beyond the current bundle budget, prioritizing measured startup and editor-interaction impact.
5. Harden Tauri security:
   - narrow asset protocol scope where practical
   - keep CSP updated as asset and preview capabilities change
   - remove `macOSPrivateApi` if the final window design no longer needs it
6. Decide on a Rust dependency audit tool:
   - `cargo audit`
   - `cargo-deny`
7. Add release checklist automation once packaging stabilizes.

## Non-Goals For This Phase

- No broad feature rewrite.
- No Electron migration.
- No hosted AI provider migration.
- No aggressive security tightening that breaks user-selected local libraries before a replacement design exists.
