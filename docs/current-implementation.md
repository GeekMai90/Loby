# Current Implementation

Last updated: 2026-07-08

## Implemented

Nibva currently has a working desktop prototype with:

- Tauri 2 shell
- Rust command layer
- React + TypeScript frontend
- Frontend structure guidance in `docs/frontend-structure.md`; new UI surfaces should be split out of `App.tsx` once their boundaries are clear
- CodeMirror 6 Markdown editor
- Current-sheet Markdown preview mode using the same unified / remark / rehype renderer as export
- Markdown source styling for headings, emphasis, links, quotes, and inline code
- Blockquotes use a subtle note-block treatment with a soft background and left accent line
- Markdown heading markers stay visible but are rendered as muted left-side markers so heading text aligns with body text
- Nibva's supported writing heading depth is H1-H4; H5/H6 remain plain Markdown text rather than structured headings
- Nibva supports a custom inline highlight syntax, `::highlighted text::`, in the editor, preview, and HTML-oriented exports
- Markdown editor shortcuts for common formatting actions
- The editor area uses a simplified local toolbar with previous/next sheet navigation and a right-inspector collapse control
- The editor toolbar does not show the sheet title; sheet titles are derived from the first Markdown H1 in the sheet body
- Local project and sheet state
- Project creation
- Project groups between projects and sheets
- Library mode now includes a lightweight Notes section with a default Inbox for loose ideas and notes
- Selecting a Notes group updates the sheet list directly without entering a project workspace; Notes groups remain flat for now
- Library sidebar now has a library mode for project selection and a project mode for internal group navigation
- In project mode, the sidebar toolbar uses a return-to-project-list button beside the collapse button instead of a new-project action
- Entering a project selects the first visible group by default and the sheet list shows only that group's sheets
- After a project has been opened once, Nibva remembers the last selected group per project and reopens that group next time
- Legacy system groups such as 正文 and 素材 are removed during normalization; their sheets are migrated into the first visible/default group
- New groups are created through the same dialog surface as new projects, including name, icon, and icon color
- Sheet list cards use a compact title-and-body-preview layout without status or word count metadata
- Sheet list search is hidden by default behind a local filter button; closing the filter clears the keyword
- Project duplication with copied sheets and reset export history
- Safe project removal from the active library list while preserving the local project folder on disk
- Project templates for blank writing projects, WeChat long-form articles, article series, tutorials/guides, and visual articles
- Project metadata editing for status, target platform, target words, tags, description, and writing brief
- Project writing brief fields for audience, thesis, tone, and publishing notes
- Project workflow actions for advancing status, marking待发布, marking已发布, marking已归档, and restoring completed work to修改中
- Marking a project待发布, 已发布, or 已归档 also syncs non-material sheet statuses
- Current sheet workflow actions for advancing status, marking待发布, marking已发布, marking已归档 through the status flow, and restoring completed sheets to修改中
- Project search across title, description, writing brief, tags, and sheet metadata
- Project filters for active, today, published, archived, and tag-filtered work
- Project sorting by recent update, title, word count, or progress
- Sheet creation
- New body sheets start with an empty editor body and focus the writing area; sheet titles are not prefilled as H1 content
- Material sheet creation
- Markdown/text file import into a new project or new body sheets by copying selected file contents
- Sheet rename, reorder, duplication, and deletion
- Sheet type editing for body, chapter, outline, material, and published-version cards
- Sheet search across title, summary, type, status, and body
- Sheet type filters for all, body, chapter, outline, material, and published-version cards
- Sheet duplication
- Sheet deletion with a fallback blank sheet when deleting the last card
- Sheet reordering controls
- Drag-and-drop sheet ordering with before/after drop indicators
- List, status-grouped card, and outline sheet views
- Status-grouped card view can advance or restore sheet workflow state directly from each card
- Word count
- Character, paragraph, heading, and estimated reading time stats
- Target progress
- Project-level and sheet-level progress metrics in the inspector
- Current writing session metrics in the inspector, including start words, net gain, current words, and remaining target words
- Markdown heading outline for the current sheet
- Clickable outline navigation back into the editor
- History inspector tab with sheet version snapshots, save, compare, restore, and export history controls
- Each sheet keeps up to 20 local snapshots in project metadata
- Focus mode
- Independent collapse controls for the project rail, sheet rail, and inspector without leaving blank grid columns
- Layout preferences are remembered locally for project rail, sheet rail, inspector, focus mode, and typewriter mode
- Last active project and writing sheet are remembered locally and restored after launch when still present
- Typewriter mode that keeps the active cursor area centered while typing
- Inspector panel
- AI chat panel in the inspector
- Tauri command bridge for `codex exec` and `claude --print`
- Multi-conversation chat tabs
- Library-scoped chat persistence under `.nibva/ai/conversations.json`
- Conversation auto-title from the first user prompt
- New and delete conversation controls
- Plan Mode toggle
- `/` composer menu for local Codex skill selection
- `@` composer menu for mounting app documents and selected text
- Mounted current-document context is shown once in the chat flow; selected text is shown as a compact one-line context bubble
- User messages support hover copy and edit/resend actions
- AI-generated text edits can be applied directly to the active sheet after creating a pre-edit snapshot
- AI edit operation cards are persisted as structured chat message history
- AI edit cards can show or hide editor-side changes and undo applied edits
- Editor-side AI changes show added text in blue, removed text as muted strikethrough, and unchanged text without marks
- Grouped model, reasoning, and quick-mode menu in the composer toolbar
- Codex/Claude CLI path override setting
- `$skill-name` typed context support through discovered local Codex skills
- Info, Resource, History, Export, and AI-generated note controls are temporarily hidden from the right sidebar
- Clean, fresh, white-first Apple-style interface refresh
- Clean, white-led Apple-style visual direction is now a product requirement for future UI work
- The current prototype styling is not the final visual bar; the app should be redesigned toward a cleaner, lighter, more Apple-like white interface before release
- CSS design tokens now centralize surfaces, separators, text, accent, status colors, and lightweight control radii
- Codex CLI diagnostics in the AI settings panel
- Markdown, clean HTML, plain text, WeChat HTML, and Xiaohongshu draft export
- Export panel can copy Markdown, HTML, WeChat HTML, and Xiaohongshu draft output to the clipboard
- Export panel can open a printable HTML preview so the system print dialog can save a PDF
- Export panel can save Markdown, HTML, plain text, WeChat HTML, and Xiaohongshu draft files into the project's local `exports/` folder
- Markdown and HTML saves scan local image references and create an export bundle with copied `assets/images` when selected sheets use project images
- Clean HTML export dynamically loads unified / remark / rehype with GFM support
- Export renderers understand common Markdown syntax used by the toolbar, including links, inline code, task lists, quotes, and dividers
- Material cards are excluded from publish exports by default while remaining available to AI context
- Export panel can select which publishable sheets enter the compiled output
- Export panel can reorder selected sheets for the compiled output without changing the project sheet order
- Export panel can save the selected compilation back into the project as a `发布版本` sheet
- Export panel includes automatic publish-readiness checks and a persistent project publishing task checklist
- History inspector records and shows recent saved export history with local file paths
- Browser localStorage fallback
- Tauri local persistence to the remembered writing library path, defaulting to `Documents/NibvaLibrary`
- Empty desktop writing libraries remain empty and show a first-project creation surface instead of being auto-filled with sample content
- Toolbar controls for switching the active writing library and opening it in the system file viewer
- Toolbar control for saving and opening the current sheet's local Markdown file in the system file viewer
- Tauri now writes user-authored Markdown into visible local-first folders: `notes/<group>/<note>.md` and `projects/<project>/<group>/<sheet>.md`
- Tauri can scan the visible notes/projects folder tree first, then use JSON metadata as a secondary index/cache
- Tauri writes readable per-project `project.toml` metadata for external tools and AI context
- Tauri writes project `README.md` files and sheet Markdown with `nibvaSheet` frontmatter for external readability
- Tauri creates per-project `assets`, `assets/images`, `references`, and `exports` directories
- Pasted, dropped, and toolbar-inserted editor images are saved into `assets/images` and inserted with either standard Markdown image syntax or optional Obsidian embed syntax
- The export panel reports selected-sheet local image dependencies, external images, and missing local references before saving
- Tauri save cleanup removes only stale managed Markdown files that contain `nibvaSheet: true`

