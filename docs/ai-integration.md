# AI Integration

## AI Role

AI in Loby should be an assistant inside the writing workflow.

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

This chat is not a generic article generator. It is a local writing assistant that can read the current Loby context and talk to the local Codex CLI already authenticated on the user's machine.

Initial AI entry points:

- Right sidebar chat
- Local Codex CLI provider
- Current project and sheet context
- Slash prompt expansion typed in the input
- `$skill-name` references typed in the input

Claude and hosted API providers are future additions. Do not expose a provider selector until each provider has a planned session model and the product has defined expectations for models, approvals, skills, usage, and failure handling.

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
- If an AI edit is applied to a sheet that is no longer active by the time the CLI returns, Loby should return to that target sheet and keep the AI panel open so the writer immediately sees the operation card and editor diff controls.
- If the target sheet body no longer matches the body that was sent to AI, Loby should cancel automatic application and show an operation-card error instead of overwriting writer edits made while AI was running. Because nothing was applied, the card should offer review and dismiss controls instead of undo.
- Unresolved errored edit cards should remain visible in the AI panel even when their target sheet is not active, with a control to return to the target sheet when possible.
- Undo restores the pre-edit body and marks the operation rejected only when the current sheet body still matches the AI-applied body. If the writer has edited after the AI change, show a failure message instead of overwriting user work.

For structured Loby actions:

- AI may propose app actions with `loby-action` JSON blocks.
- Supported proposed actions are `createSheet`, `insertText`, `insertImage`, and `saveExport`.
- Dedicated block names `loby-create-sheet`, `loby-insert-text`, `loby-insert-image`, and `loby-save-export` are also accepted.
- The app strips these protocol blocks from visible chat text and persists them as assistant action cards.
- Action cards start as proposals. They must not imply that a file, sheet, image, or export has already been created.
- Action cards are bound to the project and, for sheet insertion actions, the sheet that was active when AI generated the proposal. If the writer switches elsewhere before execution or retry, Loby should show a card warning, disable execution, offer a control to return to the recorded target when it still exists, and refuse to apply the action until the original target is active again.
- Action cards move through `proposed -> applying -> applied` on success, or `proposed/applying -> failed` on execution errors. Buttons are disabled while applying to avoid duplicate local writes.
- If Loby reloads while an action is `applying`, the loaded conversation normalizes that action to `failed` with a visible recovery message, so the user can inspect local state and retry instead of being stuck.
- Action cards should show enough preview information for confirmation: destination/title, image reference syntax, filename, content size, and a short content excerpt when applicable.
- Action cards validate required payload fields and basic path safety before execution. Missing `createSheet.title`, `insertText.text`, `insertImage.path`, or `saveExport.content`, unsupported insertion targets, unsafe image paths, and export filenames that contain directories should be shown as visible card warnings and should disable execution until AI returns a complete action.
- Applied action cards keep a short result message, such as the created sheet title, target document, inserted reference, or saved export path, so the chat history remains auditable.
- Reversible actions expose a chat-card undo control after execution: `insertText` and `insertImage` restore the pre-action sheet snapshot, while `createSheet` removes the sheet created by that action.
- `insertText` and `insertImage` undo must only restore the pre-action sheet snapshot when the current sheet body still matches the AI-applied body. If the user has edited after the AI action, show a failure message instead of overwriting user work.
- `createSheet` undo must only delete the AI-created sheet when its title, type, summary, body, and target word count still match the original action result. If the user has edited it, show a failure message instead of deleting user work.
- Execution buttons call Loby's existing app logic for sheet creation, image insertion, or export saving instead of letting the CLI write arbitrary files.
- `insertText` is for small, user-approved Markdown insertions such as transition paragraphs, outline fragments, intros, endings, and publishing notes. It should not be used for whole-document rewrites; use `loby-change` for reviewable body edits.
- `insertText` and `insertImage` both support `target: "cursor" | "selection" | "end" | "anchor"` and should preview the destination before execution; image insertion must honor `end` and `anchor` the same way text insertion does. `cursor` inserts at the current selection head without replacing selected text. A `selection` target must still have a non-empty editor selection at execution time, otherwise execution should fail visibly instead of silently inserting at the cursor. An `anchor` target can locate paragraphs from the start or end, headings, or exact text anchors, so instructions like "after the third paragraph from the end" do not require the writer to manually place the cursor.
- Before applying `insertText` or `insertImage` through the editor, Loby should verify that the live editor document still matches the target sheet body. If the editor is stale or belongs to a different document, fail the action visibly instead of writing into an outdated view.
- Failed insertion actions must not create sheet-version snapshots or mutate sheet bodies; snapshots are recorded only after the app has confirmed a valid insertion target and produced the new body.
- Failed action cards keep the error visible and remain retryable or dismissible, so transient local runtime failures do not strand a useful AI proposal.

