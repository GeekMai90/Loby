# app/ - 应用组合层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
App.tsx - 主窗口协调器，持有跨功能状态、首次启动与帮助菜单欢迎界面、默认进入外观页的应用设置、写作设置到收件箱新文稿目标默认值的领域映射、原生视图菜单打字机状态同步、可重复切换的快捷键面板、整组与单独导航栏切换、按上次选择预加载的异步 CodeMirror 阶段、新建文稿落稳后的编辑器聚焦请求、正文逐键单文稿耐久化、以 CodeMirror 实时正文和上次手动版本为基线并通过统一 Toast 反馈结果的 `⌘S` 去重保存事务、有界 React 模型提交与单 revision 字数派生、AI 固定侧边偏好与单次形态覆盖、应用级发布目标、统一 Markdown 导入入口、持久化所有权及主要界面组合
AppRoot.tsx - 多窗口入口选择器，按窗口类型装配主应用、公众号主题工作室、主窗口首屏 ready 信号与统一 Animate UI Tooltip 上下文
</member>

这里可以组合 feature，但不得吸收稳定的领域规则、长 JSX、大型选项/palette 或平台适配。新 modal、panel、inspector tab、sidebar、toolbar 或 picker 从所属 feature 的独立组件开始。拆出状态所有权前必须先有聚焦的集成测试，不能为了缩短 `App.tsx` 改变持久化与交互时序。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
