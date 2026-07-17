# Publishing Architecture

Nibva exposes publishing from the right side of the editor toolbar. The entrypoint always targets the active sheet; the existing export panel remains responsible for compiling multiple sheets and saving export artifacts.

## Channels

- WeChat opens a local formatting workspace. It renders the active Markdown sheet with a registered article theme, shows a mobile-width preview, and copies rich inline-styled HTML for pasting into the WeChat editor.
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

## Secrets and Safety

- API keys and application passwords are stored in `publishing-secrets.json` inside Nibva's platform-specific app-data directory, never inside a writing library or project. Unix builds restrict the directory and file to the current user.
- A Mowen API Key is verified through the documented MCP connection before it replaces the saved value.
- WordPress site URL and username may be stored in local app storage; secrets must not be stored there.
- WordPress direct publishing defaults to drafts. Mowen uses the explicit publish action as its public-send confirmation.
- Browser development mode renders dialogs and WeChat previews but never sends direct publish requests.
