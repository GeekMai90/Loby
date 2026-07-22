# library/ - 本地写作库能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 写作库导航、项目/文稿列表、字段管理、创建/移动对话框与回收站界面
components/project-fields/ - 项目字段定义、默认值、类型与破坏性变更确认
hooks/ - 写作库持久化、选择修复、项目资源、文稿动作、拖拽与右键菜单协调
model/ - 本地模型、导入、图片资产、保存队列、选择/排序/移动规则与 registry 兼容层
constants/ - 项目外观、模板与字段稳定配置
</directory>

本地目录与 Markdown 是事实来源。registry 的删除和显示名修改不得触碰实际文件夹；持久化、外部刷新与选择修复的时序只能在集成覆盖保护下调整。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
