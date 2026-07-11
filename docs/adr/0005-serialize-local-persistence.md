# ADR 0005: Debounce And Serialize Local Persistence

Date: 2026-07-11

## Status

Accepted

## Context

Nibva keeps the full writing-library model in frontend state. Editor keystrokes and streamed AI messages can update that state many times per second. Saving every intermediate state immediately creates overlapping Tauri calls, unnecessary disk writes, and a risk that an older request finishes after a newer request.

The local Markdown library remains the durable source of truth, so persistence performance cannot come at the cost of losing the latest user state or making files opaque.

## Decision

Use a latest-wins task queue for writing-library and AI-conversation persistence:

- debounce replaceable updates for 500 milliseconds;
- allow only one save to run at a time;
- collapse updates received during a save to the latest pending state;
- flush writing-library changes before switching libraries or rebuilding the index;
- skip writes when rendered file content is unchanged;
- on macOS and Linux, write changed managed files to a synced temporary file in the destination directory before renaming it into place.

The serialized queue preserves the existing full-library command contract for now. Incremental dirty-project or dirty-sheet commands can be introduced later with separate compatibility and integration tests.

## Consequences

- Normal typing and AI streaming no longer start a persistence call for every state update.
- A single Nibva process cannot race its own writing-library saves.
- Existing Markdown, project metadata, and conversation formats remain unchanged.
- The native layer still walks the full project model during a save, although unchanged files avoid disk writes.
- Windows retains direct replacement until a tested platform-specific atomic replacement implementation is adopted.
- Close, library-switch, external-edit, and large-library scenarios require dedicated integration coverage as the persistence layer evolves.
