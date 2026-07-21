# Current Implementation

Last updated: 2026-07-20

## Implemented

Loby currently has a working pre-release desktop application with:

- Tauri 2 shell
- Rust command layer
- React + TypeScript frontend
- Frontend structure guidance in `docs/frontend-structure.md`; new UI surfaces should be split out of `App.tsx` once their boundaries are clear
- CodeMirror 6 Markdown editor
- Current-sheet Markdown preview mode using the same unified / remark / rehype renderer as export
- Markdown source styling for headings, emphasis, links, quotes, and inline code
- Blockquotes use a subtle note-block treatment with a soft background and left accent line
- Markdown syntax markers are hidden during normal writing and revealed when the cursor enters or the selection intersects the corresponding formatted content
- Loby's supported writing heading depth is H1-H4; H5/H6 remain plain Markdown text rather than structured headings
- Loby supports Obsidian-compatible inline highlight syntax, `==highlighted text==`, in the editor, preview, and HTML-oriented exports
- Central keyboard-shortcut catalog for common project, document, navigation, view, application, and Markdown formatting actions, with an in-app shortcut overview
- Application appearance supports light, dark, and automatic system-following modes; the choice is remembered locally and updates live when the operating system changes
- Editor appearance is independent from the application theme, with Loby, Graphite, Vue-inspired, and Lapis-inspired palettes that each include light and dark variants
- The editor area uses a simplified local toolbar with previous/next sheet navigation and a right-inspector collapse control
- The editor toolbar does not show the sheet title; sheet titles are derived from the first Markdown H1 in the sheet body
- Zen Mode uses two coordinated native windows: a simple-fullscreen background layer that covers the current desktop without creating a separate Space, plus a movable and resizable editor window with custom macOS-style controls, edge tiling, and maximize/restore behavior
- The Zen Mode editor writes the active sheet's existing Markdown file through the serialized Rust persistence path; the hidden main editor follows the existing file watcher and rebuilds once more when Zen Mode exits
- Zen Mode includes a generated offline background, custom background selection synchronized to the background window, procedural offline background sounds, a bottom-left settings menu, and safe exit that flushes pending Markdown writes before closing both Zen windows and restoring the main window
- The Zen Mode editor reuses the main editor's Markdown decorations, shortcuts, search, links, image previews/imports, slash commands, typography settings, and format-only selection toolbar while keeping its own immersive background and text colors
- Local project and sheet state
- Project creation
- Project groups between projects and sheets
- Library mode now includes a lightweight Notes section with a default Inbox for loose ideas and notes
- Selecting a Notes group updates the sheet list directly without entering a project workspace; Notes groups remain flat for now
- Library sidebar now has a library mode for project selection and a project mode for internal group navigation
- In project mode, the sidebar toolbar uses a return-to-project-list button beside the collapse button instead of a new-project action
- Entering a project selects the first visible group by default and the sheet list shows only that group's sheets
- After a project has been opened once, Loby remembers the last selected group per project and reopens that group next time
- Legacy system groups such as 正文 and 素材 are removed during normalization; their sheets are migrated into the first visible/default group
- New groups are created through the same dialog surface as new projects, including name, icon, and icon color
- The sheet list uses compact divider rows with title-and-body previews, contiguous multi-selection grouping, independent non-contiguous selections, and focus-aware active/inactive treatments
- Sheet rows support direct multi-selection, drag ordering, and cascading context-menu moves across Inbox, Notes, projects, and groups, with a full-location fallback and undo feedback
- Sheet-card context menus expose `中文排版`, which formats the selected Markdown document using five persisted writing preferences: whitespace cleanup, one-blank-line block spacing, Markdown marker normalization, Chinese/Latin spacing, and context-aware full-width punctuation. Formatting preserves frontmatter, code, URLs, image destinations, versions, dates, and file paths, stores a restorable pre-format snapshot, and reports the outcome through a compact top-center toast.
- Sheet list search is hidden by default behind a local filter button; closing the filter clears the keyword
- Project duplication with copied sheets and reset export history
- Project, document, and cleaned-image removal through a library-level trash with read-only preview, restore, permanent deletion, and clear-all actions
- An independent native `File > 清理未使用的图片…` action that scans shared `assets/images`, preserves references from live Markdown, retained sheet versions, and trashed Markdown, shows selectable thumbnail candidates in a large scrollable dialog, supports system Quick Look preview and Save As, revalidates the selection, and moves confirmed images into the Loby trash
- Independent project and document archiving with restoration; archive is a lifecycle state and no longer part of a writing-status flow
- Project templates for blank writing projects, WeChat long-form articles, article series, tutorials/guides, and visual articles, including typed metadata field presets
- Project field definitions for text, number, checkbox, date, URL, single-select, multi-select, and free-entry tags
- A document Information inspector for viewing and editing typed metadata values without editing YAML manually
- A project-specific two-level field manager with fixed system properties, draggable custom-property ordering, a focused detail editor for stable YAML keys, field types, defaults, select options, and option colors, plus explicit destructive-change confirmations
- Project field defaults apply automatically to new documents and to existing documents whose value is empty; existing values are never overwritten
- Field deletion can preserve or remove existing YAML values; option removal supports replacement or clearing; type changes report incompatible values and require a conversion choice
- App-owned metadata fields are locked while project-defined fields remain configurable
- Single-select and multi-select values use controlled project options; tags remain a locked system property instead of a user-created custom type
- Existing unknown YAML properties are retained during load, edit, and save
- Project writing brief fields for audience, thesis, tone, and publishing notes
- Legacy fixed status and target-platform values migrate into ordinary project-defined properties and no longer trigger automatic state changes
- Project search across title, description, writing brief, tags, and typed sheet metadata
- Project filters for all, recent 7 days, archived, and trash
- Project sorting by recent update, title, word count, or progress
- Sheet creation
- New body sheets start with an empty editor body and focus the writing area; sheet titles are not prefilled as H1 content
- Material sheet creation
- Markdown/text import into a new project or existing project with structured YAML frontmatter parsing, project-default merging, custom-field preservation, and inferred editable field types
- Sheet rename, reorder, duplication, and deletion
- Sheet type editing for body, chapter, outline, material, and published-version cards
- Sheet search across title, summary, type, typed properties, and body
- Typed property filtering for empty values, text matching, numeric/date comparisons and ranges, checkbox state, controlled options, and multi-select/tag any-or-all matching
- Sheet type filters for all, body, chapter, outline, material, and published-version cards
- Sheet duplication
- Sheet deletion through the library trash without creating a fallback document
- Sheet reordering controls
- Drag-and-drop sheet ordering with before/after drop indicators
- List-based document navigation with type and property filtering
- The left navigation rail and sheet list preserve their selections independently while showing whether navigation, list, or editor is currently active: active rail selections use system blue, while inactive navigation and sheet selections use theme-aware blue and neutral treatments with restrained dark-mode contrast; focusing the editor makes both rails inactive
- Word count
- Three-level writing goals: creation-day daily check-ins, project word/article targets, and per-article word targets
- Navigation heatmap popover for the recent 12 weeks plus a one-year detail dialog with streaks, monthly totals, project filtering, and day details
- Project goal progress in the library list; article-count goals use an explicit completed marker from the sheet context menu
- Editor and Zen Mode article progress rings, with near-goal pulse/shake feedback plus a one-time completion burst, toast, and sustained confetti controlled by Writing settings and reduced-motion preferences
- Character, paragraph, heading, and estimated reading time stats
- Target progress
- Project-level and sheet-level progress metrics in the inspector
- Current writing session metrics in the inspector, including start words, net gain, current words, and remaining target words
- Markdown heading outline for the current sheet
- Clickable outline navigation back into the editor
- History inspector tab with sheet version snapshots, save, compare, restore, and export history controls
- The document-function history tab can preview a snapshot read-only in the editor, clearly return to the current version, or restore the previewed snapshot after automatically backing up the current body
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
- Library-scoped chat persistence under `.loby/ai/conversations.json`
- Library-scoped custom AI quick prompts under `.loby/ai/quick-prompts.json`, with settings management, an empty-conversation launcher, and `/` composer lookup
- Library-scoped durable writing activity under `.loby/activity/writing-activity.json`
- Portable non-sensitive library preferences under `.loby/preferences.json`
- Library-scoped WeChat theme conversations, revisions, and preferences under `.loby/publishing/wechat-theme-state.json`
- Conversation auto-title from the first user prompt
- New and delete conversation controls
- `/` composer menu for local Codex skill selection
- `@` composer menu for mounting app documents and selected text
- Mounted current-document context is shown once in the chat flow; selected text is shown as a compact one-line context bubble
- Mounted selected-text context is synchronized with the live editor selection and is cleared when the selection becomes empty
- Context previews mark documents as live references and selections as send-time snapshots; editing and resending a user message restores documents from the current sheet body while preserving selection snapshot text
- Legacy context previews without an explicit source marker are interpreted by type: documents are live, selections are snapshots
- Selected Codex skills are read on demand so `SKILL.md` instructions can be included in that turn's prompt context
- Each AI turn includes Loby operating context with current library/project/sheet paths, resource folders, image-reference rules, and `.loby/` safety boundaries
- Each AI turn includes compact writing-structure context with project word progress, current sheet typed properties and word target, current group, and grouped sheet summaries
- Each AI turn includes compact current-document outline context with word/paragraph/heading stats, selected-text size, and a bounded Markdown heading list
- Prompt assembly removes duplicate current-sheet full-body injection when the active sheet is already mounted as a document context
- The Loby operating context includes action-selection rules and compact action examples so Codex can choose between `loby-change`, `insertText`, `createSheet`, `insertImage`, and `saveExport`
- User messages support hover copy and edit/resend actions
- AI-generated text edits can be applied directly to the active sheet after creating a pre-edit snapshot
- AI edit operation cards are persisted as structured chat message history
- AI edit cards can show or hide editor-side changes and undo applied edits
- If a running AI edit returns after the writer has switched sheets, Loby reopens the edited sheet so the applied edit card and diff controls are immediately visible
- If the target sheet changed after the AI request was sent, Loby cancels automatic application, records an error on the edit card instead of overwriting the writer's newer text, keeps unresolved errored edit cards visible across sheet switches, offers target-sheet return when applicable, and shows an ignore control rather than undo
- Editor-side AI changes show added text in blue, removed text as muted strikethrough, and unchanged text without marks
- AI `loby-action` blocks are parsed into persisted action proposal cards for creating sheets, inserting Markdown text, inserting image references, and saving exports; action cards keep the project/sheet target that was active when AI generated the proposal, users can execute or ignore each proposal, incomplete payloads, unsupported insertion targets, unsafe path-like values, and wrong active project/sheet targets show card warnings and cannot execute, text/image insertion cards preview and honor `cursor`/`selection`/`end`/`anchor`, `anchor` supports paragraph-from-start/end, heading, and exact-text insertion points, `cursor` inserts at the selection head without replacing selected text, `selection` execution requires a non-empty current editor selection, editor-backed insertions first verify that the live editor document still matches the target sheet body, failed insertion attempts leave sheet bodies and version history untouched, wrong-target cards can jump back to the recorded project or sheet when it still exists, in-progress actions are marked `applying` to prevent duplicate execution, applied actions keep a visible result message, created sheets and text/image insertions can be reverted from the card, undo refuses to overwrite or delete sheets that have been edited after the AI action, persisted stale `applying` actions recover to retryable failures on load, and failed actions keep the error visible
- Grouped model, reasoning, and quick-mode menu in the composer toolbar
- Codex CLI path override setting
- `$skill-name` typed context support through discovered local Codex skills
- Info, Resource, History, Export, and AI-generated note controls are temporarily hidden from the right sidebar
- Clean, fresh, white-first Apple-style interface refresh
- Clean, white-led Apple-style visual direction is now a product requirement for future UI work
- The visual system now covers the primary writing surfaces, menus, dialogs, toasts, themes, and focus states; release work should continue refining consistency without replacing the established white-first direction
- CSS design tokens now centralize surfaces, separators, text, accent, status colors, and lightweight control radii
- Codex CLI diagnostics in the AI settings panel
- Markdown, clean HTML, plain text, WeChat HTML, and Xiaohongshu draft export
- Export panel can copy Markdown, HTML, WeChat HTML, and Xiaohongshu draft output to the clipboard
- Editor toolbar publishing center for the active sheet, with WeChat, WordPress, and Mowen channels
- WeChat formatting dialog with mobile/desktop and light/dark previews, rich HTML copy, extensible built-in themes plus writing-library-local `.lobywechat` personal theme files, and optional Aliyun OSS upload that replaces local preview/copy image URLs without modifying source Markdown
- WordPress draft/public publishing through the REST API, including local image upload
- Mowen publishing through NoteAtom OpenAPI payloads, including local and remote image upload; the publish action is a single public-send confirmation that automatically uses project tags
- Publishing settings validate the Mowen API Key through its documented MCP connection before saving it, keeping credentials out of the per-document publish flow
- Publishing credentials use Loby's cross-platform Rust secret store in the current user's platform app-config directory instead of OS-specific Keychain-only storage, writing-library files, or browser storage; saved password fields restore an explicit persisted state without returning the secret value to the renderer
- Export panel can open a printable HTML preview so the system print dialog can save a PDF
- Export panel can save Markdown, HTML, plain text, WeChat HTML, and Xiaohongshu draft files into the project's local `exports/` folder
- Markdown and HTML saves scan local image references and create an export bundle with copied `assets/images` when selected sheets use writing-library images
- Export bundles validate every relative destination and reject portable case-insensitive collisions before creating files, so unsafe or conflicting entries cannot leave a partial bundle
- Clean HTML export dynamically loads unified / remark / rehype with GFM support
- Export renderers understand common Markdown syntax used by the toolbar, including links, inline code, task lists, quotes, and dividers
- Material cards are excluded from publish exports by default while remaining available to AI context
- Export panel can select which publishable sheets enter the compiled output
- Export panel can reorder selected sheets for the compiled output without changing the project sheet order
- Export panel can save the selected compilation back into the project as a `发布版本` sheet
- Export panel includes automatic publish-readiness checks and a persistent project publishing task checklist
- History inspector records and shows recent saved export history with local file paths
- Browser localStorage fallback
- The product interface presents one local writing folder; projects are the highest user-facing organization level
- Tauri local persistence retains its global registry of multiple named writing roots for backward compatibility and recovery, without exposing creation or switching in the normal interface
- The default first-run folder is `Documents/LobyLibrary`, or a user-selected parent plus folder name
- A newly created writing folder contains the editable `落笔指南/待整理/欢迎使用落笔.md` starter document; an existing empty folder opened during onboarding remains empty
- The left rail ends with a direct Settings entry. File & Storage settings show the current path and provide Finder reveal and on-disk move actions without exposing library counts or management
- Toolbar control for saving and opening the current sheet's local Markdown file in the system file viewer
- Tauri now writes user-authored Markdown into visible local-first folders: `notes/<group>/<note>.md` and `projects/<project>/<group>/<sheet>.md`
- Tauri can scan the visible notes/projects folder tree first, then use JSON metadata as a secondary index/cache
- Tauri writes readable per-project `project.toml` metadata for external tools and AI context
- Tauri writes project `README.md` files and sheet Markdown with `lobySheet` frontmatter for external readability
- Tauri creates one writing-library-level `assets/images` directory plus per-project `assets`, `references`, and `exports` directories
- Pasted, dropped, toolbar-inserted, imported, and generated images share the writing-library `assets/images` directory; moving a sheet rewrites its relative Markdown image paths without moving image files
- The export panel reports selected-sheet local image dependencies, external images, and missing local references before saving
- Tauri save cleanup removes only stale managed Markdown files that contain `lobySheet: true`

