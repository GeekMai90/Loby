# Loby - 本地优先的专业写作应用

Tauri 2 + Rust + TypeScript + React 19 + CodeMirror 6 + unified/remark/rehype + Tailwind CSS 4 + shadcn/ui

> L1 | 项目宪法、全局工程地图与开发约束

## 一、产品使命

Loby 用适合 AI 协作的工作流帮助人类写得更好，而不是用一键生成取代作者。所有产品与工程决策必须守住以下不变量：

- 作者始终拥有控制权；AI 修改必须可审阅、可拒绝、可撤销，并与本地快照关联。
- 本地写作文件夹和项目目录是内容的唯一事实来源（source of truth）；Markdown 离开 Loby 后仍应可直接阅读。
- 全局写作文件夹注册表（registry）只能记录名称与路径；删除条目或修改显示名称不得删除、移动或重命名本地目录。
- Loby 必须始终像写作工具，而不是聊天应用；编辑器是主角，AI 是次级协作者。
- 发布秘密不得进入写作文件夹、项目文件、浏览器存储、日志、截图或审阅文本。

## 二、技术边界

- Tauri 2 提供桌面外壳；Rust 负责本地文件、进程、索引、发布、秘密存储和系统集成。
- TypeScript + React 负责界面；CodeMirror 6 负责编辑器；unified/remark/rehype 负责 Markdown 处理。
- 不引入 Electron，除非聚焦的编辑器原型证明 Tauri/WebView 无法满足长文、中文 IME、选区或装饰层性能要求。
- 前端只消费稳定的 Tauri commands 与 events；原生命令负责校验和转换输入，持久行为下沉到聚焦的 Rust 领域模块。
- 普通写作使用浏览器原生选区；只有定向回归证明必要时才启用 CodeMirror `drawSelection`。
- 当前不建立独立 `api/` 或 `chat/` 服务。只有出现账号/计费、跨设备同步、多人协作、Web/移动端复用、服务端唯一业务规则或远程 AI gateway 等明确需求时，才在 `services/` 下创建可独立部署的服务，并先记录 ADR。

## 三、产品界面基线

### 3.1 视觉方向

- 使用清新、白色优先、Apple 风格的桌面审美：白色表面、浅灰分隔、system blue、克制排版和安静的编辑布局。
- 避免米色纸张主题、温暖编辑部默认风格、重卡片堆叠、装饰渐变、饱和状态块和喧闹的 AI 仪表盘。
- 菜单与选择器统一使用高不透明液态玻璃浮层、细边框与阴影、中性 hover/keyboard-active 行；选中项只显示 checkmark，不保留彩色背景。

### 3.2 选择与焦点

- 左侧导航栏和文稿列表必须区分选中状态（selection）与焦点（focus），焦点移动不得清空选择。
- 当前激活栏的选中项使用 system-blue 主色处理。
- 焦点移到另一栏或编辑器后，导航选中态使用 `#DFF1FC` + 蓝色内容；文稿选中态使用 `#DCDCDC` + 普通内容。
- 点击或聚焦编辑器时，两栏都进入非激活选中状态。

### 3.3 编辑器、AI 与发布

- AI 模型、推理和速度设置保留为输入工具栏的紧凑文字控件，复用 `AssistantModelSettingsMenu`，不新建一次性下拉菜单。
- AI 修改结果卡属于持久化消息历史；详细 diff 属于编辑器，新增为蓝色、删除为弱化删除线、未变内容不标记。
- 公众号主题统一注册在 `src/features/publishing/model/wechatThemes.ts`，通过类型化注册表扩展，禁止按主题名称分支对话框。
- 发布凭证使用当前用户平台 app-config 目录中的跨平台 Rust secret store；环境变量可以覆盖，但 system Keychain 等单一操作系统服务不得成为唯一存储路径。

## 四、UI 组件规范

