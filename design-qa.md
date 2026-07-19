# Library Manager Design QA

- Source visual truth: `/Users/geekmai/Downloads/CleanShot 2026-07-12 at 11.55.09.png`
- Create-flow visual truth: `/Users/geekmai/Downloads/CleanShot 2026-07-12 at 12.18.25.png`
- Tooltip-residue visual truth: `/Users/geekmai/Downloads/CleanShot 2026-07-12 at 12.31.53@2x.png`
- Existing Loby screen reference: `/Users/geekmai/Downloads/CleanShot 2026-07-12 at 11.54.39@2x.png`
- Final implementation screenshot: `.codex-artifacts/library-manager-main-revised.png`
- Overflow-menu screenshot: `.codex-artifacts/library-manager-menu-open.png`
- Create-state screenshot: `.codex-artifacts/library-manager-create-final.png`
- Simplified create-state screenshot: `.codex-artifacts/library-manager-create-simplified.png`
- Final create-state screenshot: `.codex-artifacts/library-manager-create-final-v2.png`
- Repaint-fix screenshot: `.codex-artifacts/library-manager-create-repaint-fixed.png`
- Create typography screenshot: `.codex-artifacts/library-manager-create-typography.png`
- 16px create-title screenshot: `.codex-artifacts/library-manager-create-title-16px.png`
- Tooltip cleanup screenshot: `.codex-artifacts/tooltip-cleanup-after-dialog-close.png`
- Manager typography and menu screenshot: `.codex-artifacts/library-manager-menu-typography-fixed.png`
- Small-window screenshot: `.codex-artifacts/library-manager-small-window.png`
- Side-by-side comparison: `.codex-artifacts/library-manager-comparison-final.png`
- Primary viewport: 1360 × 900
- Resilience viewport: 800 × 720
- States checked: default manager, library overflow menu, create form, minimum-width layout

## Full-view comparison evidence

The final manager preserves the selected Obsidian information architecture: a roughly one-third library rail, a larger right identity/action area, app identity above a compact action card, and per-library overflow actions. It intentionally uses Loby's light, quiet visual language and omits remote sync, language, and help controls as requested.

## Focused-region comparison evidence

- Left rail: library name, local path, and trailing overflow affordance align as one scannable row. The resting row is transparent and uses the shared neutral hover surface.
- Brand area: the real Loby icon and runtime version are centered above the action card.
- Action card: only create and open remain. Titles have increased hierarchy, and trailing buttons use text only.
- Overflow menu: rename, on-disk move, Finder reveal, and registry-only removal render in the shared high-opacity liquid-glass menu layer.

## Comparison history

1. First pass found a P2 vertical-rhythm mismatch: the brand/action group was centered too low compared with the source. Fixed by changing the right pane to top-led spacing with a 72px top inset.
2. First create-state pass found a P1 clipping issue: the primary create action and return control extended below the dialog at the target viewport. Fixed with a compact create-mode brand treatment, reduced form spacing, and shorter location controls. The revised screenshot shows both actions fully visible.
3. User review requested three polish changes: remove the resting background from the library row, increase action-title size, and remove action-button icons while renaming “新建” to “创建”. All are present in the final implementation screenshot.
4. The first horizontal-track implementation used a double-width percentage layout that displaced the create panel into the left rail. It was replaced with two absolutely positioned pages sharing the exact same stage; the old page exits left while the create page enters from the right. Final measurements confirm identical stage and create-panel x/y/width values, while the brand and dialog rectangles remain unchanged.
5. The create flow was simplified against the second reference: an independent back control, a title, and exactly two form rows for name and user-selected location. The default-location choice was removed, and create stays disabled until both values exist.
6. Native WebView testing exposed a blank-until-click repaint after the slide completed. The composited `transform` animation, eager input autofocus, and inactive-page `inert` toggling were removed; the pages now animate with ordinary left positioning and delayed visibility. A final capture taken after the transition, without a second pointer event, shows the complete create form.
7. The create-form item titles and the two default action titles were increased to a consistent 16px after user review. Both the name input value and its placeholder use 14px.
8. The tooltip-residue reference shows a “关闭” tooltip left behind after its dialog target disappeared. The shared tooltip now waits 700ms for pointer hover, clears on pointer down, click, Enter, Space, and Escape, and observes target removal or visibility changes. The post-close capture contains no orphan tooltip, the rendered tooltip count is zero, and the browser console is clean.
9. User review found the manager rail hierarchy and overflow-menu type undersized. The rail heading is now 18px, library names 16px, supporting count/path text 13px, and overflow actions use the shared 13px menu size. The outside-pointer listener now runs during capture, so clicking blank space inside the dialog closes the portaled menu even though the dialog stops bubbling.

