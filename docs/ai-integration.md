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

Do not reintroduce a large AI dashboard before the chat runtime is stable. Inline edit, resource pickers, review panels, and publishing actions can return later as focused workflows.

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

- The AI assistant discovers local Codex skills.
- Typed `$skill-name` references are added to the prompt context with skill name, description, and path.
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

- Never overwrite user writing without confirmation.
- Keep AI actions scoped to the current project or explicit selection.
- Show what context will be sent to an AI action when the action is broad.
- Avoid sending unnecessary private files as context.
- Store AI artifacts locally in readable formats.