## Frontend Ownership

`App.tsx` is now the application coordinator. It composes the main rails, editor, inspector, dialog, and top-level project state, but feature-specific logic should stay outside the entry file.

Current split:

- AI state, local Codex/Claude CLI calls, provider settings, typed skill mentions, and conversations live in `src/hooks/useAiAssistant.ts` and `src/hooks/useChatConversations.ts`.
- AI model, reasoning, and quick-mode menu behavior lives in `src/components/AssistantModelSettingsMenu.tsx`.
- Export selection, compilation, copy/download/save actions, publish-version creation, and export history opening live in `src/hooks/useProjectExport.ts`.
- Project resource listing, import, preview, opening, and resource selection live in `src/hooks/useProjectResources.ts`.
- Sheet creation, material cards, Markdown import into a project, duplication, deletion, moving, status updates, and drag ordering live in `src/hooks/useSheetActions.ts`.
- Major UI surfaces live under `src/components/`; stable palettes/templates live under `src/constants/`; non-UI helpers live under `src/lib/`.
- AI chat shell, message, run-process, and review styles live in `src/styles/ai.css`; AI composer, mounted context, skill/document menus, and model menu styles live in `src/styles/ai-composer.css`.

## Local Persistence

Target architecture: see [Local-First File Architecture](./local-first-file-architecture.md). The durable writing source should become the visible folder tree and Markdown files, with app indexes and databases treated as rebuildable support state.

In the Tauri runtime, Nibva writes to the active writing library. The first-run default is:

```text
~/Documents/NibvaLibrary/
  notes/
    收件箱/
      一个想法.md
  projects/
    <project-title>/
      README.md
      project.toml
      <group-title>/
        <sheet-title>.md
      assets/
      references/
      exports/
  .nibva/
    library.json
    ai/
      conversations.json
```