## Required fidelity surfaces

- Fonts and typography: passed. System typography, restrained weights, readable local paths, and increased action-title hierarchy are consistent with Loby.
- Spacing and layout rhythm: passed. Two-column proportions, top-led brand spacing, separators, card padding, and create-state fit are stable at both checked viewports.
- Colors and visual tokens: passed. Loby light surfaces and shared neutral hover/menu tokens replace the source's dark purple theme intentionally.
- Image quality and asset fidelity: passed. The bundled Loby app icon is used directly at native quality; no placeholder or CSS-drawn logo is present.
- Copy and content: passed. Only locally supported actions appear, using Loby's “写作库” terminology.
- Icons: passed. The real app icon and existing Lucide interface icons are aligned and consistent; the right action buttons intentionally contain text only.
- States and interactions: passed. Switch, rename entry, overflow open/close, create/back, disabled current-library removal, and responsive layout were checked. The Rust move operation is covered separately by a filesystem test.
- Accessibility: passed for this scope. Dialog semantics, labels, alt text, focusable controls, disabled state, and visible focus behavior remain present.
- Console: no warnings or errors in the final browser pass.

## Findings

No actionable P0, P1, or P2 differences remain. The light theme and omission of unsupported Obsidian rows are intentional product adaptations rather than fidelity misses.

## Follow-up polish

No blocking polish remains. Additional library-count and long-path stress testing can be done when more real libraries are registered.

final result: passed
---

# Design QA: WeChat Publishing Preview Redesign

## Inputs

- Initial publishing dialog reference: `/Users/geekmai/Downloads/CleanShot 2026-07-17 at 16.07.53@2x.png`
- Theme-list issue reference: `/Users/geekmai/Downloads/CleanShot 2026-07-17 at 19.02.09@2x.png`
- Final implementation screenshot: `.codex-artifacts/wechat-publish-preview-bottom-spacing.jpg`
- Browser viewport: 1280 × 720 CSS pixels
- State: publishing dialog open, mobile rich-text preview selected, saved `奶油纸页` theme selected

## Full-view comparison evidence

The former header, footer, explanatory copy, reading statistics, and preview top bar are removed. The dialog now uses the full available height as a quiet two-column workspace: a compact theme rail on the left and the reusable WeChat preview surface on the right. The final browser measurement is 1120 × 704 within the 1280 × 720 viewport, reducing unused horizontal space while retaining an 889.6px preview area.

## Focused selection evidence

Every theme is a bordered card by default. The selected card uses the shared system-blue primary treatment with white text and no checkmark. Preventing dialog autofocus removes the misleading blue focus ring that previously appeared on the first theme independently of the saved selection.

## Preview and control evidence

- The complete iPhone frame measures about 309.3 × 620.8 at this viewport and remains fully inside the dialog with a 27.2px bottom inset; the article continues scrolling only inside its 402 × 874 logical screen.
- Moving the former bottom controls to the right frees additional vertical space. The device-fit reserve is 48px and the dialog inset remains 16px vertically, enlarging the phone compared with the first redesign while retaining a quiet bottom margin.
- The 677px desktop canvas still fits at full width, keeps a 52.3px gap from the right-side tool rail, and ends 28px above the dialog edge.
- The right-side liquid-glass toolbar measures 38 × 76 and contains two 38px joined icon buttons: rich text/HTML and light/dark.
- Copy and close are both 38 × 38 liquid-glass icon buttons at y=20, with an 8px gap and matching top alignment.
- Runtime interaction checks confirmed rich text to HTML and back, light to dark and back, and a valid iframe source document containing the rendered article. Browser error and warning logs were empty.

## Required fidelity surfaces

