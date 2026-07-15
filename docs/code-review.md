# Code Review Guide

Use review to protect behavior, local data, and maintainability—not merely to approve a diff that compiles.

## When Review Is Required

Use a pull request and complete the repository template for every meaningful change. An independent reviewer is strongly preferred for changes involving:

- persistence, file paths, indexing, trash, import, or export
- Tauri commands, permissions, IPC payloads, or frontend event contracts
- editor selection, Chinese IME, focus, drag/reorder, or AI streaming
- shared types, migrations, security settings, dependencies, or release automation

For low-risk documentation or isolated pure-helper changes, a documented self-review is acceptable while the project has a single maintainer.

## Branch And Merge Model

- Create one `codex/<short-task-name>` branch per coherent task.
- A branch may contain multiple commits; a commit is not a pull request boundary.
- Open one draft pull request when the task is implemented and `npm run check` passes.
- Use squash merge to add one task-level commit to `main`.
- GitHub automatically deletes the remote branch after merge.
- Do not combine unrelated work merely to reduce the number of pull requests.

## Review Order

1. Confirm the requested behavior and explicit non-goals.
2. Check data loss, compatibility, cancellation, and error paths before style details.
3. Check whether state and code live in the correct existing boundary.
4. Read tests as behavioral evidence; do not treat snapshots or green automated checks as sufficient by themselves.
5. Review user-visible performance and interaction risks.
6. Confirm docs and changelog updates when contracts or workflows changed.

## Evidence Expected

- `npm run check` passes.
- The pull request states the manual checks performed and any checks not run.
- UI changes include focused screenshots when visual comparison matters.
- Persistence and IPC changes identify compatibility assumptions and failure recovery.
- Large refactors are split into behavior-preserving steps where practical.

## GitHub Repository Setting

Protect `main` and require pull requests rather than direct pushes when the repository plan supports private-repository protection. Do not require a hosted CI status while GitHub-hosted Actions remain intentionally disabled.

GitHub Free does not expose branch protection for this private repository. Until the repository plan supports it, `AGENTS.md` plus the tracked `.githooks` prevent normal Codex and local workflows from writing directly to `main`. After upgrading the plan, enable protection in GitHub and retain the local hooks as a second safeguard.
