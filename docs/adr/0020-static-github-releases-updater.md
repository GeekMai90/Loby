# ADR 0020：使用公开 GitHub Releases 提供静态桌面更新

> 状态更新：发布仓库边界已被 [ADR 0021](0021-open-source-and-in-repository-releases.md) 取代。Tauri 静态 updater、完整三平台 manifest 与签名边界继续有效。

## 背景

Loby 是 Tauri 本地优先桌面应用，源码仓库保持私有。产品需要在导航栏提示新版本，并在用户确认后下载、安装和重启，但当前没有自建服务器，也不需要差分更新、灰度发布、账号授权或动态版本策略。

## 决策

采用 Tauri 2 官方 updater 的完整安装包覆盖更新。私有 `GeekMai90/Loby` 保留源码，公开 `GeekMai90/Loby-Releases` 只托管安装包、Tauri `.sig` 和静态 `latest.json`；客户端固定读取该仓库的 `releases/latest/download/latest.json`，由 Tauri 按当前系统和架构选择平台条目。

正式发布矩阵固定为 macOS Apple Silicon、Windows x64 和 Linux x64，对应 `darwin-aarch64`、`windows-x86_64`、`linux-x86_64`。每个平台在对应原生系统 runner 构建并生成带哈希的收据，汇总器只有在完整矩阵通过时才生成 manifest。Linux 只发布 AppImage，避免静态 `linux-x86_64` 平台键无法区分 DEB 与 AppImage 更新包类型的问题。

更新包必须使用独立 Tauri signing key 签名。公钥嵌入 `tauri.conf.json`，私钥只保存在受控本机或发布环境 secret 中，禁止进入源码、写作库、日志和 Release。安装前由 app 组合层 flush 写作保存队列，updater 只替换应用 bundle，不读取或迁移本地 Markdown。

启动后自动检查一次，失败保持安静；用户从帮助菜单手动检查时给出结果。发现更新后，底部帮助按钮临时替换为主题色下载按钮；下载、安装和重启必须由用户点击触发。

## 结果

当前方案没有自建后端、数据库、域名或运行中服务成本，并保持源码私有。GitHub-hosted runner 只由手动正式发布触发，不参与 PR CI。静态更新源不提供灰度、按用户分流、安装格式分流或服务端降级；出现这些真实需求时，再通过新 ADR 引入动态更新服务。Tauri updater 签名不替代 macOS/Windows 平台代码签名与公证。
