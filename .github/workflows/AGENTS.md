# workflows/ - 受控 GitHub Actions

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
ci.yml - push、Pull Request 与手动触发的公开只读质量门禁，不读取发布秘密
desktop-release.yml - 手动触发的桌面发布矩阵；在 macOS、Windows、Linux 原生 runner 构建并汇总到同仓库 Release
</member>

CI 自动验证公开提交与 Pull Request，但保持 `contents: read` 且不使用仓库 secret。桌面发布不得由 push 或 Pull Request 自动触发；dry-run 从当前 `main` 验证刚合并的发布链路，正式发布只接受已合并到 `origin/main` 的同版本 tag，并以 job 级 `contents: write` 将完整矩阵写入当前仓库 Release。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
