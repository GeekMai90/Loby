# Content Metadata And Lifecycle

Status: implemented on 2026-07-10.

## Objective

Loby should let writers describe and organize documents with project-defined,
typed metadata without imposing one fixed publishing workflow. Publishing to a
platform is a user property or a publication event, not a global document
status. Archive and trash are application lifecycle states and remain separate
from user metadata.

## Product Principles

- The editor remains primary. Metadata is edited in the document function rail.
- Project field definitions provide dependable structure across documents.
- Markdown frontmatter remains readable and useful outside Loby.
- Unknown frontmatter fields must survive a Loby read/write round trip.
- Loby-owned fields are minimal and cannot be renamed or deleted by users.
- Select-like fields use controlled options so filtering remains reliable.
- Archive hides retained content. Trash contains deleted content that can be
  restored or permanently removed.
- Exporting or AI-editing a document never changes user metadata implicitly.

## Concepts

### Project Field Configuration

Every project owns one field configuration that defines the metadata structure
available to all documents in the project. A field definition includes:

- Stable field ID
- Frontmatter key and display name
- Field type
- Optional description
- Ordered options for single-select and multi-select fields
- Optional default value for new documents
- Display order
- Whether an empty value remains visible
- Whether the field is Loby-owned and locked

Adding a definition makes the field available to every document. It does not
need to write an empty YAML value into every existing file. Defaults apply to
new documents; applying a default to existing documents is an explicit bulk
operation.

### Document Property Values

Each document stores only its current values. The Information tab renders the
correct control for each project field definition and updates the current
document only.

### Project Templates

A project template packages:

- Project defaults
- Default groups
- Project field definitions
- Initial documents
- Future saved views

The current built-in project templates will be extended instead of introducing
a second, competing metadata-template concept.

Users do not need to create or select a separate metadata template. Editing a
project's field configuration once changes the schema and new-document
defaults for that project. Every document created in the project afterwards
receives those configured defaults automatically.

### Document Templates

A later document-template layer may prefill document content and property
values while reusing the project's field definitions. It does not define a
different field schema.

## Field Types

The first implementation supports:

| Type          | Stored value    | Editor control          | Filter behavior              |
| ------------- | --------------- | ----------------------- | ---------------------------- |
| Text          | string          | free text input         | contains, equals, empty      |
| Number        | number          | numeric input           | equals, ranges, empty        |
| Checkbox      | boolean         | checkbox                | checked, unchecked, empty    |
| Date          | ISO date string | date picker             | before, after, ranges, empty |
| URL           | string          | URL input               | contains, empty              |
| Single select | string          | controlled menu         | option, not option, empty    |
| Multi-select  | string array    | controlled multi-picker | contains any/all, empty      |
| Tags          | string array    | open token input        | contains any/all, empty      |

Text is one unconstrained value. Tags are multiple open values with suggestions
from tags already used in the project. Single-select and multi-select values
can only come from the field definition; current-document editing cannot create
ad-hoc options.

Example publication fields:

```text
Stage                 Single select  Topic / Writing / Complete
Published to WeChat   Checkbox       false
WeChat published on   Date
WeChat URL            URL
Published to Blog     Checkbox       false
Blog URL              URL
Tags                  Tags
```

## Field Ownership

### System Metadata

System metadata is locked and primarily read-only:

- Stable document ID
- Project and group relationship
- Local file path
- Created and updated timestamps
- Archived timestamp

These values live under the Loby namespace or in project metadata and are not
treated as user workflow fields.

### App Feature Fields

An app feature field has a locked key and type but an editable value. The first
implementation retains only fields that current Loby behavior genuinely uses:

- Document kind (`type` in the legacy model)
- Target word count
- Summary
- Tags

This list must stay small. Fixed workflow status and target publishing platform
are not app feature fields.

### Custom Fields

Custom field names, descriptions, options, defaults, order, and visibility are
project-managed. Existing values must be validated before a field is renamed,
deleted, or converted to another type.

Removing a field definition does not delete values by default. Removing all
stored values is a separate destructive operation. Incompatible type changes
must preserve the old values until the user confirms the conversion result.

## User Interface

### Document Function Rail

The document function switch becomes:

```text
Information | Outline | Media | Find | History
```

The first-time default remains Outline. Loby remembers the last selected
function for the session.

The Information tab contains:

1. A compact, collapsible Document Information section for system metadata.
2. A Document Properties section with typed controls.
3. Add Property and Manage Fields actions.

Add Property reveals a configured field that is currently hidden because its
value is empty, then focuses its value for the current document. Manage Fields
opens the current project's field manager, where new project fields are
created.

### Project Field Manager

Entry points:

- Project context menu -> Project Settings -> Document Fields
- Information tab -> Manage Fields

The manager supports:

