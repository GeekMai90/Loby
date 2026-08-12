# Loby - 本地优先的专业写作应用

Tauri 2 + Rust + TypeScript + React 19 + CodeMirror 6 + unified/remark/rehype + Tailwind CSS 4 + shadcn/ui

> L1 | 项目宪法、全局边界与顶层导航

## 一、项目宪法

Loby 用适合 AI 协作的工作流帮助人类写得更好，而不是用一键生成取代作者。

- 作者始终拥有控制权；应用内 AI 修改必须可审阅、可拒绝、可撤销，并与本地快照关联。用户显式授权外部 Agent 使用 CLI 修改指定文稿时，CLI 可以直接替换正文，但必须精确定位文稿、保留元数据并限制在写作库受管目录内。
- 本地写作目录和 Markdown 是内容的唯一事实来源（source of truth），离开 Loby 仍应可直接读取。
- 全局 registry 只记录名称与路径；删除条目或修改显示名称不得删除、移动或重命名本地目录。
- Loby 始终是写作工具：编辑器是主角，AI 是次级协作者。
- 敏感凭证不得进入写作目录、项目文件、浏览器存储、日志或审阅文本；用户在设置中主动保存的 API Key 可按需回填到对应设置表单，默认以密码框遮罩并只在用户点击显示时呈现明文。OAuth token、refresh token 与设备授权秘密仍不得返回 renderer。
- 任何工程优化都必须保持现有用户行为；不以目录整理、行数或风格统一为理由改写状态机、持久化时序或外部契约。
- 文件长度只作职责审查信号，不设统一硬上限；按职责、状态所有权和数据流拆分，具体触发区间见 [`docs/development.md`](docs/development.md)。

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
cli/ - 可由 Agent 安装的落笔命令行、收件箱写入协议与配套 Skill
docs/ - 产品、架构、工程、安全与发布的长期文档
public/ - Vite 原样复制的静态 Web 资产
skills/ - 随产品维护的 Loby Agent Skills
.github/ - Pull Request 模板与依赖更新配置
.githooks/ - `main` 写入保护与本地质量门禁
</directory>

<config>
package.json - npm 任务图、前端依赖与仓库级质量门禁
src-tauri/Cargo.toml - Rust crate 元数据与原生依赖边界
src-tauri/tauri.conf.json - 桌面窗口、bundle、权限与 Web runtime 配置
src-tauri/tauri.windows.conf.json - Windows 专属窗口装饰配置，不改变 macOS 默认窗口
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

## 五、版本发布语义

- 应用版本使用三段式 SemVer；开发提交不自动增加版本，准备对用户发布时才增加一次。
- “修订版更新”“补丁版更新”“小修复”表示 `patch`：只修复问题或做兼容性维护，例如 `0.1.0 → 0.1.1`。
- “功能版更新”“次版本更新”“新功能版”表示 `minor`：增加向后兼容的新能力，例如 `0.1.0 → 0.2.0`。
- “重大版更新”“主版本更新”“破坏性更新”表示 `major`：存在不兼容行为或产品进入新的稳定阶段，例如 `0.1.0 → 1.0.0`。
- 用户使用上述中文语义提出发布请求时，执行对应的 `npm run release -- patch|minor|major`；命令会同步 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 与 `src-tauri/tauri.conf.json`，并保持应用版本来源一致。
- `npm run release -- --dry-run` 只预览版本同步结果，`npm run release -- --check` 只检查版本来源；版本准备命令不提交、打 tag 或上传 Release。版本 PR 合并并在 `main` 创建同版本 tag 后，通过手动 `Desktop release` 工作流先做三平台 dry-run，再执行正式发布。
- 源码与桌面 GitHub Release 统一位于公开仓库 `GeekMai90/Loby`；正式版本使用 `v<version>` tag 与 `落笔 <version>` 标题，原生 runner 分别构建 macOS Apple Silicon DMG、Windows x64 NSIS 和 Linux x64 AppImage。
- updater 的 `latest.json` 必须同时包含 `darwin-aarch64`、`windows-x86_64` 与 `linux-x86_64`，签名逐字取自各平台 `.sig`，URL 指向同仓库同一版本 Release；完整构建矩阵、逐资产 SHA-256 校验和匿名下载验收全部通过后才允许公开。
- “发布一下”但没有说明修订版、功能版或重大版时，不猜测版本类型；先确认这次变更属于哪一类。CLI 的版本号独立维护，不随桌面应用版本自动同步。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
