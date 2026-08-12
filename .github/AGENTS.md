# .github/ - GitHub 协作配置

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
dependabot.yml - npm 与 Cargo 依赖更新的分组与节奏
ISSUE_TEMPLATE/ - 公开 Bug、功能建议与私密漏洞报告的结构化入口
pull_request_template.md - 目的、范围、验证、风险与审查提示的 PR 固定结构
workflows/ - 公开只读 CI 与用户显式触发的桌面正式发布矩阵
</member>

公开仓库使用 GitHub-hosted Actions 为 push/Pull Request 提供只读质量门禁；来自 fork 的 CI 不接触仓库 secret。桌面 Release 只允许 `workflow_dispatch`，发布 job 以最小 `contents: write` 权限和当前仓库短期 `GITHUB_TOKEN` 写入同仓库 Release。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
