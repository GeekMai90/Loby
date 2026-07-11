# Local-First File Architecture

Last updated: 2026-07-04

## Decision

Nibva's long-term content model is file-system first. The visible writing structure in the app must map directly to folders and Markdown files that users can open in Finder, edit with other Markdown tools, or open as an Obsidian-compatible vault.

The app may keep indexes, databases, caches, and UI state, but those are secondary. The folder and Markdown structure is the durable source of content.

## Principles

- A Nibva writing library is a normal local folder.
- Multiple libraries may be registered globally, but only one is active and watched at a time.
- Removing a library from Nibva's registry never deletes or moves its folder. Renaming a registered library changes only its display name.
- User-authored content lives in Markdown files, not only in JSON, SQLite, or app-private storage.
- Folders represent user-visible structure.
- Markdown frontmatter uses simple YAML properties compatible with Obsidian-style properties.
- App-specific metadata should be minimal, flat, and human-readable.
- Indexes can accelerate search, sorting, AI context, history, and relationships, but they must be rebuildable from the folder tree and Markdown files where practical.
- Users should be able to browse, rename, copy, back up, and sync their writing library with ordinary file tools.

## Target Folder Shape

```text
NibvaLibrary/
  notes/
    收件箱/
      一个想法.md
      临时记录.md

  projects/
    知识管理/
      project.toml
      正文/
        第一篇文章.md
      素材/
        参考资料.md

  .nibva/
    library.json
    ui-state.json
    index.sqlite
    trash/
      projects/
    ai/
      conversations.json
```

## Notes

The Notes area is a flat folder-based capture space.

```text
notes/
  收件箱/
    <note>.md
  读书摘录/
    <note>.md
```

Rules:

- `notes/` is the top-level Notes container.
- `notes/收件箱/` exists by default.
- Notes groups are folders directly under `notes/`.
- Notes groups do not nest in the first version.
- A note is a Markdown file inside a notes group.
- Selecting a notes group in the app shows that folder's Markdown files in the sheet list; it does not enter a project workspace.

## Projects

The Projects area is a folder-based production workspace.

```text
projects/
  <project>/
    <group>/
      <sheet>.md
```

Rules:

- Each project is a folder under `projects/`.
- Each project group is a folder inside its project.
- Sheets are Markdown files inside project groups.
- Entering a project switches the left sidebar into the project's internal group navigation.
- Project display metadata such as title, icon, color, archive time, groups, and project field definitions can be stored in `project.toml`.
- A project can have app-managed metadata in `.nibva` or a readable sidecar file, but its writing content remains in Markdown files.

## Markdown Format

Each sheet should remain valid Markdown and readable in Obsidian.

Recommended frontmatter shape:

```yaml
---
title: "第一篇文章"
type: "正文"
阶段: "写作中"
公众号发布: false
tags:
  - 知识管理
created: 2026-07-04
updated: 2026-07-04
nibva:
  id: "sheet-..."
  targetWords: 1200
---
```

Guidelines:

- Keep content as normal Markdown body text.
- Use YAML frontmatter at the top of the file for metadata.
- Prefer flat, Obsidian-friendly properties for common metadata such as `title`, `tags`, `aliases`, `created`, and `updated`.
- Put Nibva-specific fields under a small `nibva` namespace only when needed.
- Project field definitions supply controlled types and options; the Markdown values remain ordinary YAML properties.
- Avoid depending on non-standard Markdown syntax for core content. Extended syntax such as `==highlight==` should degrade gracefully in other Markdown editors.

## Compatibility With Obsidian

Nibva should be able to open a folder layout that Obsidian can also understand:

- Markdown files are ordinary `.md` files.
- Folder hierarchy is meaningful and user-visible.
- Frontmatter is valid YAML.
- Obsidian default properties such as `tags`, `aliases`, and `cssclasses` should not be repurposed for incompatible meanings.
- Attachments and resources should be stored as regular files in visible folders, not app-private blobs.

## Indexes And Databases

Nibva can still use indexes or a local database for:

- Fast search
- Sort order
- UI state
- AI context cache
- Snapshots and history
- Project export selections
- Cross-file relationships

These indexes should live under `.nibva/` and should not be the only copy of user writing content.

## Trash

Deletion is conservative:

- Deleting a project moves the whole project folder into `.nibva/trash/projects/`.
- The original Markdown files remain intact while they are in the Nibva trash.
- The app only physically deletes trashed files when the user explicitly chooses to clear the trash.
- Built-in Notes groups such as `收件箱` are system entries and should not be deletable.
- Future document deletion should use the same pattern: move first, permanently delete only from trash.

## Rebuild Index

Nibva must support a manual rebuild flow for Finder-first usage:

- The app exposes `File > 重建索引` in the native application menu.
- Rebuild scans `notes/` and `projects/` from the active writing library.
- Rebuild refreshes `.nibva/library.json` and the in-app project tree.
- Rebuild must not rewrite, move, delete, or clean up user Markdown files.
- Markdown files placed directly under `notes/` should be treated as Inbox notes.
- Markdown files placed directly under a project folder should be treated as belonging to a default group.
- Chinese and other non-ASCII file names must generate stable non-empty internal IDs so external imports do not collide.

## Automatic External Sync

Nibva must also support live external updates:

- The desktop app watches the active writing library recursively.
- File events under `.nibva/` are ignored because those files are indexes, UI state, and AI caches.
- File events under `notes/` and `projects/` trigger a debounced refresh from disk.
- If Codex, Finder, or another Markdown editor modifies the current `.md` file, the editor should update to the new Markdown body without requiring a manual reload.
- If external changes add, remove, or rename folders/files, the app should refresh the project tree and sheet list.
- Nibva's own save events should be suppressed briefly so normal typing does not cause a reload loop.
- Conflict handling should remain conservative: if the active editor has unsaved local edits and an external change touches the same file, later versions should show an explicit reload/keep/merge choice instead of silently overwriting.

## Current Prototype Gap

The current prototype now writes user-authored Markdown to the folder-first layout:

```text
notes/<group>/<note>.md
projects/<project>/<group>/<sheet>.md
```

It still keeps `.nibva/library.json` and the internal Notes representation as app indexes/caches so the existing React state model can keep working. These files should be treated as secondary support state, not as the durable writing source.

Remaining gaps:

- Rename/move behavior is conservative; existing Markdown paths may be reused instead of aggressively renaming files on every title edit.
- Project and group icon/color metadata still depends on app metadata rather than pure Markdown/folder names.
- The frontend state model still represents Notes as an internal project-shaped object; the persisted storage already uses real `notes/<group>/<note>.md` files.

## Migration Direction

1. Continue treating the folder tree and Markdown files as the loading priority.
2. Generate stable internal IDs from frontmatter when present, otherwise derive and write them once.
3. Keep app indexes, UI state, and AI conversations under `.nibva/`.
4. Replace the hidden Notes system project in the frontend state model with a first-class Notes model.
5. Keep import/export paths compatible with ordinary Finder and Obsidian usage.
