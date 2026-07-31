# ADR 0020：使用公开 GitHub Releases 提供静态桌面更新

## 背景

Loby 是 Tauri 本地优先桌面应用，源码仓库保持私有。产品需要在导航栏提示新版本，并在用户确认后下载、安装和重启，但当前没有自建服务器，也不需要差分更新、灰度发布、账号授权或动态版本策略。

## 决策

采用 Tauri 2 官方 updater 的完整安装包覆盖更新。私有 `GeekMai90/Loby` 保留源码，公开 `GeekMai90/Loby-Releases` 只托管安装包、Tauri `.sig` 和静态 `latest.json`；客户端固定读取该仓库的 `releases/latest/download/latest.json`。

更新包必须使用独立 Tauri signing key 签名。公钥嵌入 `tauri.conf.json`，私钥只保存在受控本机或发布环境 secret 中，禁止进入源码、写作库、日志和 Release。安装前由 app 组合层 flush 写作保存队列，updater 只替换应用 bundle，不读取或迁移本地 Markdown。

启动后自动检查一次，失败保持安静；用户从帮助菜单手动检查时给出结果。发现更新后，底部帮助按钮临时替换为主题色下载按钮；下载、安装和重启必须由用户点击触发。

## 结果

当前方案没有自建后端、数据库、域名或运行中服务成本，并保持源码私有。静态更新源不提供灰度、按用户分流或服务端回滚；出现这些真实需求时，再通过新 ADR 引入动态更新服务。Tauri updater 签名不替代 macOS/Windows 平台代码签名与公证。
