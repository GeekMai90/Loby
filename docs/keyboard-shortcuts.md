# Keyboard Shortcuts

Loby keeps keyboard shortcuts in one typed catalog so matching, menu labels, button hints, accessibility metadata, CodeMirror bindings, and the in-app shortcut overview cannot drift independently.

## Current Shortcuts

On macOS, `Mod` means Command. On Windows and Linux, it means Control.

| Area        | Action                  | Shortcut       |
| ----------- | ----------------------- | -------------- |
| File        | New project             | `Mod+Shift+N`  |
| File        | New sheet               | `Mod+N`        |
| Editor      | Bold                    | `Mod+B`        |
| Editor      | Italic                  | `Mod+I`        |
| Editor      | Link                    | `Mod+K`        |
| Editor      | Inline code             | `Mod+E`        |
| Editor      | Heading 1               | `Mod+Alt+1`    |
| Editor      | Heading 2               | `Mod+Alt+2`    |
| Editor      | Bullet list             | `Mod+Shift+8`  |
| Editor      | Quote                   | `Mod+Shift+9`  |
| Editor      | Task list               | `Mod+Alt+T`    |
| Navigation  | Search sheets           | `Mod+Shift+K`  |
| Navigation  | Previous sheet          | `Mod+Alt+Up`   |
| Navigation  | Next sheet              | `Mod+Alt+Down` |
| View        | Toggle navigation rails | `Mod+\\`       |
| View        | Toggle AI panel         | `Mod+J`        |
| View        | Toggle focus mode       | `Mod+Shift+F`  |
| View        | Enter Zen Mode          | `Mod+Alt+F`    |
| View        | Toggle Markdown preview | `Mod+Shift+P`  |
| Application | Settings                | `Mod+,`        |
| Application | Shortcut overview       | `Mod+/`        |

## Architecture

- `src/shared/lib/keyboardShortcuts.ts`: typed catalog, exact matching, platform labels, accessibility labels, and CodeMirror key conversion.
- `src/shared/hooks/useAppShortcuts.ts`: one global dispatcher with current action availability.
- `src/features/settings/components/KeyboardShortcutsDialog.tsx`: catalog-driven user-facing overview.
- `src-tauri/src/app.rs`: native menu accelerators for standard File and application menu actions.

## Adding A Shortcut

1. Add one entry to `APP_SHORTCUTS` with a unique key combination and the correct group.
2. For an App action, register its handler and availability in the `useAppShortcuts` call in `App.tsx`. For a CodeMirror action, generate its key with `codeMirrorShortcutKey`.
3. Reuse `appShortcutTitle` and `appShortcutAriaKeys` on visible controls when the action has a button.
4. Run `npm run test -- src/shared/lib/keyboardShortcuts.test.ts` and `npm run check`.

The shortcut overview is generated from the catalog automatically. Do not hard-code a second shortcut list in components or documentation used by the app.
