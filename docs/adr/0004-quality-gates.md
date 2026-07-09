# ADR 0004: Use Automated Quality Gates

Date: 2026-07-08

## Status

Accepted

## Context

Nibva is growing through frequent AI-assisted changes. Without automated checks, regressions in TypeScript, Rust, formatting, and pure logic are easy to miss.

## Decision

Maintain a project-level `npm run check` gate and run it in CI. The gate includes TypeScript, ESLint, Vitest, web build, Rust check, and Clippy. Formatting is enforced through `npm run format:check`.

## Consequences

- Every meaningful change should pass `npm run check`.
- New pure helper logic should get Vitest coverage when practical.
- Clippy warnings are denied for Rust.
- Existing frontend lint warnings are allowed temporarily and should be reduced over time.
