# Frontend Structure

Last updated: 2026-07-19

## Direction

The frontend started as a single prototype surface. As Loby grows, `App.tsx` should remain the app coordinator, not the home for every component, option list, and style block.

## Key Structure

This is an ownership map for the main boundaries, not an exhaustive file listing.

```text
src/
  App.tsx
  components/
    animate-ui/
      primitives/
    ui/
      button.tsx
    AiAssistantPanel.tsx
    AssistantApprovalDock.tsx
    AssistantComposer.tsx
    AssistantMessage.tsx
    AssistantModelSettingsMenu.tsx
    AssistantThread.tsx
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
    ProjectFieldManagerDialog.tsx
    ProjectDraftDialogs.tsx
    project-fields/
      ProjectFieldDefaultValueControl.tsx
      ProjectFieldDefinitionEditor.tsx
      ProjectFieldDialogs.tsx
      ProjectFieldListScreen.tsx
      ProjectFieldNewEditor.tsx
      ProjectFieldTypeIcon.tsx
      ProjectFieldViews.tsx
      types.ts
    ResourcePanel.tsx
    SheetRail.tsx
    SidebarGlassPanel.tsx
    UnusedImageCleanupDialog.tsx
    WechatThemeStudioDialogs.tsx
    WechatThemeStudioHeader.tsx
    WechatThemeStudioWindow.tsx
    WindowControls.tsx
    ZenModeControlMenu.tsx
    ZenModeWindow.tsx
  constants/
    projectAppearance.ts
    projectTemplates.ts
    themes.ts
  hooks/
    useAiAssistant.ts
    useChatConversations.ts
    useEditorImages.ts
    useLibraryPersistence.ts
    useLibraryTrash.ts
    useAppShortcuts.ts
    useAppTheme.ts
    useProjectExport.ts
    useProjectDraftDialogs.ts
    useProjectResources.ts
    useSheetActions.ts
    useSidebarContextMenu.ts
    useUnusedImageCleanup.ts
    useWindowChrome.ts
  lib/
    agentCommands.ts
    agentRunState.ts
    agentSettings.ts
    assistantContext.ts
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
    exportBrowser.ts
    formatters.ts
    importMarkdown.ts
    keyboardShortcuts.ts
    librarySaveCoordinator.ts
    libraryRefresh.ts
    publishing/
      wechatThemeConversation.ts
    themes.ts
    markdownTitle.ts
    markdownOutline.ts
    persistence.ts
    projectCreation.ts
    projectModel.ts
    workspaceSelection.ts
    resourceTexts.ts
    sheetSorting.ts
    text.ts
    textarea.ts
  styles.css
  styles/
    ai-action-image-preview.css
    ai-review.css
    ai-thread.css
    ai.css
    base.css
    controls.css
    editor.css
    left-workspace-glass.css
    library-rail.css
    publishing.css
    responsive.css
    settings-controls.css
    shadcn.css
    sheet-row.css
    shell.css
    themes.css
  types.ts
```

## Rules

