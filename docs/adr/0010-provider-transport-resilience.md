# ADR 0010：Provider 传输韧性与显式模型能力

日期：2026-07-27

## 状态

已接受

## 背景

Loby 最初为每次模型调用新建 HTTP client，并给整个响应设置统一的 180 秒超时。这个实现对短请求足够，但会把“连接失败”“等待首字节”和“已经持续返回内容的长写作流”混为一类：活跃流可能被总时限切断，瞬时 429/502 又没有安全恢复。错误最终只剩 Provider 返回的一段字符串，用户无法判断应重新登录、缩短上下文、换模型还是稍后重试。

Provider 模型目录也把低/中/高推理档位附加给所有模型。OpenAI-compatible 服务能力未知时，Loby 仍会发送 `reasoning` 字段；这不是兼容，而是用一个 Provider 的协议猜测另一个服务的能力。

## 开源实现对照

- [Codex model provider registry](https://github.com/openai/codex/blob/main/codex-rs/model-provider-info/src/lib.rs) 将请求重试、stream 重试、stream idle timeout、认证和能力放进 Provider 配置；
- [Codex client](https://github.com/openai/codex/blob/main/codex-rs/core/src/client.rs) 把 client、会话状态、retry 与 fallback 分层，避免业务循环直接拥有 HTTP 细节；
- [OpenCode provider transform](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/provider/transform.ts) 按模型和 Provider 能力转换请求，而不是向所有兼容端发送相同扩展字段；
- [OpenHands Agent](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/agent/agent.py) 在 Agent 边界根据模型能力裁剪功能，例如非视觉模型不接收图像工具结果。

Loby 借鉴能力驱动和传输分层，不引入通用 Agent 的 Provider 插件市场、自动跨供应商 fallback 或多级路由。写作软件必须避免一次不可见重放造成重复文字、重复工具调用或重复计费。

## 决策

### 1. 复用连接，但不使用整轮总超时

Provider adapter 共享一个原生 HTTP client，复用连接池并设置连接超时。等待响应开始与流式块空闲分别计时；只要 Provider 持续产生数据，长篇写作流不因固定总时长被中止。

### 2. 只在可证明尚未产生可见流时有限重试

请求最多额外重试两次，仅覆盖连接失败和明确的 `408`、`429`、`500`、`502`、`503`、`504`。`Retry-After` 只在不超过 15 秒时自动等待，否则立即返回可操作错误。

收到成功响应并开始读取 stream 后不自动重放。stream idle timeout 终止当前请求并解释原因；用户决定是否重新发送。Loby 不做跨 Provider fallback，不能在用户不知情时切换账号、价格或数据边界。

### 3. 错误在 native 边界分类

Provider 原始错误在传输层归一化为认证、限流、过载、上下文超限、模型不可用、无效请求、网络、超时和协议错误。错误细节限制长度，不记录正文、附件或凭证；呈现文案必须给出下一步动作。

### 4. 模型能力必须显式声明

模型目录携带 `supportsReasoning`、支持的推理档位与服务层。adapter 只有在能力为真时才发送 `reasoning`、`service_tier` 等 Provider 扩展字段；renderer 只有在能力为真时才显示对应设置。

内置 Provider 由 Loby 维护已验证能力。OpenAI-compatible 当前采用保守能力：用户指定 model 和 base URL，但 Loby 不猜测推理扩展。未来若增加自定义能力开关，它必须进入设置与目录契约，并在发送前验证，不能依赖模型名称启发式判断。

## 非目标

- 不建立自动跨 Provider fallback；
- 不为不同模型复制一套 Agent Loop；
- 不重放已经开始输出的 stream；
- 不把 Provider 的全部实验字段暴露给写作界面；
- 不引入第三方通用 Agent runtime 接管 Loby 会话、工具或作者审阅。

## 验证

- 429/502 和连接失败仅在响应开始前有限重试；认证与普通 4xx 不重试；
- 超长活跃 stream 可以持续，180 秒无数据的 stream 明确超时且不重放；
- 错误响应正文也有读取时限，错误细节有长度上限；
- OpenAI-compatible 目录不声明推理能力，请求不含 `reasoning`，界面不显示推理档位；
- OpenAI/ChatGPT 仍发送已声明的 reasoning summary，Anthropic 继续使用自己的 effort 映射；
- Provider 定向单元测试、前端能力测试、TypeScript typecheck 与完整质量门禁通过。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
