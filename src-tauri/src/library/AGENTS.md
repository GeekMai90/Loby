# library/ - 本地写作库领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
document_id.rs - 26 位 Base32 文稿身份、重建索引迁移记录与本地引用修复
project_metadata.rs - project.toml 项目元数据、文稿自定义属性定义与顺序恢复，不承载应用级发布目标
save.rs - Markdown、项目元数据、index 与受管路径保存
scan.rs - 确定性的 folder-first 写作库扫描
trash.rs - 项目、文稿与图片的回收、恢复和永久删除
library_preferences_store.rs - 非敏感写作库偏好持久化
writing_activity_store.rs - 写作活动与目标完成事件持久化
watcher.rs - 当前写作库文件监听与事件过滤
</member>

本地文件系统是事实来源；`.loby` 只保存应用元数据。用户主动打开已有目录时，只接受包含 `.loby`，或同时包含 `inbox`、`notes`、`projects` 的写作文件夹，普通目录不得进入加载与写入链路。文稿 ID 统一为 `sheet-` 加 26 位小写 Crockford Base32，普通加载不得静默迁移；用户主动重建索引时才补齐或修复旧 ID，并同步本地偏好、写作活动、AI 对话与已发布文章的历史 source identity。watcher 必须忽略内部写入和写作库可见区域之外的路径。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
