# library/ - 本地写作库能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 写作库导航、项目/文稿列表、开发态设计入口、字段管理、创建/移动对话框与回收站界面
components/project-fields/ - 项目字段定义、默认值、类型与破坏性变更确认
hooks/ - 写作库持久化、选择修复、项目资源、文稿动作、拖拽与右键菜单协调
model/ - 本地模型、导入、图片资产、保存队列、选择/排序/移动规则、导航动效与 registry 兼容层
constants/ - 项目外观、模板与字段稳定配置
</directory>

`hooks/useLibraryRailPeek.ts` 隔离左缘悬停预览的计时器、WebView 到原生窗口边缘的连续判定、跨区域停留和浮层占用判断；它只返回临时可见性，不写入应用设置，也不拥有正式 rail 布局。

本地目录与 Markdown 是事实来源。新建、导入与 AI 创建文稿统一消费 `model/documentId.ts` 的 `sheet-` 加 26 位小写 Base32 身份；旧 Markdown 只在用户主动重建索引时由 native 迁移，普通外部刷新不得静默改写身份。项目 GitHub 发布设置从全局连接授权的可写仓库中选择目标，并拥有用户可见名称、分支、文章目录与站点地址；分享菜单使用该名称，发布身份仍由全局 native secret store 管理。registry 的删除和显示名修改不得触碰实际文件夹；持久化、外部刷新与选择修复的时序只能在集成覆盖保护下调整。

图片原图查看统一经过 `model/persistence.ts` 调用原生 `preview_local_image`；网络图片只能先由受限临时下载命令转换成本地文件，再进入同一 Quick Look 链路，不允许 feature 自建网页 lightbox。

导航栏与文稿列表分别保留 selection，focus 只决定哪一栏显示 active 视觉，不得清空另一栏的选择。编辑器获得焦点时两栏进入 inactive-selection；具体颜色只由语义 Token 和设计文档定义。

导航栏正式展开与左缘悬停预览是两套状态：预览只复用现有导航实例作为覆盖层，不改变栏宽、不持久化；鼠标进入导航浮层、打开其锚定菜单或进行拖拽时必须延后收回，固定按钮才恢复正式布局。

项目总览与项目内部使用同一固定玻璃外壳内的可逆横向场景过渡；进入与返回方向相反，底部操作区保持稳定，reduced-motion 只保留短淡化。动效不得介入选择、分组记忆或持久化逻辑。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
