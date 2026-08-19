# app/ - 应用组合层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
App.tsx - 主窗口协调器，持有跨功能状态、首次启动与帮助菜单欢迎界面、开源项目链接、签名桌面更新和安装前写作队列 flush、应用设置、写作目标映射、标准 Markdown 图片写入、原生菜单、快捷键、即时列表选择与可中断文稿导航、文稿收藏/置顶/创建副本菜单动作及独立发布分组、异步 CodeMirror、实时正文到排版/替换/耐久化/阅读预览/公众号发布的权威读取、AI 形态、应用级发布目标、统一项目发布/单篇帮助中心入口、Markdown 导入、持久化所有权及主要界面组合；主动保存、全局搜索与 AI 动作目标切换委托给 app 专用 hook；同时组合图片来源 Dialog、编辑器焦点门禁的顶栏图片入口、可选的文章内容驱动 Unsplash 默认搜索词回调与随机图片回退；项目浏览上下文与当前编辑文稿选择分离
AppRoot.tsx - 多窗口入口选择器，按窗口类型装配主应用、公众号主题工作室、主窗口首屏 ready 信号与统一 Animate UI Tooltip 上下文
lazySurfaces.ts - app 首屏按需加载注册表；只维护编辑器画布预加载与开发环境设计画廊，assistant、editor、library、media、settings 与 publishing 的 feature-specific surface 由所属模块自身持有
useAiActionTargetNavigation.ts - app AI 动作目标导航 hook；复用 assistant 只读解析器，协调错误回写、文稿/空项目/随手记定位、筛选复位和 Inspector 打开，不执行动作
useAiActionTargetNavigation.test.tsx - 验证 AI 动作返回普通文稿、空项目、随手记项目、缺失目标与未知动作时的副作用边界
useGlobalSearchNavigation.ts - app 全局搜索导航事务 hook；把有效搜索结果原子投影到列表选择、浏览上下文、rail 可见性和单调滚动请求，无效旧结果保持无副作用
useGlobalSearchNavigation.test.tsx - 验证全部范围、项目范围和已失效搜索结果的工作区切换与滚动语义
useManualDocumentSave.ts - app 主动保存协调 hook；维护写作库级正文基线和并发门禁，按设置延迟加载中文排版器，复用 library 历史版本规则并串联项目写回、立即持久化与 Toast
useManualDocumentSave.test.tsx - 验证主动保存的无变更 flush、实时正文格式化与版本写回、并发抑制、失败反馈和重试恢复
useNativeMenuBindings.ts - app 原生菜单适配 hook；维护打字机勾选同步、稳定事件到快捷键/业务动作的映射，并安全回收异步 Tauri listener
useNativeMenuBindings.test.tsx - 验证原生菜单事件全集、最新回调读取、无重复注册及注册完成前卸载的迟到 handler 回收
WindowsTitlebar.tsx - Windows Tauri 主窗口的无装饰窗口 Chrome，按显示器工作区承载横向应用菜单、显式拖拽/缩放和自定义窗口控制按钮；复用 App 现有菜单事件，不承载业务状态
WindowsTitlebar.test.tsx - Windows 标题栏的菜单入口、拖拽/双击最大化与窗口控制回归测试
WindowsViewport.test.ts - Windows 高 DPI 工作区契约回归测试；锁定平台配置不设置固定最小高度、WebView 根布局可收缩且内容填满实际客户区
</member>

这里可以组合 feature，但不得吸收稳定的领域规则、长 JSX、大型选项/palette 或平台适配。新 modal、panel、inspector tab、sidebar、toolbar 或 picker 从所属 feature 的独立组件开始。拆出状态所有权前必须先有聚焦的集成测试，不能为了缩短 `App.tsx` 改变持久化与交互时序。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
