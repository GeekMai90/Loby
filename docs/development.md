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

- `src/app`: renderer composition root and cross-feature state ownership
- `src/features`: product capabilities grouped by real domain
- `src/shared`: cross-feature contracts, lightweight UI, hooks, constants, and domain-neutral helpers
- `src/components`: local shadcn/ui and Animate UI primitives
- `src/styles`: semantic tokens, framework mapping, resets, and explicit complex visual exceptions
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

## GEB 分形文档回环

GEB 用三层地图保持“代码现实”与“Agent 语义”同构：

- L1：根目录 `AGENTS.md`，只保留项目宪法、全局架构边界、顶层目录与执行入口。只在产品不可变量、架构方向或顶级模块改变时更新。
- L2：模块目录中的 `AGENTS.md`，记录直接成员、子目录、局部责任、依赖方向与跨边界契约。文件增删、重命名或局部接口变化时同步更新。
- L3：业务源文件头部契约，只说明 `[INPUT]`、`[OUTPUT]`、`[POS]` 和固定 `[PROTOCOL]`，不罗列变量、字段或实现步骤。依赖、导出或责任改变时更新。

L2 与 L3 固定文本为：

```text
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
```

L3 模板：

```ts
/**
 * [INPUT]: 依赖 {module/file} 的 {capability}
 * [OUTPUT]: 对外提供 {exports}
 * [POS]: {module} 中的 {role and collaboration boundary}
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
```

执行顺序：进入目录先读最近的 L2，修改文件前读 L3；完成后按 L3 → L2 → L1 回环检查。新建有真实责任的模块时播种 L2，新建业务源文件时播种 L3；生成产物、依赖缓存、测试 fixture 与临时 QA 证据不纳入头部契约。禁止为了“覆盖率”批量插入空洞模板。

## Formatting

Use Prettier for frontend, docs, JSON, and CSS:

```bash
npm run format
```

Prettier output is the formatting source of truth. Avoid hand-formatting files against it.

## Adding Code

- Prefer stable product boundaries over arbitrary line-count splitting.
- Put product UI, behavior, and models in their owning feature; move code to `shared` only after a real cross-feature contract exists.
- Keep `App.tsx` as app coordination only.
- Keep workspace navigation rules in `src/features/library/model/workspaceSelection.ts` and their React application/repair wiring in `src/features/library/hooks/useWorkspaceNavigation.ts`; top-level project and selection state remains owned by `App.tsx`.
- Keep Tauri commands thin; move durable native behavior into modules as the Rust layer is split.
- Put native pure helpers in focused Rust modules with unit tests before wiring them into commands.
- Do not add global dependencies unless they meaningfully reduce implementation risk or complexity.

File length is a review signal, not a mechanical rule. Inspect ordinary components around 300 lines, complex feature panels or hooks around 500 lines, helpers around 400 lines, and stylesheets around 800 lines. Split by product responsibility, state ownership, or data flow; a longer file with one clear responsibility is preferable to artificial indirection.

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
