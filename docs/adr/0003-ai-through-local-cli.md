# ADR 0003: Integrate AI Through Local CLI Providers First

Date: 2026-07-08

## Status

Accepted

## Context

Loby's AI assistant should make Codex-style workflows friendlier while preserving local project control. The current product direction is a writing app with an AI assistant, not a hosted AI editor.

## Decision

Use the local Codex CLI as the initial AI execution layer and integrate it through the long-lived app-server runtime. Keep experimental provider plumbing internal, but do not expose a provider selector until another provider has a designed session model and defined parity for models, approvals, skills, usage, and failure handling.

## Consequences

- Users can inspect and configure the Codex CLI path.
- Codex CLI diagnostics are part of the app settings experience.
- Claude and hosted API providers remain explicit future additions instead of partially supported settings.
- Approval requests, cancellation, and run activity need durable UI treatment.
- Future hosted providers must be explicit additions, not silent replacements for local execution.