- Put reusable UI surfaces in `src/components/`.
- Put feature state machines and cross-component UI behavior in `src/hooks/`.
- Put stable option lists, defaults, and visual configuration in `src/constants/`.
- Put non-UI business helpers in `src/lib/`.
- Put shared domain types in `src/types.ts`.
- Tailwind CSS v4 and shadcn/ui provide the replacement foundation for shared controls. Generated and locally customized shadcn primitives live in `src/components/ui/`; optional Animate UI sources live in `src/components/animate-ui/`.
- Keep Tailwind and shadcn theme setup isolated in `src/styles/shadcn.css`. Preflight is enabled; explicit exceptions must define the reset-sensitive styles they require.
- Migrate existing CSS one product surface at a time. Do not mix an unrelated legacy-to-Tailwind rewrite into ordinary feature work.
- Ordinary buttons use the default variants and sizes from `src/components/ui/button.tsx`; do not reproduce the removed legacy control dimensions in feature styles. The custom liquid-glass toolbar button, native window traffic lights, and invisible sidebar reveal hit area are the intentional raw-button exceptions.
- Keep `src/styles.css` as the import entrypoint only. Do not add feature rules there.
- Move feature-specific styles into `src/styles/*.css` when a component becomes large enough to maintain independently.
- AI fading header effects belong in `src/styles/ai.css`; rich Markdown/message animations belong in `src/styles/ai-thread.css`; persisted diff rendering belongs in `src/styles/ai-review.css`. Ordinary AI layout, composer controls, mounted context, pickers, and menus use Tailwind/shadcn directly.
- Left workspace glass distortion/material layers belong in `src/styles/left-workspace-glass.css`; ordinary project/navigation rows and menus use Tailwind/shadcn directly.
- Writing-library onboarding, switching, and the two-column library manager remain in focused `Library*` components and use Tailwind/shadcn directly.
- CodeMirror theme rules belong in `src/lib/editorTheme.ts`; Chinese phrases and Markdown syntax highlighting belong in `src/lib/editorLanguage.ts`; image preview widgets and image-line mutations belong in `src/lib/editorImagePreview.ts`; ordinary Markdown decoration plugins and typewriter scrolling stay in `src/lib/editorExtensions.ts`.
- Editor image import/preview/save-as behavior belongs in `src/hooks/useEditorImages.ts`, not in `App.tsx`.
- Local writing-library load/save/watch flows belong in `src/hooks/useLibraryPersistence.ts`, not in `App.tsx`.
- External-file refresh selection reconciliation belongs in `src/lib/libraryRefresh.ts`; keep filesystem event subscriptions and callback dispatch in `useLibraryPersistence`.
- Publishing channel contracts, provider API wrappers, Mowen payload conversion, and WeChat theme/rendering logic belong in `src/lib/publishing/`; publishing dialogs remain focused components under `src/components/`, while provider credentials belong in focused panels under `src/components/settings/`.
- The WeChat theme studio window owns async loading, theme persistence, preview, and assistant coordination. Its header/menu and dialogs stay in focused presentation components, while conversation transforms stay in `src/lib/publishing/wechatThemeConversation.ts`.
- Zen Mode editor, save queue, image behavior, and exit coordination stay in `ZenModeWindow`; its settings menu stays in `ZenModeControlMenu`.
- Global writing-library registry normalization belongs in `src/lib/libraryRegistry.ts`; onboarding, switching, and management surfaces belong in focused `Library*` components.
- Left-sidebar context menus, Finder reveal, project trash confirmation, and trash clearing behavior belong in `src/hooks/useSidebarContextMenu.ts`.
- Wastebasket listing, selection, restore, and permanent-delete behavior belongs in `src/hooks/useLibraryTrash.ts`.
- App-level shortcut dispatch belongs in `useAppShortcuts`; shortcut definitions, matching, labels, accessibility strings, and CodeMirror key conversion belong in `src/lib/keyboardShortcuts.ts`.
- App color-mode resolution belongs in `useAppTheme`; persisted theme normalization belongs in `src/lib/themes.ts`; theme metadata belongs in `src/constants/themes.ts`; application and editor palette tokens belong in `src/styles/themes.css`.
- The main window uses native macOS traffic lights with an overlay title bar. Custom controls for specialized secondary windows remain in `WindowControls`; main-window drag, title-bar double-click, and inspector resize/snap behavior belong in `src/hooks/useWindowChrome.ts`.
- Sheet sorting, manual order, and rail drag-order helpers belong in `src/lib/sheetSorting.ts`.
- Sheet-list context derivation belongs in `src/lib/sheetListModel.ts`; `useSheetList` memoizes that model and coordinates persisted sort/manual-order updates while `App.tsx` retains top-level state ownership.
- Workspace navigation transitions and selection-repair rules belong in `src/lib/workspaceSelection.ts`. `App.tsx` still owns the React state and applies the returned updates; the pure module covers project entry, smart-list context, note/project groups, cross-project sheet selection, and recovery after visible groups or sheets disappear.
- Project creation, imported-project construction, initial project selection, group creation, and group reorder helpers belong in `src/lib/projectCreation.ts`.
- `App.tsx` should coordinate state and compose major surfaces. It should not contain large modals, sidebars, option lists, templates, or domain helper collections when those have stable boundaries.
- File length is a review signal, not a hard rule. Split when a file mixes responsibilities, owns unrelated state machines, or makes routine edits require scanning distant sections.
- As a rough trigger, review ordinary components around 300 lines, complex feature panels/hooks around 500 lines, helper modules around 400 lines, and style files around 800 lines.
- Longer files are acceptable when they have one clear responsibility and splitting would mainly add indirection.
- Split by product responsibility, state ownership, or data-flow boundary, not by arbitrary line count.
- If a new feature adds a modal, inspector tab, toolbar, picker, sidebar, or reusable panel, start it as a dedicated component.
- If a new feature adds large defaults, palettes, templates, or command lists, put them in `src/constants/`.
- AI assistant state, conversations, local Codex runtime settings, and typed skill mentions belong in `src/hooks/useAiAssistant.ts` and AI components. Future provider adapters should preserve this boundary instead of moving those flows back into `App.tsx`.
- Shared AI presentation belongs in `AssistantPanelChrome`, `AssistantComposerShell`, `AssistantMessageSurface`, and `AssistantComposerToolbar`. Feature assistants should compose these primitives while keeping runtime and domain controllers separate.
- The main AI inspector owns one `--assistant-panel-gutter` token in `AiPanel`; its header, message viewport, approval dock, and composer must use that token instead of compensating for `InspectorPanel` with local positive or negative offsets.
- Large non-entry surfaces such as the AI assistant, settings, and field manager should remain lazy-loaded from `App.tsx` unless startup measurements justify a different boundary.
- Markdown import parsing is user-triggered; keep `importMarkdown.ts` and its YAML parser behind dynamic imports in both project-creation and existing-project import flows.
- AI mounted-context/document-preview helpers belong in `src/lib/assistantContext.ts`.
- AI run activity and approval-request merge helpers belong in `src/lib/agentRunState.ts`.
- AI composer UI belongs in `AssistantComposer`; composer filtering, mention parsing, and model option helpers belong in `src/lib/assistantComposer.ts`.
- AI message rendering and message edit actions belong in `AssistantMessage`.
- AI thread runtime wiring, message providers, review panel placement, approval dock, and composer placement belong in `AssistantThread`.
- AI approval request UI belongs in `AssistantApprovalDock`.
- AI model/reasoning/quick-mode menu behavior belongs in `AssistantModelSettingsMenu`. Do not reimplement ad hoc model dropdowns inside `AiPanel.tsx`.

