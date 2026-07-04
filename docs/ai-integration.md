# AI Integration

## AI Role

AI in Nibva should be an assistant inside the writing workflow.

It should help with:

- Polishing selected text
- Shortening or expanding selected text
- Improving titles
- Generating summaries
- Checking structure
- Suggesting images
- Creating cover prompts
- Formatting for publishing
- Preparing exports
- Archiving published work

It should not be positioned as the primary author.

## Interaction Model

Prefer action-based AI over chat-first AI.

Good AI entry points:

- Selection actions in the editor
- Sheet-level actions
- Project-level actions
- Export and publishing actions

Chat can exist later as an advanced interface, but it should not be the product's main AI model.

## Review Flow

AI output should be reviewable.

For text changes:

- Show a diff
- Allow accept, reject, or edit
- Avoid silent replacement
- Preserve the original draft in history or undo

For generated assets:

- Save generated prompts and outputs under project assets
- Track which sheet or project generated them
- Keep generated files inspectable outside the app
- In the current prototype, local AI notes can be saved as material sheets so they remain readable Markdown and can be reused through `@materials`.

## Codex Skill Integration

Nibva should be designed to call local Codex skills.

The app can provide:

- Current project path
- Current sheet path
- Selected text
- Explicitly selected project sheets/cards
- Explicitly selected project resource file paths and supported text snippets
- Target platform
- Desired action
- Style or publishing context

Current prototype behavior:

- The AI panel discovers local Codex skills and shows them as `$skill` chips.
- Selected skills or typed `$skill-name` references can be written as local JSON task files in the active library's `ai-tasks/` folder.
- Each task records the requested action, current project and sheet identity, local project/sheet paths, target platform, selected text, current body, selected cards, and selected resource paths.
- This is a transparent local handoff for Codex CLI or a future skill runner. Direct app-server-backed runtime execution is still a later step.

Codex skills can return:

- Replacement text
- Suggested diffs
- New Markdown files
- HTML exports
- Image prompts
- Generated assets
- Publishing checklists

The bridge should be local-first and transparent. Generated files should be written back into the project folder when appropriate.

Current prototype note: each project exposes stable local folders for `assets`, `references`, and `exports`. The resource inspector and AI panel include those paths in the context sent to Codex, can import local files into `assets/` or `references/`, can open resource folders/files in the system file viewer, and can list/select resource file paths through shared `@resources` state. Supported text resources can be previewed and are read into Codex context with a guarded per-file size limit; non-text resources remain path-only.

## Suggested Skill Categories

- Polish selected text
- Generate headlines
- Generate article cover image
- Generate body illustrations
- Format for WeChat
- Convert article to Xiaohongshu notes
- Prepare publishing checklist
- Archive finished article

## Safety and Control

- Never overwrite user writing without confirmation.
- Keep AI actions scoped to the current project or explicit selection.
- Show what context will be sent to an AI action when the action is broad.
- Avoid sending unnecessary private files as context.
- Store AI artifacts locally in readable formats.