- Typography: passed. Existing Loby system typography and compact theme labels are preserved.
- Spacing and layout: passed. The selected card, device switcher, complete phone frame, centered right rail, and aligned top-right actions have balanced insets and no clipping.
- Colors and tokens: passed. Theme selection reuses the shared primary blue and white foreground tokens; controls reuse the existing liquid-glass implementation.
- Asset quality: passed. The original iPhone 17 Pro SVG remains vector-sharp and fully visible.
- Copy: passed. Visible controls are icon-only while titles and accessible labels retain `复制排版`, close, mode-switch, and appearance-switch meaning.
- Interaction: passed. Theme selection, device switching, source switching, appearance switching, copying, and dialog closing retain functional controls.

## Comparison history

1. The original dialog mixed selection, statistics, instructions, preview chrome, and a footer inside a smaller modal.
2. The first redesign removed that chrome, reused the theme-studio preview, and fixed initial rendering to wait for the saved personal theme.
3. The first focused theme item still looked selected independently of the saved theme. Autofocus is now suppressed and selection is represented only by the blue card state.
4. A cropped adaptive phone experiment made the hardware frame incomplete and was rejected. The final layout always contains the complete frame and scales it proportionally when height is constrained.
5. Bottom rich-text/HTML and light/dark segmented controls consumed attention and vertical space. They are now two joined icon toggles in a single right-side liquid-glass rail.
6. The first toolbar implementation inherited `position: relative` and a fixed 38px height from the shared group. A scoped higher-specificity rule now fixes it to the preview's right edge at the intended 38 × 76 size.
7. The first full-height layout still used a 1420px maximum width and retained excess horizontal whitespace. The final dialog is capped at 1120px, while the freed bottom control area is used to enlarge the complete phone frame from 596.8px to 620.8px high and retain a 27.2px bottom margin.

## Findings

No actionable P0, P1, or P2 issue remains in the requested publishing-preview layout and controls.

final result: passed
---

# WeChat Theme Editor Design QA

## Inputs

- Theme-menu reference: `/Users/geekmai/Downloads/CleanShot 2026-07-16 at 19.35.44@2x.png`
- Final implementation screenshot: `.codex-artifacts/wechat-theme-editor-final.png`
- Side-by-side comparison: `.codex-artifacts/wechat-theme-editor-final-comparison.png`
- Viewport: 1512 × 949 logical pixels, captured at 2× density
- States checked: default built-in theme, phone preview, undo/redo toolbar, disabled save confirmation

## Full-view comparison evidence

The final editor keeps Loby's existing three-column application structure and shared control styling while expanding the earlier partial theme-menu implementation into a complete editor surface. The theme selector remains compact, the preview stays visually primary, and the AI assistant remains secondary.

## Focused control evidence

- Undo now uses Lucide `Undo2`, paired with `Redo2` in a compact `gap-0.5` control group.
- `保存主题` replaces the ambiguous publishing-selection action and uses the shared primary button treatment.
- The button is disabled for immutable built-in themes; personal themes persist again on click and briefly show `已保存`.
- Theme management remains inside each selector row's overflow submenu, avoiding duplicate toolbar actions.

## Required fidelity surfaces

- Typography and spacing: passed. Toolbar labels, icon sizing, and compact action spacing match the existing Loby shell.
- Colors and component tokens: passed. Shared shadcn buttons and liquid-glass menus are reused without introducing a new visual system.
- Icons: passed. Standard Lucide `Undo2`, `Redo2`, `Save`, and success `Check` icons are used.
- States and interactions: passed. Built-in disabled state, personal save persistence, temporary saved feedback, undo/redo disabled states, and menu actions are represented.
- Content and preview: passed. The built-in long-form sample and bundled editorial cover remain the default phone-preview content.

## Automated checks

- Full `npm run check`: passed.
- Frontend tests: 56 files, 248 tests passed.
- Rust tests: 60 passed.
- Production web build and bundle check: passed.

## Findings

No actionable P0, P1, or P2 issues remain in the requested toolbar and save-confirmation changes.

final result: passed

---

# Zen Mode Native Window Design QA

## Inputs

