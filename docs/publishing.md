# Publishing Architecture

Nibva exposes publishing from the right side of the editor toolbar. The entrypoint always targets the active sheet; the existing export panel remains responsible for compiling multiple sheets and saving export artifacts.

## Channels

- WeChat opens a local formatting workspace. It renders the active Markdown sheet with a registered article theme, shows mobile and desktop previews, and copies rich inline-styled HTML for pasting into the WeChat editor. When an Aliyun OSS image host is configured, the workspace can upload local article images and rerender the current preview and copy result with public image URLs.
- WordPress creates a draft by default through `POST /wp-json/wp/v2/posts`. Local images are uploaded to the site's media endpoint before the post is created. Public publishing requires an explicit checkbox.
- Mowen publishes publicly through the official note-create OpenAPI with one confirmation. Markdown is converted to NoteAtom blocks, project tags are included automatically, and local or remote images are uploaded in place.

## Mowen Publish Flow

- A configured account opens directly on the active document summary; saved API-key status is not repeated in the publish dialog.
- A missing or expired API Key routes the user to `Settings → Publishing` instead of exposing credential fields in the publish flow.
- The Rust publish command streams ordered progress milestones to the dialog while preparing content, uploading images, and creating the note.
- Local PNG, JPEG, and WebP images larger than 1 MB are uploaded from self-cleaning temporary JPEG copies, capped at a 2400 px longest edge; source project images are never modified. GIF and unsupported formats bypass optimization.
- Every prepared image must have exactly one NoteAtom attachment marker before upload, so a malformed payload cannot report success after silently dropping an image.
- Success and failure replace the dialog body with dedicated result states. Raw note IDs and credential details are not shown to the user.

## Theme Extension

Built-in WeChat themes are registered in `src/lib/publishing/wechatThemes.ts` as versioned manifests. A manifest owns its name, preview colors, universal base values, and optional open CSS/HTML source. The renderer consumes either a built-in or personal manifest and must not branch on a theme ID.

The personal-theme and AI-assisted workflow is specified in [`wechat-theme-studio.md`](./wechat-theme-studio.md). Theme manifest v2 separates universal manual base controls from optional AI-authored CSS and reusable HTML transforms. Personal themes, bounded undo/redo history, and one assistant conversation per theme live in platform app data rather than a writing library. The renderer compiles open theme source into sanitized inline WeChat HTML before preview and copy.

The first two themes mirror the existing Obsidian exporter:

- `deep-blue-study`: 深蓝书房
- `cream-paper`: 奶油纸页

Adding another built-in layout requires one manifest entry. New structural behavior belongs in that manifest's reusable HTML transforms and CSS rather than a renderer branch or a new preset component enum. Personal themes are created from an existing manifest and use the same compilation path.

## WeChat Image Hosting

- The first image-host provider is Aliyun OSS, configured in the dedicated `Settings → 图床` panel with Region, Bucket, Access Key ID, optional custom domain, and object-prefix fields.
- Uploads run in the Rust desktop backend so browser CORS rules and the Access Key Secret never enter the preview renderer.
- Object keys use `prefix/year/month/file-stem-content-hash.ext`, making repeat uploads of unchanged image content resolve to a stable location.
- Only local PNG, JPEG, GIF, WebP, and SVG references are uploaded. Existing HTTP(S), data, packaged sample, and other preview-ready URLs are left unchanged.
- Successful uploads are kept as a per-dialog source-path-to-public-URL map. The active article is rerendered from that map, so preview and clipboard HTML use remote URLs without modifying the local Markdown source.
- Upload requests always target the OSS endpoint. A configured custom domain affects only the public URL written into preview and clipboard output.

## Secrets and Safety

- API keys, application passwords, and the OSS Access Key Secret use Nibva's cross-platform Rust secret store in the current user's platform app-config directory. The file-backed implementation is intentional so macOS and Windows follow one persistence contract; system Keychain or another OS-specific credential service must not become the only storage path.
- The secret store is `publishing-secrets.json`. It persists across app restarts, never belongs to a writing library, project, article, theme, or browser storage, and must never be logged or returned to the renderer. Unix builds restrict the directory and file to the current user; Windows relies on the current user's app-config profile isolation.
- Saved secrets are not repopulated into password fields after restart. Settings surfaces only report whether a secret exists; an empty password value with an explicit “saved” state means Nibva will continue using the persisted secret.
- Environment variables remain supported as per-channel overrides. The OSS Access Key ID and non-secret endpoint settings live separately in `wechat-image-host.json`.
- A Mowen API Key is verified through the documented MCP connection before it replaces the saved value.
- WordPress site URL and username may be stored in local app storage; secrets must not be stored there.
- WordPress direct publishing defaults to drafts. Mowen uses the explicit publish action as its public-send confirmation.
- Browser development mode renders dialogs and WeChat previews but never sends direct publish requests.
