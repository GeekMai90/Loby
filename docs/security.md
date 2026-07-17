# Security Notes

Nibva is a local-first desktop writing app. The security baseline should protect local writing libraries, avoid unnecessary network or filesystem exposure, and keep AI/CLI integrations explicit.

## Current Tauri Permissions

`src-tauri/capabilities/default.json` grants:

- Tauri core default permissions
- window close/minimize/drag/toggle-maximize
- dialog open/save

This is intentionally small. Add permissions only when a user-visible workflow needs them.

## Current Known Risks

- `tauri.conf.json` uses a narrow baseline CSP for app code, local asset images, and Tauri IPC.
- The custom asset protocol is still scoped to `$HOME/**` because writing libraries are user-selected at runtime.
- `macOSPrivateApi` is enabled for the current transparent/custom-window prototype.
- The native layer can run local Codex/Claude CLI processes.

The broad asset scope and private macOS API are acceptable for the current local prototype, but they are not a final release security posture.

## Required Hardening Before Release

1. Narrow asset protocol scope from `$HOME/**` to the active writing library and explicitly approved resource directories, likely through a runtime resource proxy or explicit resource allow-list.
2. Keep the CSP aligned with any future asset, preview, or plugin loading changes.
3. Re-evaluate `macOSPrivateApi` before distribution and remove it if the final window design no longer needs transparent/custom-window behavior.
4. Keep CLI execution paths user-configurable and visible in settings.
5. Do not send local document content to external services except through explicit user AI actions.
6. Redact command output and paths before adding telemetry or logs.

## macOS Private API Usage

`macOSPrivateApi` is currently enabled for the transparent, decoration-free macOS window prototype. This should stay tied to the shell design only. If Nibva moves back to standard macOS window chrome, remove this flag and verify window controls, dragging, resizing, and the right-side assistant layout again.

## AI And CLI Safety

- AI should operate on mounted context and selected writing library content, not arbitrary filesystem scans.
- Approval-required tool actions should remain visible to the user.
- Local CLI errors should be surfaced as user-facing diagnostics without exposing secrets.
- Never persist tokens, cookies, API keys, or private shell environment values into project files.
- Pasted AI chat images are written only to a process-scoped system temporary directory because Codex image input requires a file path. The native runtime accepts image paths only from that directory; attachments and paths are removed from persisted chat/theme conversations, and the directory is deleted when Nibva exits.

## Publishing Secrets

- Publishing credentials use the Rust-owned `publishing-secrets.json` store under the current user's platform app-config directory so macOS and Windows share one persistence contract. An OS-specific Keychain must not be the only storage path.
- The store is outside writing libraries and browser storage. Secret values remain in the native backend and are never returned to password fields, logs, screenshots, preview HTML, theme files, or review text.
- Settings query only whether a saved secret exists. After restart, a masked saved state is expected; leaving the password field empty keeps the stored value.
- Unix builds restrict the app-config directory and secret file to the current user. Windows relies on the current user's app-config profile isolation.
- Environment variables may override a saved channel secret. Non-secret OSS settings and the Access Key ID are stored separately from the Access Key Secret.

## Dependency Safety

Use:

```bash
npm audit
cargo audit
```

`cargo audit` is not wired yet because it requires installing an additional Rust tool. Add it before broader distribution.
