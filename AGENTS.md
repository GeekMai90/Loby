# Nibva Agent Instructions

These instructions apply to the Nibva repository.

## Product Intent

Nibva is a local-first professional writing app with AI-friendly workflows. It should help humans write better, not replace the writer with one-shot AI generation.

Preserve these principles when making product or engineering decisions:

- The writer remains in control.
- Markdown files remain readable outside Nibva.
- AI writing changes should be reviewable, reversible, and tied to local snapshots.
- Local project folders are the source of truth.
- The global writing-library registry may remember names and paths, but removing or display-renaming an entry must never delete, move, or rename its local folder.
- The app should feel like a writing tool, not a chat app.

## Technical Direction

The planned stack is:

- Tauri 2 for the desktop shell
- Rust for native file, process, indexing, and system integration
- TypeScript + React for the interface
- CodeMirror 6 for the editor
- unified / remark / rehype for Markdown processing

Do not introduce Electron unless a focused editor/input prototype shows that Tauri/WebView behavior is not acceptable for long-form writing, Chinese IME input, selection behavior, or decoration performance.

## UI Direction

Nibva should use a clean, fresh, white-first, Apple-style desktop aesthetic. This is a product requirement. Prefer white surfaces, light gray separators, system blue accents, restrained typography, and quiet editor-focused layouts. Avoid beige/paper themes, warm editorial defaults, heavy card stacks, decorative gradients, saturated status blocks, and visually noisy AI dashboards. The editor should stay visually primary; AI should remain a secondary assistant surface.

Menus and pickers should use the shared Nibva pattern: high-opacity liquid-glass floating panel, subtle border/shadow, neutral hover or keyboard-active rows, and checkmark-only selected rows without persistent colored backgrounds.

The left navigation rail and sheet list keep selection separate from focus. A selected item in the active rail uses the system-blue primary treatment; when focus moves to the other rail or the editor, the navigation selection uses `#DFF1FC` with blue content and the sheet selection uses `#DCDCDC` with normal content. Clicking or focusing the editor makes both rails inactive. Do not clear selection merely because focus moved between these regions.

AI model/reasoning/speed controls should stay as compact text controls in the composer toolbar; reuse `AssistantModelSettingsMenu` instead of adding one-off model dropdowns.

AI edit result cards belong to persisted chat message history. Detailed diffs belong in the editor, with blue additions, muted strikethrough deletions, and unmarked unchanged text.

Publishing themes belong in `src/lib/publishing/wechatThemes.ts`; add layouts through the typed registry instead of branching the dialog by theme name. Publishing secrets must stay in the system Keychain or environment and must never enter project files, browser storage, logs, screenshots, or review text.

CodeMirror should use native browser selection for normal writing unless a targeted regression proves the custom `drawSelection` layer is needed.

## UI Component Foundation

- Tailwind CSS v4 and shadcn/ui are the UI foundation. Use Tailwind utilities for ordinary layout and component state, and use local shadcn primitives for shared controls.
- Keep shadcn/ui source components under `src/components/ui/`, shared class merging in `src/lib/utils.ts`, and its isolated theme entry in `src/styles/shadcn.css`.
- Tailwind Preflight is enabled. Any native, CodeMirror, liquid-glass, or other explicit exception must define the browser styles it depends on instead of relying on user-agent defaults.
- Animate UI is an optional animation source installed through the shadcn registry. Keep copied sources under `src/components/animate-ui/` and use them only where motion materially improves feedback or state transitions.
- New or migrated product UI should compose the local shadcn primitives instead of reintroducing one-off button, input, dialog, menu, tooltip, or progress implementations.
- Migrated ordinary buttons use the local shadcn `Button` defaults and standard variants. Do not recreate the legacy `.primary-button`, `.secondary-button`, `.text-button`, or `.icon-button` appearance in Tailwind. `LiquidGlassButton` and its joined group are the intentional visual exception.
- Dialog footers stay on the same surface as the dialog body, without a separator or tinted footer strip. Secondary close/cancel actions appear to the left of the primary save/confirm action.

## Editing Guidelines