## Next Refactor Targets

Completed:

- Library navigation rail is split into `LibraryRail`.
- Sheet/card list is split into `SheetRail`.
- Editor canvas and preview are split into `EditorCanvas`.
- Inspector tab wiring is split into `InspectorPanel`.
- AI assistant logic is split into `useAiAssistant`, `useChatConversations`, and `AiAssistantPanel`.
- AI mounted-context helpers and run-state merge helpers are split into `src/lib/assistantContext.ts` and `src/lib/agentRunState.ts`.
- AI composer UI is split into `AssistantComposer`.
- AI message rendering is split into `AssistantMessage`.
- AI thread runtime and approval UI are split into `AssistantThread` and `AssistantApprovalDock`.
- AI model settings menu is split into `AssistantModelSettingsMenu`.
- AI composer helper logic is split into `src/lib/assistantComposer.ts`.
- AI composer layout and controls are expressed with Tailwind/shadcn in the focused composer components.
- AI thread/process styles are split into `src/styles/ai-thread.css`.
- AI edit-review styles are split into `src/styles/ai-review.css`.
- Hidden older AI prototype styles were removed with their retired controls.
- Left workspace glass effects remain in a focused exception stylesheet; ordinary rail layout and menus use Tailwind/shadcn.
- CodeMirror theme, language highlighting, image preview, and ordinary Markdown decorations are split into focused editor helper files.
- Editor image workflow is split into `useEditorImages`.
- Window chrome behavior is split into `useWindowChrome` and `WindowControls`.
- Local writing-library load/watch and library-session behavior is split into `useLibraryPersistence`; debounced saves and flush ordering are isolated in the tested `LibrarySaveCoordinator`.
- External refresh selection reconciliation is isolated in the tested `libraryRefresh` helper, including removed-item recovery and a large-library case.
- Left-sidebar context menus and trash actions are split into `useSidebarContextMenu`.
- Wastebasket session state and restore/delete actions are split into `useLibraryTrash`.
- Sheet sorting and drag-order helpers are split into `src/lib/sheetSorting.ts`.
- Sheet-list title, source selection, filtering, project-title mapping, sort context, navigation index, and manual-order updates are split into the tested `sheetListModel` and `useSheetList` boundary.
- Project creation and project-group helper logic is split into `src/lib/projectCreation.ts`.
- Project field migration state stays in `ProjectFieldManagerDialog`; list, creation, definition, default-value, and type-icon presentation plus destructive-change confirmations are split under `components/project-fields/`. `ProjectFieldViews.tsx` remains a compatibility export boundary for the dialog coordinator.
- Project and group draft dialog rendering is deduplicated in lazy-loaded `ProjectDraftDialogs`; draft state and dialog transitions live in `useProjectDraftDialogs`, while project collections and workspace selection remain in `App.tsx`.
- Export state and orchestration are split into `useProjectExport`; pure content compilers live in `src/lib/export.ts`, while download, clipboard, and print-window effects live in `src/lib/exportBrowser.ts`.
- Project resource state and actions are split into `useProjectResources`.
- Sheet creation/import/duplicate/delete/drag actions are split into `useSheetActions`.
- WeChat theme studio header/menu/dialog presentation and conversation transforms are split from `WechatThemeStudioWindow` without moving its async controller state.
- Zen Mode settings presentation is split from `ZenModeWindow`; editor, IME-sensitive selection, save, image, and exit behavior remain together.

Reviewed And Kept Intact:

- `LibraryRail.tsx` is currently one sidebar surface with local drag handling and two closely related render branches. Split only if project rows, note groups, or drag behavior become independently reusable.
- `SheetRail.tsx` is currently one sheet-list surface with local sort/search/drag behavior. Split only if sheet rows or sort menu behavior need reuse outside the rail.
- `src/lib/editorImagePreview.ts` is a cohesive CodeMirror image-preview extension. Split only if parser helpers, DOM context menu, or decoration state become independently tested modules.

Next:

1. Continue splitting `App.tsx` only at a stable workspace-selection or library-session boundary. Sheet-list coordination is now isolated, but project/sheet selection repair still spans persistence and navigation and should move only after focused integration coverage.
2. Keep `WechatThemeStudioWindow` as the feature controller; move additional logic only when a tested persistence, preview, or assistant boundary becomes independent.
3. Review `AiPanel.tsx`, `AssistantComposer.tsx`, and future AI/editor surface files by responsibility before adding new behavior; split only when a real boundary is visible.

Each step should preserve behavior and pass `npm run build:web`.
