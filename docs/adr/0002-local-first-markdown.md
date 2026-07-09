# ADR 0002: Keep User Writing In Local Markdown Files

Date: 2026-07-08

## Status

Accepted

## Context

Nibva should help professional writing workflows without locking user content inside an opaque database. AI workflows need structured context, but users should retain readable project folders.

## Decision

Treat local project folders and Markdown files as the durable source of truth. App indexes and metadata files are support state that should be rebuildable where practical.

## Consequences

- User-authored sheets are written as visible Markdown.
- Project metadata is stored beside content using readable files such as `project.toml`.
- Import/export and AI context should preserve local file readability.
- Persistence logic requires stronger tests because it bridges app state and filesystem state.
