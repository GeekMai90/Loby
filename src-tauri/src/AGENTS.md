# src-tauri/src/ - Native composition 与领域层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
agent/ - Codex 进程、协议、事件、会话、prompt 与临时附件
library/ - 写作库扫描、保存、偏好、活动记录、监听与回收站
publishing/ - 发布渠道、主题、秘密与上传
resources/ - 图片、Markdown/Obsidian 导入和导出资源的受控读写
</directory>

<member>
lib.rs - crate 模块根与公开启动边界
main.rs - desktop binary 入口
app.rs - Tauri builder、managed state、菜单、commands 与 events 注册
agent.rs - AI agent 领域模块根与 command/runtime 能力边界
library.rs - 写作库领域模块根、command facade 与库级不变量入口
resources.rs - 写作资源领域模块根与受控导入、读取、导出 command facade
models.rs - 跨 command 的序列化模型，包括 agent stream 阶段耗时与生成图片产物路径事件
fs_paths.rs - 通用安全路径与文件名能力
markdown.rs - Markdown/frontmatter 解析与渲染
project_paths.rs - 项目目录与资源路径解析
system_paths.rs - 系统打开、显示与复制能力，并将本地或受限下载的网络图片交给原生 Quick Look
window_lifecycle.rs - 主窗口首屏显示、Dock 恢复与 macOS 原生全屏退出通知驱动的交通灯无闪动位置修复
tests.rs - 真正跨领域的 native 集成测试
</member>

前端可见的 command 名称、camelCase payload 与 event 名称是稳定 API。`app.rs` 只组合，不实现持久业务；跨领域测试只有在所有权清晰后才下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
