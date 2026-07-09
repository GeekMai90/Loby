# Engineering Roadmap

This roadmap tracks engineering maturity work that is not directly product-feature work.

## Completed Baseline

- Node and Rust toolchains are pinned.
- ESLint, Prettier, Vitest, TypeScript, Rust check, and Clippy are wired.
- `npm run check` is the main local quality gate.
- GitHub Actions CI runs formatting and project checks.
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

## Current Accepted Warnings

The default local gate is currently warning-free for ESLint and Rust Clippy.

Vite still reports accepted production-build warnings:

- the main JavaScript chunk is larger than 500 kB
- some Markdown/export dynamic imports are ineffective because the same packages are statically imported elsewhere

These are tracked as bundle-shape work, not correctness failures.

## Next Engineering Milestones

1. Split `src-tauri/src/lib.rs` by native domain:
   - `commands`
   - `library`
   - `resources`
   - `agent`
   - `watcher`
   - `models`
2. Add more Rust unit tests for library scanning edge cases and resource bundle writing.
3. Add frontend tests for publish export compilation and project import edge cases.
4. Decide whether hidden older AI prototype panels should be restored or deleted.
5. Reduce Vite bundle warnings by splitting AI Markdown rendering and export code paths where practical.
6. Harden Tauri security:
   - narrow asset protocol scope where practical
   - keep CSP updated as asset and preview capabilities change
   - remove `macOSPrivateApi` if the final window design no longer needs it
7. Decide on a Rust dependency audit tool:
   - `cargo audit`
   - `cargo-deny`
8. Add release checklist automation once packaging stabilizes.

## Non-Goals For This Phase

- No broad feature rewrite.
- No Electron migration.
- No hosted AI provider migration.
- No aggressive security tightening that breaks user-selected local libraries before a replacement design exists.