## Frontend Ownership

`App.tsx` is now the application coordinator. It composes the main rails, editor, inspector, dialog, and top-level project state, but feature-specific logic should stay outside the entry file.

Current split:

- AI state, local Codex runtime settings, typed skill mentions, and conversations live in `src/hooks/useAiAssistant.ts` and `src/hooks/useChatConversations.ts`.
- AI text-edit review state, editor-side diff visibility, accepted-change application, and rollback live in `src/hooks/useAiChangeSetReview.ts`, with reusable change-set transforms in `src/lib/aiChangeSets.ts`.
- AI mounted-context/document-preview helpers live in `src/lib/assistantContext.ts`; run activity and approval-request merge helpers live in `src/lib/agentRunState.ts`.
- AI action parsing, preview fields, button state, payload validation, conversation recovery, and undo safety guards live in `src/lib/aiActions.ts`, `src/lib/aiActionPreview.ts`, `src/lib/aiActionState.ts`, `src/lib/aiActionValidation.ts`, `src/lib/chatConversationNormalization.ts`, and `src/lib/aiActionEffects.ts`.
- AI action execution, including applying proposals, rejecting proposals, recording action effects, and reverting reversible actions, lives in `src/hooks/useAiActionExecutor.ts`.
- AI composer UI lives in `src/components/AssistantComposer.tsx`, with filtering, mention parsing, and model option helpers in `src/lib/assistantComposer.ts`.
- AI message rendering and user-message edit actions live in `src/components/AssistantMessage.tsx`.
- User-message context chip rendering lives in `src/components/AssistantMessageContextPreview.tsx`.
- AI action proposal card rendering lives in `src/components/AssistantActionCards.tsx`.
- AI thread runtime wiring and approval UI live in `src/components/AssistantThread.tsx` and `src/components/AssistantApprovalDock.tsx`.
- AI model, reasoning, and quick-mode menu behavior lives in `src/components/AssistantModelSettingsMenu.tsx`.
- Editor image import, insertion, preview resolution, open, and save-as behavior lives in `src/hooks/useEditorImages.ts`.
- Window controls, window drag/maximize, and inspector resize/snap behavior live in `src/components/WindowControls.tsx` and `src/hooks/useWindowChrome.ts`.
- Local writing-library load/watch, external file refresh, loaded conversations, and library switching behavior live in `src/hooks/useLibraryPersistence.ts`; its production `LibrarySaveCoordinator` owns debounced latest-wins saves and the flush-before-switch/close boundary, while `src/lib/libraryRefresh.ts` owns tested selection recovery after external changes.
- Left-sidebar context menus, archive/restore actions, project/document trash confirmation, and trash clearing behavior live in `src/hooks/useSidebarContextMenu.ts`.
- Writing-goal normalization and statistics live in `src/lib/writingGoals.ts`; durable check-in hydration lives in `src/hooks/useWritingActivity.ts`, and threshold-crossing celebration behavior lives in `src/hooks/useArticleGoalCelebration.ts`.
- Markdown document formatting and its protected-range rules live in `src/lib/markdownFormatting.ts`; the writing settings only expose five user-facing groups while syntax-specific safety rules remain automatic.
- File-storage settings own the current writing-folder path, Finder reveal, and on-disk move presentation. The retained registry and path-switching behavior stay in the persistence layer rather than the normal interface.
- Sheet sorting and rail drag-order helpers live in `src/lib/sheetSorting.ts`.
- Project creation, imported-project construction, initial project selection, group creation, and group reorder helpers live in `src/lib/projectCreation.ts`.
- Export selection, save orchestration, publish-version creation, and export history opening live in `src/hooks/useProjectExport.ts`; pure content compilation lives in `src/lib/export.ts`, while download, clipboard, and print-window effects live in `src/lib/exportBrowser.ts`.
- Project resource listing, import, preview, opening, and resource selection live in `src/hooks/useProjectResources.ts`.
- Sheet creation, material cards, Markdown import into a project, duplication, moving, and drag ordering live in `src/hooks/useSheetActions.ts`.
- Typed property normalization, migration, defaults, context formatting, and filtering live in `src/lib/documentProperties.ts`.
- The Information inspector, project field manager, typed property filter, and trash preview live in focused components under `src/components/`. Project field migration stays in `ProjectFieldManagerDialog`, while its list, creation, definition, default-value, and type-icon presentation is split under `src/components/project-fields/`.
- Project and group draft dialog rendering is deduplicated in lazy-loaded `ProjectDraftDialogs`; draft state, edit/create mode, target project, and submit/close transitions live in `useProjectDraftDialogs`, while project collections remain coordinated by `App.tsx`.
- Pure project, smart-list, note-group, project-group, sheet-selection, and invalid-selection repair rules live in `src/lib/workspaceSelection.ts`; `src/hooks/useWorkspaceNavigation.ts` applies those rules to React state and rail/filter actions, while `App.tsx` retains top-level state ownership.
- The WeChat theme studio keeps loading, preview, persistence, and assistant state in `WechatThemeStudioWindow`; header/menu and dialog presentation live in `WechatThemeStudioHeader` and `WechatThemeStudioDialogs`, with conversation transforms in `src/lib/publishing/wechatThemeConversation.ts`.
- Zen Mode keeps editor, image, save-queue, selection, and exit behavior in `ZenModeWindow`; its settings menu is the focused `ZenModeControlMenu` presentation component.
- Sheet version snapshot construction lives in `src/lib/sheetVersions.ts`.
- Major UI surfaces live under `src/components/`; stable palettes/templates live under `src/constants/`; non-UI helpers live under `src/lib/`.
- AI fading header effects live in `src/styles/ai.css`; rich Markdown/message animations live in `src/styles/ai-thread.css`; persisted diff rendering lives in `src/styles/ai-review.css`. Ordinary AI layout and controls use Tailwind/shadcn directly.
- Retired AI prototype styles have been removed rather than kept as a hidden legacy layer.
- Left workspace glass effects live in `src/styles/left-workspace-glass.css`; ordinary project/navigation rows and rail menus use Tailwind/shadcn directly.
- CodeMirror theme, language highlighting, image preview widgets, and ordinary Markdown decorations are split across `src/lib/editorTheme.ts`, `src/lib/editorLanguage.ts`, `src/lib/editorImagePreview.ts`, and `src/lib/editorExtensions.ts`.

