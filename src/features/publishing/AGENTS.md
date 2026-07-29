# publishing/ - 导出与发布能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 导出面板、条件发布入口、应用级 GitHub 目标/墨问/微信界面与公众号主题工作室
hooks/ - 项目导出状态、应用级发布目标状态与浏览器副作用协调
model/ - 渠道/发布目标契约、GitHub 文章 payload、渲染器、主题注册/存储/会话、预览与 Tauri API 适配
</directory>

公众号主题统一通过 `model/wechatThemes.ts` 的类型化 registry 扩展。Markdown/HTML bundle 中的本地图片统一导出为标准 Markdown 可移植引用，兼容输入的 Obsidian embed 不作为输出方言。设置页先以“发布目标”目录管理 GitHub/墨问渠道接入，再在已接入 GitHub 下展示同构的具体目标目录；渠道行与子目标行只显示名称和更多菜单，不把身份动作、敏感字段或仓库表单平铺在列表中。GitHub 发布目标以应用级 registry 持久化在 app-config，分享入口从全部已启用目标生成，不受文稿所在项目限制；项目只提供当前文稿和图片路径上下文，不拥有仓库参数。GitHub App Device Flow、令牌轮换、安装仓库缓存与发布时目标权限检查归 Rust；设置目录只读取本地凭证存在性来即时恢复“已添加”状态，进入页面不自动验证网络，只有用户显式刷新、打开仓库设置或真实发布才访问 GitHub。renderer 只消费一次性设备码、去敏连接状态、仓库清单和稳定进度事件，禁止发布秘密进入 renderer 持久化、写作库、日志和审阅文本。文稿发布结果按 target ID 写入 `publications`，多个目标之间不得覆盖远端身份、URL 或 commit。

发布目标属于非首屏状态，只能在写作库恢复完成且真实路径确定后加载；`Loading library` 等启动占位值不得触发 native 读取或旧项目配置迁移。

Hugo `description` 与 WordPress `excerpt` 只来自当前文稿显式填写的 `description`；摘要为空时省略或发送空值并由目标平台自行回退，禁止使用项目描述或模板文案补位。

墨问与应用级 GitHub 目标发布共用无渠道图标的“发布到 + 目标名称”紧凑标题栏、`PublishDocumentSummary` 确认摘要、`PublishTypewriterLoader`、`direct-publish-body` 进度几何和成功态反馈。确认态只展示文章信息与公开/私密选择，不发 GitHub 网络请求，也不暴露内部 slug；用户点击“发布”或“更新”后，进度状态首先检查 GitHub 连接与目标仓库权限，授权类错误进入“前往设置”，临时错误保留“重试”。公开/私密只改变辅助文案与发布 payload，主操作仅按历史发布状态命名为“发布”或“更新”。发布中和成功态不重复文章摘要，成功态通过 `CopyPublishLinkButton` 复制 native 返回的真实文章地址。`MowenPublishView` 与 `GitHubPublishView` 是不持有发布副作用的渠道状态视图，由业务 Dialog 和设计系统共同消费，渠道控制器只提供真实阶段到百分比/文案的映射。发布成功后父级会按 target ID 回写文稿元数据，Dialog 本地 success 状态不得因此重置为确认态。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
