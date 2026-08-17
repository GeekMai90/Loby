# app/ - 应用组合层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
App.tsx - 主窗口协调器，持有跨功能状态、首次启动与帮助菜单欢迎界面、开源项目链接、签名桌面更新和安装前写作队列 flush、应用设置、写作目标映射、标准 Markdown 图片写入、原生菜单、快捷键、即时列表选择与可中断文稿导航、文稿收藏/置顶/创建副本菜单动作及独立发布分组、异步 CodeMirror、实时正文到排版/替换/历史保护/耐久化/阅读预览/公众号发布的权威读取、AI 形态、应用级发布目标、统一项目发布/单篇帮助中心入口、Markdown 导入、持久化所有权及主要界面组合；项目浏览上下文与当前编辑文稿选择分离
AppRoot.tsx - 多窗口入口选择器，按窗口类型装配主应用、公众号主题工作室、主窗口首屏 ready 信号与统一 Animate UI Tooltip 上下文
WindowsTitlebar.tsx - Windows Tauri 主窗口的无装饰窗口 Chrome，按显示器工作区承载横向应用菜单、显式拖拽/缩放和自定义窗口控制按钮；复用 App 现有菜单事件，不承载业务状态
WindowsTitlebar.test.tsx - Windows 标题栏的菜单入口、拖拽/双击最大化与窗口控制回归测试
WindowsViewport.test.ts - Windows 高 DPI 工作区契约回归测试；锁定平台配置不设置固定最小高度、WebView 根布局可收缩且内容填满实际客户区
</member>

这里可以组合 feature，但不得吸收稳定的领域规则、长 JSX、大型选项/palette 或平台适配。新 modal、panel、inspector tab、sidebar、toolbar 或 picker 从所属 feature 的独立组件开始。拆出状态所有权前必须先有聚焦的集成测试，不能为了缩短 `App.tsx` 改变持久化与交互时序。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
