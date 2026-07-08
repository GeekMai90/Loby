# Frontend Structure

Last updated: 2026-07-08

## Direction

The frontend started as a single prototype surface. As Nibva grows, `App.tsx` should remain the app coordinator, not the home for every component, option list, and style block.

## Current Structure

```text
src/
  App.tsx
  components/
    AiAssistantPanel.tsx
    AssistantComposer.tsx
    AssistantMessage.tsx
    AssistantModelSettingsMenu.tsx
    AiPanel.tsx
    EditorToolbar.tsx
    EditorCanvas.tsx
    EmptyLibraryState.tsx
    ExportPanel.tsx
    HistoryPanel.tsx
    InfoPanel.tsx
    InspectorPanel.tsx
    LibraryRail.tsx
    NewProjectDialog.tsx
    ProgressBar.tsx
    ResourcePanel.tsx
    SheetRail.tsx
    SidebarGlassPanel.tsx
    WindowControls.tsx
  constants/
    projectAppearance.ts
    projectTemplates.ts
  hooks/
    useAiAssistant.ts
    useChatConversations.ts
    useEditorImages.ts
    useLibraryPersistence.ts
    useProjectExport.ts
    useProjectResources.ts
    useSheetActions.ts
    useSidebarContextMenu.ts
    useWindowChrome.ts
  lib/
    agentCommands.ts
    agentSettings.ts
    assistantComposer.ts
    codex.ts
    codexContext.ts
    dates.ts
    conversations.ts
    diff.ts
    editorImagePreview.ts
    editorExtensions.ts
    editorLanguage.ts
    editorMarkdown.ts
    editorTheme.ts
    export.ts
    formatters.ts
    importMarkdown.ts
    markdownTitle.ts
    markdownOutline.ts
    persistence.ts
    projectModel.ts
    resourceTexts.ts
    sheetSorting.ts
    text.ts
    textarea.ts
  styles.css
  styles/
    ai-composer.css
    ai-legacy.css
    ai-review.css
    ai-thread.css
    ai.css
    base.css
    controls.css
    dialogs.css
    editor.css
    empty-state.css
    left-workspace-glass.css
    left-workspace-menus.css
    left-workspace.css
    panels.css
    responsive.css
    sheet-rail.css
    shell.css
  types.ts
```

## Rules