Focused frontend regression coverage includes malformed-frontmatter recovery, custom-metadata filtering and fallback, deterministic large-batch Markdown import IDs, project-field rendering states, rendered workspace-navigation wiring and repair, project export ordering and transforms, portable/WeChat/XHS compilation, and browser export effects.

## Native Ownership

- `src-tauri/src/lib.rs` is the native module root; `src-tauri/src/app.rs` owns Tauri composition, managed state, menus, and command registration.
- Serializable Rust models now live in `src-tauri/src/models.rs`.
- Path, filename, extension, and path-safety helpers live in `src-tauri/src/fs_paths.rs`.
- Markdown/frontmatter rendering and parsing helpers live in `src-tauri/src/markdown.rs`.
- Folder-first scans preserve indexed/project metadata order, sort newly discovered projects, groups, and sheets deterministically, and ignore hidden Markdown files. Typed `project.toml` recovery lives in `src-tauri/src/library/project_metadata.rs` so generated metadata and sheet order survive a missing library index.
- Export file and bundle writing lives in `src-tauri/src/resources/exports.rs`; other resource listing, import, image, and guarded text commands remain in `src-tauri/src/resources.rs`.
- Native workflows live in focused `agent`, `library`, publishing, resource, watcher, project-path, system-path, and zen-mode modules.
- Durable heatmap events and celebration markers are read and written by `src-tauri/src/writing_activity_store.rs` under the active library's hidden `.loby/activity/` directory.
- Cross-domain native integration tests live in `src-tauri/src/tests.rs`; focused unit tests stay with their owning modules.

