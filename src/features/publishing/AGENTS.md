# publishing/ - 导出与发布能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 导出面板、条件发布入口、项目 GitHub/墨问/微信界面与公众号主题工作室
hooks/ - 项目导出状态与浏览器副作用协调
model/ - 渠道契约、GitHub 文章 payload、渲染器、主题注册/存储/会话、预览与 Tauri API 适配
</directory>

公众号主题统一通过 `model/wechatThemes.ts` 的类型化 registry 扩展。项目 GitHub 发布目标的名称、仓库、分支、文章目录与站点地址随 `project.toml` 持久化；底层 `[blogPublishing]` 键为旧项目兼容契约，不作为界面名称。GitHub App Device Flow、令牌轮换、安装仓库缓存与发布时目标权限检查归 Rust，renderer 只消费一次性设备码、连接状态、仓库清单和稳定进度事件，禁止发布秘密进入 renderer 持久化、写作库、日志和审阅文本。

墨问与项目 GitHub 发布共用无渠道图标的“发布到 + 目标名称”紧凑标题栏、`PublishDocumentSummary` 确认摘要、`PublishTypewriterLoader`、`direct-publish-body` 进度几何和成功态反馈。确认态只展示文章信息与公开/私密选择，不发 GitHub 网络请求，也不暴露内部 slug；用户点击“发布”或“更新”后，进度状态首先检查 GitHub 连接与目标仓库权限，授权类错误进入“前往设置”，临时错误保留“重试”。公开/私密只改变辅助文案与发布 payload，主操作仅按历史发布状态命名为“发布”或“更新”。发布中和成功态不重复文章摘要，成功态通过 `CopyPublishLinkButton` 复制 native 返回的真实文章地址。`MowenPublishView` 与 `GitHubPublishView` 是不持有发布副作用的渠道状态视图，由业务 Dialog 和设计系统共同消费，渠道控制器只提供真实阶段到百分比/文案的映射。发布成功后父级会回写文稿元数据，Dialog 本地 success 状态不得因此重置为确认态。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
