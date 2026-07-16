# WeChat Theme Studio

Status: approved for implementation on 2026-07-16.

## Goal

Build a dedicated WeChat theme studio where a writer can use AI to create and refine a reusable personal publishing theme, see every change immediately against real Markdown articles, and later format articles without invoking AI again.

The studio is a theme-design surface, not a second writing editor and not an advanced CSS editor.

## Product Decisions

- The studio opens in one dedicated Tauri window. It is not a modal inside the main writing window.
- The selected visual direction is a balanced three-column layout that reuses Nibva's existing application shell, sheet-list patterns, publishing preview, AI thread, composer, model controls, buttons, menus, and theme tokens.
- The left rail switches between themes and read-only preview articles.
- The center is the primary live WeChat article preview.
- The right rail is a focused WeChat theme assistant built from the existing AI assistant UI.
- AI changes the active personal theme directly. Valid changes refresh the center preview and persist automatically.
- There is no per-property or per-proposal accept/reject flow. The user can ask AI to change the result again or use undo/redo.
- Built-in themes are immutable. The first AI edit of a built-in theme creates a personal copy automatically.
- Personal themes are reusable across writing libraries and projects.
- A theme is selected for publishing through `使用此主题`; saving and selecting are separate concepts because theme edits already auto-save.
- The first release does not expose arbitrary CSS, a DOM inspector, direct HTML editing, theme sharing, or a theme marketplace.

## Primary User Flow

1. The writer opens WeChat publishing for the active sheet.
2. The writer chooses `管理主题`, or opens a theme and chooses `用 AI 调整`.
3. Nibva opens or focuses the singleton theme-studio window.
4. The studio starts with the current publishing theme and active sheet.
5. The writer selects the built-in theme test article or any real article from the active writing library.
6. The writer describes a desired visual change in the theme assistant.
7. The assistant returns a validated structured theme update.
8. Nibva applies the update to the personal theme, refreshes the preview, saves the theme, and records one undo revision.
9. The writer continues the conversation, selects another article to test, or uses undo/redo.
10. The writer chooses `使用此主题` to make it the current WeChat publishing theme and return to publishing.

## Window And Layout

### Window behavior

- Tauri window label: `wechat-theme-studio`.
- Opening the studio while it already exists focuses the existing window instead of creating another.
- The main Nibva window remains visible and usable.
- The initial size should target approximately `1440 x 900`, with a minimum size that preserves usable preview and AI rails.
- Browser development mode renders the same surface through a query-based root route.
- The theme studio never edits article Markdown. Preview articles are read-only inputs.
- Closing the window is immediate when idle because valid theme changes are auto-saved. Closing while an AI request is running asks whether to cancel the request.

### Top bar

- Reuse Nibva window controls and toolbar primitives.
- Show the active theme name as an inline-editable title.
- Show `正在修改…`, `正在保存…`, `已保存`, or `保存失败`.
- Provide undo and redo.
- Provide `版本记录` when automatic revision history is available.
- Provide the primary `使用此主题` action.

### Left rail

The left rail uses a `主题 / 文章` segmented control.

`主题` contains:

- immutable built-in themes;
- personal themes;
- current-theme indication;
- a compact `新建主题` action;
- personal-theme rename, duplicate, and delete actions through the existing menu pattern.

`文章` contains:

- a pinned `主题测试稿`;
- the active project and writing-library article hierarchy;
- existing sheet-list search and selected-row behavior;
- read-only article switching that does not reset the theme or assistant conversation.

### Center preview

- Reuse the current mobile-width WeChat preview and renderer.
- Render both the built-in theme test article and real selected articles.
- Keep preview rendering isolated from the application theme.
- Provide preview width and compatibility status controls only when they materially help validation.
- A later iteration may allow selecting semantic targets such as article header, title, H2, quote, image, or footer. It must not expose raw DOM or CSS names.

### Right assistant

