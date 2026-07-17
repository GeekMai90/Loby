# Native Structure

Last updated: 2026-07-17

## Direction

The Tauri layer exposes a stable command boundary to the frontend. Commands should validate and translate inputs, then delegate durable filesystem, library, resource, or agent behavior to focused modules. `lib.rs` is the application composition root, not the permanent home for every native feature.

## Current Modules

```text
src-tauri/src/
  lib.rs             native module root
  tests.rs           cross-domain native integration tests
  app.rs             Tauri builder, managed state, menus, and command registration
  main.rs            desktop binary entrypoint
  agent.rs           local AI agent domain root
  agent/app_server.rs
                     Codex app-server process, JSON-RPC loop, and approval waiting
  agent/discovery.rs skill, model, and CLI capability discovery commands
  agent/events.rs    app-server notification to stable frontend event translation
  agent/process.rs   executable resolution and timeout-bounded process helpers
  agent/protocol.rs  pure app-server JSON-RPC request and response construction
  agent/runtime.rs   agent commands, managed run state, cancellation, and stream lifecycle
  conversation_store.rs
                     AI conversation JSON persistence
  assistant_attachments.rs
                     process-scoped temporary AI images, validation, and guarded path resolution
  library.rs         writing-library commands, default path, and index coordination
  library/project_metadata.rs
                     typed project.toml metadata and order recovery
  library/scan.rs    deterministic folder-first library scanning
  library/save.rs    Markdown, project metadata, index, and managed-path persistence
  library/trash.rs   project and document trash, restore, and permanent deletion
  models.rs          serializable command and persistence models
  fs_paths.rs        generic filename, relative-path, extension, and safe-write helpers
  markdown.rs        Markdown/frontmatter rendering and parsing
  project_paths.rs   stable project-folder resolution and resource directory shape
  resources.rs       project resource listing, import, images, and guarded text reads
  resources/exports.rs
                     project export files and validated bundle writing
  system_paths.rs    operating-system open, reveal, and copy commands
  watcher.rs         active writing-library filesystem watcher and event filtering
```

## Boundaries

- Keep frontend-visible Tauri command names, camelCase payloads, and event names stable unless a coordinated contract migration is intentional.
- Put serializable request and response structures in `models.rs`.
- Put platform-neutral path validation in `fs_paths.rs`; project-folder knowledge belongs in `project_paths.rs`.
- Resource commands may access project resources only through the active library's `projects` area.
- Watcher events must ignore `.nibva` internal writes and paths outside `notes` and `projects`.
- Native modules should expose the smallest `pub(crate)` surface required by the composition root or sibling domains.
- Add pure or temporary-filesystem tests inside the owning module. Avoid requiring a Tauri window for domain tests.

## Next Boundaries

1. Keep `app.rs` limited to composition; new command behavior belongs in focused domain modules.
2. Move tests from `tests.rs` into their owning modules when fixtures and responsibility boundaries are clear; keep genuinely cross-domain persistence flows together.
