# Design Language

Nibva should use a clean, fresh, white-first, Apple-style desktop aesthetic.

This is a product requirement, not only a visual preference. New UI work should keep the whole app clean, fresh, and white-led. The previous heavier visual direction is considered unsuitable for Nibva and should not be used as the baseline.

The current prototype styling is not accepted as the final product direction. Before Nibva is treated as release-quality, the interface should be polished toward a cleaner, lighter, more Apple-like writing environment.

## Direction

- White and very light gray surfaces
- Clear hierarchy through spacing, typography, and subtle separators
- Blue system accent for primary actions and selected states
- Minimal shadows
- Low visual noise
- Calm writing-first interface
- Native-feeling macOS/Windows desktop controls
- Toolbar controls should feel like lightweight native writing tools, not dashboard widgets

## Non-negotiable UI Requirement

Nibva's default interface must look like a serious Apple-style writing tool:

- White is the dominant color.
- Light gray should define structure through separators, sidebars, and hover states.
- Blue is reserved for primary actions, focus, and selected states.
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

- White floating panel, subtle border, light shadow, and 8-10px radius.
- Hover and keyboard-active rows use the system blue accent with white text.
- Checked rows do not get a persistent colored background. They keep normal text color and show only a right-aligned checkmark.
- Section labels use muted text and small type.
- Separators are light gray and minimal.
- If a menu has submenus, open to the right when there is room and to the left when the right side is constrained.
- Menus that may escape an inspector/sidebar should render in a high-level portal layer rather than being clipped by the local panel.

Do not create new menu palettes or one-off hover treatments. Reuse the existing menu behavior before inventing a new variant.

## AI Assistant Controls

The AI assistant should stay visually secondary to the editor:

- Model, reasoning, and speed settings use a lightweight text trigger, not large capsule controls.
- The selected model label uses normal text color; reasoning/speed metadata uses muted text.
- Toolbars should stay compact and leave the editor as the visual center.

## Editor Selection

The editor uses native browser selection rather than CodeMirror's custom `drawSelection` layer. This keeps selected text visually close to normal writing apps: selection should follow the actual text instead of filling soft-wrapped line rectangles. Do not re-enable custom selection drawing unless long-form writing, Chinese IME, or multi-selection testing proves it is needed.

## Product Fit

Nibva is a professional writing app, not a playful AI dashboard. The interface should feel quiet, precise, and efficient. AI should be powerful but visually secondary to the editor.
