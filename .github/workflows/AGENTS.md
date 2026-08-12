# workflows/ - 受控 GitHub Actions

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
desktop-release.yml - 手动触发的桌面发布矩阵；在 macOS、Windows、Linux 原生 runner 构建并汇总到公开 Release
</member>

工作流不得由 push 或 Pull Request 自动触发。dry-run 从当前 `main` 验证刚合并的发布链路，正式桌面发布只接受已合并到 `origin/main` 的同版本 tag；两种模式都必须先通过完整质量门禁，再并行构建全部受支持平台。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
