# 参与开发

Loby 采用小步、可逆、可验证的开发方式。开始修改前先阅读根级 `AGENTS.md`，进入模块后继续阅读最近的 `AGENTS.md` 和目标文件的 L3 头部。

## 开始之前

```bash
git status --short --branch
npm ci --legacy-peer-deps
npm run setup:git-hooks
```

有意义的开发不得直接在 `main` 上开始。一个完整任务对应一个 `codex/<short-task-name>` 分支和一个 Pull Request；不要把无关改动混入同一分支。

## 本地验证

提交前默认运行：

```bash
npm run check
```

该命令覆盖格式、GEB/工程结构、TypeScript、ESLint、前端测试与构建、Rust 检查/测试/Clippy。仅修改窄范围前端样式且完整门禁明显过重时，可以先运行 `npm run build:web`，但 PR 合并前仍应记录完整门禁结果。

## 修改原则

- 保持本地 Markdown、写作库目录和已有用户数据兼容。
- 普通 UI 优先组合 `src/components/ui/` 下的共享组件和 Tailwind utilities。
- 全局颜色、字体和圆角使用共享 Design Token，不在业务组件中新增裸值。
- 快捷键统一登记在 `src/shared/lib/keyboardShortcuts.ts`。
- 新增稳定模块时创建对应 L2 `AGENTS.md`；修改依赖、导出或职责时同步更新 L3 头部。
- 不以行数机械拆分；按产品职责、数据流或状态机边界拆分。

## Pull Request

PR 使用 `.github/pull_request_template.md`，至少说明：

- 变更的用户价值和边界；
- 主要实现与数据兼容性；
- 本地验证命令和结果；
- 尚未覆盖的风险或平台手测项。

GitHub Actions 默认关闭，本地 `npm run check` 与人工 diff 审阅是合并门禁。完成的 PR 使用 squash merge；除非用户明确授权，不自动合并。

## 提交信息

使用简洁的 Conventional Commit 风格，例如：

```text
feat(editor): add reusable history panel
fix(library): preserve sheet selection after refresh
docs(architecture): align local-first persistence guide
```

面向用户的行为变化同步记录在 `CHANGELOG.md` 的 `Unreleased` 小节。
