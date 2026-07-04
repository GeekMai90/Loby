# Frontend Structure

Last updated: 2026-07-04

## Direction

The frontend started as a single prototype surface. As Nibva grows, `App.tsx` should remain the app coordinator, not the home for every component, option list, and style block.

## Current Structure

```text
src/
  App.tsx
  components/
    AiAssistantPanel.tsx
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
    ai/
      AiResourceContext.tsx
      AiReviewTools.tsx
  constants/
    projectAppearance.ts
    projectTemplates.ts
  hooks/
    useAiAssistant.ts
    useChatConversations.ts
    useProjectExport.ts
    useProjectResources.ts
    useSheetActions.ts
  lib/
    agentCommands.ts
    agentSettings.ts
    codex.ts
    codexContext.ts
    dates.ts
    conversations.ts
    diff.ts
    editorExtensions.ts
    editorMarkdown.ts
    export.ts
    formatters.ts
    importMarkdown.ts
    localSuggestions.ts
    markdownTitle.ts
    markdownOutline.ts
    persistence.ts
    projectModel.ts
    resourceTexts.ts
    text.ts
  styles.css
  styles/
    dialogs.css
  types.ts
```

## Rules

- Put reusable UI surfaces in `src/components/`.
- Put feature state machines and cross-component UI behavior in `src/hooks/`.
- Put stable option lists, defaults, and visual configuration in `src/constants/`.
- Put non-UI business helpers in `src/lib/`.
- Put shared domain types in `src/types.ts`.
- Keep global tokens and layout primitives in `src/styles.css`.
- Move feature-specific styles into `src/styles/*.css` when a component becomes large enough to maintain independently.
- `App.tsx` should coordinate state and compose major surfaces. It should not contain large modals, sidebars, option lists, templates, or domain helper collections.
- Prefer keeping ordinary component files under roughly 250 lines. Complex feature panels can be larger, but should stay under roughly 400 lines and must be split before 450 lines.
- Prefer keeping helper files under roughly 300 lines. Split before a helper file passes 400 lines.
- If a new feature adds a modal, inspector tab, toolbar, picker, sidebar, or reusable panel, start it as a dedicated component.
- If a new feature adds large defaults, palettes, templates, or command lists, put them in `src/constants/`.
- AI assistant state, conversations, Codex CLI calls, skill task creation, and AI suggestions belong in `src/hooks/useAiAssistant.ts` and AI components. Do not put those flows back into `App.tsx`.

## Next Refactor Targets

Completed:

- Library navigation rail is split into `LibraryRail`.
- Sheet/card list is split into `SheetRail`.
- Editor canvas and preview are split into `EditorCanvas`.
- Inspector tab wiring is split into `InspectorPanel`.
- AI assistant logic is split into `useAiAssistant`, `useChatConversations`, and `AiAssistantPanel`.
- Export state and actions are split into `useProjectExport`.
- Project resource state and actions are split into `useProjectResources`.
- Sheet creation/import/duplicate/delete/drag actions are split into `useSheetActions`.

Next:

1. Split project/library mutation flows into a workspace hook.
2. Split remaining library switching and project mutation flows when their state dependencies are clear.
3. Consider splitting `styles.css` by surface once layout stabilizes.

Each step should preserve behavior and pass `npm run build:web`.
