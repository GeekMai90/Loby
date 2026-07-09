# ADR 0001: Use Tauri For The Desktop Shell

Date: 2026-07-08

## Status

Accepted

## Context

Nibva is a local-first writing app that needs native filesystem access, local process integration, and a desktop-quality editor surface. The planned stack already uses React, TypeScript, Rust, and CodeMirror.

## Decision

Use Tauri 2 as the desktop shell and Rust as the native integration layer.

Do not switch to Electron unless focused testing shows Tauri/WebView cannot meet long-form editing, Chinese IME, selection behavior, or decoration performance requirements.

## Consequences

- Native filesystem and CLI integration lives in Rust.
- Frontend code stays React/TypeScript.
- Security permissions and asset protocol scope must be reviewed before release.
- Rust code must be modularized as native behavior grows.
