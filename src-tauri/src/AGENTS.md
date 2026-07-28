# src-tauri/src/ - Native composition 与领域层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
agent/ - Loby Agent Runtime、Provider、工具、MCP、Skill、凭证、事件、会话与临时附件
library/ - 写作库扫描、保存、偏好、活动记录、监听与回收站
publishing/ - 发布渠道、主题、秘密与上传
resources/ - 图片、Markdown/Obsidian 导入和导出资源的受控读写
</directory>

<member>
lib.rs - crate 模块根与公开启动边界
main.rs - desktop binary 入口
app.rs - Tauri builder、managed state、菜单、commands 与 events 注册，包括帮助菜单欢迎界面的 renderer 事件桥接；新建项目与快捷键面板保留菜单点击但不注册冲突性 native accelerator
agent.rs - AI agent 领域模块根与 command/runtime 能力边界
library.rs - 写作库领域模块根、command facade 与库级不变量入口
resources.rs - 写作资源领域模块根与受控导入、读取、导出 command facade
models.rs - 跨 command 的序列化模型，包括 Provider 显式能力、Agent Skill、Agent Event Protocol v2 的封闭 kind、phase/state/visibility/sequence、stream 指标与图片产物
fs_paths.rs - 通用安全路径与文件名能力
markdown.rs - Markdown/frontmatter 解析与渲染
project_paths.rs - 项目目录与资源路径解析
system_paths.rs - 系统打开、显示与复制能力；网络图片受限下载并校验后，只将单个临时文件动态授权给 asset protocol 与原生 Quick Look
window_lifecycle.rs - 主窗口首屏显示、Dock 恢复与 macOS 原生全屏退出通知驱动的交通灯无闪动位置修复
tests.rs - 真正跨领域的 native 集成测试
</member>

前端可见的 command 名称、camelCase payload 与 event 名称是稳定 API。`app.rs` 只组合，不实现持久业务；跨领域测试只有在所有权清晰后才下沉。

远程图片预览只能在下载体积和图片格式校验通过后，把生成的单个临时文件动态加入 Tauri asset protocol scope；禁止为了编辑器预览把 `$TEMP/**` 或其他宽目录写入静态 scope。临时目录与 WebView 授权都随应用进程结束而失效。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
