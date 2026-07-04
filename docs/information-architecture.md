# Information Architecture

## Product Mental Model

Nibva should manage writing work as a local writing library made of visible folders and Markdown files. The app UI has two top-level content areas:

- Notes: a lightweight capture area for loose ideas, quick notes, excerpts, and unfinished writing fragments.
- Projects: a structured writing workspace for articles, series, books, tutorials, and other intentional writing outputs.

The core hierarchy is:

```text
Library
  Notes
    Note Group
      Note
  Projects
    Project
      Project Group
        Sheet
```

## Library

A library is a local folder that contains notes and writing projects.

Examples:

- Personal essays
- Public account articles
- Tutorial series
- Book drafts
- Product writing

The library should remain usable as a normal folder outside Nibva.

The intended local folder shape is documented in [Local-First File Architecture](./local-first-file-architecture.md). In short, Notes and Projects should map to ordinary folders, and notes/sheets should map to ordinary Markdown files.

## Notes

Notes are for capture before structure. They are useful when the user wants to quickly write something down without deciding which project it belongs to.

The default Notes group is:

- Inbox: loose notes and ideas that can be organized later.

Rules:

- The Notes area maps to `notes/` in the local writing library.
- A note group maps to a direct child folder under `notes/`.
- A note maps to a Markdown file under a note group.
- Notes groups are flat in the first version; they do not contain nested groups.
- Selecting a note group shows that folder's Markdown files in the sheet list; it does not enter a project workspace.

Examples:

```text
notes/
  收件箱/
    一个想法.md
  读书摘录/
    某本书的摘录.md
```

## Project

A project is a meaningful writing space. It can be a single work, but it can also be a long-running container such as a blog, public account, tutorial collection, book draft, or newsletter.

Examples:

- A single article
- A multi-part series
- A tutorial package
- A book chapter group
- A newsletter issue
- A publishing campaign

Project-level information may include:

- Title
- Description
- Status
- Target platform
- Tags
- Target word count
- Current word count
- Created and updated dates
- Publishing state
- Sheet ordering
- Optional imported Markdown/text source files copied into sheets

## Group

A group organizes sheets inside one project.

For a blog-style project, a group usually means a column, topic, series, or temporary writing bucket. For a long-form work, a group can mean a chapter, part, module, or section.

Rules:

- A project must contain at least one group before sheets can be created.
- Nibva should not force fixed default groups such as Text or Materials in normal new projects.
- A normal blog post should usually be one sheet inside a topic/column group.
- A very long article may be upgraded into a group, with multiple sheets for its opening, sections, and ending.
- Material/reference writing can live in a dedicated group or as typed sheets later, but the folder hierarchy should stay clear in Finder.

Examples:

```text
projects/
  知识管理/
    正文/
      第一篇文章.md
    资料/
      参考资料.md
```

## Sheet

A sheet is the smallest major writing unit.

It should be larger than a paragraph block and more purposeful than a generic note. A sheet can be independently written, reordered, merged, exported, or reviewed by AI.

Possible sheet types:

- Draft
- Chapter
- Section
- Outline
- Reference
- Summary
- Publishing version
- Image brief

Sheet-level information may include:

- Title
- Type
- Status
- Target word count
- Current word count
- Current writing session start count and net word gain
- Summary
- Markdown body
- Related assets
- AI action history

## Main Interface

The main interface should support a four-zone layout:

```text
Library or Project Groups | Group Sheets | Editor | Inspector
```

All zones should be collapsible so the app can become a focused editor. The prototype now supports independent project rail, sheet rail, and inspector collapse controls, plus a one-click focus mode that hides all side surfaces.

## Left Sidebar: Library and Project Groups

The left sidebar has two modes:

- Library mode: global writing library navigation and project list
- Project mode: the selected project's internal groups

Library mode should stay small:

- All active projects
- Today
- Archive
- Projects

When the user enters a project, this sidebar is replaced by the project view. It shows the project title, a back action, and the project's groups. This keeps the app close to Ulysses' focus behavior without copying its terminology.

This area should not become a general file explorer or a publishing dashboard.

## Sheet List: Current Group

The sheet list shows sheets in the currently selected group, not every sheet in the project at once.

Supported views:

Supported views:

- List view for daily writing
- Board view for card-based planning and reordering
- Outline view for long-form structure
- Compile view for final output ordering

## Editor

The editor is the center of the product.

Expected capabilities:

- Markdown source editing
- Subtle rendered styling for headings, emphasis, lists, quotes, and code
- Visible Markdown syntax where useful
- Focus mode
- Typewriter mode
- Word count
- Current section highlighting
- Keyboard-first interactions

The editor should stay calm and writing-focused. AI controls should not dominate the writing surface.

## Inspector

The inspector is contextual and should be easy to hide.

Possible inspector tabs:

- Info
- Outline
- AI
- Assets
- Export
- History

The AI tab should expose action-based assistance rather than defaulting to open-ended chat.

## Compile and Export

Compile is a core workflow.

The user should be able to select multiple sheets, set order, preview the combined result, and export to a target format.

Possible outputs:

- Standard Markdown
- Clean HTML
- WeChat public account HTML
- Web article Markdown
- Long image
- PDF
- Series index

Only Markdown and HTML are MVP-level outputs. Others can come later.
