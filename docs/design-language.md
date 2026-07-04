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

## Product Fit

Nibva is a professional writing app, not a playful AI dashboard. The interface should feel quiet, precise, and efficient. AI should be powerful but visually secondary to the editor.
