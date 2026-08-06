# assistant/ - AI 协作能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 助手入口、会话级渲染故障隔离、线程、消息成果、共享卡片骨架、写入确认、操作回执、权限审批、审阅、composer 与模型设置界面
hooks/ - agent stream、会话、附件、动作执行、变更集审阅协调及主 hook 静态契约
model/ - Loby Agent IPC、上下文快照、流式帧批处理、阶段耗时、会话归一化、AI action、inline AI 与 quick prompts
constants/ - composer 的稳定选项与默认值
</directory>

`model/documentSummary.ts` 负责复用当前 Provider runtime 的一次性文稿摘要请求与 30 个汉字/60 个字符边界；它只返回文本，不拥有文稿或发布元信息的写入权。

作者控制权是硬边界：AI 变更必须可审阅、可拒绝、可撤销；消息历史、运行时与编辑器 diff 不得混为一个状态机。feature 可以消费编辑器和写作库的稳定模型，但不得接管其持久化所有权。任何 AI 插入、接受或恢复在校验和创建版本快照时都必须读取编辑器实时正文；React 中稍旧的文稿对象不能成为恢复点，避免撤回动作删除作者刚输入的内容。

结构化 `propose_document_change.proposedBody` 与发送时的 `baseBody` 是正文审阅的事实来源。模型提供的 `changes` 只有在能够完整重建 `proposedBody` 时才可作为精细 diff；描述性、遗漏或与最终正文不一致的变更清单必须退回到两版正文的 Myers 最小字符差异，并记录 base/proposed 双版本偏移与邻近上下文。旧会话的 `loby-change` / `loby-action` 只在展示边界兼容解析，新请求不得继续要求模型输出 Markdown 协议块。空白行不得作为自然段错配锚点，已持久化但无法重建最终正文的旧变更也必须在展示边界重新计算。

每轮请求由当前会话历史、已挂载写作快照、选区、显式 mention、用户明确提供的本地参考目录、Skill catalog 与资源共同构造，不依赖外部 Provider 的隐式 thread。显式挂载 Skill 可随本轮上下文读取说明；自然语言发现通过 native `activate_skill` 渐进加载，不能预注入全部 Skill。当前对话中用户明确出现的外部目录只作为 `read_local_directory` 的只读范围，不能扩展为任意本机文件访问。流式内容与运行状态使用 requestId 派生的独立 Tauri event channel，并按绘制帧合并发布；完成、失败和取消负责封口并持久化最终阶段耗时。AI 面板打开后只触发后台 runtime 预热，不得阻塞面板呈现或吞掉发送时的显式错误。

AI 面板每次从关闭状态重新挂载时，以最近用户消息的当前文稿和两小时静默期划分任务会话：换文稿立即进入惰性新对话，同一文稿超过两小时才进入新对话；面板保持打开时切换文稿不得自动切断会话。运行中的请求、待审批权限、待确认动作或未完成正文修改必须保留原对话；未发送消息的新对话只存在于内存，不进入历史文件，也不创建返回旧对话的临时入口。有新消息活动的会话移动到历史首位，使下次加载恢复最近实际使用的任务而不是固定创建顺序。

首轮 AI 回复成功完成后，标题任务作为独立后台请求只触发一次；后续轮次不重复改名。标题请求只投影有界的首条与最近消息，关闭推理并限制输出预算；Provider 不可用、结果不符合 6 到 8 字约束或标题请求落后于会话状态时静默放弃。手动标题永远优先，AI 标题只在仍未被手动修改的会话上应用。

会话文件保存 append-only 用户事实；原生层只接受最多 64 MB 的 JSON 数组，每次改写前保留上一份通过解析的 `conversations.backup.json`，主文件损坏时可回退。Provider model view 由 `model/conversationContextPlanner.ts` 按模型窗口逐轮派生。最近完整 turn 保持原生 user/assistant 角色，较早消息压缩为带来源/保留消息 ID 和模型可见语义指纹的结构化 checkpoint；动作状态、待插入内容/目标、change set 提议正文与 artifact 必须进入后续轮状态。只有消息 ID、保留边界和语义指纹都未变化时才可复用 checkpoint，状态就地变化必须重建。压缩只改变模型投影，不能删除历史；界面展示上次预算与压缩数量。编辑旧 user message 创建带父会话和分叉消息引用的新会话，原线不得截断。native 崩溃恢复项只转换为显式重试卡片；接受恢复时必须等新 checkpoint 落盘后才从界面移除旧卡片。进入写工具后的中断必须提醒检查外部状态，renderer 不得自动重放。

