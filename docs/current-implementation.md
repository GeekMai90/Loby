# Current Implementation

Last updated: 2026-07-04

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
- Codex chat panel in the inspector
- Tauri command bridge for `codex exec`
- Local diff review panel
- Multi-conversation chat tabs
- Library-scoped chat persistence under `.nibva/ai/conversations.json`
- Conversation auto-title from the first user prompt
- Local conversation fork, compact, and delete controls
- Plan Mode toggle
- Slash command shortcuts for writing workflows
- Mention context controls for current sheet, selection, project outline, and all sheets
- `@materials` mention context for project material cards
- `@cards` picker for adding specific project sheets to AI context
- `@resources` picker for adding selected local asset/reference/export paths and supported text snippets to AI context
- Resource inspector tab for browsing, importing, previewing, opening, and selecting project resources
- Codex CLI path override setting
- Codex inline edit request that returns into the diff review panel
- `$skill` context support through discovered local Codex skills
- Local sheet summary suggestions in the AI panel
- Local image-idea suggestions for covers, body images, and generation prompts
- Read-only AI notes can be saved back into the project as material sheets
- Clean, fresh, white-first Apple-style interface refresh
- Clean, white-led Apple-style visual direction is now a product requirement for future UI work
- The current prototype styling is not the final visual bar; the app should be redesigned toward a cleaner, lighter, more Apple-like white interface before release
- CSS design tokens now centralize surfaces, separators, text, accent, status colors, and lightweight control radii
- Codex CLI diagnostics in the AI settings panel
- Markdown, clean HTML, plain text, WeChat HTML, and Xiaohongshu draft export
- Export panel can copy Markdown, HTML, WeChat HTML, and Xiaohongshu draft output to the clipboard
- Export panel can open a printable HTML preview so the system print dialog can save a PDF
- Export panel can save Markdown, HTML, plain text, WeChat HTML, and Xiaohongshu draft files into the project's local `exports/` folder
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
- Tauri creates per-project `assets`, `references`, and `exports` directories
- Tauri save cleanup removes only stale managed Markdown files that contain `nibvaSheet: true`

## Frontend Ownership

`App.tsx` is now the application coordinator. It composes the main rails, editor, inspector, dialog, and top-level project state, but feature-specific logic should stay outside the entry file.

Current split:

- AI state, Codex CLI calls, local suggestions, skill tasks, and conversations live in `src/hooks/useAiAssistant.ts` and `src/hooks/useChatConversations.ts`.
- Export selection, compilation, copy/download/save actions, publish-version creation, and export history opening live in `src/hooks/useProjectExport.ts`.
- Project resource listing, import, preview, opening, and resource selection live in `src/hooks/useProjectResources.ts`.
- Sheet creation, material cards, Markdown import into a project, AI note saving, duplication, deletion, moving, status updates, and drag ordering live in `src/hooks/useSheetActions.ts`.
- Major UI surfaces live under `src/components/`; stable palettes/templates live under `src/constants/`; non-UI helpers live under `src/lib/`.

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

The AI panel now has a Claudian-style chat surface.

Current behavior:

- Chat messages are shown in the right inspector.
- Multiple local chat conversations can be created and switched.
- The first user prompt automatically renames a new/default conversation.
- Current conversation can be forked into a copy.
- Current conversation can be compacted locally into a system summary plus the latest messages.
- Current conversation can be deleted, with a fallback conversation created when deleting the last one.
- Conversations persist in the active Nibva library at `.nibva/ai/conversations.json`.
- Browser development mode still falls back to localStorage.
- Plan Mode changes the instruction sent to Codex: plan first, do not directly rewrite.
- Slash commands expand into writing prompts: `/polish`, `/outline`, `/title`, `/cover`, `/wechat`, `/xhs`, `/compile`.
- Mention chips control what context is sent: `@sheet`, `@selection`, `@project`, `@materials`, `@all`.
- `@materials` sends only material cards to Codex, useful for references, excerpts, facts, image directions, and research notes.
- `@cards` lets the user select specific project sheets so Codex can compare or reference a controlled subset without sending every sheet.
- The resource inspector and AI panel share project resource paths for `assets`, `references`, and `exports`, and these paths are included in Codex context when available.
- `@resources` lists files from `assets`, `references`, and `exports`; selected resources are shared between the resource inspector and AI panel, sent as paths, and supported text files also include guarded content snippets.
- Selected text resources such as Markdown, txt, HTML, JSON, CSV, YAML, and code files are read into Codex context with a guarded per-file size limit; non-text resources remain path-only.
- Text resources can be previewed in the resource inspector or AI panel with the same guarded reader before being sent to Codex.
- Local files can be imported into a project's `assets/` or `references/` folder from the resource inspector or AI resource picker.
- Project resource folders and resource files can be opened from the resource inspector or AI resource picker through the system file viewer.
- Local Codex skills are scanned and displayed as `$skill` chips. Selected skills, or `$skill-name` typed in chat, are added to the prompt context with name, description, and path.
- Selected `$skill` chips or typed `$skill-name` references can write transparent local task JSON files under `ai-tasks/`. Each task includes action text, current project and sheet ids/titles/paths, target platform, selected text, current sheet body, selected `@cards`, and selected `@resources`.
- A Codex CLI path can be set in the AI panel when automatic PATH detection fails.
- "测试 Codex CLI" checks the resolved CLI path, `--version`, `exec --help`, and `app-server --help`, then shows stdout/stderr per step.
- Sending a chat message calls a Tauri command.
- The Tauri command resolves the local `codex` CLI and runs `codex exec`.
- Current project, writing brief, sheet, selected text, sheet body, and recent chat are sent as context.
- CLI stdout is shown as a Codex message.
- CLI stderr or invocation errors are shown as system messages.
- "润色当前选区" creates a deterministic local suggestion.
- If no editor selection exists, it suggests changes for the whole sheet.
- Suggestions are shown in a line diff review panel.
- Text suggestions can be accepted or rejected.
- "Codex 改写选区" calls the CLI and routes the returned text into the same diff review flow.
- "生成标题备选" creates local title candidates.
- "总结当前稿件" creates a local read-only note with metadata, structure, and next-step writing gaps.
- "生成配图构思" creates a local read-only note with cover directions, body-image positions, and a generation prompt.
- Read-only AI notes can be saved as `素材` sheets, then reused by the AI panel through `@materials`.

Current local machine note:

- The `codex` command is present at `/Users/geekmai/.nvm/versions/node/v24.15.0/bin/codex`.
- In this environment, that npm wrapper currently fails because its internal platform binary is missing. Nibva surfaces this as a chat error. A native Codex CLI install or fixed npm install is required for live replies.
- The diagnostics panel is expected to surface this exact `ENOENT` failure until the local CLI install is repaired.

Next step: replace one-shot `codex exec` with a Claudian-style long-lived `codex app-server --listen stdio://` runtime.

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
- Long document and Chinese IME stress test
- Windows verification
- App icon and visual polish
