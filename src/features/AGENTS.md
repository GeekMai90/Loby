# features/ - 产品能力层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
assistant/ - AI 会话、执行、审阅与 composer
editor/ - CodeMirror 编辑、文稿信息、历史与资源面板
library/ - 本地写作库、项目、文稿列表、字段、持久化与回收站
publishing/ - 导出、墨问、微信公众号与主题工作室
settings/ - 设置导航与各设置面板
writing-activity/ - 写作目标、活动记录与庆祝反馈
zen-mode/ - 禅模式窗口、布局、声音与保存协调
</directory>

每个 feature 内按真实需要使用 `components/`、`hooks/`、`model/`、`constants/`。禁止创建空目录；跨 feature 规则应优先下沉为 shared 契约或提升到 app 协调。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
