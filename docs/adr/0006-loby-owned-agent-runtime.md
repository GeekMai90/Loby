# ADR 0006：由 Loby 拥有 Agent Runtime

日期：2026-07-26

## 状态

已接受

## 背景

Loby 的 AI 协作者需要读取用户明确授权的本地 Markdown、调用可复用 Skill、联网搜索、生成图片并连接 MCP。继续依赖 Codex CLI/app-server 会把会话、工具、账号、模型和失败语义交给外部运行时，也无法让用户在同一产品边界内配置自己的 API Provider。

“自己拥有 runtime”不等于重写 HTTP、OAuth 或 MCP。Loby 只拥有决定产品行为的编排状态机；模型传输、标准协议和系统凭证由可替换的开源库承担。

## 决策

在 Tauri/Rust 原生层建立 Loby Agent Runtime，并彻底移除 Codex CLI、Codex app-server、CLI 探测及其兼容分支。

运行时由以下稳定边界组成：

- `Provider Registry`：OpenAI API、Anthropic API、OpenAI-compatible，以及受供应商正式契约约束的账号 Provider；
- `Agent Loop`：模型请求、tool call、结果回填、停止条件、取消和用量；
- `Context Builder`：只消费 renderer 已选择的文稿、选区、附件与资源，后续可通过受控文件工具补充读取；
- `Tool Registry`：统一注册本地只读工具、联网搜索、图片生成、Skill 与 MCP Tool；
- `Permission Controller`：副作用、外部命令、MCP 写操作与敏感路径必须经过明确授权；
- `Credential Store`：Provider 和 MCP 凭证只保存在原生安全存储，不进入 renderer 持久化或写作库；
- `Event Bridge`：继续向前端发出 Loby 自己的请求级 stream、activity、approval、usage 和 metric 事件。

第三方库只能位于适配层，不得拥有对话历史、Markdown 修改、审阅、快照、权限政策或产品状态机。Provider、Tool 与 MCP transport 必须可替换，不能让某个 SDK 的会话对象成为 Loby 的事实来源。

## 鉴权决策

- OpenAI Platform 与 Anthropic API 使用用户自己的 API key；
- ChatGPT subscription 是独立账号 Provider，不把 OAuth token 伪装成 Platform API key，也不读取 Codex 或浏览器的既有登录状态；
- Loby 使用 ChatGPT Device OAuth 获得并刷新自己的 token bundle，秘密只进入系统钥匙串，renderer 只接收设备码、连接状态、邮箱与套餐类型；
- 订阅请求携带 OAuth bearer 与 `ChatGPT-Account-Id`，调用 `https://chatgpt.com/backend-api/codex/responses`；Agent Loop 仍归 Loby，因此不依赖 Codex CLI、SDK 或 app-server；
- 该 endpoint 与 `https://api.openai.com/v1/responses` 是不同计费和权限通道。订阅适配器强制 `store=false`、`stream=true` 与顶层 `instructions`，并独立维护受支持模型；
- OpenAI 已在官方工程文章中公开 endpoint 区别，Codex 开源实现提供协议基线；但这不是 Platform API SLA，因此适配器标记为实验性、保持可替换并对协议漂移显式失败；
- Claude 订阅登录与 Anthropic API key 是不同通道。在没有正式第三方 OAuth 契约前，不把 Claude Pro/Max 登录描述为稳定 API 能力；
- 登录可使用系统浏览器或 device flow，不在 WebView 捕获密码和 cookie。

## 迁移策略

这是一次有阶段门禁的替换，不保留运行时兼容层：

1. 固化 Loby-owned command/event、对话、审阅与动作协议；
2. 建立 Provider/credential/model catalog 基础边界；
3. 建立 Agent Loop 与内置只读文件工具；
4. 接入 Skill、联网搜索、图片生成与 MCP；
5. 接入 ChatGPT subscription 账号 Provider，并独立验证 Device OAuth、刷新、退出和失效恢复；
6. 删除全部 Codex CLI/app-server 实现、设置、测试、路径 scope 与文档；
7. 完成普通问答、长文上下文、附件、取消、工具审批、图片成果、正文审阅和会话恢复回归。

任一阶段都不得通过绕过作者审阅或放宽文件范围来换取进度。

## 影响

- 用户不再安装或配置 Codex CLI；
- Loby 可以独立增加 Provider、Tool、Skill 与 MCP server；
- 模型服务故障不影响 Markdown 和会话历史的本地事实；
- Loby 需要自己维护 tool loop、Provider 差异、凭证轮换和协议回归测试；
- 未配置可用 Provider 时，AI 面板必须显示可执行的配置引导，而不是探测本地 CLI。
