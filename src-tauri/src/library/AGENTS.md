# library/ - 本地写作库领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
project_metadata.rs - project.toml 元数据与顺序恢复
save.rs - Markdown、项目元数据、index 与受管路径保存
scan.rs - 确定性的 folder-first 写作库扫描
trash.rs - 项目、文稿与图片的回收、恢复和永久删除
library_preferences_store.rs - 非敏感写作库偏好持久化
writing_activity_store.rs - 写作活动与目标完成事件持久化
watcher.rs - 当前写作库文件监听与事件过滤
</member>

本地文件系统是事实来源；`.loby` 只保存应用元数据。watcher 必须忽略内部写入和写作库可见区域之外的路径。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
