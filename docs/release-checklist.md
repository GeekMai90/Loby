# Release Checklist

Use this checklist before tagging or distributing a Loby build.

## Required Checks

```bash
npm ci
npm run check
npm run audit:npm
npm run build
```

## Manual Smoke Tests

- Open an existing local writing library.
- Create a project, group, and sheet.
- Edit a long Markdown document and confirm selection, cursor, and scrolling stay stable.
- Test Chinese IME composition in the editor and AI composer.
- Attach a document and selected text to the AI assistant.
- Send, stream, cancel, and retry an AI request.
- Apply an AI edit, show changes, hide changes, and undo it.
- Insert, preview, open, and export an image reference.
- Export Markdown, HTML, plain text, WeChat HTML, and Xiaohongshu draft formats.
- Restart the app and confirm projects, conversations, settings, and AI change cards persist.

## Security Review

- Review `docs/security.md`.
- Confirm no secrets, tokens, private paths, or local writing-library files are committed.
- Recheck Tauri capabilities when adding filesystem, shell, protocol, or network behavior.
- If Rust dependency auditing is required for the release, install and run `cargo audit` or adopt `cargo-deny` before tagging.

## Release Notes

- Update `CHANGELOG.md`.
- Record any known build warnings that are accepted for this release.
- Record the tested macOS version and whether the build was run as `npm run build` or from a signed/notarized pipeline.
