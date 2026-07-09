# Development Guide

This guide is the engineering entrypoint for Nibva. It explains how to run, check, and extend the project without re-learning conventions from scattered files.

## Runtime Versions

- Node.js: see `.node-version`
- Rust: see `rust-toolchain.toml`
- Package manager: npm with `package-lock.json`

Use these pinned versions when reproducing local or CI failures.

## Common Commands

```bash
npm ci
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
- `npm run check`: primary local and CI gate

## Repository Shape

- `src/components`: reusable UI surfaces
- `src/hooks`: feature state machines and cross-component behavior
- `src/lib`: non-UI helpers and pure domain logic
- `src/constants`: stable option lists, templates, and visual defaults
- `src/styles`: product-surface CSS files imported by `src/styles.css`
- `src-tauri`: native commands, filesystem, agent process, and desktop integration
- `docs`: product, architecture, implementation, and engineering notes

Detailed frontend ownership lives in `docs/frontend-structure.md`.
Ongoing engineering maturity work is tracked in `docs/engineering-roadmap.md`.
Release readiness steps live in `docs/release-checklist.md`.

## Quality Gates

Before pushing meaningful code, run:

```bash
npm run check
npm run format:check
```

CI runs the same gates on `main` pushes and pull requests.

Current policy:

- ESLint should be warning-free.
- Rust Clippy warnings are denied.
- Rust unit tests are part of the main quality gate.
- New pure helper logic should include Vitest coverage when practical.
- New Rust modules should be structured so they can eventually receive unit tests without invoking Tauri windows.

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
- Keep Tauri commands thin; move durable native behavior into modules as the Rust layer is split.
- Put native pure helpers in focused Rust modules with unit tests before wiring them into commands.
- Do not add global dependencies unless they meaningfully reduce implementation risk or complexity.

## Local Data

Nibva is local-first. The active writing library defaults to `~/Documents/NibvaLibrary` and may contain user-authored Markdown and assets. Do not hard-code personal paths or commit generated library data.

## Release Readiness

Before a release candidate:

1. Run the required checks in `docs/release-checklist.md`.
2. Review Tauri permissions and security notes in `docs/security.md`.
3. Smoke test long-document editing, Chinese IME input, AI assistant send/cancel, local file persistence, and export.
4. Update `CHANGELOG.md`.
