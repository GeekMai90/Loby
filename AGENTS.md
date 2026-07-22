# Loby - 本地优先的专业写作应用

Tauri 2 + Rust + TypeScript + React 19 + CodeMirror 6 + unified/remark/rehype + Tailwind CSS 4 + shadcn/ui

> L1 | 项目宪法、全局边界与顶层导航

## 一、项目宪法

Loby 用适合 AI 协作的工作流帮助人类写得更好，而不是用一键生成取代作者。

- 作者始终拥有控制权；AI 修改必须可审阅、可拒绝、可撤销，并与本地快照关联。
- 本地写作目录和 Markdown 是内容的唯一事实来源（source of truth），离开 Loby 仍应可直接读取。
- 全局 registry 只记录名称与路径；删除条目或修改显示名称不得删除、移动或重命名本地目录。
- Loby 始终是写作工具：编辑器是主角，AI 是次级协作者。
- 敏感凭证不得进入写作目录、项目文件、浏览器存储、日志、截图或审阅文本。
- 任何工程优化都必须保持现有用户行为；不以目录整理、行数或风格统一为理由改写状态机、持久化时序或外部契约。

## 二、全局架构边界

- Tauri 2 提供桌面外壳；Rust 负责本地文件、进程、索引、发布、秘密存储和系统集成。
- TypeScript + React 负责 renderer；CodeMirror 6 负责编辑器；unified/remark/rehype 负责 Markdown 处理。
- renderer 依赖主方向为 `app → features → shared`；原生层以领域模块承载持久行为，Tauri commands/events 保持稳定且精薄。
- 当前不建立独立 `api/` 或 `chat/` 服务。只有出现明确的跨端共享或服务端唯一规则时，才在 ADR 记录后于 `services/` 创建可独立部署的服务。
- 项目文档、AGENTS 地图和代码注释默认使用中文；路径、标识符、命令、API 与专业术语保留准确的 English 原文。

## 三、顶层工程地图

<directory>
src/ - React renderer：应用组合、产品能力、共享契约、UI 基础与样式
src-tauri/ - Tauri 桌面外壳、Rust 原生领域、权限与 bundle 配置
scripts/ - 构建、Git hooks、bundle budget 与架构验证脚本
docs/ - 产品、架构、工程、安全、发布与 QA 文档
public/ - Vite 原样复制的静态 Web 资产
skills/ - 随产品维护的 Loby Codex skills
.github/ - Pull Request 模板与依赖更新配置
.githooks/ - `main` 写入保护与本地质量门禁
</directory>

<config>
package.json - npm 任务图、前端依赖与仓库级质量门禁
src-tauri/Cargo.toml - Rust crate 元数据与原生依赖边界
src-tauri/tauri.conf.json - 桌面窗口、bundle、权限与 Web runtime 配置
vite.config.ts - renderer 构建与开发服务器配置
vitest.config.ts - 前端测试环境与发现规则
eslint.config.js - TypeScript 与 React lint 规则
tsconfig.json - TypeScript 编译边界与路径规则
components.json - 本地 shadcn/ui registry 配置
.node-version - 固定 Node.js runtime
rust-toolchain.toml - 固定 Rust toolchain
</config>

## 四、执行入口

- 进入目标目录前读取最近的 L2 `AGENTS.md`；L1 不替代局部成员地图和领域契约。
- 代码、L3 头部与 L2 成员地图必须同构；具体 GEB 模板、触发条件和回环步骤见 [`docs/development.md`](docs/development.md)。
- 实质开发使用一个 `codex/<task>` 分支和一个 draft Pull Request；完整流程与风险门禁见 [`docs/development.md`](docs/development.md) 与 [`docs/code-review.md`](docs/code-review.md)。
- 有意义的代码改动以 `npm run check` 为本地合并门禁；持久化、编辑器、AI runtime 和原生契约须额外完成相应的定向回归。
- 视觉和交互决策见 [`docs/design-language.md`](docs/design-language.md)；前端与原生层所有权见 [`docs/frontend-structure.md`](docs/frontend-structure.md) 与 [`docs/native-structure.md`](docs/native-structure.md)。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
