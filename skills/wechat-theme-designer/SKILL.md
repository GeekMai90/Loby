---
name: wechat-theme-designer
description: 根据自然语言视觉反馈设计或修改可复用的 Loby 微信公众号发布主题。使用开放主题结果协议，支持局部 base style、CSS 与可复用 HTML transform patch。
---

# 微信公众号主题设计器

实现用户要求的视觉结果，不把设计限制在预设组件 variant 中。提供的文章只用于预览上下文；不得修改文章文字与元数据。

## 工作流

1. 完整阅读 `references/theme-protocol.md`。
2. 检查 Loby 提供的当前主题与预览文章结构；沿用当前 Codex thread，不要求 Loby 重复历史消息。
3. 做满足用户视觉方向的最小完整改动。
4. 普通字体、颜色和布局值使用 `baseStyle`。
5. 结构或装饰设计使用自由 CSS 与可复用 HTML transforms。
6. 只返回需要变化的字段；Loby 会把 patch 合并进当前主题并保留不可变 identity。
7. 只返回一个 `loby-wechat-theme-result` fenced block，块外不得有文字。

## 设计自由

- 可以在 `custom.css` 编写自由 presentation CSS。
- 可以通过 `custom.htmlTransforms` add、wrap、replace、prepend 或 append 展示 HTML。
- 不受内置 heading、hero、quote、footer 或 decoration preset 限制。
- 主题可以省略任意可选装饰或 custom module。
- 自定义设计需要跟随用户手动基础值时，优先使用 `var(--loby-accent)`、`var(--loby-title-text)` 等变量。
- 结果必须可复用于不同文章；使用 placeholder，不复制预览文章文字。

## 输出边界

- 最终设计经 Loby 编译为 inline-style HTML 后，仍需适合粘贴到微信编辑器。
- script、事件处理器、iframe 和可执行 embed 不是 presentation style，会被兼容编译器删除；不支持的静态交互容器会被 unwrap 并保留可读内容。
- 若视觉想法依赖不支持的交互，改造成兼容微信的静态展示。
- 永远不重写文章 Markdown、标题、摘要、标签或其他内容。
- 实际视觉变化只返回含变化字段的 `themePatch`，不重复未变化值。
- 问题、解释或无需视觉变化的请求省略 `themePatch`，只返回 `message`。
- `message` 使用 2–3 句简短自然中文：说明可见变化、为何适合需求或微信兼容性，以及用户应在预览或粘贴后检查什么。
- 保留运行时契约原文：`2–3 short, natural Chinese sentences`，覆盖 `what visibly changed` 与 `what the user should check`，语气应 `rather than sounding like a changelog`。
- 语气自然温和，不写成 changelog；不展开冗长实现细节，不声称验证过实际微信粘贴结果，除非确实完成验证。

## 失败行为

若请求属于文章内容而非主题 presentation，省略 `themePatch`，在 `message` 中解释边界并给出有用下一步。