- Tailwind CSS 4 与 shadcn/ui 是 UI 基础：普通布局和状态使用 Tailwind，共享控件使用本地 shadcn primitives。
- shadcn 源码位于 `src/components/ui/`，class 合并位于 `src/shared/lib/utils.ts`，独立主题入口位于 `src/styles/shadcn.css`。
- Tailwind Preflight 已启用；native、CodeMirror、液态玻璃等例外必须显式声明依赖的浏览器样式，不依赖 user-agent defaults。
- Animate UI 只在动效明显改善反馈或状态过渡时使用，复制源码保留在 `src/components/animate-ui/`。
- 新增或迁移的产品 UI 必须组合本地 primitives，不重复实现 button、input、dialog、menu、tooltip 或 progress。
- 普通按钮使用 shadcn `Button` 默认值与标准 variants，不复刻 `.primary-button`、`.secondary-button`、`.text-button`、`.icon-button`；`LiquidGlassButton` 及其 joined group 是明确例外。
- Dialog footer 与 body 使用同一表面，不增加分隔线或染色 footer strip；取消/关闭在左，保存/确认在右。

## 五、工程地图与文件归属

<directory>
src/ - React renderer：app 组合层、feature 产品能力、shared 公共契约、UI 基础与样式
src-tauri/ - Tauri 桌面外壳、Rust 原生领域、capabilities、icons 与生成配置
scripts/ - 构建、Git hooks、bundle budget 与架构验证脚本
docs/ - 产品决策、架构、工程实践、安全、发布与持久 QA 证据
public/ - 由 Vite 原样复制的静态 Web 资产
skills/ - 随产品维护的 Loby Codex skills
.github/ - Pull Request 模板与依赖更新配置
.githooks/ - main 写入保护与本地质量门禁 hooks
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

### 5.1 前端文件归属

- `src/app/App.tsx` 只负责顶层状态协调和主要界面组合；稳定 UI、常量、helpers 与状态机必须进入聚焦文件。
- renderer 依赖方向以 `app → features → shared` 为主。`shared` 禁止依赖 app 或具体 feature；新增 feature 间协作优先通过 shared 契约或提升到 app 协调。
- 产品能力按真实领域放入 `src/features/<feature>/`，内部按需要使用 `components/`、`hooks/`、`model/`、`constants/`；不创建空目录或占位文件。
- 跨功能 UI、hooks、常量、types 与无领域偏向的 helpers 放入 `src/shared/`；shadcn 与 Animate UI 源码继续留在 `src/components/`，不得混入产品 feature。
- 新 modal、panel、inspector tab、sidebar、toolbar 或 picker 从所属 feature 的独立组件开始，不向 `App.tsx` 塞入大段 JSX。
- 大型选项列表、模板、图标/颜色 palette 和 seed-like configuration 进入所属 feature 的 `constants/` 或 `model/`，不得进入 `App.tsx`。
- App 与 editor keyboard shortcuts 统一声明在 `src/shared/lib/keyboardShortcuts.ts`，复用 matcher、formatter、无障碍标签与 CodeMirror key conversion；禁止孤立 `keydown` listener 和重复快捷键标签。
- Application/editor theme palette 统一通过 `src/styles/themes.css` tokens 表达；选项与持久化 ID 位于 `src/shared/constants/themes.ts` 和 `src/shared/lib/themes.ts`，组件与 CodeMirror extension 不得硬编码第二套 palette。

### 5.2 样式归属

- `src/styles.css` 只作为 import entrypoint，不承载功能样式。
- 自定义 CSS 只服务共享 tokens/resets 与显式例外：shell geometry、liquid glass、CodeMirror/editor theme、rich Markdown、diff、drag/drop、image lightbox、publishing preview、responsive geometry 和 state animation。
- AI fading header 位于 `src/styles/ai.css`；AI rich Markdown/message animation 位于 `src/styles/ai-thread.css`；持久化 diff 位于 `src/styles/ai-review.css`。
- 普通 AI 布局与控件使用 Tailwind/shadcn。修改样式时先进入现有归属文件，只有新的主要界面无法归属时才创建 stylesheet。

### 5.3 拆分尺度

