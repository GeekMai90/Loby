# ADR 0013：封闭工具副作用与有界写作库搜索

日期：2026-07-27

## 状态

已接受

## 背景

Tool Registry 首版用字符串表达 `read/network/write/proposal`。审批层只比较字符串是否等于 `write`；新增工具的拼写错误或未知 effect 会自然落入“无需审批”路径。安全属性由自由文本表达，失败方式就是权限降级。

本地全文搜索虽然限制单文件 512 KB 和文件数量 2000，却没有限制一轮累计读取量。大型写作库一次工具调用理论上可同步读取接近 1 GB。图片工具 schema 还声明了执行器并未消费的 `inputFidelity`，会让模型误以为参数已经生效。

## 开源实现对照

- [Codex app-server approvals](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) 用明确的 item/approval/completed 生命周期表达命令和文件修改，不把授权隐藏在工具描述文字里；
- [OpenCode session processor](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) 显式追踪每个 tool call 并在 abort/完成时 settle，工具状态是结构化运行事实；
- [OpenHands Agent](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/agent/agent.py) 在能力边界裁剪工具，而不是假设模型会自行遵守不可执行能力。

Loby 的工具集合远小于通用编码 Agent，因此不需要动态权限语言。封闭枚举、统一执行器和保守 MCP 映射更简单，也更适合作者控制。

## 决策

1. `ToolEffect` 固定为 `Read/Network/Write/Proposal`；ToolDefinition、Provider strict 映射、审批与测试均使用同一枚举。
2. 只有 `Write` 进入原生审批，`Proposal` 只能产生作者确认卡片，不能执行写入；MCP 无论 `readOnlyHint` 如何都先映射为 `Write`。
3. JSON Schema 用于约束模型生成，但执行器仍逐参数检查类型、长度、路径、枚举和数量；schema 不得声明未消费字段。
4. Markdown 单文件上限 512 KB；全文搜索累计扫描上限 32 MB，并在结果中返回扫描字节数和截断标记。
5. 所有工具结果在回传模型前先递归脱敏 JSON 中的 token、authorization、password、secret、cookie 与 credential 字段，并处理常见纯文本赋值行，再按 UTF-8 边界截断到 64 KB；单工具和整轮时限由 ADR 0011 的执行子状态机拥有。

## 验证

- 工具 effect 拼写不再可能编译，MCP read-only hint 不能绕过审批；
- proposal 仍使用 strict schema 且不会进入普通工具执行；
- 隐藏目录、符号链接和写作库外 Markdown 被拒绝；
- 搜索达到 32 MB 后停止并报告 `scanTruncated=true`；
- schema 与执行参数一致，嵌套 JSON/纯文本敏感赋值被脱敏，结果超过 64 KB 时保持 UTF-8 边界截断。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