## Engineering Gates

- `npm run check` runs formatting checks, TypeScript, ESLint, Vitest, web build, Rust check, Rust tests, and Clippy.
- GitHub-hosted Actions are intentionally disabled for this private repository; the tracked Git hooks, local `npm run check`, reviewed PR diff, and pull-request checklist form the merge gate.
- `npm run audit:npm` is the explicit network-dependent npm vulnerability check and remains separate from the deterministic local gate.
- Vitest coverage includes AI context and action helpers, agent run state, project creation/normalization, export and publishing compilation, image handling, external-library refresh recovery, and WeChat theme behavior.
- Rust coverage includes Markdown rendering/parsing, folder-first persistence and metadata recovery, deterministic library scanning, validated export bundles, Codex runtime message construction, and filesystem path safety.
- Node and Rust versions are pinned in `.node-version` and `rust-toolchain.toml`.

## Local Persistence

Target architecture: see [Local-First File Architecture](./local-first-file-architecture.md). The durable writing source should become the visible folder tree and Markdown files, with app indexes and databases treated as rebuildable support state.

In the Tauri runtime, Loby writes to the current writing folder. The default first-run folder is:

```text
~/Documents/LobyLibrary/
  assets/
    images/
  inbox/
  notes/
    随手记/
  projects/
    落笔指南/
      README.md
      project.toml
      待整理/
        欢迎使用落笔.md
    <project-title>/
      README.md
      project.toml
      待整理/
        <sheet-title>.md
      <group-title>/
        <sheet-title>.md
      assets/
      references/
      exports/
  .loby/
    library.json
    preferences.json
    activity/
      writing-activity.json
    ai/
      conversations.json
      quick-prompts.json
    publishing/
      wechat-theme-state.json
```