- Reuse the current AI thread, message rendering, composer, streaming state, model settings, cancellation, and retry visuals.
- Use one theme-specific conversation per personal theme.
- Do not expose ordinary writing actions, document-change review, arbitrary skill selection, or article editing.
- Automatically mount the bundled WeChat theme-design skill.
- Keep assistant responses concise after a successful change, for example `已调整二级标题，预览已更新。`

## Theme Model

Built-in and personal themes use one versioned manifest. The manifest must express theme behavior without requiring users or AI to write executable code.

```ts
interface WechatThemeManifest {
  schemaVersion: 1;
  id: string;
  kind: "built-in" | "personal";
  name: string;
  description: string;
  baseThemeId?: string;
  swatches: [string, string, string];
  tokens: WechatThemeTokens;
  components: {
    hero: WechatHeroStyle;
    heading: WechatHeadingStyle;
    quote: WechatQuoteStyle;
    footer: WechatFooterStyle;
  };
  brand: {
    author: string;
    footerText: string;
    showDate: boolean;
    showTags: boolean;
    showReadingStats: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
```

The implementation may refine field names, but it must preserve these boundaries:

- stable metadata and schema version;
- visual tokens;
- typed structural strategies;
- editable brand/footer behavior;
- no arbitrary executable JavaScript or unsanitized HTML;
- deterministic compilation to inline-styled WeChat HTML.

## Theme Storage

- Built-in manifests ship with the application and are never mutated.
- Personal manifests live in Nibva's platform-specific application-data theme directory so they are available across writing libraries.
- Browser development uses a namespaced local-storage fallback.
- Theme content is not secret and must not share the publishing credential store.
- Each valid AI change saves the personal theme using serialized latest-wins persistence.
- Each successful change stores one bounded revision containing the previous manifest, new manifest, timestamp, and user-facing summary.
- Undo and redo operate on whole AI revisions, not individual token fields.
- Duplicating a theme copies only its manifest. It starts a new assistant conversation and revision history.
- Deleting a theme never deletes articles or publishing output. If it was current, Nibva falls back to a built-in theme.

## AI Skill And Protocol

The theme assistant requires both a bundled skill and an application protocol.

### Bundled skill

The bundled `nibva-wechat-theme-designer` skill teaches the agent:

- Nibva's theme manifest and supported strategies;
- Chinese long-form typography principles;
- WeChat inline-style compatibility limits;
- how to interpret semantic targets such as title, H2, quote, image, and footer;
- that it may change only the theme, never article Markdown or unrelated files;
- that every applied result must be returned through the theme-change protocol.

The studio mounts this skill automatically. The user does not type a skill name or choose it from the general skill picker.

### Structured response

The assistant returns one hidden structured block alongside its natural-language response:

````text
```nibva-wechat-theme-change
{
  "baseRevision": 4,
  "summary": "降低二级标题的视觉重量",
  "theme": { "...": "complete next manifest" }
}
```
````

- The response carries a complete next manifest rather than an open-ended CSS fragment.
- `baseRevision` prevents a late response from overwriting a newer theme.
- Nibva validates and normalizes the manifest before applying it.
- Invalid, stale, unsupported, or unsafe results do not change the theme or preview.
- A successful result updates the theme directly, auto-saves it, records one revision, and refreshes the preview.
- The AI never writes theme files directly. Application persistence owns all writes.

## State And Data Boundaries

- `WechatThemeStudioWindow` composes the three rails and top bar.
- `useWechatThemeStudio` owns active theme, selected preview article, window-session state, auto-save status, revisions, and undo/redo.
- `useWechatThemeAssistant` owns the focused conversation and streaming request lifecycle.
- Theme parsing, normalization, validation, revision helpers, and renderer input belong under `src/lib/publishing/`.
- Theme options and the built-in test article belong under `src/constants/` when they become stable data.
- Native window creation and personal-theme filesystem persistence belong in focused Rust publishing/theme modules, not `app.rs` beyond command registration.
- `App.tsx` only opens the studio and refreshes the publishing-theme catalog after studio events.
- The existing generic AI components should be made configurable only where that reduces duplication; do not force theme behavior into ordinary writing-assistant state.