In browser-only development, it falls back to localStorage and still uses seed content for quick UI testing when no browser projects exist.

The active desktop writing library can be switched from the toolbar. Nibva remembers the chosen path in local app settings and restores it on next launch. Empty folders are valid writing libraries and show a first-project creation surface until the user creates a project.

This is now a folder-first persistence shape. `.nibva/library.json` remains a pragmatic app index/cache for the prototype, but user-authored writing content is written to visible Markdown files under notes and project group folders. For external readability, each project also writes a `README.md`, a `project.toml` metadata summary, each sheet Markdown file includes Nibva-owned YAML frontmatter such as `nibvaSheet`, `id`, `title`, `groupId`, `type`, `status`, `targetWords`, `summary`, and `updatedAt`, and each project has stable `assets`, `references`, and `exports` directories.

When loading sheet Markdown, Nibva strips only frontmatter that contains `nibvaSheet: true`; user-authored Markdown frontmatter is left intact. When saving in Tauri, Nibva rewrites the library index under `.nibva/`, project `README.md`, project `project.toml`, and managed sheet Markdown files. It removes stale managed `.md` files only when they contain `nibvaSheet: true`, so user-authored Markdown files in the same folders are not deleted.

## AI State

The AI panel is currently a right-sidebar writing assistant with local CLI providers and editor-aware context.

Current behavior:

- Chat messages are shown in the right sidebar.
- The right sidebar no longer exposes separate Info, Resource, History, and Export tabs.
- The AI surface is AI-only for now, so the first runtime can stay focused and testable.
- Multiple local chat conversations can be created and switched.
- The first user prompt automatically renames a new/default conversation.
- Current conversation can be deleted, with a fallback conversation created when deleting the last one.
- Conversations persist in the active Nibva library at `.nibva/ai/conversations.json`.
- Browser development mode still falls back to localStorage.
- Provider can be switched between Codex CLI and Claude CLI.
- Each provider can use an automatically resolved CLI path or a user-configured path.
- Plan Mode changes the instruction sent to the provider: plan first, do not directly rewrite.
- The `/` menu selects local Codex skills and mounts them into the composer.
- The `@` menu mounts app documents and selected text into the composer.
- Mounted current-document context is shown once in the chat flow; selected text context is shown as a compact one-line bubble above the user message.
- Local Codex skills are scanned. Mounted skills and `$skill-name` typed in chat are added to the prompt context with name, description, and path.
- Model, reasoning, and quick-mode settings are grouped into one compact composer menu.
- A Codex or Claude CLI path can be set in the AI panel when automatic PATH detection fails.
- The CLI test checks the resolved path and basic provider commands, then shows stdout/stderr per step.
- Sending a chat message calls a Tauri command.
- The Tauri command resolves the selected provider and runs either `codex exec` or `claude --print`.
- Current project, writing brief, sheet, selected text, sheet body, and recent chat are sent as context.
- CLI stdout is streamed into an AI message.
- Run-process details are grouped into a collapsible thinking/process block.
- CLI stderr or invocation errors are shown as system/process details.
- Token usage is captured when Codex reports it, but the prototype does not show a context-window ring because the CLI does not currently provide a reliable max/remaining context value.
- When AI returns a text edit for the active sheet, Nibva creates a pre-edit snapshot, applies the edit, persists a compact operation card in the chat message, and shows detailed changes inside the editor.
- Operation cards can show changes, hide changes, or undo the applied edit.

Current local machine note:

- The `codex` command is present at `/Users/geekmai/.nvm/versions/node/v24.15.0/bin/codex`.
- In this environment, that npm wrapper currently fails because its internal platform binary is missing. Nibva surfaces this as a chat error. A native Codex CLI install or fixed npm install is required for live replies.
- The diagnostics panel is expected to surface this exact `ENOENT` failure until the local CLI install is repaired.

Next step: keep hardening the local CLI runtime and split the remaining oversized AI/editor modules without changing the visible workflow.

## Validation Run

Validated on 2026-07-04:

```bash
npm run build:web
cargo check
npm run build
```

Generated desktop bundles:

```text
src-tauri/target/release/bundle/macos/Nibva.app
src-tauri/target/release/bundle/dmg/Nibva_0.1.0_aarch64.dmg
```

Known warning:

- Vite reports the main JS chunk is larger than 500 kB. This is acceptable for the prototype and mostly comes from editor dependencies. The clean HTML export pipeline is already loaded dynamically; later we can code-split editor-related modules if needed.

## Near-term Gaps

- Direct Codex app-server skill execution
- Claudian-style app-server runtime
- App-server-backed conversation resume
- Rich previews for binary assets and PDFs beyond path-only context
- App-server-backed real skill execution instead of task-file handoff
- Migration display for older conversations that predate persisted AI operation cards
- Further splitting of `App.tsx`, `AiPanel.tsx`, `editorExtensions.ts`, and remaining AI styles
- Long document and Chinese IME stress test
- Windows verification
- App icon and visual polish
