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

The first AI surface should be a Claudian-style right sidebar chat.

This chat is not a generic article generator. It is a local writing assistant that can read the current Nibva context and talk to a local CLI provider already authenticated on the user's machine.

Initial AI entry points:

- Right sidebar chat
- Local Codex CLI provider
- Local Claude CLI provider
- Current project and sheet context
- Slash prompt expansion typed in the input
- `$skill-name` references typed in the input

Do not reintroduce a large AI dashboard before the chat runtime is stable. AI actions should appear as focused chat-side operations and editor-side changes, not as a separate dashboard.

## Review Flow

AI output should be reviewable.

For text changes:

- AI may apply a proposed edit directly to the active sheet.
- Before applying, create a sheet version snapshot so the original draft can be restored.
- Show a compact operation card in the chat message that produced the edit.
- Persist the operation card as structured message history, not as transient component state.
- The chat card should explain what changed and offer display/hide changes plus undo.
- Show detailed changes in the editor, not as a long diff embedded in the chat flow.
- Added text is shown in blue; removed text is shown as muted strikethrough; unchanged text stays unmarked.
- Undo restores the pre-edit body and marks the operation rejected.

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

- The AI assistant discovers local Codex skills.
- The `/` menu mounts local Codex skills into the composer.
- The `@` menu mounts app documents or selected text into the composer.
- Mounted current-document context is shown once at the first relevant user message; selected text is shown as a one-line context bubble.
- Typed `$skill-name` references are added to the prompt context with skill name, description, and path.
- Model, reasoning, and quick-mode settings are grouped into one compact model menu in the composer toolbar.
- Direct runtime execution through Codex app-server is still a later step.

Codex skills can return:

- Replacement text
- Suggested diffs
- New Markdown files
- HTML exports
- Image prompts
- Generated assets
- Publishing checklists

The bridge should be local-first and transparent. Generated files should be written back into the project folder when appropriate.

Current prototype note: each project exposes stable local folders for `assets`, `references`, and `exports`. The first AI sidebar does not expose resource-picking controls; those can return after the core chat/provider runtime is stable.

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

- Never silently overwrite user writing.
- When a workflow intentionally auto-applies an AI edit, preserve a pre-edit snapshot and provide an obvious undo action in the chat operation card.
- Keep AI actions scoped to the current project or explicit selection.
- Show what context will be sent to an AI action when the action is broad.
- Avoid sending unnecessary private files as context.
- Store AI artifacts locally in readable formats.
