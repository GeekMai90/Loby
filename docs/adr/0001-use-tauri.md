# ADR 0001：使用 Tauri 作为桌面外壳

日期：2026-07-08

## 状态

已接受

## 背景

Loby 是本地优先写作应用，需要原生文件系统、本地进程集成和桌面级编辑器表面。既定产品栈已使用 React、TypeScript、Rust 与 CodeMirror。

## 决策

使用 Tauri 2 作为桌面外壳，Rust 作为原生集成层。

除非针对性验证证明 Tauri/WebView 无法满足长文编辑、中文 IME、选区行为或 decoration 性能，否则不切换到 Electron。

## 影响

- 原生文件与 CLI 集成位于 Rust；
- 前端保持 React/TypeScript；
- 发布前必须审查安全权限和 asset protocol 范围；
- 原生能力增长时按领域继续模块化 Rust 代码。
