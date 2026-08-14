# app-update/ - 桌面应用更新能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
hooks/ - Tauri 更新检查、签名包下载、安装准备与用户确认后的重启协调
</directory>

更新源由 Tauri 按平台解析：macOS/Windows 先读取公开 Gitee `geekmai/Loby-Releases` 的 `updates/<target>-<arch>/latest.json`，失败后回退到完整 GitHub Releases；Linux 的 Gitee 路径故意不存在，因此继续使用 GitHub。GitHub 的 `latest.json` 仍必须完整提供 macOS、Windows、Linux 平台条目，Gitee 只镜像 macOS/Windows 安装与更新资产。检查请求使用短超时和 `Cache-Control: no-cache`，自动检查失败不得打断写作，手动检查必须给出明确反馈；安装前由 app 组合层完成本地写作队列 flush，更新领域不读取或修改写作库内容。Windows 安装器会在 `downloadAndInstall` 中接管并退出当前进程，macOS/Linux 下载完成后继续由用户确认重启。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
