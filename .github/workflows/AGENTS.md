# workflows/ - 受控 GitHub Actions

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
ci.yml - push、Pull Request 与手动触发的公开只读质量门禁，不读取发布秘密，并沉淀跨运行 Rust 编译缓存
desktop-release.yml - 手动触发的桌面发布矩阵；dry-run 并行门禁与三平台单次构建，正式模式按 Run ID 准备同提交草稿、验收 Gitee 镜像后再公开 Release
</member>

CI 自动验证公开提交与 Pull Request，但保持 `contents: read` 且不使用仓库 secret。桌面发布不得由 push 或 Pull Request 自动触发；dry-run 固定触发时的 `main` 提交，让完整门禁与原生矩阵并行，并将源码 SHA 写入三平台收据。正式发布只接受已成功 dry-run、artifact 未过期且 `head_sha` 与同版本 tag 一致的来源 Run，以 job 级 `actions: read` / `contents: write` 准备并校验原资产草稿，不重复构建；发布 job 使用 `GITEE_RELEASE_TOKEN` 幂等同步并验收 macOS/Windows 镜像，镜像失败时 GitHub 保持草稿，重试可复用已上传资产，全部通过后才公开 GitHub Release。dry-run 与普通 CI 不读取该 secret。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
