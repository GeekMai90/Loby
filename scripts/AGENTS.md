# scripts/ - 仓库自动化与本地门禁

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
build-tauri.mjs - 校验固定 toolchain 后调用 Tauri 生产构建
check-architecture.mjs - 验证 renderer 依赖方向、GEB 契约、历史路径、旧 Token、禁用 surface 背景命名与普通 UI 全 Tailwind palette/裸色边界
check-bundle-size.mjs - 检查生产 renderer 首屏初始 JavaScript 总量与最大动态 chunk 双预算
setup-git-hooks.mjs - 将仓库跟踪的 hooks 配置为当前 Git worktree 的 hooksPath
</member>

脚本只编排环境检查、构建和质量门禁，不承载产品业务规则。新增脚本必须由 `package.json` 或明确的工程流程消费，不保留无调用者的备用命令。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
