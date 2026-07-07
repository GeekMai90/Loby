# Image Assets Design

Nibva keeps image files as ordinary project files. The app should help insert, preview, validate, and export image references, but Finder remains a first-class management surface.

## Storage

- Imported, pasted, and dropped writing images are saved under `assets/images/`.
- The image file is the source of truth. Any registry or usage list should be derived from Markdown references and the project folder.
- Generated images and manually imported images should use stable, readable filenames. Name collisions are resolved by suffixing `-2`, `-3`, and so on.

## Reference Formats

Nibva supports two authoring formats:

- Standard Markdown: `![Alt text](../assets/images/example.png)`
- Obsidian embed: `![[assets/images/example.png]]`

Standard Markdown is the default because it is portable across Markdown renderers. Obsidian embed mode is optional for writers who want the same project folder to work smoothly inside Obsidian.

Both formats must be recognized regardless of the current setting. The setting only controls which syntax Nibva inserts for new images.

## Path Rules

- Standard Markdown paths are written relative to the current sheet Markdown file.
- Obsidian paths are written relative to the project folder, so `assets/images/example.png` works when the project folder is opened as an Obsidian vault.
- External images such as `https://...` are not copied into the local image folder unless the user explicitly imports them later.

## Export

When saving Markdown or HTML exports to the project `exports` folder:

- Nibva scans selected sheets for standard Markdown images and Obsidian image embeds.
- The export panel shows local image count, external image count, and missing local references before saving.
- Local image files are copied into `exports/<export-name>/assets/images/`.
- Exported Markdown and HTML are rewritten to reference the copied bundle assets.
- If no local images are used, exports remain single files.

Wechat HTML and Xiaohongshu exports can render or list image references, but publishing workflows still need a later upload/replacement step because those platforms cannot consume local file paths directly.
