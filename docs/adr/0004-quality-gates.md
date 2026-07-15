# ADR 0004: Use Automated Quality Gates

Date: 2026-07-08

## Status

Accepted

## Context

Nibva is growing through frequent AI-assisted changes. Without automated checks, regressions in TypeScript, Rust, formatting, and pure logic are easy to miss.

## Decision

Maintain a project-level `npm run check` gate. The gate includes formatting, TypeScript, ESLint, Vitest, the production web build and bundle budget, Rust check and tests, and Clippy. Because GitHub-hosted Actions are intentionally disabled for this private repository, every meaningful pull request records a successful local run. The network-dependent npm vulnerability audit remains available as `npm run audit:npm`.

## Consequences

- Every meaningful change should pass `npm run check`.
- New pure helper logic should get Vitest coverage when practical.
- Clippy warnings are denied for Rust.
- ESLint warnings are denied.
- The production bundle budget prevents silent growth while bundle splitting remains active work.
- Tracked Git hooks, the pull-request checklist, reviewed diffs, and the recorded local gate replace a hosted CI status check under the current runner-cost policy.
