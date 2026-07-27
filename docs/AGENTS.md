# docs/ - 项目决策与工程记忆

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
adr/ - 不可逆或跨模块架构决策及其背景
</directory>

<member>
agent-skills.md - 开放 Agent Skills 的产品分层、包格式、创建迁移、工具映射与验证契约
ai-integration.md - AI 运行时、上下文、审阅与作者控制权契约
code-review.md - 风险分级的代码审查与验证要求
content-metadata-lifecycle.md - 内容元数据、归档与废纸篓的生命周期边界
design-language.md - 产品视觉语言、Design Token 与共享交互基线
development.md - 环境、命令、分支/PR、质量门禁与 GEB 回环入口
engineering-roadmap.md - 当前工程优先级、完成定义与明确非目标
frontend-structure.md - renderer feature-first 骨架、依赖方向与高风险边界
image-assets-design.md - 写作图片资产的存储、引用、导出与清理设计
keyboard-shortcuts.md - App 与 CodeMirror 快捷键注册、显示和验证契约
local-first-file-architecture.md - 本地优先文件格式、目录、偏好与持久化不可变量
markdown-import.md - Markdown/Obsidian 来源扫描、字段映射、目录分组与图片迁移契约
native-structure.md - Rust/Tauri 模块所有权、command 边界与测试方向
product-brief.md - Loby 产品定位、核心心智模型与非目标
publishing.md - 导出、发布渠道、主题 registry 与凭证安全
release-checklist.md - 发布候选版的构建、编辑、持久化与平台验收
security.md - Tauri 权限、文件系统、进程与秘密的安全边界
themes.md - 应用/编辑器主题模型、持久化 ID 与 palette 边界
wechat-theme-studio.md - 微信公众号主题工作室的产品与技术契约
</member>

本目录只保留跨任务仍然有效的决策、契约和发布证据。当前实现的文件级地图由各模块 `AGENTS.md` 与 L3 头部维护；临时排查记录、一次性截图、已完成迁移日志和会随提交迅速失真的统计数字不得长期留在这里。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