- 优先采用小而可逆的实现步骤，每一步都必须能独立验证和回滚。
- 文件长度是审阅信号，不是机械拆分目标。优先检查：普通 component 约 300 行、复杂 feature panel/hook 约 500 行、helper 约 400 行、样式文件约 800 行。
- 单文件超过 800 行必须视为重构契机；不得继续塞入无关职责。若文件仍有单一、清晰且不可安全分割的所有权，可保留，但必须在相关架构文档中说明原因。
- 按产品职责、状态所有权或数据流边界拆分；禁止为了数字好看增加间接层。
- `App.tsx` 保留顶层状态与持久化所有权，只有稳定边界具备聚焦的 integration coverage 后才能移动。

## 六、GEB 分形文档回环

- 进入目录前先读取最近的 `AGENTS.md`；修改源码前先读取文件头部 L3 契约。
- 新增非空源码或文档模块时同时创建 L2 `AGENTS.md`，写明父级、完整成员清单、职责边界、依赖方向与固定 protocol。
- 新增或实质修改业务文件时维护 L3：`[INPUT]` 说明真实依赖，`[OUTPUT]` 说明对外能力，`[POS]` 说明模块位置与协作关系。
- L2/L3 必须包含固定文本：`[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md`。
- 修改完成后依次检查 L3 → L2 → L1；代码结构和文档地图不一致时，任务不算完成。
- 禁止批量插入空洞 L3 模板；历史缺口按实际改动边界补齐，契约债务只能减少，不能新增。
- 生成产物、忽略的浏览器证据、依赖缓存和构建产物不属于源码所有权地图。

## 七、开发与 Pull Request 流程

- 本节是实质开发的默认授权，用户无需为每个任务重复说明分支与交付流程。
- 一个完整任务对应一个 `codex/<short-task-name>` 分支和一个 Pull Request；一个 PR 可以包含多个实现 commit，不按 commit 拆 PR。
- 开始前运行 `git status --short --branch`。不得直接在 `main` 开展实质开发。
- `main` 干净时先创建任务分支；若已有明确属于当前任务的改动，原样带入分支，不 stash、不丢弃；所有权不清时先保留并询问。
- 不相关任务使用不同分支；避免并行修改同一协调器或状态机。
- 实现期间可以按需要创建多个本地 commit，但历史必须保持连贯并只包含当前任务。
- 实现完成后审阅完整 diff，并运行 `npm run check`；把本地结果写入 PR。
- 默认交付：只提交当前任务文件、push 任务分支、使用 `.github/pull_request_template.md` 创建 draft PR。只有用户明确要求仅保留本地、不 commit/push，或存在未解决的无关改动时才跳过。
- GitHub-hosted Actions 为避免 private runner 费用而关闭，禁止添加自动 Actions checks；tracked hooks、本地 `npm run check` 和人工 PR review 是合并门禁，不要求 remote Check status。
- 完成的 PR 使用 squash merge；没有用户明确批准不得自动 merge。合并后删除远端任务分支。
- 禁止 force-push `main`、带未解决 review comments 合并、或削弱测试以换取通过。
- Git hooks 阻止直接 commit/push `main`；`LOBY_ALLOW_MAIN_WRITE=1` 仅在用户明确授权直接修复 `main` 时使用。

## 八、验证底线

- 每个重构步骤必须保持行为不变，并在实际可行时通过 `npm run check`；只有范围很窄的纯前端改动才可单独使用 `npm run build:web`。
- 工程重构优先验证：长 Markdown 编辑性能、中文 IME、selection/cursor、focus mode、Markdown decorations、本地文件读写、Codex skill 调用与结果审阅。
- 涉及持久化、外部文件刷新、选择修复或状态所有权的移动，必须先建立聚焦的 unit/integration coverage。
- 不因为文件过大而盲拆 editor input、AI runtime、preview、persistence 或 native cross-domain test；先证明新的稳定所有权边界。

## 九、文档语言

- 项目文档、AGENTS 地图、设计决策和代码注释默认使用中文。
- 文件路径、代码标识、命令、API、框架名和无法准确替代的专业术语保留英文原文。
- 关键术语首次出现时可写成“中文（English）”，后续固定同一名称，避免同义词漂移。
- 规划文档保持短、具体、面向决策；产品方向、架构、数据格式或 AI 工作流假设变化时同步更新，不把仓库变成通用知识库。
- 不为追求全中文翻译代码符号，也不为形式统一批量改写语义未变化的历史文档。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
