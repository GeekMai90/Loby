# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、线程、消息、审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行与变更集审阅协调
model/ - Codex 运行契约、thread 上下文快照、流式帧批处理、阶段耗时、会话归一化、AI action、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。

同一 agent thread 只复用已确认同步的稳定写作快照；文稿或挂载上下文变化必须触发完整重同步，选区、显式 mention、skill 与资源仍按 turn 传递。流式内容与运行状态按绘制帧合并发布，完成、失败和取消负责封口并持久化最终阶段耗时。

模型、推理和速度保持为 composer toolbar 中的紧凑文字控件，统一复用 `components/AssistantModelSettingsMenu.tsx`。AI 修改结果卡属于持久化消息，详细 diff 属于编辑器审阅层；不创建第二套一次性设置菜单或 diff 状态机。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
