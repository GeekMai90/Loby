# Tailwind Migration

## Target

- Use Tailwind utilities for ordinary component layout and states.
- Use local shadcn primitives for buttons, inputs, switches, dialogs, menus, tooltips, progress, and selects.
- Keep CSS for global tokens/resets, CodeMirror integration, editor themes, liquid glass, and genuinely complex effects.
- Keep Tailwind Preflight enabled; legacy exceptions must define their required styles explicitly.

## Button Rule

- Ordinary migrated buttons use shadcn `Button` defaults and standard variants.
- Do not reproduce the legacy button appearance in Tailwind.
- `LiquidGlassButton` and `LiquidGlassButtonGroup` keep their custom appearance.

## Progress

- [x] Tailwind v4 and shadcn foundation
- [x] Tailwind Preflight enabled after legacy-surface audit
- [x] Settings dialog, navigation, rows, inputs, switches, sliders, selects, and segmented controls
- [x] Shared confirm, keyboard-shortcut, settings, and new-project dialogs
- [x] Publish, library-switcher, and sheet-sort dropdown menus
- [x] Document search-mode and add-property dropdown menus
- [x] AI conversation and model-settings dropdown menus
- [x] Shared dialog, tooltip, and progress primitives
- [x] AI skill and document suggestion menus
- [x] Sidebar project, note-group, and document context menu
- [x] Library manager dialog, create flow, actions, and more menu
- [x] WordPress and Mowen direct-publish dialogs, inputs, progress, and actions
- [x] WeChat publishing dialog, theme controls, source toggle, and copy action
- [x] Project field manager dialog, field actions, and destructive confirmations
- [x] Export output, publishing checklist, history, resource, trash, and empty-library actions
- [x] AI action cards, approval dock, change review, message actions, and composer submit action
- [x] Remove legacy `primary-button`, `secondary-button`, `icon-button`, and `modal-backdrop` consumers and definitions
- [x] Publishing and library lifecycle buttons, forms, dialogs, and publish-state layouts
- [x] Document information, search, outline, media, history, and selection-toolbar controls
- [x] Left workspace navigation, sheet-rail filters, sort controls, and sheet-card layout
- [x] AI assistant action, approval, review, message-edit, composer, and run-summary controls
- [x] Shell and editor-perimeter ordinary controls
- [x] Native input/select/textarea/checkbox audit; only the property color picker remains native by design
- [x] Remaining ordinary layouts in export, resources, AI thread, library onboarding, project fields, and document function panels
- [x] Preflight decision and first regression pass

## Completion Audit

- Ordinary product buttons use local shadcn `Button` defaults or standard variants; legacy button skins are removed.
- Raw `<button>` elements remain only for liquid-glass controls, native window traffic lights, and the invisible sidebar reveal hit area.
- Native form controls remain only where the browser control itself is required, currently the project-field color picker.
- Feature CSS files that only duplicated ordinary layout, spacing, typography, borders, and hover states have been removed.
- Retained CSS files are limited to the explicit exceptions below and shared design tokens/foundation.

## Explicit CSS Exceptions

- `LiquidGlassButton` and `LiquidGlassButtonGroup`
- Native window traffic-light controls and the invisible sidebar resize/reveal hit area
- CodeMirror/editor integration, editor themes, selection positioning, and embedded WeChat preview
- Glass distortion, drag/drop insertion indicators, state animations, responsive shell geometry, and theme preview artwork
- Markdown rich-text rendering, persisted diff rendering, image lightbox behavior, and fading blurred toolbar/header masks

Tailwind Preflight is enabled. CodeMirror, native window controls, liquid-glass controls, and other explicit exceptions keep their own focused styles instead of relying on browser defaults.

## Per-surface Gate

1. Migrate one complete product surface.
2. Remove only selectors that have no remaining consumers.
3. Verify light and dark themes in the running app.
4. Run `npm run check`.

## Final Verification

Completed on 2026-07-13:

- Browser regression passed for the main writing shell, AI panel/composer, settings, light and dark application themes, new-project dialog, document information rail, and project-field manager/create flow.
- Browser console reported no errors or warnings during the regression pass.
- Static audits found no legacy button classes and no unconsumed static CSS class selectors.
- Raw button and native form-control consumers match the documented exceptions.
- `npm run check` passed, including 196 frontend tests and 52 Rust tests.
