# 工程路线图

本文件只记录尚未完成且跨任务有效的工程方向。已完成事项由 Git 历史、`CHANGELOG.md` 和架构地图证明，不在这里堆叠日期日志或测试数量。

## 当前基线

- Tauri/Rust 负责文件系统、进程、监听、发布和本地持久化边界。
- React 按 `app / features / components / shared` 分层，`App.tsx` 只保留跨功能协调与主要表面组合。
- 本地写作库及其可见 Markdown 是事实来源，`.loby/` 保存可重建或应用管理的数据。
- AI 已迁移到 Loby-owned Agent Runtime；Provider、Tool、Skill、MCP 与凭证边界由原生层统一拥有，修改始终进入可审阅历史。
- 普通界面统一使用 Tailwind CSS v4、shadcn/ui 与语义 Token；领域 CSS 只保留明确例外。
- Renderer 首屏与 CodeMirror 编辑器内核分阶段加载，初始 JavaScript 总量和最大动态 chunk 都受生产 bundle 门禁约束；写作库启动恢复并行读取互不依赖的本地状态。
- 本地全文搜索由 native Tantivy/Jieba 持有索引：首次建立与显式重建执行全量校验，单文稿保存和外部 Markdown 变化优先走路径级增量同步；增量路径无法可靠应用时回退到全量校验，不以索引取代 Markdown 事实来源。
- GEB L1/L2/L3 与架构门禁共同约束代码和文档同构。

## 优先级

### P0：数据与编辑可靠性

- 持续验证长文性能、中文 IME、光标/选区、外部文件变化和原子写入。
- 对写作库迁移、图片路径、废纸篓恢复和持久化队列维持集成测试。
- 所有删除、移动、覆盖和 AI 写入都必须有明确目标、可恢复路径或确认步骤。

### P0：交互性能与流畅度

- 以生产 bundle、真实 renderer 长任务、桌面进程资源与原生 I/O 分段数据作为优化依据，不以文件长度或主观观感代替测量。
- 长文派生数据必须保持线性或有界扫描；文稿列表、目录、字数与编辑器装饰不得在单次输入中重复遍历完整正文。
- 发布、设置、统计和开发工具等非首屏能力按真实打开状态加载；编辑器、作者控制、持久化和恢复语义不得为缩小 bundle 而降级。
- 原生正文保存以 per-document revision、latest-wins 串行 writer、idle/max-dirty-age 双边界和稳定 ID 路径缓存落盘；CodeMirror 逐键排队与 React 项目树更新已经分离为即时耐久化和有界模型提交，继续用真实长文 profiler 收紧派生计算，同时保留切换前 flush、原子替换和精确内部写入过滤。
- AI 性能继续按 runtime、thread、首个增量、工具阶段与完成态分段；不得通过省略上下文、Skill、artifact 或 requestId 隔离换取表面速度。

### P1：状态所有权收敛

- 继续从 `App.tsx` 提取已有稳定边界，优先处理独立状态机和可单测协调逻辑。
- `App.tsx` 的后续拆分顺序应先处理独立的弹窗/页面组合与纯文稿 action，再处理仍依赖切换前 flush、编辑器 session 和选择修复的状态；拆分后 `App` 仍只拥有跨 feature 协调，不把保存时序下沉到展示组件。
- `useLibraryPersistence` 的搜索索引同步、文件监听、保存队列和切库恢复仍共享严格时序；只有在边界测试覆盖后，才把搜索同步或外部刷新提取为独立协调器，不能按行数机械切片。
- `src/shared/types.ts` 是高扇出公共契约入口；未来按领域拆分时保留原文件作为兼容性 re-export barrel，先迁移契约所有权，再逐步迁移调用方，避免一次性改动数百个 import。
- 消除业务组件中的重复几何、重复持久化和孤立快捷键实现。
- 新抽象必须减少调用方知识，不为行数指标增加中间层。

### P2：账号 Provider 与 Runtime 质量

- 持续验证 ChatGPT subscription endpoint 的模型目录、rate limit、错误映射和 refresh-token rotation；协议变化必须只收敛在账号 Provider 适配层。
- Claude 等订阅账号等待可验证授权边界；不以读取其他客户端 token 或未声明 cookie 的方式接入。
- 维持 OpenAI Responses、ChatGPT subscription、Anthropic/MiniMax Messages 与 Chat Completions 四类流协议的增量解码、累计 usage 和错误分类契约，并补强代表性真实服务 smoke test。
- 持续验证联网搜索的 Provider-native/无 Key 降级、图片生成的计费服务隔离，以及 MCP 的配置指纹、取消、审批和跨平台凭证存储。

### P1：跨平台发布准备

- 在 macOS 与 Windows 验证路径、文件监听、Provider 网络、秘密存储、OAuth 回调、MCP transport 和 WebView 行为。
- 维护依赖审计、Tauri capability 最小权限和发布凭证边界。
- 发布候选版本完整执行 `docs/release-checklist.md`。

### P2：发布与主题生态

- 保持公众号主题协议可验证、可回滚，并兼容独立 `.lobywechat` 文件。
- 新渠道先复用中立发布模型，再添加薄适配层；不得把渠道字段写死进编辑器核心。

## 完成定义

每个工程任务必须同时满足：行为保持或需求验收、相关自动化检查通过、风险得到手测、L3/L2/L1 回环完成、文档没有新增重复事实。

## 非目标

- 不因预想中的服务端能力提前引入 `api/` 或远程后端。
- 不以数据库或索引取代可见 Markdown 事实来源。
- 不为追求“全 Tailwind”删除 CodeMirror、发布预览、Liquid Glass 等合理的领域 CSS。
- 不进行缺少回归保护的大爆炸式重写。
