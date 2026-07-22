# shared/ - 跨功能公共层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 跨 feature 的轻量界面、液态玻璃、导航与窗口控件
hooks/ - theme、viewport、window chrome、shortcut 与通用 React 生命周期工具
lib/ - dates、diff、formatters、keyboard、theme、toast 与无领域偏向的工具
constants/ - 跨功能主题选项与持久化 ID
</directory>

<member>
types.ts - renderer 共享领域类型；只承载多个 feature 都需要的稳定契约
</member>

`shared` 不得导入 `app` 或具体 feature。仅被单一 feature 使用的能力应留在该 feature，不能借“复用”之名继续堆成新的 `lib/` 杂物间。

App 与 editor 快捷键统一通过 `lib/keyboardShortcuts.ts` 声明和格式化，禁止在组件中重复文案或建立孤立 `keydown` listener。Application/editor theme 的选项与持久化 ID 归 `constants/themes.ts` 和 `lib/themes.ts`，视觉值分别由 styles 全局 Token 与编辑器作用域 palette 承载。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
