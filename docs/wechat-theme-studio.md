# 微信公众号主题工作室

## 目标

主题工作室让作者用两种互补方式设计可复用公众号主题：

- 直接调整所有主题都具备的字体、颜色与布局基础值；
- 让 AI 编写开放 CSS 和可复用 HTML transforms，完成结构与装饰设计。

改字号不应等待 AI；AI 也不应被限制在少量标题、引用、页脚 preset 中。

## 产品边界

### 手动基础值

`baseStyle` 只包含跨主题稳定的通用字段：

- typography：文章标题、H2/H3/H4、正文、行高、段间距；
- colors：强调色、页面、标题、正文、强调、链接和 mark；
- layout：内容 padding、章节间距、通用圆角、图片圆角和阴影强度。

工作室左栏只展示这些通用字段和文章导航，不把可选 hero、品牌、签名、引用或页脚当成所有主题必填表单。修改内置主题时先创建个人副本；拖动过程即时预览，一次完成 gesture 只生成一个持久化 revision。

### AI 开放设计

AI 可以增加、修改或移除展示 CSS 与 HTML transforms，例如标题装饰、引用、分隔、签名和元信息表面。它只能改变 presentation，文章 Markdown、标题、摘要、标签和图片语义是只读输入。

禁止 script、事件处理器、iframe 与可执行 embed。兼容编译器删除可执行内容；Markdown 任务列表的 checkbox 转为静态 `☑`/`☐` 标记；静态但不受支持的交互容器应保留可读子内容。

每个 transform 在隔离候选 DOM 中执行。若它删除、复制、重排或重写受保护的正文、链接或图片，整条 transform 被忽略并报告 warning；仅包裹和装饰受保护内容是允许的。

## Manifest v2

`WechatThemeManifest` 的正式 TypeScript 定义位于 `src/features/publishing/model/wechatThemes.ts`。稳定结构包括：

- `schemaVersion`、稳定 `id`、`kind`、名称与说明；
- 可选 `baseThemeId`、三枚 preview swatches；
- 通用 `baseStyle`；
- 可选 `custom.css` 与 `custom.htmlTransforms`；
- 可选来源/许可证与创建更新时间。

运行时代码和文档不得复制完整 interface；新增字段先修改 typed model、normalizer、validator、编译器与测试，再更新本契约。

## 编译流程

1. Markdown 编译成带稳定 `data-loby-role` 语义标记的基础 HTML。
2. 应用 manifest HTML transforms，每条独立验证受保护内容。
3. 把 base style 映射为主题 CSS variables，再应用自定义 CSS。
4. 四个系统自带主题通过主题 CSS 默认隐藏文章级标题并清除默认上下留白；标题节点仍保留，个人主题的显式标题 CSS 可以覆盖这条默认规则并重新展示标题。
5. compatibility compiler 移除脚本、事件属性、危险 URL 和不支持结构，并把任务列表 checkbox 降级为静态标记；列表 marker 的颜色和字体类装饰安全回退到默认项目符号，自定义 marker 内容保留明确兼容性提示。
6. 最终样式内联到 HTML，供预览与微信剪贴板使用。

主题 CSS 作用域必须限制在发布根节点，不能影响工作室本身。选择器、HTML、CSS、数量和总字节都受预算限制，超限返回明确 warning/error。

## AI 协议

主题助手使用 `loby-wechat-theme-result` 返回解释或完整候选主题。解析器兼容旧 `loby-wechat-theme-change`，但写入和文档只使用当前协议。

主题助手与主应用 AI 共用 Assistant Runtime、连接目录、模型/推理选择、会话上下文规划、取消/引导、Composer 输入生命周期、`assistant-ui` 的 `turnAnchor="top"` 消息定位和用户明确提供的本地参考目录只读工具；主题工作室只保留自己的领域适配器：内置 `wechat-theme-designer` Skill、主题 JSON/文章摘要上下文、结果协议解析以及主题 revision 应用。模型选择属于当前主题会话，缺失时从应用默认值初始化，不回写全局默认设置。附件入口也完全复用主助手，支持受支持的图片与文档，并在发送前提升到写作库的受管附件目录。

主题会话历史仍按主题作用域保存，但发送时通过通用 `conversationMessages` 和 `conversationId` 进入 Runtime；因此“继续当前主题对话”不依赖 Provider 的隐式 thread。主题助手不应因主题领域而复制主助手的输入卡片、附件入口或模型菜单。

- AI 返回完整候选 manifest，不返回任意命令或文件写入指令；
- 应用校验 schema、ID/所有权、CSS、transforms 和兼容性；
- 主题目录代表色由应用根据 `baseStyle.colors` 派生，AI patch 不再负责维护 `swatches`；旧输出中的不完整色板会被兼容忽略；
- 合法变更先显示可审阅结果，再成为 revision；
- 非变更回答不得制造空 revision；
- 详细 envelope、patch 边界和 hard boundaries 以 `skills/wechat-theme-designer/references/theme-protocol.md` 为准。

## 状态与持久化

- 个人主题 manifest 保存在当前写作库 `themes/*.lobywechat`；收藏、默认项、bounded undo/redo revision 和多条命名主题对话保存在 `.loby/publishing/wechat-theme-state.json`。
- 主题切换、手动 gesture 和一次接受的 AI change 各形成一个语义 revision；连续 hover/slider frame 不逐帧入历史。
- 加载损坏或旧状态时通过 normalizer/legacy migration 恢复；不能让一份坏主题阻止打开写作库。
- 关闭窗口前 flush 当前变更；多窗口/多写作库不得交叉覆盖 state。

## 独立主题文件

`.lobywechat` 是主题交换格式，只包含单一合法 manifest 与格式标记。导入时限制扩展名、schema、大小和内容；ID 冲突通过明确复制/替换策略解决。导出不包含文章预览内容、AI 对话、revision、凭证或本机路径。

## 验证

- base style 的范围、颜色和数值验证；
- CSS/HTML sanitizer 与安全 URL；
- transform 受保护内容指纹；
- v1/legacy 到 v2 的幂等迁移；
- preview 与复制 HTML 一致；
- undo/redo、对话、导入/导出和写作库切换持久化；
- 微信编辑器、移动/桌面宽度、长文、图片、表格、代码块与脚注兼容。

## 非目标

- 不允许主题修改文章正文或执行脚本；
- 不把所有可能的装饰变成永久表单字段；
- 不按主题 ID 在 renderer 中创建分支；
- 不把个人主题或对话保存为应用全局唯一状态；
- 不承诺任意 Web CSS 在微信编辑器中原样保留。
