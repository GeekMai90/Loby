# ADR 0004: Use Automated Quality Gates

Date: 2026-07-08

## Status

Accepted

## Context

Nibva is growing through frequent AI-assisted changes. Without automated checks, regressions in TypeScript, Rust, formatting, and pure logic are easy to miss.

## Decision

Maintain a project-level `npm run check` gate and run it in CI. The gate includes formatting, TypeScript, ESLint, Vitest, the production web build and bundle budget, Rust check and tests, and Clippy. CI also runs the npm vulnerability audit.

## Consequences

- Every meaningful change should pass `npm run check`.
- New pure helper logic should get Vitest coverage when practical.
- Clippy warnings are denied for Rust.
- ESLint warnings are denied.
- The production bundle budget prevents silent growth while bundle splitting remains active work.