- Put reusable UI surfaces in `src/components/`.
- Put feature state machines and cross-component UI behavior in `src/hooks/`.
- Put stable option lists, defaults, and visual configuration in `src/constants/`.
- Put non-UI business helpers in `src/lib/`.
- Put shared domain types in `src/types.ts`.
- Keep `src/styles.css` as the import entrypoint only. Do not add feature rules there.
- Move feature-specific styles into `src/styles/*.css` when a component becomes large enough to maintain independently.
- AI chat shell and top-level menu styles belong in `src/styles/ai.css`; message/run-process styles belong in `src/styles/ai-thread.css`; edit-review and diff styles belong in `src/styles/ai-review.css`; AI input box, mounted context chips, skill/document pickers, and model menu styles belong in `src/styles/ai-composer.css`.
- Hidden older AI prototype controls stay isolated in `src/styles/ai-legacy.css` until they are restored or deleted.
- Left workspace glass/surface layout belongs in `src/styles/left-workspace-glass.css`; project/navigation row styles stay in `src/styles/left-workspace.css`; rail sort/context menus belong in `src/styles/left-workspace-menus.css`.
- CodeMirror theme rules belong in `src/lib/editorTheme.ts`; Chinese phrases and Markdown syntax highlighting belong in `src/lib/editorLanguage.ts`; image preview widgets and image-line mutations belong in `src/lib/editorImagePreview.ts`; ordinary Markdown decoration plugins and typewriter scrolling stay in `src/lib/editorExtensions.ts`.
- Editor image import/preview/save-as behavior belongs in `src/hooks/useEditorImages.ts`, not in `App.tsx`.
- Local writing-library load/save/watch flows belong in `src/hooks/useLibraryPersistence.ts`, not in `App.tsx`.
- Left-sidebar context menus, Finder reveal, project trash confirmation, and trash clearing behavior belong in `src/hooks/useSidebarContextMenu.ts`.
- Window controls, drag, maximize, and inspector resize/snap behavior belong in `WindowControls` and `src/hooks/useWindowChrome.ts`.
- Sheet sorting, manual order, and rail drag-order helpers belong in `src/lib/sheetSorting.ts`.
- `App.tsx` should coordinate state and compose major surfaces. It should not contain large modals, sidebars, option lists, templates, or domain helper collections.
- Prefer keeping ordinary component files under roughly 250 lines. Complex feature panels can be larger, but should stay under roughly 400 lines and must be split before 450 lines.
- Prefer keeping helper files under roughly 300 lines. Split before a helper file passes 400 lines.
- If a new feature adds a modal, inspector tab, toolbar, picker, sidebar, or reusable panel, start it as a dedicated component.
- If a new feature adds large defaults, palettes, templates, or command lists, put them in `src/constants/`.
- AI assistant state, conversations, local Codex/Claude CLI calls, provider settings, and typed skill mentions belong in `src/hooks/useAiAssistant.ts` and AI components. Do not put those flows back into `App.tsx`.
- AI composer UI belongs in `AssistantComposer`; composer filtering, mention parsing, and model option helpers belong in `src/lib/assistantComposer.ts`.
- AI message rendering and message edit actions belong in `AssistantMessage`.
- AI model/reasoning/quick-mode menu behavior belongs in `AssistantModelSettingsMenu`. Do not reimplement ad hoc model dropdowns inside `AiPanel.tsx`.

## Next Refactor Targets

Completed:

- Library navigation rail is split into `LibraryRail`.
- Sheet/card list is split into `SheetRail`.
- Editor canvas and preview are split into `EditorCanvas`.
- Inspector tab wiring is split into `InspectorPanel`.
- AI assistant logic is split into `useAiAssistant`, `useChatConversations`, and `AiAssistantPanel`.
- AI composer UI is split into `AssistantComposer`.
- AI message rendering is split into `AssistantMessage`.
- AI model settings menu is split into `AssistantModelSettingsMenu`.
- AI composer helper logic is split into `src/lib/assistantComposer.ts`.
- AI composer-specific styles are split into `src/styles/ai-composer.css`.
- AI thread/process styles are split into `src/styles/ai-thread.css`.
- AI edit-review styles are split into `src/styles/ai-review.css`.
- Hidden older AI prototype styles are isolated in `src/styles/ai-legacy.css`.
- Left workspace glass shell and rail menus are split into focused style files.
- CodeMirror theme, language highlighting, image preview, and ordinary Markdown decorations are split into focused editor helper files.
- Editor image workflow is split into `useEditorImages`.
- Window chrome behavior is split into `useWindowChrome` and `WindowControls`.
- Local writing-library load/save/watch behavior is split into `useLibraryPersistence`.
- Left-sidebar context menus and trash actions are split into `useSidebarContextMenu`.
- Sheet sorting and drag-order helpers are split into `src/lib/sheetSorting.ts`.
- Export state and actions are split into `useProjectExport`.
- Project resource state and actions are split into `useProjectResources`.
- Sheet creation/import/duplicate/delete/drag actions are split into `useSheetActions`.

Next:

1. Continue splitting `App.tsx`: project/group mutation flows should move into focused hooks.
2. Decide whether hidden older AI prototype controls should return as product features or be removed with `src/styles/ai-legacy.css`.
3. Keep `AiPanel.tsx`, `AssistantComposer.tsx`, and future AI/editor surface files under the line limits before adding new behavior.

Each step should preserve behavior and pass `npm run build:web`.
