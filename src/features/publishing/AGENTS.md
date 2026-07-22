# publishing/ - 导出与发布能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 导出面板、发布入口、墨问/微信界面与公众号主题工作室
hooks/ - 项目导出状态与浏览器副作用协调
model/ - 渠道契约、payload、渲染器、主题注册/存储/会话、预览与 Tauri API 适配
</directory>

公众号主题统一通过 `model/wechatThemes.ts` 的类型化 registry 扩展。发布秘密只通过 Rust secret store 或环境变量流动，禁止进入 renderer 持久化、写作库、日志和审阅文本。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