助手更多菜单底部的“固定到侧边”是展示形态的唯一持久入口，默认勾选；勾选时仅在编辑区仍保留安全宽度时停靠，否则降级为小窗，取消勾选后始终默认小窗。标题栏形态按钮只写当前打开周期的 override，关闭面板立即清除；应用设置页不得复制第二个“默认形态”入口。

AI 对话只保留用户气泡与透明助手时间线两种视觉语言。普通系统通知不得建立带背景、边框和圆角的第三类卡片，统一使用思考详情同款左侧竖线与次级文字；运行失败和取消必须作为可展开运行面板的终态，错误原因只在竖线详情内显示，不能再复制成系统正文气泡。历史中已保存为 system 的运行消息在展示边界投影回 assistant 表面，不修改其审计事实。

composer 模型菜单只列出已经配置的连接，按连接名称排序并在二级菜单展示各自真实模型目录；分隔线下的推理强度必须随当前 Provider/模型能力收敛，不支持推理参数的模型不得由前端补默认档位。折叠按钮只显示品牌图标、紧凑模型版本和推理强度，不重复连接名称。这里的选择是当前对话状态，随对话持久化并由分支继承，绝不反向写入应用设置；新对话缺少选择时才用设置中的 Provider/模型/推理默认值初始化。主助手与发布主题助手共用 composer 附件入口，统一接收受支持的图片与文档；达到长粘贴阈值的 UTF-8 文本也转成 Markdown 临时附件，短文本仍留在输入框中。临时文件只存在于输入阶段；发送时必须提升到写作库 `.loby/ai/attachments` 的受管内容寻址目录，会话只持久化稳定附件记录而不保存 blob 预览，历史重载后仍可再次提供给 Provider。AI 生成成果与 action payload 使用同一来源关联：待确认动作必须通过 `sourceArtifactPath` 跨消息引用运行时缓存源产物，不能提前把尚未创建的 library 目标路径用于预览；用户接受插入动作后先由 library 领域复制进 `assets/images` 并把 action 提升为稳定相对路径，再由 renderer 统一生成标准 Markdown 引用后修改正文，历史 action 的 Obsidian 格式提示只在兼容读取时忽略并从稳定 payload 移除，使后续插入失败能够重试而不重复导入缓存产物。会话加载边界必须按消息顺序恢复历史来源关联，不能关联到未来产物；文稿跨项目移动后仍按稳定 sheetId 解析已持久化预览。成果在消息流完整呈现，本地图片双击查看复用编辑器相同的 macOS Quick Look。同一消息、同一目标文稿中的多个待确认图片 action 必须在 renderer 归一化为一个 `insertImages` 批量动作：按序展示每张成果及各自位置，随后只出现一张确认卡；执行器先校验全部锚点和资源，再以一次 CodeMirror transaction、一个版本快照和一个 effect 原子写入，任一项失败不得留下部分正文，只提供一次撤销。已经执行的历史单图动作不得事后合并。其他多项 action 仍按各自身份将成果与确认卡/终态回执成对渲染，不能先集中展示全部成果、再集中展示全部决策。待决写入和正文修改结果复用共享三段式卡片骨架，以固定语义标题、13px 次级动作说明和明确按钮表达状态与决策；写入终态在原位置收缩成持久化单行回执。详细 diff 属于编辑器审阅层；不创建第二套一次性设置菜单、图片 lightbox 或 diff 状态机。

Provider 品牌标识统一由 `components/AgentBrandIcon.tsx` 适配 `@lobehub/icons` 的官方 SVG；常规只出现在连接管理，composer 仅允许在连接行与折叠后的当前模型按钮中作为紧凑识别例外，具体模型二级菜单仍保持纯文字。图标默认使用 `1em` 并跟随文字基线；OpenAI 与 Kimi 使用随主题前景色变化的官方单色版，自定义 OpenAI-compatible 连接使用中性 SVG。