In browser-only development, it falls back to localStorage and still uses seed content for quick UI testing when no browser projects exist.

The device-local global library registry still remembers multiple named folders and the active path across launches so existing installations remain compatible and recovery tooling can reopen prior roots. This capability is intentionally not exposed as a normal content-organization feature: users organize writing with projects, while File & Storage settings operate only on the current writing folder. Each root keeps its portable last project and sheet selection in `.loby/preferences.json`. A new folder receives the editable `落笔指南` starter project once; opening an existing empty folder during onboarding does not recreate it.

This is now a folder-first persistence shape. `.loby/library.json` remains a pragmatic app index/cache for the prototype, but user-authored writing content is written to visible Markdown files under notes and project group folders. For external readability, each project also writes a `README.md` and a `project.toml` metadata summary with project field definitions. Each sheet Markdown file stores ordinary user-facing typed properties at the top level and keeps Loby-owned identifiers, type, targets, timestamps, and archive state under a small `loby` namespace. Each project has stable `assets`, `references`, and `exports` directories.

When loading sheet Markdown, Loby parses YAML frontmatter as typed document properties and exposes only the Markdown body in the editor. Unknown YAML values are preserved when the document is saved. In Tauri, Loby rewrites the library index under `.loby/`, project `README.md`, project `project.toml`, and managed sheet Markdown files. It removes stale managed `.md` files only when they contain `lobySheet: true`, so unrelated Markdown files in the same folders are not deleted.

