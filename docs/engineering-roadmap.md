# 工程路线图

本文件只记录尚未完成且跨任务有效的工程方向。已完成事项由 Git 历史、`CHANGELOG.md` 和架构地图证明，不在这里堆叠日期日志或测试数量。

## 当前基线

- Tauri/Rust 负责文件系统、进程、监听、发布和本地持久化边界。
- React 按 `app / features / components / shared` 分层，`App.tsx` 只保留跨功能协调与主要表面组合。
- 本地写作库及其可见 Markdown 是事实来源，`.loby/` 保存可重建或应用管理的数据。
- AI 迁移到 Loby-owned Agent Runtime；Provider、Tool、Skill、MCP 与凭证边界按 `docs/ai-integration.md` 分阶段落地，修改始终进入可审阅历史。
- 普通界面统一使用 Tailwind CSS v4、shadcn/ui 与语义 Token；领域 CSS 只保留明确例外。
- GEB L1/L2/L3 与架构门禁共同约束代码和文档同构。

## 优先级

### P0：数据与编辑可靠性

- 持续验证长文性能、中文 IME、光标/选区、外部文件变化和原子写入。
- 对写作库迁移、图片路径、废纸篓恢复和持久化队列维持集成测试。
- 所有删除、移动、覆盖和 AI 写入都必须有明确目标、可恢复路径或确认步骤。

### P1：状态所有权收敛

- 继续从 `App.tsx` 提取已有稳定边界，优先处理独立状态机和可单测协调逻辑。
- 消除业务组件中的重复几何、重复持久化和孤立快捷键实现。
- 新抽象必须减少调用方知识，不为行数指标增加中间层。

### P2：账号 Provider 与 Runtime 质量

- 等待供应商提供正式第三方订阅授权契约；在此之前只维护 OpenAI API、Anthropic API 与 OpenAI-compatible Provider。
- 为 OpenAI 与 Anthropic 适配器增加原生增量流式解析、累计 usage 和代表性真实服务契约测试。
- 为联网搜索、图片生成和 MCP 增加可替换适配器及跨平台凭证存储验收。

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