For generated assets:

- Save generated prompts and outputs under project assets
- Track which sheet or project generated them
- Keep generated files inspectable outside the app
- In the current prototype, local AI notes can be saved as material sheets so they remain readable Markdown and can be reused through `@materials`.

## Codex Skill Integration

Loby should be designed to call local Codex skills.

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
- Selected-text context follows the live editor selection: when the editor selection is cleared, Loby clears the mounted selection context so stale selected text is not sent to AI.
- Context previews distinguish source semantics: document contexts are live references to the current local sheet body, while selection contexts are snapshots of the selected text at send time. Editing and resending a user message should preserve this distinction.
- Older saved messages may not have an explicit context source marker; Loby should infer document previews as live references and selection previews as snapshots.
- Context chips should label this distinction and explain source details on hover: context type, document title or selection excerpt, source project/group when available, and whether edited/resubmitted prompts use current document content or preserved selected text.
- Typed `$skill-name` references are added to the prompt context with skill name, description, and path.
- Selected or typed Codex skills are read on demand; their `SKILL.md` instructions are included in the prompt context for that turn when available.
- Each AI turn includes a Loby operating context that explains the local-first folder layout, current library/project/sheet paths, project resource folders, image-reference rules, and reviewable edit protocol.
- The operating context also includes action-selection rules and compact `loby-action` examples, so the CLI knows when to use `insertText`, `createSheet`, `insertImage`, `saveExport`, or `loby-change`.
- Each AI turn also includes a compact writing-structure context with project word progress, current sheet typed properties and word target, current group, and a grouped sheet list. This helps Codex decide whether to answer, edit the current sheet, insert a small block, create a material card, or create a publishing version without guessing the project structure.
- Each AI turn includes a compact current-document outline: word/paragraph/heading stats, selected-text size, and bounded Markdown heading list. This gives Codex structural awareness even when the full draft is not mounted, while avoiding accidental full-body prompt bloat.
- Prompt assembly should avoid duplicate full-body context. If the active sheet is already mounted as a document context, Loby should not also inject the same sheet through `current-sheet` mention context.
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

## Loby Operating Context

Loby should treat Codex CLI as the AI engine, not as an unconstrained file editor. Every turn should give the CLI enough app-specific context to behave like a Loby writing assistant:

- The active writing library path
- The current project or notes area
- The current Markdown file path
- The current sheet's project position, typed properties, word count, word target, group, and summary
- A compact grouped sheet list for the current project
- The current sheet's Markdown outline and document-shape stats
- The writing library's shared `assets/images` path plus the current project `assets`, `references`, and `exports` paths when available
- Rules for standard Markdown image references and optional Obsidian embeds
- A warning not to directly edit `.loby/` indexes, AI conversation files, caches, or trash
- The reviewable `loby-change` protocol for body edits
- The proposed `loby-action` protocol for new sheets, text insertion, image insertion, and exports

This context is intentionally app-owned instead of user-authored. Users should not need to remember where images are stored, how paths are formed, or how edit review works before asking for help.

Task-specific Codex skills remain separate. The operating context teaches Codex how Loby works; skills teach Codex how to perform a particular workflow such as headline generation, polishing, cover prompts, WeChat formatting, or Xiaohongshu repurposing.

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
