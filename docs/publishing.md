# Publishing Architecture

Nibva exposes publishing from the right side of the editor toolbar. The entrypoint always targets the active sheet; the existing export panel remains responsible for compiling multiple sheets and saving export artifacts.

## Channels

- WeChat opens a local formatting workspace. It renders the active Markdown sheet with a registered article theme, shows a mobile-width preview, and copies rich inline-styled HTML for pasting into the WeChat editor.
- WordPress creates a draft by default through `POST /wp-json/wp/v2/posts`. Local images are uploaded to the site's media endpoint before the post is created. Public publishing requires an explicit checkbox.
- Mowen creates a private draft by default through the official note-create OpenAPI. Markdown is converted to NoteAtom blocks, local or remote images are uploaded in place, and public publishing requires an explicit checkbox.

## Theme Extension

WeChat themes are registered in `src/lib/publishing/wechatThemes.ts`. A theme owns its label, preview colors, visual tokens, and layout strategies. The renderer and dialog consume the registry and must not special-case a theme outside the declared strategy fields.

The first two themes mirror the existing Obsidian exporter:

- `deep-blue-study`: 深蓝书房
- `cream-paper`: 奶油纸页

Adding another layout should normally require one registry entry and, only when the layout introduces a genuinely new structural behavior, one additional typed strategy value.

## Secrets and Safety

- API keys and application passwords are stored in macOS Keychain by native Tauri commands.
- WordPress site URL and username may be stored in local app storage; secrets must not be stored there.
- Direct publishing defaults to drafts. The user must explicitly select public publishing each time.
- Browser development mode renders dialogs and WeChat previews but never sends direct publish requests.
