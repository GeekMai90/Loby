# .githooks/ - 本地 Git 写入保护

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
pre-commit - 拦截 `main` 直接 commit，仅允许显式紧急覆盖
pre-push - 拦截 `main` 直接 push，强制任务分支与 PR 流程
</member>

hooks 保护协作流程，不代替格式、测试、构建或审查。只有用户明确授权直接修复 `main` 时才可使用紧急覆盖。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