## AI State

The AI panel is currently a right-sidebar writing assistant with a local Codex runtime and editor-aware context.

Current behavior:

- Chat messages are shown in the right sidebar.
- The right sidebar no longer exposes separate Info, Resource, History, and Export tabs.
- The AI surface is AI-only for now, so the first runtime can stay focused and testable.
- Multiple local chat conversations can be created and switched.
- The first user prompt automatically renames a new/default conversation.
- Current conversation can be deleted, with a fallback conversation created when deleting the last one.
- Conversations persist in the active Loby library at `.loby/ai/conversations.json`.
- Browser development mode still falls back to localStorage.
- Codex is the only user-facing provider while its app-server session, approval, model, skill, and usage integrations mature.
- The Codex CLI can use an automatically resolved path or a user-configured path.
- Claude and hosted API providers are deferred until their interaction model and feature-parity requirements are designed; the current settings UI does not expose a provider switch.
- The `/` menu selects local Codex skills and mounts them into the composer.
- The `@` menu mounts app documents and selected text into the composer.
- Mounted current-document context is shown once in the chat flow; selected text context is shown as a compact one-line bubble above the user message.
- Selected text context is cleared when the live editor selection is cleared, preventing stale selections from being reused in later AI prompts.
- Message context chips label documents as live and selections as snapshots, with hover text explaining the context type, source title/group, and whether an edited/resubmitted prompt will use current document content or preserved selected text.
- Existing chat history without `contentMode` is backward compatible; document chips still display as live and selection chips as snapshots.
- Local Codex skills are scanned. Mounted skills and `$skill-name` typed in chat are added to the prompt context with name, description, path, and on-demand `SKILL.md` instructions when available.
- Each AI turn includes Loby operating context: active writing library, current project/sheet paths, project resource paths, image-reference rules, `.loby/` safety boundaries, and the reviewable edit protocol.
- The prompt context also includes current writing structure: project progress, current sheet metadata, current group, and a bounded grouped sheet list, so the assistant can reason about where a requested edit or new sheet belongs.
- The prompt context includes current document outline stats and bounded Markdown headings, giving the assistant structural awareness without automatically mounting the full draft body.
- When the current sheet is already mounted as a document, the `current-sheet` mention block is filtered out so the same full draft is not sent twice.
- Model, reasoning, and quick-mode settings are grouped into one compact composer menu.
- The main and WeChat-theme assistants share panel-header, thread-viewport, message-surface, composer-shell, and toolbar presentation components. Their runtime controllers remain separate because the main assistant owns streaming, approvals, actions, and document context while the theme assistant validates and applies complete theme manifests.
- The WeChat-theme assistant uses the shared Codex stream runner, so its persisted assistant messages show the same live reasoning, read-only tool activity, usage, cancellation, and conversation-history controls as the main assistant without exposing the raw theme manifest as chat content. Each theme keeps multiple named conversations with an independent resumable Codex thread and remembers the active conversation. Theme runs use an autonomous read-only policy that permits inspection of user-provided local references and never pauses for step-by-step approvals; all writes still flow only through the validated theme manifest.
- The composer accepts pasted, dropped, or file-picked PNG, JPEG, WebP, and GIF attachments. It shows removable thumbnails and sends the images as native Codex image input alongside the text prompt.
- Chat images are session-only. Tauri keeps the CLI-required files in a process-scoped system temporary directory, removes that directory when Loby exits, and strips image metadata and temporary paths from persisted conversations.
- A Codex CLI path can be set in the AI panel when automatic PATH detection fails.
- The CLI test checks the resolved Codex path and basic commands, then shows stdout/stderr per step.
- A successful CLI probe writes the resolved executable path back to the Codex CLI path field and persists it across launches; paths inside `ChatGPT.app` use the ChatGPT-bundled Codex CLI.
- Sending a chat message calls a Tauri command.
- The active frontend runtime uses the Codex app-server integration. Experimental backend provider plumbing remains internal and is not exposed as a supported setting.
- Current project, writing brief, sheet, selected text, sheet body, and recent chat are sent as context.
- CLI stdout is streamed into an AI message.
- Run-process details are grouped into a collapsible thinking/process block.
- CLI stderr or invocation errors are shown as system/process details.
- Token usage is captured when Codex reports it, but the prototype does not show a context-window ring because the CLI does not currently provide a reliable max/remaining context value.
- When AI returns a text edit for the active sheet, Loby creates a pre-edit snapshot, applies the edit, persists a compact operation card in the chat message, and shows detailed changes inside the editor.
- Operation cards can show changes, hide changes, or undo the applied edit; undo refuses to overwrite the sheet when the writer has continued editing after the AI-applied body.
- When AI returns `loby-action`, `loby-create-sheet`, `loby-insert-text`, `loby-insert-image`, or `loby-save-export` blocks, Loby strips the raw protocol JSON from visible text and stores action proposal cards on the assistant message.
- Action cards show preview fields and short content/reference excerpts before execution.
- Action cards can execute through Loby app logic: create a sheet in the current project/group, insert an image reference into the current editor, or save an export file into the current project's `exports` folder. They can also be ignored.
- Reversible action cards use explicit effect guards before undo: inserted text/images only restore when the current body still matches the AI-applied body, and AI-created sheets are deleted only when their recorded title, type, summary, body, and target word count still match.
- Fixture tests cover Codex-style replies that combine visible assistant text, `loby-change`, and `loby-action` blocks.

