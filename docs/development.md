# 开发指南

本文是 Loby 的工程入口。项目产品与架构规则以根级 `AGENTS.md` 为准，具体模块地图以最近的 L2 `AGENTS.md` 为准。

## 运行环境

- Node.js：以 `.node-version` 为准；
- Rust：以 `rust-toolchain.toml` 为准；
- 包管理器：npm，锁文件为 `package-lock.json`。

复现构建或验证问题时必须使用仓库固定版本。

## 常用命令

```bash
npm ci --legacy-peer-deps # 按锁文件安装依赖；与发布检查清单保持一致
npm run setup:git-hooks # 安装仓库 Git hooks
npm run dev:web         # Vite Web 界面，127.0.0.1:1420
npm run dev             # Tauri 桌面应用
npm run build:web       # TypeScript + Web 构建 + bundle 门禁
npm run build           # 桌面构建
npm run release -- patch # 修订版更新，版本号 +0.0.1
npm run release -- minor # 功能版更新，版本号 +0.1.0
npm run release -- major # 重大版更新，版本号进入下一个主版本
npm run release -- --check # 检查应用版本来源是否一致
npm run release:build -- --version <version> --platform <platform-id> --output-dir <empty-directory> # 原生 runner 构建单平台资产
npm run release:publish -- --version <version> --artifacts-dir <directory> --dry-run # 汇总三平台收据，不写 GitHub
npm run release:publish -- --version <version> --artifacts-dir <directory> --prepare-only --source-run-id <dry-run-id> # 只准备 GitHub Draft
npm run release:mirror -- --version <version> --source-run-id <dry-run-id> # 本机同步 Gitee 并公开 GitHub
npm run release:publish -- --version <version> --artifacts-dir <directory> # 从同版本 tag 汇总与当前提交一致的 dry-run 资产并正式发布
npm run check           # 完整本地质量门禁
npm run audit:npm       # 独立的 npm 依赖安全检查，需要网络
```

`npm run check` 实际执行 `format:check`、`check:architecture`、`typecheck`、`lint`、`test`、`test:release`、`test:cli`、`build:web`、`check:rust`、`test:rust` 和 `lint:rust`；其中 `build:web` 会继续执行 `check:bundle`。`audit:npm` 不属于 `npm run check`，因为它依赖网络，应在发布前单独运行。

## 工程结构

- `src/app/`：renderer 组合根与跨功能状态所有权；
- `src/features/`：按真实产品领域组织的能力；
- `src/components/`：本地 shadcn/ui 与 Animate UI primitives；
- `src/shared/`：跨 feature 契约、常量、hook 与领域中立工具；
- `src/styles/`：语义 Token、框架映射、reset 与明确的复杂视觉例外；
- `src-tauri/`：原生命令、文件系统、Agent 进程、发布与桌面集成；
- `skills/`：随应用分发的 Agent skill；
- `docs/`：跨任务长期有效的产品与架构契约；
- `scripts/`：构建、门禁与开发辅助脚本。

前端和 Rust 的详细边界分别见 `frontend-structure.md` 与 `native-structure.md`。

## 分支与 Pull Request

1. 修改前运行 `git status --short --branch`。
2. 不在 `main` 上开始有意义的开发；一个完整任务使用一个 `codex/<task>` 分支和一个 PR。
3. 实现后审阅完整 diff，运行 `npm run check`。
4. 只提交本任务文件，推送分支并使用仓库模板创建 Draft PR。
5. 经用户明确批准后使用 squash merge；远程分支自动删除。

公开仓库的 GitHub-hosted CI 会在 Pull Request 与 `main` push 上运行完整质量门禁和 npm 审计；本地完整门禁、PR diff 审阅和 Git hooks 仍是提交前约束。来自 fork 的只读 CI 不获得仓库 secret，三平台桌面发布只允许维护者手动触发。禁止 force-push `main`，禁止通过削弱测试绕过失败。

## 质量门禁

```bash
npm run check
```

