# publishing/ - 导出与发布能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 导出面板、条件发布入口、GitHub 目标实例、项目绑定与 Starlight 同步、墨问/微信界面与公众号主题工作室
hooks/ - 项目导出状态、应用级发布目标状态与浏览器副作用协调
model/ - 渠道/发布目标契约、GitHub 博客与帮助中心 payload、渲染器、主题注册/存储/会话、预览与 Tauri API 适配
</directory>

公众号主题统一通过 `model/wechatThemes.ts` 的类型化 registry 扩展。Markdown/HTML bundle 中的本地图片统一导出为标准 Markdown 可移植引用，兼容输入的 Obsidian embed 不作为输出方言。设置页先以“发布目标”目录管理 GitHub、墨问与微信公众号渠道接入，再在已接入 GitHub 下展示同构的具体目标目录；渠道行与子目标行只显示名称和更多菜单，不把身份动作、敏感字段或仓库表单平铺在列表中。微信公众号 AppID 存在 app-config，AppSecret 只进入 native secret store；设置页只读本地状态，显式验证或预览中的真实推送才访问微信。公众号预览保留复制/图床入口并新增草稿按钮，使用当前主题重新渲染，第一张本地图片作为封面，正文图片上传到微信 CDN；只新增或更新草稿，不执行正式发布，不修改源 Markdown。草稿 `media_id` 与 AppID 按稳定 target ID 写入 `publications`，仅在相同 AppID 下复用更新。GitHub 目标 registry 默认没有实例，只内置 `Hugo 博客` 与 `Starlight 文档站` 两种通用适配器，用户保存的私人站点均为普通实例；旧博客和帮助中心配置迁移出的实例继续保留。GitHub 目标参数以应用级 registry 持久化在 app-config，项目在 `project.toml` 中只保存一对一 target ID 引用和 Starlight 分组投影；分享入口只从当前项目绑定且可用的目标生成，收件箱、笔记或未绑定项目不得看到其他项目的 GitHub 目标。GitHub App Device Flow、令牌轮换、安装仓库缓存与发布时目标权限检查归 Rust；设置目录只读取本地凭证存在性来即时恢复“已添加”状态，进入页面不自动验证网络，只有用户显式刷新、打开仓库设置或真实发布才访问 GitHub。用户主动保存的 API Key 可由专用设置 command 回填到受控密码框，但不得进入 renderer 持久化、写作库、日志和审阅文本；GitHub OAuth token、refresh token 与设备授权秘密仍只停留在 Rust。文稿发布结果按 target ID 写入 `publications`，多个目标之间不得覆盖远端身份、URL 或 commit。

发布目标属于非首屏状态，只能在写作库恢复完成且真实路径确定后加载；`Loading library` 等启动占位值不得触发 native 读取或旧项目配置迁移。

Hugo 与 Starlight 是同一 GitHub 发布管线的格式适配器：前者生成 page bundle 和博客 Front Matter，后者生成项目分组目录、Starlight Front Matter、图片路径与所有权清单。项目设置负责选择目标；只有 Starlight 绑定额外维护分组目录映射，新分组默认使用清理后的同名中文目录并立即保存映射，默认“待整理”永不自动启用。`HelpCenterSyncDialog` 只执行已绑定目标的单篇同步或项目增量发布，不再编辑仓库参数；项目顶部“发布”与项目右键发布共用同一入口和完整发布范围，新增、更新及无变化文稿由同一次 GitHub tree 提交收敛。它通过 `HelpCenterSyncView` 复用墨问发布的确认、固定高度打字机进度、成功/错误恢复语法，单篇确认态提高文稿标题层级，并依次展示文稿规模、GitHub 仓库、实际发布目录与同步状态，不重复模态窗标题中的动态站点名称。单篇动作以发布输入指纹区分“同步”“更新”和禁用的“已同步”；旧记录回退比较编辑时间与上次发布时间，下一次成功同步后补齐指纹。成功后直接消费 native 返回的单篇 URL，并同时保留设置中站点地址作为网站出口。项目发布默认保留远端多余文稿，只有用户显式开启清理时，native 才按版本化所有权清单删除已不在当前发布范围内的文稿与配图；清理模式允许当前发布范围为空。`model/helpCenter.ts` 必须让单篇与项目发布生成同构 payload 并保持已发布 slug。

图床服务归“发布”设置页所有，不占用独立设置分类；发布主页在发布目标与 GitHub 子目标之后展示图床目录，进入具体阿里云 OSS 设置时由该二级页接管当前发布内容区。图床目录只显示 native 判定完整的配置，新建入口与腾讯云占位仍由 settings 编排，上传和 Secret 持久化继续归原生 publishing 领域。

Hugo `description` 与 WordPress `excerpt` 只来自当前文稿显式填写的 `description`；摘要为空时省略或发送空值并由目标平台自行回退，禁止使用项目描述或模板文案补位。

墨问与应用级 GitHub 目标发布共用无渠道图标的“发布到 + 目标名称”紧凑标题栏、`PublishDocumentSummary` 确认摘要、`PublishTypewriterLoader`、`direct-publish-body` 进度几何和成功态反馈。确认态的文稿标题使用统一分组标题层级，并统一显示字符数与 Markdown 图片引用数；可见范围只保留正常字号标签，右侧使用较正文更低视觉权重的紧凑等分选择器，不重复解释当前选择。确认态只展示文章信息与公开/私密选择，不发 GitHub 网络请求，也不暴露内部 slug；用户点击“发布”或“更新”后，进度状态首先检查 GitHub 连接与目标仓库权限，授权类错误进入“前往设置”，临时错误保留“重试”。公开/私密只改变发布 payload，主操作仅按历史发布状态命名为“发布”或“更新”。发布中和成功态不重复文章摘要，成功态通过 `CopyPublishLinkButton` 复制 native 返回的真实文章地址。`MowenPublishView` 与 `GitHubPublishView` 是不持有发布副作用的渠道状态视图，由业务 Dialog 和设计系统共同消费，渠道控制器只提供真实阶段到百分比/文案的映射。发布成功后父级会按 target ID 回写文稿元数据，Dialog 本地 success 状态不得因此重置为确认态。

微信公众号草稿从主题预览按钮进入独立紧凑确认模态窗，不在预览表面直接执行网络请求或显示悬浮结果。`WechatDraftPublishView` 与墨问/GitHub 使用同一 `ready → publishing → success/error` 语法、`PublishTypewriterLoader`、`Progress` 和 `direct-publish-body` 固定几何；确认态统一显示标题、字符数和 Markdown 图片引用数，并以无底色摘要行列出公众号草稿箱、当前主题与封面来源，不重复发布位置说明。主操作按相同 AppID 下的 `media_id` 显示“发布”或“更新”。进度只映射 native 已发出的连接、正文图片、封面、创建/更新与完成事件。AppID/AppSecret 配置错误进入“前往设置”，`40164` 白名单与临时网络错误必须保留“重试”。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
