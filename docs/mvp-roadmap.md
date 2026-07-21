# MVP Roadmap

## Goal

The first useful version of Loby should prove that a local-first, Markdown-based, AI-friendly professional writing app can feel better than using Obsidian as a writing workaround.

## Non-goals

The MVP should not include:

- Mobile apps
- Cloud sync
- Real-time collaboration
- Plugin marketplace
- Full publishing automation
- Complex WYSIWYG block editing
- Social features
- Team workspace management

## Phase 0: Technical Spike

Status: started. A Tauri 2 + React + CodeMirror prototype now exists.

Build a focused Tauri + CodeMirror prototype.

Validate:

- Long Markdown editing performance
- Chinese IME behavior
- Selection and cursor behavior
- Markdown decoration performance
- Focus mode behavior
- Basic local file save/load

Exit criteria:

- Editing feels stable on macOS and Windows
- Chinese input does not break composition, undo, or selection
- Large Markdown files remain usable
- CodeMirror decorations do not cause visible lag

## Phase 1: Local Writing Folder

Status: started. The app currently saves project metadata and sheet Markdown through Tauri commands into one user-facing local writing folder, defaults to `Documents/LobyLibrary`, remembers the chosen path on next launch, and supports a real empty state. Projects contain groups between the project and sheet levels, so a project can behave like a blog, column collection, long-form work, tutorial set, or material workspace. The interface deliberately treats projects as the highest content-organization level; the internal multi-folder registry remains only for compatibility and recovery. Browser development still uses localStorage as a fallback. It also includes first-version project templates for common writing workflows.

Build the basic local project system.

Features:

- Open or create a local Loby writing folder during onboarding: implemented
- Empty writing folder first-project surface: implemented
- Create a project: implemented
- Duplicate a project and safely remove a project from the active library list while preserving local files: implemented
- Create a project from writing templates: implemented
- Create, rename, reorder, and delete sheets: implemented
- Organize project sheets into groups: first version implemented
- Import existing Markdown/text files as a new project or as sheets in the current project: implemented
- Edit project writing brief fields for audience, thesis, tone, and publishing notes: implemented
- Archive completed projects and filter archived work out of the active project list: implemented
- Filter project lists by existing project tags: implemented
- Sort project lists by recent update, title, word count, or progress: implemented
- Store sheets as Markdown files: implemented
- Store project metadata as readable YAML or TOML: implemented with per-project `project.toml`
- Show project and sheet word counts: implemented

Exit criteria:

- User can manage a real writing project without touching the filesystem manually
- Files remain readable outside Loby

## Phase 2: Writing Experience

Status: started. The prototype includes a CodeMirror Markdown editor, word count, target progress, focus mode, independent rail/inspector collapse controls, Markdown quick formatting, and common editor shortcuts.

Build the core editor experience.

Features:

- Markdown hybrid editing
- Heading/list/quote/code styling
- Focus mode
- Remembered project rail, sheet rail, inspector, focus mode, and typewriter layout preferences: implemented
- Restore last active project and writing sheet on launch: implemented
- Typewriter mode
- Outline panel
- Word count and target word count
- Current writing session word gain and remaining target metrics: implemented
- Keyboard shortcuts: first version implemented
- Sheet version history with save, compare, and restore: implemented

Exit criteria:

- Writing in Loby feels clearly better than writing in a general note app
- Sidebars can be hidden for focused writing

## Phase 3: Sheet-based Organization

Status: started. The prototype includes project sheets, list navigation, sheet creation, writing templates with typed metadata fields, property filtering, manual ordering controls, and drag-and-drop sheet ordering.

Build the project structure views.

Features:

- Sheet list view
- Typed project-defined metadata fields and controlled options: implemented
- Document property filtering: implemented
- Outline view
- Drag-and-drop ordering: implemented
- Project-defined writing stage or publishing fields when a project needs them
- Sheet summary
- Independent archive and trash lifecycle actions: implemented

Exit criteria:

- User can plan and restructure a multi-part article or series visually
- Sheet order can drive export order

## Phase 4: AI-assisted Writing

Status: started as a local interaction prototype. The current AI panel creates reviewable deterministic suggestions, local summaries, image-idea notes, and Codex CLI-backed chat/edit attempts, but it does not yet call real Codex skills through a long-lived runtime.

Add the first AI actions through a local Codex bridge.

Features:

- Polish selected text: implemented
- Generate title alternatives: implemented
- Summarize current sheet: first local version implemented
- Suggest image ideas: first local version implemented
- Show text results as reviewable diffs

Exit criteria:

- AI improves the workflow without taking over the writing surface
- User can accept or reject AI changes safely

## Phase 5: Compile and Export

Status: started. The prototype can select publishable project sheets, compile only the selected sheets, download Markdown, clean HTML, plain text, WeChat HTML, or Xiaohongshu draft exports, copy common export formats to the clipboard, open a system print/PDF preview, save export files into the project's local `exports/` folder, and save the selected compilation back as a `发布版本` sheet. Material sheets are excluded from publish exports by default.

Build the first publishing preparation workflow.

Features:

- Select sheets to compile: implemented
- Set export order independently from project sheet order: implemented
- Preview combined article: implemented
- Export Markdown: implemented
- Export clean HTML: implemented
- Export platform-specific preparation formats: first version implemented
- Copy Markdown, HTML, WeChat HTML, and Xiaohongshu draft output to the clipboard: implemented
- Open system print/PDF preview for the compiled article: first version implemented
- Save export files into the local project `exports/` folder: implemented
- Save compiled draft as a publish-version sheet: implemented
- Automatic publish-readiness checks: implemented
- Persistent project publishing task checklist: implemented
- Persistent export history for saved local export files: implemented
- History inspector for version snapshots and saved export history: implemented

Exit criteria:

- User can go from project sheets to a publishable article draft
- Export output is predictable and inspectable

## Later Directions

- Deeper WeChat public account formatting: implemented for active sheets with mobile preview, rich HTML copy, and two extensible themes
- AI-assisted personal WeChat themes: approved for phased implementation through a dedicated theme-studio window; see `docs/wechat-theme-studio.md`
- Direct WordPress and Mowen publishing: implemented, with cross-platform app-data credentials, Mowen Key validation, and image upload
- Deeper Xiaohongshu adaptation
- Long image export
- PDF export
- Cover and body image generation workflow
- Project templates
- Mobile companion app
