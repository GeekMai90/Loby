# Contributing

Nibva is currently an early local-first desktop prototype. Contributions should preserve the writing-tool product direction and keep AI as a secondary assistant surface.

## Before You Start

Read:

- `AGENTS.md`
- `docs/development.md`
- `docs/frontend-structure.md`
- `docs/design-language.md`
- `docs/security.md`

## Local Setup

```bash
npm ci
npm run dev:web
```

For the desktop app:

```bash
npm run dev
```

## Quality Gate

Run before pushing:

```bash
npm run check
npm run format:check
```

Use `npm run format` to apply Prettier.

## Pull Request Expectations

- Keep changes scoped to one product or engineering intent.
- Include tests for pure logic changes where practical.
- Update docs when architecture, data shape, workflows, permissions, or development commands change.
- Do not commit generated local writing libraries, build output, secrets, or personal paths.
- Prefer small, reversible refactors over broad rewrites.

## Commit Style

Use concise imperative commit messages, for example:

```text
Add CI quality gates
Split agent run state helpers
Document Tauri security baseline
```

## Release Notes

User-visible changes and engineering milestones should be summarized in `CHANGELOG.md`.