Provider 凭证的事实来源始终是 native credential store；`model/agentCredentialEvents.ts` 只定义无秘密的失效通知契约，设置页新增、替换或删除任一连接后广播事件，连接目录与当前 Provider credential hook 据此重新查询状态，不把 API Key 回传或复制进 React 状态之外的持久层。`model/agentConnectionCapabilities.ts` 是 renderer 唯一的连接能力目录，只声明已经接入的文本、思考和图片协议；千问、MiniMax、DeepSeek、Kimi 各自拥有独立 Provider id 与凭证，不得借用单个自定义连接相互覆盖。生图偏好只能从已添加且声明图片能力的连接派生，不能按 Provider 名称猜测或建立第二套图片凭证。连接验证也只向 native 传 Provider 与非敏感 Endpoint，由原生层读取凭证并执行无生成模型目录探测，renderer 只接收去敏结果。

composer 中由 `/` 与 `@` 触发的输入建议统一复用 `components/ui/suggestion-menu.tsx`，保持与 DropdownMenu 一致的实体材质、菜单几何和选中状态；文本框以 combobox 暴露展开状态、受控 listbox 与当前 active option，键盘导航仍由 composer 状态机持有。

Provider 可见文字、推理摘要和工具里程碑必须按发生顺序进入 assistant 展示，不能先缓存完整响应，也不能在完成态丢失。第一个增量或 tool 里程碑到达后，运行气泡必须立即可展开并随事件逐步追加；agent message delta 按帧流式刷新，终态先冲刷待发布帧。typed activity 保留 native item id 并按首次出现顺序原位更新，非 reasoning 活动到达终态后不可回退；run 完成、失败或取消后，sequence 更大的迟到 IPC 也不得重新打开快照或追加内容。结构化 proposal 与文本消息是不同事件，前端只能从 proposal payload 创建确认卡片，不能从自然语言猜测执行意图；最终回复只保留面向作者的说明，模型回显的 pending/target/path/anchor 等提案协议必须在持久化前移除，实时状态与详细参数由确认卡片独占。proposal 只记录一项待确认动作，不得提前终止模型循环；多张图片仍须在 Runtime 中逐张形成独立 proposal，非执行性收据让模型继续补齐全部提案，renderer 再把同轮同目标的待决图片收敛为一个批量 action。图片生成是合法的无文字完成结果：artifact path 作为 run artifact 持久化并在 assistant 消息成果层展示；缺少非空最终回复时追加 Loby 的完成提示，不得误报运行中断，也不得混入用户输入附件或正文 action。

Agent Event Protocol v2 由 native Runtime 提供单调 `sequence`、权威 `runPhase + activeItemId` 和稳定 `kind + state + visibility`。所有实时事件先进入 `model/agentRunReducer.ts`；折叠摘要只读取 phase，展开轨迹只投影 detail/milestone，禁止根据数组尾项、中文 title 或定时器猜状态。`waitingForModel` 在折叠摘要使用 15 条写作化文案组成的七秒随机洗牌袋，一轮内不重复、跨轮不连续重复；它不得伪造 reasoning 或工具活动，真实 phase/item 到达后必须立即停止轮换。Provider 请求、MCP discovery、模型记账和最终回复属于 diagnostic，不计为用户步骤；reasoning 使用一个稳定活动并由 Runtime 显式封口。旧会话缺失 typed 字段或保存了英文/Markdown reasoning 摘要时，才允许在 `agentRunEvents.ts`/`agentRunPresentation.ts` 兼容推导和本地化，不能把兼容逻辑扩散到组件。

运行父状态进入 completed、error 或 cancelled 前，所有仍为 active、running、in_progress 或 pending 的子活动必须同步封口；历史加载发现残留 running 快照时转为 interrupted error。外层 tool call、内层 exec 与空 reasoning 可能描述同一里程碑，展示层只归并无信息重复，带有不同正文或不同成果的真实步骤必须保留；迟到 sequence 不得覆盖较新的 phase 或 item 状态。

每轮用户发送后，消息流使用 assistant-ui 的 top turn anchor 将最新用户消息单次定位到工具栏下方，并为下方响应预留阅读空间；新锚点出现后不得用持续自动滚动争夺用户的手动浏览位置。顶部工具栏采用覆盖式布局时，滚动视口自身必须从工具栏下方开始，不能依赖会被 scrollTop 消耗的内容 padding 避让。

活动会话 ID 是 assistant-ui 外部消息 runtime 的生命周期边界；切换历史记录必须重建消息子树，不能让上一会话的 message/part 索引进入新会话。助手消息子树必须位于局部 Error Boundary 内，第三方渲染异常只能降级助手内容区，不得卸载编辑器或应用外壳。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
