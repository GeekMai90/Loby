# GitHub 发布三状态设计 QA

## 对照目标

- Source visual truth: 用户提供的调整前截图，已收录在 `output/design-qa/github-publishing-comparison.png` 上半部分
- Source dimensions: `2110 × 1806 px`
- Implementation screenshots:
  - `output/design-qa/github-publishing-default-left.png`
  - `output/design-qa/github-publishing-default-right.png`
- Combined comparison: `output/design-qa/github-publishing-comparison.png`
- Browser viewport: `1280 × 720 CSS px`, device scale factor `1`
- State: Light theme；GitHub 确认态、发布中、成功态；确认态公开/私密切换；成功态复制链接反馈

## 归一化方法

- Source 截取 GitHub 三状态首行 `2110 × 900 px`，等比缩放至 `1280 px` 宽。
- Implementation 在相同默认浏览器视口下分别捕获状态展台左侧与右侧，再各截取 `860 × 500 px` 的目标区域并缩放至 `640 px` 宽。
- 两张 implementation focused captures 横向拼接后，与 source crop 纵向拼接为 `1280 × 918 px` 的同一比较输入。
- Source 是调整前的问题截图，因此结构变化以用户本轮四项要求和墨问同屏样例为最终视觉真相，不以保留旧 GitHub 表单为目标。

## Full-view comparison evidence

- 确认态已从带边框的文章卡、slug 输入和草稿 checkbox，收敛为与墨问相同的无背景文章摘要、分隔线与公开/私密 Tabs。
- 发布中和成功态已移除顶部文章摘要，状态主体、打字机、进度条和成功反馈与墨问保持同一垂直节奏。
- 成功态 footer 在“完成”左侧新增“复制链接”，没有破坏按钮对齐或卡片高度。
- 标题统一为“发布到 + 用户设置名称”，没有渠道图标和额外 eyebrow 文案。

## Focused region comparison evidence

- Typography: 标题、文章名、辅助信息、状态标题与按钮继续复用现有语义字号和字重；GitHub 与墨问由同一摘要组件渲染。
- Spacing and layout rhythm: 确认摘要、分隔线、Tabs、状态主体和 footer 使用同一 `h-52` 内容高度；设计展台每卡最小 `408px`，空间不足时横向滚动，不再压缩卡片。
- Colors and tokens: 继续使用 `background`、`border`、`muted-foreground`、`primary` 与正式成功色；未引入渠道私有颜色。
- Image quality and assets: 发布中复用既有 `PublishTypewriterLoader` 资产；成功态复用正式图标组件，无占位资产或自制图形。
- Copy and content: 未发布显示“发布”，已发布显示“更新”；公开/私密只改变“所有人可查看/仅自己可见”和 payload；成功态提供“复制链接/已复制”反馈。

## Findings

- No actionable P0/P1/P2 findings remain.
- P3 accepted: 默认 `1280px` 视口下设计展台通过水平滚动查看第三张状态卡，避免为了三卡同屏而压缩真实 Dialog 几何。

## Interaction and runtime evidence

- Browser verified: 公开 → 私密后辅助文案变为“仅自己可见”，主按钮仍为“发布”，未出现“保存草稿”或“确认发布”。
- Browser verified: 成功态点击“复制链接”后按钮显示“已复制”。
- Automated regression verified: 未发布文章显示“发布”，已发布文章显示“更新”，复制动作接收 native 返回的真实文章 URL。
- Browser console errors: none.

## Comparison history

1. Initial implementation compressed three cards when the viewport reached the old `xl` breakpoint. Fixed by using three `minmax(408px, 1fr)` tracks and horizontal overflow below the required width.
2. Initial design-gallery Tabs were controlled by static values and did not react. Fixed by giving both GitHub and Mowen preview cards local visibility state; post-fix browser evidence shows copy and button semantics update correctly.
3. Final user correction removed `确认发布/保存草稿` button variants, restored only `发布/更新`, and added the success-state copy action. Post-fix screenshots and interaction checks show all requested states.

## Implementation Checklist

- [x] 标题使用“发布到 + 用户设置名称”
- [x] 确认态移除文章背景框、slug 与链接
- [x] 公开/私密复用墨问 Tabs 和辅助文案
- [x] 发布中与成功态移除顶部文章摘要
- [x] 未发布显示“发布”，已发布显示“更新”
- [x] 成功态增加“复制链接”并提供“已复制”反馈
- [x] 设计系统与真实发布组件共用 production views

## Follow-up Polish

- 无阻塞项；后续只需根据用户在真实应用窗口中的主观观感微调尺寸或间距。

final result: passed

---

# SuggestionMenu Design QA

## Visual source

- Product source: existing `DropdownMenu` in the AI assistant model selector.
- Reference capture: `.codex-artifacts/suggestion-menu/reference-dropdown.png`.
- Implementation capture: `.codex-artifacts/suggestion-menu/implementation-full.png`.
- Viewport: 1280 × 720 CSS px, light theme, floating AI assistant panel.

## Comparison

- Full view: compared the reference and implementation captures together at the same viewport and assistant-panel state.
- Surface: both use the solid menu material, shared menu foreground, border, shadow, padding, and menu radius.
- Item state: both use the shared highlight color, 13px primary text, 14px icon geometry, and item radius.
- Intentional difference: `SuggestionMenuItem` keeps a two-line 38px minimum row because suggestions include a title and description; `DropdownMenuItem` remains a single-line 26px command row.
- Placement: the suggestion menu remains anchored to the full composer width and opens 8px above it, preserving the existing input relationship.

## Interaction and accessibility

- `/` opens the quick-prompt and Codex skill listbox; `Escape` closes it.
- `@` opens the document listbox; `Enter` mounts the active document reference.
- The composer exposes `combobox`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; the active item exposes `option` and `aria-selected`.
- Browser console: no warnings or errors during the verified flows.

## Automated verification

- `npm run check`: passed.
- Frontend: 146 test files, 604 tests passed.
- Rust: 138 tests passed.

final result: passed
