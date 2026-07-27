# settings/ - 应用设置能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 设置对话框、侧栏、表单基础与 AI/外观/存储/发布/写作面板
constants/ - 设置 tab 标识与稳定元数据
</directory>

设置界面只编辑各领域公开配置，不复制领域校验和持久化实现。“本地文件”区分“在文件管理器中显示”、迁移当前目录与打开已有写作文件夹；切换入口只负责收集用户选择，目录结构校验和保存后切换归 library 领域。该区域还提供带确认的重建索引入口，并用不可中断的阶段进度弹窗承接运行状态、用全局 Toast 报告成功或失败；扫描、旧文稿 ID 迁移和引用修复仍完全归 native library 领域。GitHub 等跨项目身份归全局“发布”设置，通过官方 Device Flow 一次连接并由 native secret store 持有令牌；GitHub 博客等非敏感发布目标同样归应用级“发布”设置，以 provider 下的独立子项编辑仓库、分支、目录、站点和菜单名称。持久化单选设置统一使用共享 Select；Tabs 只切换当前内容视图，Toggle Group 只保留给高频即时操作，不再维护设置专用分段选择器。设置 Dialog 的主体、侧栏、区块与分区边界统一消费 `index.css` 中的专属语义 Token：主体跟随应用 `background`，侧栏复用 Tabs 容器的 `muted` 灰色；设置区块在亮色模式融入 `background`，在暗色模式使用 `muted` 建立层级。敏感值必须交给 native secret store，不能在表单组件中建立第二套存储。

AI 助手展示形态不在设置 Dialog 维护；其唯一持久入口是助手自身更多菜单中的“固定到侧边”。设置页维护发送快捷键、quick prompts、当前写作库 Skill 的导入/诊断/启停/删除、对话 Provider、图片生成服务路由、应用内凭证、ChatGPT Device OAuth、联网搜索与 MCP server；图片服务允许自动复用当前对话 Provider，也允许独立指定 ChatGPT 订阅或 OpenAI API，界面不得暗示 GPT 文本模型本身直接输出图片。Skill 设置只调用 native Skill Store，不复制文件校验；敏感表单只持有未提交草稿，OAuth 界面只接收设备码和去敏账号状态，保存后不得从 native 读回明文。

快捷键浏览使用靠右、四周留白的近全高 Dialog，内容以单列分组和独立 keycap 呈现并支持即时搜索；该特殊定位只属于快捷键表面，不改变共享 Dialog 的居中默认值。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