Current local machine note:

- The `codex` command is present at `/Users/geekmai/.nvm/versions/node/v24.15.0/bin/codex`.
- In this environment, that npm wrapper currently fails because its internal platform binary is missing. Loby surfaces this as a chat error. A native Codex CLI install or fixed npm install is required for live replies.
- The diagnostics panel is expected to surface this exact `ENOENT` failure until the local CLI install is repaired.

Next step: keep hardening the local CLI runtime and split remaining mixed-responsibility frontend modules only when a tested ownership boundary is visible, without changing the writing workflow.

## Validation Run

Validated on 2026-07-20:

```bash
npm run check
```

The maintenance gate passes with 111 frontend test files / 465 tests, 94 Rust tests, warning-free ESLint and Clippy, and a production entry chunk of 1268.0 KiB raw / 422.8 KiB gzip.

Desktop packaging targets produced by `npm run build`:

```text
src-tauri/target/release/bundle/macos/Loby.app
src-tauri/target/release/bundle/dmg/Loby_0.1.0_aarch64.dmg
```

The production entry chunk is guarded by `npm run check:bundle`; import-only YAML parsing, export-only Markdown processors, and large settings/AI surfaces remain in async chunks.

## Near-term Gaps

- Direct Codex app-server skill execution
- Claudian-style app-server runtime
- App-server-backed conversation resume
- Rich previews for binary assets and PDFs beyond temporary image attachments
- App-server-backed real skill execution instead of task-file handoff
- Migration display for older conversations that predate persisted AI operation cards
- Failure-path coverage for image centralization when a source becomes unreadable between scan and transfer
- A tested library-session boundary before moving any more persistence or library-switch coordination out of `App.tsx`
- Long document and Chinese IME stress test
- Windows verification
- App icon and visual polish
