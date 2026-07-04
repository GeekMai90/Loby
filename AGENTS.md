# Nibva Agent Instructions

These instructions apply to the Nibva repository.

## Product Intent

Nibva is a local-first professional writing app with AI-friendly workflows. It should help humans write better, not replace the writer with one-shot AI generation.

Preserve these principles when making product or engineering decisions:

- The writer remains in control.
- Markdown files remain readable outside Nibva.
- AI output should be reviewable before it changes user writing.
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

## Editing Guidelines

- Keep planning documents short, concrete, and decision-oriented.
- Update docs when product direction, architecture, data format, or AI workflow assumptions change.
- Avoid turning this repository into a generic knowledge base.
- Prefer small, reversible implementation steps.

## Verification Expectations

When implementation begins, prioritize validation of:

- Long Markdown document editing performance
- Chinese IME behavior
- Selection and cursor behavior
- Focus mode and Markdown decoration behavior
- Local file read/write correctness
- Codex skill invocation and result review flow
