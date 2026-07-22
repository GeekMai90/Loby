# Theme System

Loby has two independent theme layers:

- **Application appearance** controls navigation, lists, dialogs, inspector panels, menus, and controls. It supports `system`, `light`, and `dark` preferences. System mode listens to `prefers-color-scheme` and switches without restarting the app.
- **Editor theme** controls the CodeMirror writing surface and Markdown preview. The selected editor style stays independent from the application preference, while its light/dark palette follows the resolved application appearance.

Both choices are stored in `loby.agentSettings.v1` and normalized when older or invalid values are loaded.

## Editor Themes

| Loby theme        | Design direction                                                | Reference                                                         |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Loby              | Neutral Apple-style writing surface with system blue            | Original                                                          |
| Graphite / 石墨红 | Red Graphite light palette, quiet dark palette, serif headings  | [Ursine](https://github.com/noatpad/typora-theme-ursine)          |
| Vue / 青岚        | Clear document hierarchy with a restrained green accent         | [typora-vue-theme](https://github.com/blinkfox/typora-vue-theme)  |
| Lapis / 青金石    | Blue-gray long-form palette with calm blocks and serif headings | [typora-theme-lapis](https://github.com/YiNNx/typora-theme-lapis) |

The Loby versions use original token maps written for CodeMirror and the Loby preview renderer. No upstream fonts, images, or complete Typora CSS files are bundled.

## Ownership

- `src/shared/constants/themes.ts`: stable option metadata and preview swatches.
- `src/shared/lib/themes.ts`: persisted-value normalization and system-mode resolution.
- `src/shared/hooks/useAppTheme.ts`: operating-system listener and root color-scheme application.
- `src/styles/themes.css`: application dark tokens and all editor light/dark palettes.
- `src/features/editor/model/editorTheme.ts` and `src/features/editor/model/editorLanguage.ts`: CodeMirror rules that consume editor tokens.
- `src/features/settings/components/AppearanceSettingsPanel.tsx`: settings UI.

## Adding An Editor Theme

1. Add a stable `EditorThemeId` and one option in `EDITOR_THEME_OPTIONS`.
2. Define the light token map and a matching dark token map in `themes.css`.
3. Reuse the existing editor tokens; do not add theme-specific branches inside CodeMirror extensions.
4. Record external inspiration and licensing in this document and `THIRD_PARTY_NOTICES.md`.
5. Verify editing and preview surfaces in both application modes, then run `npm run check`.
