# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、线程、消息、审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行与变更集审阅协调
model/ - Codex 运行契约、会话归一化、AI action、上下文、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