- Source visual truth: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/codex-clipboard-9ec21cb8-3bdb-49f5-bd66-242e1c16eda6.png`
- Final implementation screenshot: `.codex-artifacts/zen-native-window-final.png`
- Full-view comparison: `.codex-artifacts/zen-native-window-comparison.png`
- Focused header comparison: `.codex-artifacts/zen-native-window-header-comparison.png`
- Viewport: 1512 × 982 logical pixels, captured at 2× density
- State: centered editor window over the simple-fullscreen background layer

## Full-view comparison evidence

The implementation preserves the reference composition: a narrow, vertically dominant writing window centered over a dimmed mountain background; a quiet dark-blue editor surface; restrained title and save status; long-form text as the visual focus; and the settings trigger anchored at the lower left. The two screenshots were combined at the same 3024/3026 × 1964/1966 capture size before comparison.

## Focused-region comparison evidence

The header crop confirms matching height, border radius, dark surface, centered document title, right-aligned save status, and macOS-style traffic-light placement. The implementation intentionally uses active yellow and green controls because the user requested functional minimize and maximize behavior; the reference's muted inactive controls are not carried over.

## Comparison history

1. The first two-window pass placed the background at `always_on_bottom`, allowing other applications to appear between the background and editor. The background now uses the normal application window level and is shown immediately before the editor; post-fix Core Graphics inspection shows the editor and background adjacent at layer 0.
2. The first exit order destroyed the invoking editor before restoring the main window, which could leave the background or no visible Loby window. Exit now hides the background, restores and focuses the main window, emits the rebuild event, then destroys both Zen windows. Post-fix close testing leaves only the restored main window onscreen.
3. The new window labels initially fell outside Tauri's capability scope, blocking drag, resize-state reads, and cross-window events. Both labels and the required window-state permissions are now registered; the final runtime pass produced no permission or console errors.
4. The native-window behavior was exercised directly: the editor dragged from x=377 to x=477, snapped to the left half at 757 × 949, maximized to 1512 × 950, restored to 760 × 938, and closed through the custom red control.

## Required fidelity surfaces

- Fonts and typography: passed. The editor font, title hierarchy, line height, reading measure, and muted status text remain consistent with the reference.
- Spacing and layout rhythm: passed. The panel dimensions, header height, traffic-light inset, editor padding, rounded frame, and bottom-left settings control preserve the source rhythm across normal, half-screen, and maximized states.
- Colors and visual tokens: passed. The dark blue editor, cool gray foregrounds, dim background overlay, subtle separator, and shadow remain aligned with the source.
- Image quality and asset fidelity: passed. The existing generated mountain background is used at native resolution with the same crop and dimming treatment; no placeholder asset was introduced.
- Copy and content: passed. The document title, save state, Markdown content, and Zen settings terminology are unchanged.
- Interaction and window behavior: passed. Drag, edge tiling, resize, maximize/restore, synchronized background preferences, and coordinated exit are operational native-window behaviors.

## Findings

No actionable P0, P1, or P2 differences remain. The fully colored yellow and green controls are an intentional functional change requested by the user, not design drift.

## Follow-up polish

No blocking polish remains for the requested native-window conversion.

final result: passed

---

# Zen Mode Design QA

## Inputs

- Reference: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/codex-clipboard-20af0ca8-aac9-41e3-b781-38991ba92bf9.png`
- Reference menu: `/Users/geekmai/Downloads/CleanShot 2026-07-15 at 12.21.15@2x.png`
- Reference editor: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/codex-clipboard-bc6eadf8-7bad-4850-9530-671630880028.png`
- Generated background: `public/assets/zen-mountains.png`
- Implementation: `src/components/ZenModeWindow.tsx`, `src/styles/zen-mode.css`

## Automated checks

- Production web build: passed
- TypeScript and ESLint: passed
- Rust check, tests, and Clippy: passed
- Direct Markdown persistence test: passed

## Visual comparison

The reference and implementation were inspected together in the in-app browser. The editor comparison used a 1504 × 974 viewport, matching the logical size of the 3008 × 1948 reference.

### Fixed during QA

- P0: the default CodeMirror light theme overrode the Zen Mode theme, producing a white editor with nearly invisible text. The dedicated CodeMirror theme is now passed through the component's `theme` prop.
- P1: the first implementation used a 900 px writing panel and allowed CodeMirror's flex growth to stretch content edge to edge. The panel now matches the reference's approximately 760 px centered width and keeps a 648 px reading measure.
- P2: the background-sound submenu inherited the ordinary light menu surface. It now uses the same dark liquid-glass surface and spacing as the parent menu.
- P2: the editor's initial top padding was reduced after the same-viewport comparison to better match the reference's compact writing start position.

### Interaction checks

- Entering Zen Mode from the editor toolbar: passed.
- Editing and debounced save state: passed; the temporary QA text was undone and the original browser fixture was restored.
- Main menu open/close and background-sound toggle: passed.
- Background-sound submenu and selected-sound persistence: passed.
- Escape closes an open settings menu before exiting Zen Mode: passed.
- Escape exits Zen Mode and returns to the main editor when the menu is closed: passed.
- Main editor content is restored without the temporary QA text: passed.

## Result

final result: passed

---

# Design QA: WeChat Theme Preview

- Source visual truth: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.6eu3elutLI/iphone-17-pro-silver.png`
- Implementation screenshots:
  - Initial viewport: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.tiyeOSeW9K/wechat-iphone-frame-top-safe-area.png`
  - Bottom scroll state: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.tiyeOSeW9K/wechat-iphone-frame-safe-areas.png`
  - Light/dark control placement: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.dnqja8D2JS/wechat-preview-light-control.png`
  - Inline JPEG cover in the native preview: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.pN990xCibD/theme-inline-cover.png`
