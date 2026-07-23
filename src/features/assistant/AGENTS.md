# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、线程、消息成果、共享卡片骨架、写入确认、操作回执、权限审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行与变更集审阅协调
model/ - Codex 运行契约、thread 上下文快照、流式帧批处理、阶段耗时、会话归一化、AI action、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。

同一 agent thread 只复用已确认同步的稳定写作快照；文稿或挂载上下文变化必须触发完整重同步，选区、显式 mention、skill 与资源仍按 turn 传递。流式内容与运行状态使用 requestId 派生的独立 Tauri event channel，并按绘制帧合并发布；完成、失败和取消负责封口并持久化最终阶段耗时。AI 面板打开后只触发后台 runtime 预热，不得阻塞面板呈现或吞掉发送时的显式错误。

主助手 thread 默认关闭全局 Codex Memory、插件/Apps 与自动 Skill 目录注入；composer 显式选择、`$skill-name` 或“使用 Every 技能”一类自然语言唯一名称命中的 Skill，由落笔读取并按 turn 注入，只有插件缓存中的 Skill 才按需恢复插件能力。自然语言别名存在歧义时不得猜测或一次注入多个 Skill。落笔操作协议保持单一紧凑来源，禁止在上下文装配层重复动作 schema、路径和示例。

模型、推理和速度保持为 composer toolbar 中的紧凑文字控件，统一复用 `components/AssistantModelSettingsMenu.tsx`。主助手的 composer 附件入口统一接收受支持的图片与文档：图片使用 Codex `localImage`，PDF、Word 与文本文档使用受控本地 `mention`，临时路径不得持久化；发布主题助手的 image-only 适配层保持独立边界。AI 生成成果与 action payload 使用同一数据源：成果在消息流完整呈现，本地图片双击查看复用编辑器相同的 macOS Quick Look；待决写入和正文修改结果复用共享三段式卡片骨架，以固定语义标题、13px 次级动作说明和明确按钮表达状态与决策；写入终态在原位置收缩成持久化单行回执。详细 diff 属于编辑器审阅层；不创建第二套一次性设置菜单、图片 lightbox 或 diff 状态机。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
