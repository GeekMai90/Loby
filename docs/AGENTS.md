# docs/ - 项目决策与工程记忆

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
adr/ - 不可逆或跨模块架构决策及其背景
qa/ - 需要长期保留的界面验收证据
</directory>

<member>
ai-integration.md - AI 上下文、action、审阅与作者控制权契约
claudian-migration-plan.md - 历史 AI 能力迁移范围与实现状态
code-review.md - 风险分级的代码审查与验证要求
content-metadata-lifecycle.md - 内容元数据的生命周期与兼容边界
current-implementation.md - 当前产品能力与已实现行为的长期记录
design-language.md - 产品视觉语言、交互基线与安静的写作中心原则
development.md - 环境、命令、分支/PR、质量门禁与 GEB 回环的工程入口
engineering-roadmap.md - 工程成熟度、已完成边界与后续拆分机会
frontend-structure.md - renderer feature-first 骨架、依赖方向与高风险边界
image-assets-design.md - 写作图片资产的存储、引用与清理设计
information-architecture.md - 写作库、项目、文稿与导航的产品信息架构
keyboard-shortcuts.md - App 与 CodeMirror 快捷键注册、显示和验证契约
local-first-file-architecture.md - 本地优先文件格式、目录、偏好与持久化不可变量
mvp-roadmap.md - MVP 范围、用户旅程与阶段性验收条件
native-structure.md - Rust/Tauri 模块所有权、commands 边界与测试方向
product-brief.md - Loby 产品定位、目标用户与核心价值
publishing.md - 导出、发布渠道、主题 registry 与凭证安全
release-checklist.md - 发布候选版的构建、编辑、持久化与平台验收
security.md - Tauri 权限、文件系统、进程与秘密的安全边界
tailwind-migration.md - Tailwind/shadcn 迁移范围、例外与进度
technical-stack.md - 技术选型、平台能力与已知风险
themes.md - 应用/编辑器主题模型、持久化 ID 与 palette 边界
wechat-theme-studio.md - 公众号主题工作室的产品与技术设计
</member>

本目录记录需要跨任务保留的决策与证据，不复制 L2 成员地图，不把临时调试过程写成永久规范。架构与产品假设变化时更新对应主题文档，不回填根级 L1 的局部实现细节。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
