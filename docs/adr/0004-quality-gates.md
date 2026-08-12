# ADR 0004：使用自动化质量门禁

日期：2026-07-08

## 状态

已接受

## 背景

Loby 经常进行 AI 辅助修改。缺少自动化检查时，TypeScript、Rust、格式、架构边界和纯逻辑回归很容易漏过。

## 决策

维护仓库级 `npm run check` 门禁，覆盖格式、GEB/工程结构、TypeScript、ESLint、Vitest、Web production build、bundle budget、Rust check/test 与 Clippy。

私有仓库为控制 runner 成本而不启用 GitHub-hosted PR Actions，每个有意义的 PR 记录完整本地门禁结果。唯一例外是用户显式触发的三平台桌面正式发布矩阵；它会在构建前重新执行完整门禁。依赖网络的 npm 漏洞审计作为独立 `npm run audit:npm` 保留。

## 影响

- 有意义的改动必须通过 `npm run check`；
- 新纯 helper 在可行时增加 Vitest；
- ESLint 与 Rust Clippy 均不接受 warning；
- bundle budget 防止 production entry 静默增长；
- Git hooks、PR checklist、人工 diff 与已记录的本地门禁共同替代 hosted CI status。