- Full and focused comparison: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.tiyeOSeW9K/frame-comparison-safe.png`
- Original/compressed cover comparison: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.pmqXR3AH2q/cover-comparison.png`
- Desktop width reference: `/Users/geekmai/Downloads/CleanShot 2026-07-17 at 15.01.07@2x.png`
- Desktop source page: `https://mp.weixin.qq.com/s/TSQzajYvNK5GQB6uAkPhBQ`
- Viewport: 1966 × 1096 desktop pixels at 2× capture density
- State: WeChat theme studio, mobile preview selected, built-in example article

## Full-view comparison evidence

The Silver frame silhouette, metal edge, side controls, black bezel, screen opening, and Dynamic Island match the supplied SVG/PNG source because the implementation renders the original vector asset without redrawing it. The 402 × 874 logical content viewport aligns to the source asset's 1206 × 2622 screen opening at one-third scale. The device stays centered below the existing phone/desktop switch and the surrounding canvas does not scroll.

## Focused-region comparison evidence

The combined comparison confirms that the frame proportions, corner geometry, side controls, and Dynamic Island are preserved. A focused comparison was required because the frame edge and top safe area are too small to judge reliably in the full application screenshot.

## Required fidelity surfaces

- Fonts and typography: unchanged inside the publishing preview; no frame-specific typography was introduced.
- Spacing and layout rhythm: the initial mobile document reserves 64px above the article for the Dynamic Island and 32px after the final article element for the rounded bottom edge.
- Colors and visual tokens: the neutral Silver frame fits the existing white and cool-gray studio palette without changing product tokens.
- Image quality and asset fidelity: the original device SVG remains vector-sharp and is not recreated with CSS, handcrafted SVG, or placeholder geometry. The sample cover was resized from 1672 × 941 to 1200 × 675 and compressed from 3.7MB PNG to 279KB JPEG; the side-by-side comparison shows no material loss at the preview size.
- Copy and content: article content and toolbar copy remain unchanged; the frame changes preview presentation only.
- Desktop fidelity: the device-free desktop iframe uses the public page's measured 677px article wrapper width and retains adaptive vertical space.
- Appearance control: the shared segmented control sits in the preview area's lower-right corner. It changes only the generated iframe documents; the studio shell, theme manifest, and copied HTML stay unchanged.

## Comparison history

1. Initial implementation: the original frame matched, but the cover began at the top of the screen and was obscured by the Dynamic Island. The final article element also sat too close to the rounded bottom edge.
2. First fix: added 64px preview-only top and bottom safe areas.
3. User refinement: reduced the bottom safe area from 64px to 32px while retaining the 64px top safe area.
4. Final evidence: the initial cover starts below the Dynamic Island, and the final element can scroll fully above the bottom curve with a restrained amount of whitespace.
5. A MacBook frame experiment was rejected after review because it compressed the article and did not represent WeChat's max-width desktop layout. The desktop preview was restored to a plain, tall content canvas.
6. The supplied public WeChat page identifies `#img-content.rich_media_wrp` at 677px, so the desktop canvas now uses that exact width instead of 820px.
7. Added a lower-right light/dark segmented control. A component interaction test confirms that switching it updates the embedded preview document to dark appearance while leaving the surrounding studio unchanged.
8. The sample cover previously used an app-internal asset URL that WeChat could not resolve after paste. It is now a compressed inline JPEG, and copy preparation also materializes other app-local image URLs as data URLs while preserving remote and already-inline images.

## Findings

No actionable P0, P1, or P2 visual mismatch remains.

