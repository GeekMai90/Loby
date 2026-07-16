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

WeChat themes are registered in `src/lib/publishing/wechatThemes.ts`. A theme owns its label, preview colors, visual tokens, and layout strategies. The renderer and dialog consume the registry and must not special-case a theme outside the declared strategy fields.

The approved personal-theme and AI-assisted theme-studio direction is specified in [`wechat-theme-studio.md`](./wechat-theme-studio.md). That migration replaces the fixed registry with a versioned manifest shared by built-in and personal themes while preserving deterministic inline-styled HTML output.

The first two themes mirror the existing Obsidian exporter:

- `deep-blue-study`: 深蓝书房
- `cream-paper`: 奶油纸页

Adding another layout should normally require one registry entry and, only when the layout introduces a genuinely new structural behavior, one additional typed strategy value.

## Secrets and Safety

- API keys and application passwords are stored in `publishing-secrets.json` inside Nibva's platform-specific app-data directory, never inside a writing library or project. Unix builds restrict the directory and file to the current user.
- A Mowen API Key is verified through the documented MCP connection before it replaces the saved value.
- WordPress site URL and username may be stored in local app storage; secrets must not be stored there.
- WordPress direct publishing defaults to drafts. Mowen uses the explicit publish action as its public-send confirmation.
- Browser development mode renders dialogs and WeChat previews but never sends direct publish requests.
