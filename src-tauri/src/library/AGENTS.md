# library/ - 本地写作库领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
document_id.rs - 26 位 Base32 文稿身份、重建索引迁移记录与本地引用修复
project_metadata.rs - project.toml 项目元数据、项目级新文稿目标默认值、自定义属性、非敏感发布目标绑定与顺序恢复，不承载应用级目标参数或凭证
save.rs - Markdown、项目元数据与 metadata-only index 保存，高频正文按文稿 revision 原子写入并复用进程内稳定 ID 路径索引；结构保存精确迁移改名或跨目录路径，不通过模型差异清扫文件
scan.rs - 确定性的 folder-first 写作库扫描
trash.rs - 项目、文稿与图片的回收、恢复和永久删除
library_preferences_store.rs - 非敏感写作库偏好持久化
writing_activity_store.rs - 写作活动与目标完成事件持久化
watcher.rs - 当前写作库文件监听与事件过滤
</member>

本地文件系统是事实来源；`.loby` 只保存应用元数据。用户主动打开已有目录时，只接受包含 `.loby`，或同时包含 `inbox`、`notes`、`projects` 的写作文件夹，普通目录不得进入加载与写入链路。文稿 ID 统一为 `sheet-` 加 26 位小写 Crockford Base32，普通加载不得静默迁移；用户主动重建索引时才补齐或修复旧 ID，并同步本地偏好、写作活动、AI 对话与已发布文章的历史 source identity。保存只能按已知稳定 ID 精确改名或移动文稿，不能把“不在当前模型里”解释为删除；单文稿保存不得扫描或序列化整库，metadata-only index 不得写回 Markdown 正文；用户清理空白文稿和删除文稿都必须进入废纸篓。watcher 必须按精确路径忽略已登记的内部写入和原子临时文件，并继续上报其他外部变化。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