## Follow-up polish

- P3: the upstream frame repository does not publish a standard license file; the source and this limitation are recorded in `THIRD_PARTY_NOTICES.md` for a future distribution review.

## Implementation checklist

- [x] Use the original Silver SVG asset.
- [x] Align the iframe to the 402 × 874 iPhone 17 Pro screen opening.
- [x] Keep the outer canvas non-scrolling and scale the complete device proportionally when space is constrained.
- [x] Keep article scrolling inside the device screen.
- [x] Reserve top and bottom preview-only safe areas.
- [x] Preserve the existing desktop preview behavior.
- [x] Keep the desktop preview device-free and match the 677px public WeChat article width.
- [x] Add preview-only light/dark appearance controls at the lower right.
- [x] Keep the built-in cover visually faithful while making its copied image source self-contained.

final result: passed

---

# Design QA: WeChat Theme Assistant Header

- Source visual truth:
  - Header overflow: `/Users/geekmai/Downloads/CleanShot 2026-07-17 at 15.41.14@2x.png`
  - Edge spacing: `/Users/geekmai/Downloads/CleanShot 2026-07-17 at 15.45.48@2x.png`
- Final implementation screenshot: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.SdKQUlu42U/theme-studio-inset.png`
- Focused final crop: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.SdKQUlu42U/theme-header-after-focus.png`
- Focused source/final comparison: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/tmp.SdKQUlu42U/theme-header-focused-comparison.png`
- Viewport: 1920 × 1050 logical pixels, captured at 2× density
- State: WeChat theme studio, existing theme conversation scrolled beneath the fixed assistant header

## Full-view comparison evidence

The final native-window capture shows the assistant column expanded to 400px while the 280px article rail and the phone preview retain their intended proportions. The assistant border is now a hard visual boundary: the fading header backdrop no longer leaks into the central preview, and message cards, run steps, composer, and appearance controls remain inside the assistant column.

## Focused-region comparison evidence

The side-by-side header crop compares the same conversation title and two liquid-glass controls. In the source, the shared header's negative horizontal offset leaves the controls visually pressed against the column edges. In the final crop, the controls have a consistent 16px inset, the title remains centered, and the header fade is clipped at the assistant boundary.

## Comparison history

1. Source finding (P2): the fixed 330px assistant track felt compressed, while the absolute fading header extended 8px beyond its column because the theme assistant did not clip its shared header effect.
2. First fix: changed the track to `minmax(330px, 400px)` and clipped overflow at the theme assistant boundary. This removed the transparent spill and uses the extra width only when available.
3. User refinement (P2): clipping exposed the shared header's negative inset, leaving both controls too close to the outer edges.
4. Final fix: scoped the theme assistant header to `left: 0`, `right: 0`, and 16px horizontal padding. The main application assistant keeps its existing shared-header geometry.
5. Post-fix evidence: the focused comparison shows balanced left/right whitespace, centered title text, no cross-column fade, and no clipped controls or message content.

## Required fidelity surfaces

- Fonts and typography: passed. The existing system font, title size, weight, truncation, and centered hierarchy are unchanged.
- Spacing and layout rhythm: passed. The responsive 330–400px track uses available space without reducing the preview below its existing minimum; header controls now have symmetric 16px insets.
- Colors and visual tokens: passed. Existing background, border, shadow, liquid-glass, and muted title tokens are unchanged; only the effect boundary is clipped.
- Image quality and asset fidelity: passed. This surface contains only existing Lucide icons and liquid-glass controls; no raster or decorative asset changed.
- Copy and content: passed for the captured state. Existing conversation content is preserved, and the title remains centered and truncated consistently.
- Interaction and responsiveness: passed. Header actions, conversation scrolling, message rendering, composer controls, and the 330px constrained fallback remain available.

## Findings

No actionable P0, P1, or P2 visual differences remain for the requested width, overflow, or header-spacing changes.

## Follow-up polish

No blocking visual polish remains. The richer 2–3 sentence theme-assistant reply applies to future AI turns; persisted historical one-line replies intentionally remain unchanged.

final result: passed

---

# Quick Capture Design QA

- Source visual truth: `codex-clipboard-16837761-11f3-48af-8db3-505c09401fbe.png` (user-provided reference)
- Supporting issue reference: `codex-clipboard-e8ddeaa8-c713-44e7-8bdf-13e1a5ae4bc9.png` (user-provided caret-height capture)
- Final implementation screenshot: `loby-inbox-notes-implementation/second-line-caret-frame-1.png`
- Viewport: 1970 × 1280 screenshot of the macOS desktop app
- State: quick capture open with two lines of text and the enabled send action

## Full-view comparison evidence

The reference and final implementation were opened together and compared in the same interaction state. The Loby implementation preserves the reference's single glass input surface, large uninterrupted writing area, restrained outer border, and circular bottom-right arrow action. The reference's top mode switch is intentionally absent because the requested Loby flow has only one quick-note destination.

## Focused region comparison evidence

The quick-capture panel itself was large enough in the combined comparison to inspect typography, inset spacing, outer radius, glass opacity, send-button placement, icon shape, and native caret height without an additional crop.

## Required fidelity surfaces

- Fonts and typography: Loby uses its existing system font at 18px with a 22px line height. Placeholder and entered text share the same scale, and the native caret now follows the tighter line box on every line.
- Spacing and layout rhythm: The textarea fills the complete glass panel. A 24px top/left inset and reserved bottom action area keep writing and the send button separate without an inner frame or footer.
- Colors and visual tokens: The panel uses existing popover, border, muted, and primary theme tokens. The caret and enabled action follow the current primary theme color.
- Image quality and asset fidelity: No raster assets are required. The arrow is the existing icon-library asset rather than a text glyph or custom SVG.
- Copy and content: Only the input placeholder is visible. Explanatory copy, title chrome, cancel action, and text button label are absent.

## Comparison history

1. P1 nested form chrome: the first implementation showed a bordered textarea and separate footer inside the glass dialog. Fixed by making the dialog surface the input surface and overlaying the action in the lower-right corner.
2. P2 action mismatch: the first implementation used a rectangular text button. Fixed with a circular icon-only upward arrow and distinct disabled/enabled states.
3. P2 desktop type override: the shared textarea's responsive `md:text-sm` overrode the requested size. Fixed with an explicit 18px desktop override.
4. P2 oversized multiline caret: the 18px text inherited a tall line box and the shared textarea's content-based field sizing. The first-line caret appeared shorter only because it was clipped at the content edge, while later lines exposed its full height. Fixed by using fixed field sizing and a 22px line height; first- and second-line screenshots now show the same caret proportion.

## Findings

No actionable P0, P1, or P2 differences remain. The panel is intentionally more compact than the source application's full-width capture and omits its mode switch, matching the user's stated Loby scope.

## Follow-up polish

No blocking polish remains. Dark-theme appearance should continue to inherit the existing Loby dialog and theme tokens.

final result: passed

---

# Loby First-Run Onboarding Design QA

- Source visual truth: `/Users/geekmai/.codex/generated_images/019f73d8-ff80-7d21-b2b3-29d0c4f56898/exec-c0c52e88-24bf-4e34-a0c7-8c13a5f55630.png`
- Source SHA-256: `aad9609545770b6673b6998ef6b1ecd9a4bec64d082db4da8d3946cbedb63f71`
- Final implementation screenshot: `/tmp/loby-onboarding-implementation-v3.png`
- Implementation SHA-256: `e8f0b378eedc85709d7d473f2fa71dc7bc66969f58b5d0b9da6cbfa33b4a00c8`
- Full-view comparison: `/tmp/loby-onboarding-compare-v3.png`
- Focused comparison: `/tmp/loby-onboarding-focus-compare.png`
- Viewport: `1584 × 994`
- State: light theme, first launch, no registered writing library, name input focused

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the final implementation matches the source hierarchy with a 36px semibold title, 17px supporting copy, 15–18px form text, and 16px actions. Chinese system-font rendering is slightly sharper than the generated reference and is accepted.
- Spacing and layout rhythm: the single 500px column, icon/title alignment, form width, 56px input and location rows, 48px actions, radii, and vertical grouping match the source. The trust row sits slightly higher than the generated reference; this is a P3 difference and keeps the real interface balanced at the app's minimum height.
- Colors and visual tokens: the implementation uses Loby's shared white surface, foreground, muted foreground, border, ring, and `#007aff` primary tokens. The generated reference has a faint ambient cast that was intentionally omitted to preserve Loby's white-first product direction.
- Image quality and asset fidelity: the real `src-tauri/icons/icon.png` asset is used directly. It remains sharp, correctly scaled, and is not recreated in CSS or SVG.
- Copy and content: all approved Chinese copy and action labels match. The browser implementation displays `浏览器存储`; the native macOS path is humanized as `文稿 / Loby Libraries` and is covered by unit tests.
- Accessibility and interaction: the input retains a visible focus ring; Enter and the primary button both complete library creation; the secondary action remains keyboard reachable. At `1040 × 720`, both primary actions remain visible, there is no horizontal overflow, and the main surface scrolls for the nonessential trust note.