## Migration From The Current Renderer

The current Obsidian-derived implementation is a compatibility reference, not an architecture constraint.

1. Represent `深蓝书房` and `奶油纸页` as manifests using the new model.
2. Preserve current rendered behavior with focused renderer tests before adding user themes.
3. Move hard-coded brand text and display switches into manifest fields.
4. Keep one deterministic renderer for active-sheet formatting and later migrate compiled multi-sheet WeChat output to the same engine.
5. Keep the existing publishing dialog as the fast daily workflow. Add theme management entrypoints without turning it into the studio.

## Delivery Plan

### Phase 1: theme foundation

- Introduce the versioned manifest, built-in manifests, normalization, validation, and renderer tests.
- Preserve current theme output and clipboard behavior.
- Add a deterministic built-in theme test article.

Exit criteria:

- Existing themes render through the manifest registry.
- Renderer coverage includes headings, paragraphs, quotes, lists, links, emphasis, code, tables, images, dividers, hero, and footer.
- `npm run check` passes.

### Phase 2: personal themes and native window

- Add personal-theme persistence and browser fallback.
- Add singleton Tauri studio window and root routing.
- Add theme catalog, duplication, rename, deletion, current-theme selection, auto-save, and revision history.

Exit criteria:

- Personal themes survive restart and are shared across writing libraries.
- Built-in themes cannot be mutated.
- Window open/focus/close behavior is stable.

### Phase 3: three-column studio

- Implement the selected balanced layout using existing Nibva components.
- Add theme/article left rail, live preview, top-bar state, undo/redo, and `使用此主题`.
- Keep articles read-only and refresh preview when the selected article changes.

Exit criteria:

- The studio can create, select, rename, duplicate, and delete personal themes before the AI workflow is connected.
- The same theme can be tested against the theme fixture and multiple real articles.

### Phase 4: focused theme assistant

- Add the bundled skill and theme-specific operating context.
- Add theme-specific conversation persistence.
- Parse, validate, apply, auto-save, and revise direct AI theme changes.
- Reuse current AI presentation and runtime controls without exposing writing actions.

Exit criteria:

- A natural-language request changes a personal theme and refreshes the preview directly.
- A stale or invalid AI response cannot overwrite the active theme.
- Undo restores the complete previous theme revision.

### Phase 5: publishing integration

- Show built-in and personal themes in the existing WeChat publishing dialog.
- Open/focus the studio from publishing.
- Refresh the publishing preview after `使用此主题`.
- Run a real clipboard paste compatibility pass against WeChat for supported elements and local-image behavior.

Exit criteria:

- A writer can create a personal theme once and reuse it without AI on later articles.
- Copied output remains inline-styled rich HTML.
- Theme changes never modify article Markdown.
- `npm run check` passes and the completed PR diff has been reviewed.

## Test Strategy

- Unit tests for manifest normalization, validation, cloning, current-theme fallback, revision undo/redo, and stale AI responses.
- Renderer tests for every supported Markdown element and both built-in themes.
- Persistence integration tests for rapid theme changes, restart recovery, and built-in immutability.
- Window lifecycle tests where practical, plus desktop runtime verification for singleton focus and close behavior.
- Component tests for theme/article switching and direct AI result application.
- Manual desktop checks for long article scrolling, theme switching, AI streaming, cancel behavior, and preview refresh.
- Real WeChat paste checks are required before claiming platform compatibility.

## Non-Goals

- Arbitrary CSS or raw HTML editing.
- Editing article content from the theme studio.
- Per-property AI change review or partial acceptance.
- Multiple independent AI conversations per theme in the first release.
- Theme marketplace, cloud sync, or collaborative theme editing.
- Automatic direct publishing to WeChat.
