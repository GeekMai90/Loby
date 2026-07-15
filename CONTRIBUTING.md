# Contributing

Nibva is currently an early local-first desktop prototype. Contributions should preserve the writing-tool product direction and keep AI as a secondary assistant surface.

## Before You Start

Read:

- `AGENTS.md`
- `docs/development.md`
- `docs/frontend-structure.md`
- `docs/native-structure.md`
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
```

Use `npm run format` to apply Prettier.

## Pull Request Expectations

- Use one `codex/<short-task-name>` branch and one pull request for each coherent task. Multiple commits inside that PR are expected.
- Meaningful work should not be committed or pushed directly to `main`.
- Use squash merge so `main` receives one clear commit per completed task.
- Keep changes scoped to one product or engineering intent.
- Complete `.github/pull_request_template.md` and follow `docs/code-review.md`.
- Include tests for pure logic changes where practical.
- Update docs when architecture, data shape, workflows, permissions, or development commands change.
- Do not commit generated local writing libraries, build output, secrets, or personal paths.
- Prefer small, reversible refactors over broad rewrites.

Run `npm run setup:git-hooks` after cloning if npm lifecycle scripts were disabled. The tracked hooks prevent accidental commits and pushes directly from `main`.

## Commit Style

Use concise imperative commit messages, for example:

```text
Tighten local quality gates
Split agent run state helpers
Document Tauri security baseline
```

## Release Notes

User-visible changes and engineering milestones should be summarized in `CHANGELOG.md`.
