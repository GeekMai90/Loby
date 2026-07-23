# library/ - 本地写作库能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 写作库导航、项目/文稿列表、开发态设计入口、字段管理、创建/移动对话框与回收站界面
components/project-fields/ - 项目字段定义、默认值、类型与破坏性变更确认
hooks/ - 写作库持久化、选择修复、项目资源、文稿动作、拖拽与右键菜单协调
model/ - 本地模型、导入、图片资产、保存队列、选择/排序/移动规则、导航动效与 registry 兼容层
constants/ - 项目外观、模板与字段稳定配置
</directory>

本地目录与 Markdown 是事实来源。registry 的删除和显示名修改不得触碰实际文件夹；持久化、外部刷新与选择修复的时序只能在集成覆盖保护下调整。

图片原图查看统一经过 `model/persistence.ts` 调用原生 `preview_local_image`；网络图片只能先由受限临时下载命令转换成本地文件，再进入同一 Quick Look 链路，不允许 feature 自建网页 lightbox。

导航栏与文稿列表分别保留 selection，focus 只决定哪一栏显示 active 视觉，不得清空另一栏的选择。编辑器获得焦点时两栏进入 inactive-selection；具体颜色只由语义 Token 和设计文档定义。

项目总览与项目内部使用同一固定玻璃外壳内的可逆横向场景过渡；进入与返回方向相反，底部操作区保持稳定，reduced-motion 只保留短淡化。动效不得介入选择、分组记忆或持久化逻辑。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
