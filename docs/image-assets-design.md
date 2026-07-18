# Image Assets Design

Loby keeps image files as ordinary writing-library files. The app should help insert, preview, validate, and export image references, but Finder remains a first-class management surface.

## Storage

- Every project, Inbox sheet, and note shares the writing library's root `assets/images/` directory.
- Moving a sheet never moves or copies its image files. Loby only rewrites standard Markdown paths relative to the sheet's new location.
- The image file is the source of truth. Any registry or usage list is derived from Markdown references and the writing-library folder.
- Generated and imported images use stable, readable filenames. Identical content is reused; different images with the same filename receive a short content hash.

## Reference Formats

Loby supports two authoring formats:

- Standard Markdown: a path relative to the current sheet, such as `![Alt text](../../../assets/images/example.png)` inside `projects/<project>/<group>/`
- Obsidian embed: `![[assets/images/example.png]]`

Standard Markdown is the default because it is portable across Markdown renderers. Obsidian embed mode is optional for writers who want the same project folder to work smoothly inside Obsidian.

Both formats must be recognized regardless of the current setting. The setting only controls which syntax Loby inserts for new images.

Image display size is editor metadata, not a separate database field:

- Standard Markdown stores it in the optional title: `![Alt text](../../../assets/images/example.png "loby-size=medium")`
- Obsidian embed stores it as a third pipe segment: `![[assets/images/example.png|Alt text|medium]]`

Supported display sizes are `thumbnail`, `small`, `medium`, and `large`. Unknown or missing size metadata falls back to `large`.

## Path Rules

- Standard Markdown paths are written relative to the current sheet Markdown file.
- Obsidian paths are written relative to the writing-library root, so `assets/images/example.png` works when the complete writing library is opened as an Obsidian vault.
- External images such as `https://...` are not copied into the local image folder unless the user explicitly imports them later.

## Editor Actions

The image preview context menu can change display size, open the source file, copy or cut the image reference, paste clipboard text after the image, save a copy, and delete the image reference. Delete removes the Markdown reference only; it does not remove the underlying file from `assets/images/` because the same image may be reused by other sheets.

## Export

When saving Markdown or HTML exports to the project `exports` folder:

- Loby scans selected sheets for standard Markdown images and Obsidian image embeds.
- The export panel shows local image count, external image count, and missing local references before saving.
- Local image files are copied into `exports/<export-name>/assets/images/`.
- Exported Markdown and HTML are rewritten to reference the copied bundle assets.
- If no local images are used, exports remain single files.

Wechat HTML and Xiaohongshu exports can render or list image references, but publishing workflows still need a later upload/replacement step because those platforms cannot consume local file paths directly.
