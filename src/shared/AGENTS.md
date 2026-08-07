# shared/ - 跨功能公共层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 跨 feature 的轻量界面、液态玻璃与导航控件
hooks/ - theme、viewport、window chrome、shortcut 与通用 React 生命周期工具
lib/ - dates、diff、formatters、keyboard、theme、toast 与无领域偏向的工具
constants/ - 跨功能主题选项与持久化 ID
</directory>

<member>
components/BorderGlow.tsx - 共享的旋转边缘光效层，向 AI composer 与需要强调状态的轻量提示卡片提供可控激活、速度、颜色与 reduced-motion 兼容
types.ts - renderer 共享领域类型；承载文稿收藏/置顶元数据、摘要生成器回调、写作项目/帮助中心绑定、按 GitHub 目标或微信公众号 AppID 区分且可记录发布输入指纹的发布身份、Agent Skill、侧边栏折叠模式、含对话级 Provider/模型/推理选择的 AI 会话、分支/压缩/恢复、Agent Event Protocol v2、审阅偏移、run 产物与原子动作契约
lib/diff.ts - 跨 feature 的行级展示差异与带复杂度上限的 Myers 字符最小差异
lib/text.ts - 中英文混排字数、项目/文稿进度与阅读统计；核心字数采用无分配单遍字符扫描，并按不可变 WritingSheet 引用复用同一 revision 的统计结果
lib/getStrictContext.tsx - 强制 Provider 存在的泛型 React Context 工厂，供 Animate UI 等共享 primitives 复用
lib/utils.ts - 跨 feature 的 class 合并边界；识别 Loby 语义字号 Token，避免 `text-*` 字号与文字颜色互相覆盖
lib/windowClose.ts - 原生窗口关闭适配器，先阻止关闭并完成待保存任务，再隐藏可由 Dock 恢复的主窗口
hooks/useMainWindowReady.ts - 主窗口首屏同步适配器，等待 React 提交首屏并为隐藏 WebView 留出布局时间后再通知 native 显示窗口。不得改用 requestAnimationFrame 等"首帧已绘制"：隐藏窗口不产生 animation frame，该信号永远不会到达；隐藏 WebView 的长定时器同样会被系统挂起，只有这种短延时能穿过去，真正的兜底在原生侧
hooks/useWindowBackgroundSync.ts - 窗口材质适配器，把当前主题的 `--background` 同步给原生窗口层，取代 `transparent` 掩盖 resize 期间的落后帧；palette 仍由 styles 独占
hooks/useWindowChrome.ts - 主窗口拖拽与顶栏双击最大化适配器；显式处理窗口交互时不得与同一元素的 `data-tauri-drag-region` 重叠，避免 macOS 双重切换
hooks/useWindowChrome.test.ts - 窗口 chrome 的拖拽与双击最大化回归边界，覆盖原生拖拽吞掉 `dblclick` 的时序
hooks/useAppShortcuts.ts - 应用快捷键捕获与分发边界，只阻断当前已启用的应用动作并让未绑定组合键继续下发给编辑器
</member>

`shared` 不得导入 `app` 或具体 feature。仅被单一 feature 使用的能力应留在该 feature，不能借“复用”之名继续堆成新的 `lib/` 杂物间。

`NavigationItem` 是跨 feature 导航项的唯一几何所有者；调用方只传内容和选择状态，不得覆盖其字号、图标尺寸、高度、内边距、图文间距与圆角。列表容器统一使用 Tailwind `gap-1`，具体契约见 `../styles/TOKENS.md`。

App 与 editor 快捷键统一通过 `lib/keyboardShortcuts.ts` 声明和格式化，禁止在组件中重复组合键或建立孤立 `keydown` listener。已绑定的应用快捷键由 renderer 在捕获阶段唯一接管；`⌘P` 打开写作库全局搜索，`⌘⇧P` 只打开当前可见列表栏的本地筛选，两者不得共用动作身份；`⌘S` 读取 CodeMirror 即时正文，正文编辑或启用的排版规则产生变化时生成手动历史版本并立即 flush 文稿与索引，重复保存不制造相同版本；`⌘/` 切换快捷键面板，CodeMirror 与原生菜单不得重复占用。字符会随 Shift 改变的组合键必须用 `KeyboardEvent.code` 兼容物理键位，例如 `⌘⇧\\` 仍按 `Backslash` 识别。没有应用 binding 的编辑器快捷键继续下发给 CodeMirror，已被局部控件消费的按键不能再次触发应用动作。Application/editor theme 的选项与持久化 ID 归 `constants/themes.ts` 和 `lib/themes.ts`，视觉值分别由 styles 全局 Token 与编辑器作用域 palette 承载。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
