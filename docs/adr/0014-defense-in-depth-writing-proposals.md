# ADR 0014：文稿提案的纵深校验与可重试执行

日期：2026-07-27

## 状态

已接受

## 背景

Loby 已用结构化 `propose_*` 取代正文中的协议块，并把真正写入留给 renderer 的作者确认。但“模型收到严格 JSON Schema”不等于“运行时已经建立安全边界”：Provider 可能忽略 schema，后续 adapter 也可能引入未声明字段；只校验顶层 `target=anchor` 而接受任意嵌套对象，会把模型自由数据带入编辑器定位逻辑。

图片插入还有跨边界一致性问题。生成成果先在缓存目录，用户确认后复制到写作库，再插入正文。如果复制成功而编辑器写入失败，动作仍引用缓存源，重试会再次执行导入，且持久状态无法表达“资产已经稳定、正文尚未修改”。

## 开源实现对照

- [Codex app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) 将 tool approval 建模为明确的 server request，客户端响应后运行才继续；批准不是工具参数中的布尔提示。
- [OpenCode session processor](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) 在继续下一步之前让 tool part 进入确定终态，说明工具生命周期和模型文字不能混成一个隐式结果。
- 通用编码 Agent 通常在批准后直接执行文件修改；Loby 是写作应用，正文属于作者事实，因此必须额外保留“模型提案—作者确认—编辑器写入”三段边界，不能照搬自动编辑。

## 决策

1. `propose_*` 的 JSON Schema 只负责约束模型输出，不作为可信验证。Rust 原生层对每种提案执行顶层字段 allowlist、必填字段、枚举、大小和文件名校验。
2. `anchor` 是封闭对象，只允许定位所需字段，并按 anchor type 校验正整数段落序号、标题或文本锚点以及一到六级标题。未知或语义不完整的 anchor 在跨 IPC 前拒绝。
3. Runtime 对 proposal 的唯一动作是发布结构化事件；它不把 proposal 当作已执行工具，也不直接写 Markdown。
4. Renderer 在执行前校验当前 library/project/sheet 目标；整篇变更还必须匹配发送时 `baseBody`。动作已进入终态或目标已经变化时拒绝执行。
5. 编辑器写入前创建快照；写入成功后才把动作标为 applied。撤销同样校验当前正文仍等于该动作产生的结果，避免覆盖用户后续编辑。
6. 图片动作在确认后先把缓存成果导入写作库，并立刻将 action 提升为稳定相对路径、清除临时来源，再执行正文插入。若插入失败，动作保留为可重试状态且不会重复导入缓存文件。

## 明确不做

- 不让 Runtime 自动接受模型提案；
- 不因用户一次确认而授权后续同类写入；
- 不为追求编码 Agent 的自主性绕过 diff、快照或目标校验；
- 不在插入失败时自动删除已导入资产，因为它可能与已有内容去重或仍是可重试动作的事实。

## 验证

- 原生测试覆盖未声明顶层字段、非法枚举、未知嵌套字段和语义不完整 anchor；
- renderer 测试覆盖 action 目标校验与图片缓存路径提升；
- 图片导入成功而正文插入失败时，持久 action 引用写作库路径，重试不再次消费临时缓存；
- Rust format、proposal 定向测试、Clippy、前端定向测试和 TypeScript typecheck 通过。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
