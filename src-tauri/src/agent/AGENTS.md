# agent/ - 本地 AI agent 领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
app_server.rs - Codex app-server 长生命周期连接池、JSON-RPC turn 路由、完成通知宽限对账、取消、approval wait 与阶段耗时采样
app_server_tests.rs - app-server 连接复用、死亡连接重建、跨 turn 事件隔离与完成态恢复白盒回归
assistant_attachments.rs - process-scoped 通用附件存储、图片/文档校验与 Codex 受控路径解析
conversation_store.rs - AI 会话 JSON 持久化
discovery.rs - skill、model 与 CLI 能力发现
events.rs - app-server notification、请求级 stream channel 与无内容 timing metric 到稳定前端 event 的翻译
process.rs - Agent CLI 可执行路径探测、更新感知缓存、启动失败失效与超时进程工具
protocol.rs - 带落笔轻量能力隔离的 thread start/resume/read 与 turn start/steer/interrupt 纯 JSON-RPC 构造
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - agent commands、面板后台预热、managed state、取消与 stream 生命周期
turn_recovery.rs - `thread/read` 完成态解析与缺失文本增量恢复
</member>

该模块不拥有文稿持久化；写作上下文通过经过校验的路径与 command 输入进入。临时附件必须限制在当前进程会话目录；图片通过 `localImage` 输入，文档通过 `mention` 输入，二者不得混用协议类型。

落笔复用用户的 Codex 登录、模型与显式 Skill，但普通 thread 不继承全局 Memory、插件/Apps 和自动 Skill 目录；恢复轮询发现完成后必须给正常 `usage` / `turn/completed` 通知留下宽限窗口，内部恢复状态不得进入用户可见思考步骤。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