门禁要求：Prettier 无差异、GEB/工程结构通过、ESLint 零 warning、Rust Clippy 以 warning 为错误、前后端测试通过、生产 bundle 不超预算。

持久化、文件路径、IPC、编辑器选区/IME、AI 流式状态、拖拽和发布变更必须补充针对性测试与手测，不能仅凭构建成功判断安全。

## GEB 分形文档回环

- **L1**：根 `AGENTS.md`，只保存项目宪法、顶层地图、技术方向和全局执行入口；
- **L2**：模块 `AGENTS.md`，记录直接成员、子目录、职责和跨边界契约；
- **L3**：受管源码头部，用 `[INPUT]`、`[OUTPUT]`、`[POS]` 和固定 `[PROTOCOL]` 折叠文件职责。

L2/L3 固定文本：

```text
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
```

工作顺序：进入目录先读最近 L2，修改前读目标 L3；完成后按 L3 → L2 → L1 回环。文件增删/重命名更新 L2，依赖/导出/职责变化更新 L3，顶级模块或全局架构变化才更新 L1。

手写运行源码、UI primitive、样式源、构建配置和仓库脚本必须有一份且仅一份真实 L3。生成文件、依赖缓存、fixture、二进制资产和临时 QA 证据不做机械头部覆盖。`npm run check:architecture` 检查 protocol、父级链接、成员清单和 L3 完整性。

## 添加或拆分代码

- 按产品职责、状态所有权和数据流边界拆分，不按行数机械切片。
- 功能代码先进入拥有它的 feature，出现真实跨 feature 契约后再提升到 `shared`。
- `App.tsx` 只负责顶层状态和主要表面组合，不承载大型 JSX、选项表或领域算法。
- Tauri command 保持薄层，稳定行为下沉到可单测 Rust 模块。
- 普通组件优先复用共享 primitive、Design Token 与快捷键目录，不新增平行实现。
- 新依赖必须显著降低风险或复杂度，不能只为少量语法便利引入。

文件长度只是审查信号：普通组件约 300 行、复杂面板/hook 约 500 行、helper 约 400 行、样式约 800 行时检查职责。单一职责清楚的长文件可以保留。

## 持久化不可变量

- 高频编辑与 AI stream 可以 debounce，但写入必须串行；新状态不能被旧队列覆盖。
- 切换写作库路径、重建索引或恢复数据前必须 flush 待写内容。
- 渲染结果未变化时不重写受管文件。
- 能安全原子替换的平台使用同目录临时文件、sync 与 rename。
- 修改这些规则必须补充针对性测试，并检查 ADR 0005。

## 发布准备

发布候选版本执行 `release-checklist.md`，复查 `security.md`，在 macOS、Windows、Linux 至少手测长文、中文 IME、光标/选区、AI 发送/取消/审批、文件持久化、图片和发布导出，并更新 `CHANGELOG.md`。版本 PR 合并到公开仓库 `main` 后，手动触发 `Desktop release` 工作流：先用 `dry_run=true` 并行完成完整质量门禁、三平台单次构建和源码绑定收据汇总。真机验收后在同一提交创建 `v<version>` tag，再用 `dry_run=false` 与成功 dry-run 的 `source_run_id` 提升原资产；正式模式不重复构建或读取 updater 私钥，只准备并校验 GitHub draft。随后在可信本机运行 `npm run release:mirror`，校验 dry-run 与 GitHub Draft 的交接后直接下载 Draft 资产，使用受控本机凭证幂等同步并验收 macOS/Windows 国内镜像，公开时恢复规范 `v<version>` tag，最后公开 GitHub Release。工作流和本机脚本会标准化 bundle 名称，拒绝来源 Run、tag、提交、收据或资产任一不一致，生成完整 GitHub `latest.json`，再生成 Gitee 平台清单并逐资产匿名下载验收；Gitee 请求有超时保护，失败时可复用草稿和已上传资产重试，不需要手工拼 manifest、跨仓库 PAT 或 `gh release upload`。
