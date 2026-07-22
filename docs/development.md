# Development Guide

This guide is the engineering entrypoint for Loby. It explains how to run, check, and extend the project without re-learning conventions from scattered files.

## Runtime Versions

- Node.js: see `.node-version`
- Rust: see `rust-toolchain.toml`
- Package manager: npm with `package-lock.json`

Use these pinned versions when reproducing local or remote verification failures.

## Common Commands

```bash
npm ci
npm run setup:git-hooks
npm run dev:web
npm run dev
npm run check
npm run build:web
npm run build
```

Command meanings:

- `npm run dev:web`: Vite browser surface on `127.0.0.1:1420`
- `npm run dev`: Tauri desktop app
- `npm run typecheck`: TypeScript only
- `npm run lint`: ESLint for TypeScript and React rules
- `npm run format:check`: Prettier formatting gate
- `npm run test`: Vitest unit tests
- `npm run test:rust`: Rust unit tests
- `npm run check:rust`: Rust compile check
- `npm run lint:rust`: Clippy with warnings denied
- `npm run audit:npm`: npm dependency vulnerability audit
- `npm run check:bundle`: production JavaScript entry-chunk budget
- `npm run check`: primary local quality gate

## Repository Shape

- `src/components`: reusable UI surfaces
- `src/hooks`: feature state machines and cross-component behavior
- `src/lib`: non-UI helpers and pure domain logic
- `src/constants`: stable option lists, templates, and visual defaults
- `src/styles`: product-surface CSS files imported by `src/styles.css`
- `src-tauri`: native commands, filesystem, agent process, and desktop integration
- `docs`: product, architecture, implementation, and engineering notes

Detailed frontend ownership lives in `docs/frontend-structure.md`.
Native Rust ownership lives in `docs/native-structure.md`.
Ongoing engineering maturity work is tracked in `docs/engineering-roadmap.md`.
Release readiness steps live in `docs/release-checklist.md`.

## Quality Gates

Before pushing meaningful code, run:

```bash
npm run check
```

GitHub-hosted Actions are intentionally disabled for this private repository. Run the full gate locally and record the result in the pull request; tracked Git hooks prevent ordinary direct commits and pushes to `main`.

Current policy:

- ESLint should be warning-free.
- Rust Clippy warnings are denied.
- Rust unit tests are part of the main quality gate.
- New pure helper logic should include Vitest coverage when practical.
- Before moving coordinator state, extract and test deterministic reconciliation or selection logic first; include removed-item and large-collection cases when persistence or external file refresh is involved.
- New Rust modules should be structured so they can eventually receive unit tests without invoking Tauri windows.
- The production build must remain within the checked-in JavaScript bundle budget.

Pull requests use the repository template and the risk-based review flow in `docs/code-review.md`. When the GitHub plan supports private-repository protection without changing the current runner-cost policy, require pull requests and retain the local verification gate.

The default development flow is `codex/<task>` → one draft PR → local verification and review → squash merge → automatic branch deletion. `npm ci` enables the tracked Git hooks through the `prepare` lifecycle script; run `npm run setup:git-hooks` manually if lifecycle scripts were disabled.

## Formatting

Use Prettier for frontend, docs, JSON, and CSS:

```bash
npm run format
```

Prettier output is the formatting source of truth. Avoid hand-formatting files against it.

## Adding Code

- Prefer stable product boundaries over arbitrary line-count splitting.
- Put reusable UI in components, behavior in hooks, pure logic in lib.
- Keep `App.tsx` as app coordination only.
- Keep workspace navigation rules in `src/features/library/model/workspaceSelection.ts` and their React application/repair wiring in `src/features/library/hooks/useWorkspaceNavigation.ts`; top-level project and selection state remains owned by `App.tsx`.
- Keep Tauri commands thin; move durable native behavior into modules as the Rust layer is split.
- Put native pure helpers in focused Rust modules with unit tests before wiring them into commands.
- Do not add global dependencies unless they meaningfully reduce implementation risk or complexity.

## Persistence Invariants

- Editor and AI stream updates may be frequent, but persistence work must be debounced and serialized.
- A newer state queued during a save supersedes any older pending state; saves must never overlap.
- Changing the active storage path through onboarding, recovery, or the retained internal registry, and rebuilding the index, must flush pending writing-folder changes first.
- Managed files should not be rewritten when their rendered content is unchanged.
- File replacement should use a synced same-directory temporary file and rename where the platform supports atomic replacement.
- Changes to these invariants require focused tests and an update to ADR 0005.

## Local Data

Loby is local-first. The user-facing writing folder defaults to `~/Documents/LobyLibrary` and may contain user-authored Markdown and assets. Do not hard-code personal paths or commit generated writing data.

## Release Readiness

Before a release candidate:

1. Run the required checks in `docs/release-checklist.md`.
2. Review Tauri permissions and security notes in `docs/security.md`.
3. Smoke test long-document editing, Chinese IME input, AI assistant send/cancel, local file persistence, and export.
4. Update `CHANGELOG.md`.