## Expected Capture Differences

- The source visual includes native macOS traffic lights. Browser QA captures only the app content; the existing Tauri window shell continues to render native traffic lights.
- The browser fallback uses `Browser localStorage`, while the native build provides the real default library directory.

## Comparison History

1. Version 1: the real icon rendered noticeably smaller than the visual target, the content was vertically compressed, and the secondary action had an extra folder icon. These were P2 fidelity differences.
2. Version 2: icon scale, form position, spacing, and secondary action were corrected. Typography still rendered lighter and smaller than the source, a remaining P2 difference.
3. Version 3: title, body, labels, fields, buttons, and trust copy were increased to the approved scale. Full-view and focused comparisons show no actionable P0/P1/P2 differences.

## Primary Interactions Tested

- Name field autofocus and visible caret/focus ring
- Enter submits the setup form without breaking Chinese IME composition handling
- `开始写作` creates the writing library and enters the main app
- Browser console checked: no errors

## Residual Test Gaps

- Native folder-picker appearance and cancellation cannot be exercised in the browser capture; the underlying callbacks and state handling are unchanged.
- Native macOS traffic-light rendering is owned by the existing Tauri shell and is outside this browser screenshot.

final result: passed

---

# Unused Image Cleanup Dialog Refinement

- Source visual truth: `/var/folders/s_/7wy2819s51x19x12vwzv8syh0000gn/T/codex-clipboard-68e69057-c6c1-48ac-9707-2c2bb7bf4d35.png`
- Implementation dialog screenshot: `/tmp/loby-unused-images-refined.png`
- System Quick Look screenshot: `/tmp/loby-unused-images-system-preview.png`
- Editor Quick Look screenshot: `/tmp/loby-editor-system-preview.png`
- Full-view comparison: `/tmp/loby-unused-images-comparison.png`
- Focused checkbox comparison: `/tmp/loby-unused-images-focus-comparison.png`
- Viewport: 1512 x 949 points (1970 x 1280 captured pixels), macOS light appearance
- State: one unused image selected; dialog open; Quick Look verified separately from both requested entry points

