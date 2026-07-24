# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、线程、消息成果、共享卡片骨架、写入确认、操作回执、权限审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行与变更集审阅协调
model/ - Codex 运行契约、thread 上下文快照、流式帧批处理、阶段耗时、会话归一化、AI action、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。

`loby-change.proposedBody` 与发送时的 `baseBody` 是正文审阅的事实来源。模型提供的 `changes` 只有在能够完整重建 `proposedBody` 时才可作为精细 diff；描述性、遗漏或与最终正文不一致的变更清单必须退回到两版正文的确定性差异，不能让成功写入的修改显示为空审阅。

同一 agent thread 只复用已确认同步的稳定写作快照；文稿或挂载上下文变化必须触发完整重同步，选区、显式 mention、skill 与资源仍按 turn 传递。流式内容与运行状态使用 requestId 派生的独立 Tauri event channel，并按绘制帧合并发布；完成、失败和取消负责封口并持久化最终阶段耗时。AI 面板打开后只触发后台 runtime 预热，不得阻塞面板呈现或吞掉发送时的显式错误。

模型、推理和速度保持为 composer toolbar 中的紧凑文字控件，统一复用 `components/AssistantModelSettingsMenu.tsx`。主助手的 composer 附件入口统一接收受支持的图片与文档：图片使用 Codex `localImage`，PDF、Word 与文本文档使用受控本地 `mention`，临时路径不得持久化；发布主题助手的 image-only 适配层保持独立边界。AI 生成成果与 action payload 使用同一数据源：成果在消息流完整呈现，本地图片双击查看复用编辑器相同的 macOS Quick Look；待决写入和正文修改结果复用共享三段式卡片骨架，以固定语义标题、13px 次级动作说明和明确按钮表达状态与决策；写入终态在原位置收缩成持久化单行回执。详细 diff 属于编辑器审阅层；不创建第二套一次性设置菜单、图片 lightbox 或 diff 状态机。

Codex `commentary` 是明确面向用户的过程消息，必须按 item 顺序合并进 assistant 正文，不能降级成内部思考步骤或在 `thread/read` 恢复时丢失。第一个 reasoning/tool 里程碑到达后，运行气泡必须立即可展开并随事件逐步追加；agent message delta 按帧流式刷新，终态先冲刷待发布帧。`imageGeneration` 是合法的无文字完成结果：`savedPath` 作为 run artifact 持久化并在 assistant 消息成果层展示；缺少非空 `final_answer` 时追加 Loby 的完成提示，不得误报运行中断，也不得混入用户输入附件或正文 action。

运行父状态进入 completed、error 或 cancelled 前，所有仍为 active、running、in_progress 或 pending 的子活动必须同步封口；历史记录在展示边界按父终态兼容校正。外层 tool call、内层 exec 与空 reasoning 可能描述同一里程碑，展示层只归并无信息重复，带有不同正文或不同成果的真实步骤必须保留。

每轮用户发送后，消息流使用 assistant-ui 的 top turn anchor 将最新用户消息单次定位到工具栏下方，并为下方响应预留阅读空间；新锚点出现后不得用持续自动滚动争夺用户的手动浏览位置。顶部工具栏采用覆盖式布局时，滚动视口自身必须从工具栏下方开始，不能依赖会被 scrollTop 消耗的内容 padding 避让。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
