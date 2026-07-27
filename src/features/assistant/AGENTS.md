# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、会话级渲染故障隔离、线程、消息成果、共享卡片骨架、写入确认、操作回执、权限审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行与变更集审阅协调
model/ - Loby Agent IPC、上下文快照、流式帧批处理、阶段耗时、会话归一化、AI action、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。

结构化 `propose_document_change.proposedBody` 与发送时的 `baseBody` 是正文审阅的事实来源。模型提供的 `changes` 只有在能够完整重建 `proposedBody` 时才可作为精细 diff；描述性、遗漏或与最终正文不一致的变更清单必须退回到两版正文的 Myers 最小字符差异，并记录 base/proposed 双版本偏移与邻近上下文。旧会话的 `loby-change` / `loby-action` 只在展示边界兼容解析，新请求不得继续要求模型输出 Markdown 协议块。空白行不得作为自然段错配锚点，已持久化但无法重建最终正文的旧变更也必须在展示边界重新计算。

每轮请求由当前会话历史、已挂载写作快照、选区、显式 mention、Skill catalog 与资源共同构造，不依赖外部 Provider 的隐式 thread。显式挂载 Skill 可随本轮上下文读取说明；自然语言发现通过 native `activate_skill` 渐进加载，不能预注入全部 Skill。流式内容与运行状态使用 requestId 派生的独立 Tauri event channel，并按绘制帧合并发布；完成、失败和取消负责封口并持久化最终阶段耗时。AI 面板打开后只触发后台 runtime 预热，不得阻塞面板呈现或吞掉发送时的显式错误。

AI 面板每次从关闭状态重新挂载时，以最近用户消息的当前文稿和两小时静默期划分任务会话：换文稿立即进入惰性新对话，同一文稿超过两小时才进入新对话；面板保持打开时切换文稿不得自动切断会话。运行中的请求、待审批权限、待确认动作或未完成正文修改必须保留原对话；未发送消息的新对话只存在于内存，不进入历史文件，也不创建返回旧对话的临时入口。有新消息活动的会话移动到历史首位，使下次加载恢复最近实际使用的任务而不是固定创建顺序。

会话文件保存 append-only 用户事实；Provider model view 由 `model/conversationContextPlanner.ts` 按模型窗口逐轮派生。最近完整 turn 保持原生 user/assistant 角色，较早消息压缩为带来源/保留消息 ID 的结构化 checkpoint，pending action、change set 与 artifact 必须进入后续轮状态。压缩只改变模型投影，不能删除历史；界面展示上次预算与压缩数量。编辑旧 user message 创建带父会话和分叉消息引用的新会话，原线不得截断。native 崩溃恢复项只转换为显式重试卡片；进入写工具后的中断必须提醒检查外部状态，renderer 不得自动重放。

助手更多菜单底部的“固定到侧边”是展示形态的唯一持久入口，默认勾选；勾选时仅在编辑区仍保留安全宽度时停靠，否则降级为小窗，取消勾选后始终默认小窗。标题栏形态按钮只写当前打开周期的 override，关闭面板立即清除；应用设置页不得复制第二个“默认形态”入口。

模型、推理和速度保持为 composer toolbar 中的紧凑文字控件，统一复用 `components/AssistantModelSettingsMenu.tsx`。主助手的 composer 附件入口统一接收受支持的图片与文档，临时文件只存在于输入阶段；发送时必须提升到写作库 `.loby/ai/attachments` 的受管内容寻址目录，会话只持久化稳定附件记录而不保存 blob 预览，历史重载后仍可再次提供给 Provider。发布主题助手的 image-only 适配层保持独立边界。AI 生成成果与 action payload 使用同一来源关联：待确认动作必须通过 `sourceArtifactPath` 跨消息引用运行时缓存源产物，不能提前把尚未创建的 library 目标路径用于预览；用户接受插入动作后才由 library 领域复制进 `assets/images`，正文和动作结果只保存稳定相对引用。会话加载边界必须按消息顺序恢复历史来源关联，不能关联到未来产物；文稿跨项目移动后仍按稳定 sheetId 解析已持久化预览。成果在消息流完整呈现，本地图片双击查看复用编辑器相同的 macOS Quick Look。待决写入和正文修改结果复用共享三段式卡片骨架，以固定语义标题、13px 次级动作说明和明确按钮表达状态与决策；写入终态在原位置收缩成持久化单行回执。详细 diff 属于编辑器审阅层；不创建第二套一次性设置菜单、图片 lightbox 或 diff 状态机。

composer 中由 `/` 与 `@` 触发的输入建议统一复用 `components/ui/suggestion-menu.tsx`，保持与 DropdownMenu 一致的实体材质、菜单几何和选中状态；文本框以 combobox 暴露展开状态、受控 listbox 与当前 active option，键盘导航仍由 composer 状态机持有。

Provider 可见文字、推理摘要和工具里程碑必须按发生顺序进入 assistant 展示，不能先缓存完整响应，也不能在完成态丢失。第一个增量或 tool 里程碑到达后，运行气泡必须立即可展开并随事件逐步追加；agent message delta 按帧流式刷新，终态先冲刷待发布帧。结构化 proposal 与文本消息是不同事件，前端只能从 proposal payload 创建确认卡片，不能从自然语言猜测执行意图。图片生成是合法的无文字完成结果：artifact path 作为 run artifact 持久化并在 assistant 消息成果层展示；缺少非空最终回复时追加 Loby 的完成提示，不得误报运行中断，也不得混入用户输入附件或正文 action。

Agent Event Protocol v2 由 native Runtime 提供单调 `sequence`、权威 `runPhase + activeItemId` 和稳定 `kind + state + visibility`。所有实时事件先进入 `model/agentRunReducer.ts`；折叠摘要只读取 phase，展开轨迹只投影 detail/milestone，禁止根据数组尾项、中文 title 或定时器猜状态。Provider 请求、MCP discovery、模型记账和最终回复属于 diagnostic，不计为用户步骤；reasoning 使用一个稳定活动并由 Runtime 显式封口。旧会话缺失 typed 字段或保存了英文/Markdown reasoning 摘要时，才允许在 `agentRunEvents.ts`/`agentRunPresentation.ts` 兼容推导和本地化，不能把兼容逻辑扩散到组件。

运行父状态进入 completed、error 或 cancelled 前，所有仍为 active、running、in_progress 或 pending 的子活动必须同步封口；历史加载发现残留 running 快照时转为 interrupted error。外层 tool call、内层 exec 与空 reasoning 可能描述同一里程碑，展示层只归并无信息重复，带有不同正文或不同成果的真实步骤必须保留；迟到 sequence 不得覆盖较新的 phase 或 item 状态。

每轮用户发送后，消息流使用 assistant-ui 的 top turn anchor 将最新用户消息单次定位到工具栏下方，并为下方响应预留阅读空间；新锚点出现后不得用持续自动滚动争夺用户的手动浏览位置。顶部工具栏采用覆盖式布局时，滚动视口自身必须从工具栏下方开始，不能依赖会被 scrollTop 消耗的内容 padding 避让。

活动会话 ID 是 assistant-ui 外部消息 runtime 的生命周期边界；切换历史记录必须重建消息子树，不能让上一会话的 message/part 索引进入新会话。助手消息子树必须位于局部 Error Boundary 内，第三方渲染异常只能降级助手内容区，不得卸载编辑器或应用外壳。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