- Keep planning documents short, concrete, and decision-oriented.
- Update docs when product direction, architecture, data format, or AI workflow assumptions change.
- Avoid turning this repository into a generic knowledge base.
- Prefer small, reversible implementation steps.
- Do not let `App.tsx` become a catch-all file. It should coordinate app state and compose major surfaces; move stable UI, constants, and helpers into focused files when a stable boundary exists.
- File length is a review signal, not a hard rule. Prefer splitting when a file mixes multiple responsibilities, owns unrelated state machines, or makes ordinary changes require scanning distant sections.
- As a rough review trigger, inspect ordinary components around 300 lines, complex feature panels/hooks around 500 lines, helper modules around 400 lines, and style files around 800 lines. It is acceptable to keep a longer file intact when it has one clear responsibility and splitting would mainly add indirection.
- When splitting, split by product responsibility or data flow boundary, not by arbitrary line count.
- Put reusable UI surfaces in `src/components/`, stable options/defaults in `src/constants/`, non-UI helpers in `src/lib/`, and feature-specific styles in `src/styles/*.css`.
- Keep `src/styles.css` as the style entrypoint only. It should import focused files from `src/styles/`, not contain feature rules directly.
- Keep custom CSS focused on shared tokens/resets and explicit exceptions: shell geometry, liquid glass, CodeMirror/editor themes, rich Markdown rendering, diff rendering, drag/drop indicators, image lightboxes, embedded publishing previews, responsive geometry, and state animations.
- Keep AI fading header effects in `src/styles/ai.css`, AI rich Markdown/message animations in `src/styles/ai-thread.css`, and persisted diff rendering in `src/styles/ai-review.css`. Ordinary AI layout and controls belong in Tailwind/shadcn, not new feature CSS.
- When changing UI styles, edit the matching surface file first. Create a new style file only when a new major surface does not fit an existing boundary.
- When adding a new modal, panel, inspector tab, sidebar, toolbar, or picker, create a dedicated component file instead of adding large JSX blocks to `App.tsx`.
- Large option lists, templates, icon palettes, color palettes, and seed-like configuration must not live in `App.tsx`; put them under `src/constants/`.
- App and editor keyboard shortcuts must be declared in `src/lib/keyboardShortcuts.ts`. Reuse the shared matcher, formatter, accessibility label, and CodeMirror key conversion; do not add isolated `keydown` listeners or duplicate shortcut labels in components.
- Application and editor theme palettes must be expressed through the shared tokens in `src/styles/themes.css`. Theme options and persisted IDs belong in `src/constants/themes.ts` and `src/lib/themes.ts`; do not hard-code a second theme palette inside components or CodeMirror extensions.
- Each refactor step should preserve behavior and pass `npm run check` when practical. Use `npm run build:web` only for narrow frontend-only edits where the full gate would be excessive.

## Development And Pull Request Workflow

Treat the following as the default authorization for meaningful development work in this repository. The user should not need to repeat these instructions for each task.

- One coherent task maps to one task branch and one pull request. A pull request may contain multiple implementation commits; do not create one PR per commit.
- Before editing, run `git status --short --branch`. Do not begin meaningful development directly on `main`.
- If `main` is clean, create a branch named `codex/<short-task-name>` before editing.
- If `main` already has uncommitted changes that clearly belong to the current task, create and switch to the task branch without stashing or discarding them. If ownership is ambiguous, preserve the changes and ask before combining scopes.
- Keep unrelated tasks in separate branches and PRs. Avoid running multiple branches that heavily edit the same coordinator or state-machine files at the same time.
- During implementation, make as many local commits as needed for a coherent history. Before delivery, review the complete diff and run `npm run check` locally; record the result in the pull request.
- After a meaningful task is complete and verified, the default delivery is: commit only the task changes, push the task branch, and open a draft pull request using `.github/pull_request_template.md`. Skip GitHub delivery only when the user explicitly requests local-only work, asks not to commit/push, or the worktree contains unresolved unrelated changes.
- GitHub-hosted Actions are disabled for this private repository to avoid metered runner charges. Do not add automatic GitHub Actions checks; treat the local `npm run check` result and the reviewed PR diff as the merge gate.
- Use squash merge for completed PRs so `main` receives one clear commit per task. Do not merge a PR automatically unless the user explicitly asks to merge or has already approved that task for merge.
- Delete the remote task branch after merge. GitHub is configured to do this automatically.
- Never force-push `main`, merge with unresolved review comments, or weaken tests to make local verification pass.
- Repository Git hooks block direct commits and pushes on `main`. `NIBVA_ALLOW_MAIN_WRITE=1` is an emergency override and must only be used when the user explicitly authorizes a direct-main repair.
- The project instructions, tracked Git hooks, local verification, and PR review are the enforcement layer; no remote `Check` status is required.

## Verification Expectations

When implementation begins, prioritize validation of:

- Long Markdown document editing performance
- Chinese IME behavior
- Selection and cursor behavior
- Focus mode and Markdown decoration behavior
- Local file read/write correctness
- Codex skill invocation and result review flow
