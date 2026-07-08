# Nibva Agent Instructions

These instructions apply to the Nibva repository.

## Product Intent

Nibva is a local-first professional writing app with AI-friendly workflows. It should help humans write better, not replace the writer with one-shot AI generation.

Preserve these principles when making product or engineering decisions:

- The writer remains in control.
- Markdown files remain readable outside Nibva.
- AI writing changes should be reviewable, reversible, and tied to local snapshots.
- Local project folders are the source of truth.
- The app should feel like a writing tool, not a chat app.

## Technical Direction

The planned stack is:

- Tauri 2 for the desktop shell
- Rust for native file, process, indexing, and system integration
- TypeScript + React for the interface
- CodeMirror 6 for the editor
- unified / remark / rehype for Markdown processing

Do not introduce Electron unless a focused editor/input prototype shows that Tauri/WebView behavior is not acceptable for long-form writing, Chinese IME input, selection behavior, or decoration performance.

## UI Direction

Nibva should use a clean, fresh, white-first, Apple-style desktop aesthetic. This is a product requirement. Prefer white surfaces, light gray separators, system blue accents, restrained typography, and quiet editor-focused layouts. Avoid beige/paper themes, warm editorial defaults, heavy card stacks, decorative gradients, saturated status blocks, and visually noisy AI dashboards. The editor should stay visually primary; AI should remain a secondary assistant surface.

Menus and pickers should use the shared Nibva pattern: white floating panel, subtle border/shadow, system-blue hover or keyboard-active rows, and checkmark-only selected rows without persistent colored backgrounds.

AI model/reasoning/speed controls should stay as compact text controls in the composer toolbar; reuse `AssistantModelSettingsMenu` instead of adding one-off model dropdowns.

AI edit result cards belong to persisted chat message history. Detailed diffs belong in the editor, with blue additions, muted strikethrough deletions, and unmarked unchanged text.

CodeMirror should use native browser selection for normal writing unless a targeted regression proves the custom `drawSelection` layer is needed.

## Editing Guidelines

- Keep planning documents short, concrete, and decision-oriented.
- Update docs when product direction, architecture, data format, or AI workflow assumptions change.
- Avoid turning this repository into a generic knowledge base.
- Prefer small, reversible implementation steps.
- Do not let `App.tsx` become a catch-all file. It should coordinate app state and compose major surfaces; move stable UI, constants, and helpers into focused files when a stable boundary exists.
- File length is a review signal, not a hard rule. Prefer splitting when a file mixes multiple responsibilities, owns unrelated state machines, or makes ordinary changes require scanning distant sections.
- As a rough review trigger, inspect ordinary components around 300 lines, complex feature panels/hooks around 500 lines, helper modules around 400 lines, and style files around 800 lines. It is acceptable to keep a longer file intact when it has one clear responsibility and splitting would mainly add indirection.
- When splitting, split by product responsibility or data flow boundary, not by arbitrary line count.
- Put reusable UI surfaces in `src/components/`, stable options/defaults in `src/constants/`, non-UI helpers in `src/lib/`, and feature-specific styles in `src/styles/*.css`.
- Keep `src/styles.css` as the style entrypoint only. It should import focused files from `src/styles/`, not contain feature rules directly.
- Split CSS by product surface when rules for different surfaces start interleaving. Prefer the current boundaries: `base`, `shell`, `left-workspace`, `sheet-rail`, `editor`, `controls`, `panels`, `ai`, `empty-state`, and `responsive`.
- Keep AI shell and top-level menu styles in `src/styles/ai.css`; AI message and run-process styles in `src/styles/ai-thread.css`; edit-review and diff styles in `src/styles/ai-review.css`; composer, mounted-context, skill/document picker, and model-menu styles in `src/styles/ai-composer.css`.
- When changing UI styles, edit the matching surface file first. Create a new style file only when a new major surface does not fit an existing boundary.
- When adding a new modal, panel, inspector tab, sidebar, toolbar, or picker, create a dedicated component file instead of adding large JSX blocks to `App.tsx`.
- Large option lists, templates, icon palettes, color palettes, and seed-like configuration must not live in `App.tsx`; put them under `src/constants/`.
- Each refactor step should preserve behavior and pass `npm run build:web`.

## Verification Expectations

When implementation begins, prioritize validation of:

- Long Markdown document editing performance
- Chinese IME behavior
- Selection and cursor behavior
- Focus mode and Markdown decoration behavior
- Local file read/write correctness
- Codex skill invocation and result review flow
