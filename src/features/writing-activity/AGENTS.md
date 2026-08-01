# writing-activity/ - 写作目标与活动

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 项目目标进度与写作活动面板
hooks/ - 活动记录、目标完成检测与庆祝反馈协调
model/ - 写作目标计算与庆祝状态规则
</directory>

活动记录消费写作库事实，但不拥有文稿内容；统计和庆祝逻辑保持确定性，当前文稿达标检测复用 app 为同一正文 revision 预计算的字数，不得再次扫描全文；持久化继续通过稳定 Tauri command 完成。正文高频提交只派生引用已变的项目/文稿 check-in，关闭的写作热力图不得计算全库字数；浮层打开后的项目信息也必须在单次正文扫描中同时物化总字数与目标进度。项目目标的 `articles` 单位直接统计项目内未归档文稿数量，不引入或依赖文稿完成状态。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
