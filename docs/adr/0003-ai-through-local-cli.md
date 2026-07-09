# ADR 0003: Integrate AI Through Local CLI Providers First

Date: 2026-07-08

## Status

Accepted

## Context

Nibva's AI assistant should make Codex-style workflows friendlier while preserving local project control. The current product direction is a writing app with an AI assistant, not a hosted AI editor.

## Decision

Use local CLI providers, starting with Codex CLI and Claude CLI, as the initial AI execution layer. Prefer a long-lived app-server style runtime when available and stable, but keep the UI provider abstraction local-first.

## Consequences

- Users can inspect and configure CLI paths.
- CLI diagnostics are part of the app settings experience.
- Approval requests, cancellation, and run activity need durable UI treatment.
- Future hosted providers must be explicit additions, not silent replacements for local execution.