- A first-level field list and a focused second-level field editor
- Add, reorder, rename, and remove custom fields
- Choose type and description
- Add, color, reorder, rename, and remove select options
- Set defaults for new documents, including multi-select and tags
- Explicitly apply a default to existing documents whose value is empty
- Control empty-value visibility
- Inspect locked Loby fields
- Preview affected documents before destructive changes

Select option removal must offer replacement, clearing affected values, or
cancellation. Field type conversion must report incompatible values.
Removing a field must separately offer retaining its existing YAML values or
deleting the definition and values together. Closing with unsaved changes must
require confirmation.

## Persistence

### Project Schema

Project field definitions are persisted in the project's readable
`project.toml`. The app index may cache them but is not the only copy.

### Document Values

User values are stored as flat YAML frontmatter properties so Obsidian and
other Markdown tools can read them. Loby system fields use a small `loby`
namespace. Loby parses the whole frontmatter document and merges managed
updates without dropping unknown keys.

Representative shape:

```yaml
---
stage: Complete
wechatPublished: true
wechatPublishedOn: 2026-07-10
wechatUrl: https://example.com/article
tags:
  - writing
  - knowledge-management
loby:
  id: sheet-123
  kind: body
  targetWords: 2000
  createdAt: 2026-07-01T09:00:00
  updatedAt: 2026-07-10T14:30:00
  archivedAt:
---
```

The browser fallback persists the same TypeScript model in local storage.

Markdown import parses YAML frontmatter structurally. When importing into an
existing project, project defaults are established first and explicit imported
values override them. When imported files create a new project, editable
frontmatter fields receive inferred text, number, checkbox, or tags definitions
while complex unknown YAML values remain preserved.

## Publishing

The fixed workflow values `待发布` and `已发布` no longer drive application
behavior. Users can model platform-specific workflows with typed fields.

When Loby later publishes directly to a platform, it should append a
publication event containing platform, timestamp, URL, and source version. It
must not replace all publishing history with one global status.

## Archive

Documents and projects can be archived independently.

- Archiving a document sets its archived timestamp and leaves the Markdown file
  in place.
- Archiving a project sets project archive metadata and effectively hides its
  children without overwriting each document's archive state.
- Restoring a project reveals documents that were not independently archived.
- Archived content is excluded from normal and Recent 7 Days views.
- The Archive view can switch between documents and projects and supports
  search and restore.
- Opening archived content shows an archived banner but does not change custom
  metadata.

## Trash

Trash is filesystem-backed deletion, not a property value.

- Deleting a document moves its Markdown file to `.loby/trash/documents/` and
  records its original project, group, and path.
- Deleting a project moves the whole project directory to
  `.loby/trash/projects/`.
- Trash supports preview, restore, permanent deletion, and clear-all.
- Trash content is read-only until restored.
- Loby does not auto-delete local trash by default.
- Restore resolves path conflicts without overwriting existing files.

## Legacy Migration

Existing data is migrated without discarding user information:

- A document's fixed `status` becomes a custom single-select field named
  `阶段`; its previous value is preserved as an option.
- Legacy `已归档` becomes `archivedAt` instead of a select value.
- Project `status` becomes a project property for non-archived values; archived
  projects receive project archive metadata.
- `targetPlatform` becomes a normal user field and keeps its original text.
- Export and AI edit flows stop rewriting document status.
- Readers remain compatible with legacy frontmatter and index records during
  migration; writers emit the new format after successful normalization.

## Filtering And Views

The first filter layer supports typed predicates over the current project's
field definitions: text containment/equality, number and date comparisons and
ranges, checkbox state, select equality, multi-select/tag any-or-all matching,
and empty/non-empty checks. In library mode, fields with the same key but
conflicting types are excluded instead of producing ambiguous results. Saved
custom views can later store filters, sorting, grouping, and visible fields.
Built-in library navigation remains limited to active documents, Recent 7
Days, Archive, and Trash.

## Acceptance Criteria

- A project can define each supported field type and controlled options.
- Current-document values are editable from the Information tab.
- Select and multi-select values cannot drift outside configured options.
- Tags accept new values and suggest existing project tags.
- Unknown external YAML fields survive load, edit, save, and index rebuild.
- Legacy status and target-platform values remain accessible after migration.
- Exporting and AI edits do not change metadata unless explicitly requested.
- Document and project archive are independent and reversible.
- Document and project deletion are restorable from Trash.
- Project templates create projects with their configured field definitions.
- Every new-document entry point applies the current project's defaults once;
  existing documents are unchanged unless the user explicitly applies a
  default to empty values.
- Empty fields respect their visibility setting and can be revealed for the
  current document from Add Property.
- Field removal, option removal, option rename, and type conversion preserve or
  migrate existing values according to an explicit user choice.
- Markdown import merges YAML frontmatter with project defaults and does not
  leave frontmatter text in the editor body.
- Typed filters cover empty values, ranges, checkbox state, controlled options,
  and tag/multi-select any-or-all matching.
- TypeScript tests, frontend build, Rust tests, and Clippy pass.
