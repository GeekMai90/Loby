# Design Language

Loby should use a clean, fresh, white-first, Apple-style desktop aesthetic.

This is a product requirement, not only a visual preference. New UI work should keep the whole app clean, fresh, and white-led. The previous heavier visual direction is considered unsuitable for Loby and should not be used as the baseline.

The current prototype styling is not accepted as the final product direction. Before Loby is treated as release-quality, the interface should be polished toward a cleaner, lighter, more Apple-like writing environment.

## Direction

- White and very light gray surfaces
- Clear hierarchy through spacing, typography, and subtle separators
- Blue system accent for primary actions, focus, and compact selection indicators
- Minimal shadows
- Low visual noise
- Calm writing-first interface
- Native-feeling macOS/Windows desktop controls
- Toolbar controls should feel like lightweight native writing tools, not dashboard widgets

## Non-negotiable UI Requirement

Loby's default interface must look like a serious Apple-style writing tool:

- White is the dominant color.
- Light gray should define structure through separators, sidebars, and hover states.
- Blue is reserved for primary actions, focus, and compact selection indicators. It should not fill ordinary menu rows.
- Panels should feel quiet and native, not like stacked marketing cards.
- The editor must remain the visual center of the app.
- AI UI must feel like a secondary assistant surface, not the product's main stage.
- The visual bar is Apple's native productivity and writing tools: quiet white surfaces, precise spacing, restrained controls, and no decorative weight.
- When in doubt, remove visual noise before adding more styling.

## Avoid

- Beige, cream, paper, brown, or warm editorial themes
- Heavy borders and card stacks
- Decorative gradients or colored backgrounds
- Busy dashboards
- Chat UI that dominates the writing surface
- Warm paper-like themes as the default writing environment
- Saturated status blocks that make the interface look noisy
- Dark, dense, or saturated palettes unless a later explicit theme mode is designed

## Current Tokens

- App background: `#f6f6f7`
- Main surface: `#ffffff`
- Soft surface: `#fbfbfc`
- Separator: `#e6e6eb`
- Strong separator: `#d8d8df`
- Primary text: `#1d1d1f`
- Secondary text: `#6e6e73`
- Muted text: `#86868b`
- Accent: `#007aff`
- Selected background: `#f1f7ff`

## Current Implementation

The app CSS uses centralized design tokens for white surfaces, Apple system typography, light gray separators, system blue selection states, and low-noise rounded controls. Do not reintroduce the earlier beige/paper palette, decorative gradients, or warm editorial styling as the default.

## Menus And Pickers

Menus should follow one app-wide pattern:

- High-opacity liquid-glass panel, 10px radius, 6px inner padding, subtle neutral border, shared backdrop blur, restrained inner highlight, and one shared light shadow. Keep the material opaque enough for menu labels to remain immediately readable.
- Ordinary hover and keyboard-active rows use a neutral gray background with normal dark text. Do not use a blue fill.
- Open submenu rows and selected rows without a checkmark use a slightly stronger neutral gray background.
- Checked rows do not get a persistent colored background. Their checkmark uses the same muted gray as a leading menu icon at rest.
- Destructive rows use red text and a light red hover background, never a solid red fill.
- Section labels use muted text and small type.
- Separators are light gray and minimal.
- Menu rows support three shared layouts: label only, leading icon plus label, or leading icon plus label plus a trailing shortcut.
- Leading icons use the app's inactive gray by default and change to normal primary text color only while the row is hovered or keyboard-focused.
- Shortcuts use the same muted gray as resting menu icons, with no badge, and align to the far right of the row, for example `⌘,`.
- Blue remains appropriate for focus rings, primary submit buttons, and confirm actions; menu checkmarks stay muted gray.
- If a menu has submenus, open to the right when there is room and to the left when the right side is constrained.
- Menus that may escape an inspector/sidebar should render in a high-level portal layer rather than being clipped by the local panel.

Do not create new menu palettes or one-off hover treatments. Reuse the existing menu behavior before inventing a new variant.

The shared implementation tokens live in `src/styles/base.css`: `--menu-surface`, `--menu-border`, `--menu-shadow`, `--menu-backdrop-filter`, `--menu-hover`, `--menu-selected`, `--menu-danger-hover`, `--menu-separator`, `--menu-focus-ring`, `--menu-radius`, `--menu-item-radius`, and `--menu-padding`.

## Tooltips

Tooltips use one app-wide Animate UI provider and Floating UI portal so they are not clipped by rails, panels, or overflow containers. They use the inverse `foreground/background` surface, `8px` radius, a `700ms` hover delay, a short close delay, and spring-based entry, exit, and cross-trigger movement. Existing `title` and `data-tooltip` content is adopted automatically by the Animate UI provider; do not add one-off tooltip panels, CSS pseudo-element tooltips, or a second Tooltip implementation.

## Tabs And Switchers

Compact view and mode switchers use the local Animate UI `Tabs` as their single implementation. The track uses semantic `muted` colors, the active highlight uses `background` in light mode and `input` in dark mode, and the highlight moves continuously with a spring transition. Tabs may contain text, a single icon, or an icon with text; icon-only triggers must provide an accessible label and Tooltip. Do not reintroduce one-off segmented controls or separate function/menu switcher implementations.

## AI Assistant Controls

The AI assistant should stay visually secondary to the editor:

- Model, reasoning, and speed settings use a lightweight text trigger, not large capsule controls.
- The selected model label uses normal text color; reasoning/speed metadata uses muted text.
- Toolbars should stay compact and leave the editor as the visual center.

## Editor Selection

The editor uses native browser selection rather than CodeMirror's custom `drawSelection` layer. This keeps selected text visually close to normal writing apps: selection should follow the actual text instead of filling soft-wrapped line rectangles. Do not re-enable custom selection drawing unless long-form writing, Chinese IME, or multi-selection testing proves it is needed.

The default editor text column uses a `704px` readable maximum line width with responsive `36-48px` horizontal gutters. Editing and preview mode share `--editor-text-width`, `--editor-content-max-width`, and `--editor-content-gutter` so text, media, selection tools, and inline AI result bars stay aligned.

## Workspace Rails

The project navigation rail defaults to `200px`. The sheet list defaults to and never resizes below `240px`; users can drag its editor-side divider to expand it up to `360px`. Dragging left can collapse the sheet list only after the project navigation rail is already hidden, preventing accidental loss of both navigation levels.

## Product Fit

Loby is a professional writing app, not a playful AI dashboard. The interface should feel quiet, precise, and efficient. AI should be powerful but visually secondary to the editor.
