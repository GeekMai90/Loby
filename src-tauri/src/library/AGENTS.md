# library/ - 本地写作库领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
loby-welcome-cover.webp - 首次创建写作库时随内置“落笔指南”写入 `assets/images` 的压缩欢迎封面资源（1280×720 WebP）
 active_library.rs - 桌面端与 CLI 共享的活动写作库定位文件，成功加载和移动后原子维护真实路径
document_id.rs - 26 位 Base32 文稿身份、重建索引迁移记录与本地引用修复
project_metadata.rs - project.toml 项目元数据、文稿收藏索引、项目级新文稿目标默认值、自定义属性、非敏感发布目标绑定、顺序恢复与旧文稿归档状态迁移，不承载应用级目标参数或凭证
save.rs - Markdown、项目元数据与 metadata-only index 保存，高频正文按文稿 revision 原子写入并复用进程内稳定 ID 路径索引；标题改名在移动前登记源/目标内部路径，结构保存不通过模型差异清扫文件
scan.rs - 确定性的 folder-first 写作库扫描，恢复文稿收藏元数据，并把旧 `status: 已归档` 单向收敛为 `archivedAt`
trash.rs - 项目、文稿与图片的回收、恢复和永久删除
library_preferences_store.rs - 非敏感写作库偏好持久化
writing_activity_store.rs - 写作活动与目标完成事件持久化
watcher.rs - 当前写作库文件监听，按精确路径过滤内部正文写入、标题改名两端与原子临时文件
</member>

本地文件系统是事实来源；`.loby` 只保存应用元数据。用户主动打开已有目录时，只接受包含 `.loby`，或同时包含 `inbox`、`notes`、`projects` 的写作文件夹，普通目录不得进入加载与写入链路。成功加载的当前写作库必须以不含正文和 registry 的版本化定位文件同步给 CLI；定位文件写入失败不得阻断桌面写作，移动当前库时应同步新路径。文稿 ID 统一为 `sheet-` 加 26 位小写 Crockford Base32，普通加载不得静默迁移；用户主动重建索引时才补齐或修复旧 ID，并同步本地偏好、写作活动、AI 对话与已发布文章的历史 source identity。文稿模型不拥有系统状态；读取旧 Markdown 或索引时只把 `status: 已归档` 迁为 `archivedAt`，保存 Markdown、project.toml 和 renderer payload 时都不得再输出文稿 `status`。保存只能按已知稳定 ID 精确改名或移动文稿，不能把“不在当前模型里”解释为删除；单文稿保存不得扫描或序列化整库，metadata-only index 不得写回 Markdown 正文；用户清理空白文稿和删除文稿都必须进入废纸篓。watcher 必须按精确路径忽略已登记的内部写入和原子临时文件，并继续上报其他外部变化。

文稿收藏写入 Markdown 私有 `loby.favorite` 布尔字段，并在 `project.toml` 索引中冗余；扫描以 Markdown 为事实来源、索引为缺失字段回退。未收藏文稿不输出该字段，收藏切换不改正文和 `updatedAt`。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