## Findings

No actionable P0, P1, or P2 issues remain.

- Fonts and typography: the existing Loby dialog hierarchy, sizes, weights, truncation, and Chinese copy remain consistent with the source state.
- Spacing and layout rhythm: the dialog intentionally grows from the source to a near-window workspace with a fixed header, selection bar, scrollable responsive grid, and fixed footer. The larger empty area with one result is expected and becomes useful when many images are present.
- Colors and visual tokens: existing dialog, border, muted-surface, selection, and destructive-action tokens are preserved.
- Image quality and asset fidelity: thumbnails continue to use the original local image asset with lazy loading. Double-click now opens the unmodified original in the macOS Quick Look panel.
- Copy and content: labels remain consistent. The right-click menu adds only `另存为...`.
- Checkbox focus: the extra padded translucent wrapper visible in the source has been removed. The checkbox now sits directly over the thumbnail with one border and one shadow.
- Interactions: double-click opens Quick Look from the cleanup grid; editor image context-menu `打开` opens the same Quick Look panel; right-click exposes Save As; saving a copy does not change the cleanup selection.

## Comparison History

1. Initial source finding (P2): the dialog was too small for a large candidate set, and the thumbnail checkbox had an extra rectangular background layer.
2. Fix: expanded the dialog to 1120 x 860 CSS pixels within viewport bounds, changed the image area to a responsive scrollable grid, and removed the checkbox wrapper.
3. User correction: replaced the temporary application-owned lightbox with the public macOS Quick Look panel and retained the image selection after Save As.
4. Post-fix evidence: the full-view and focused comparisons show the expanded layout and single-layer checkbox; both Quick Look screenshots confirm the shared system preview behavior.

## Follow-up Polish

No P3 follow-up is required for this scope.

final result: passed
