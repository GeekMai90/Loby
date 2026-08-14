# ADR 0022：以 Gitee 镜像 macOS/Windows 国内更新资产

## 状态

已接受（2026-08-13）。本决策补充并扩展 [ADR 0020](0020-static-github-releases-updater.md) 与 [ADR 0021](0021-open-source-and-in-repository-releases.md) 的静态 updater 方案。

## 背景

GitHub 继续是 Loby 的公开源码与正式三平台 Release 仓库，但部分中国大陆用户无法稳定访问 GitHub，导致安装包下载和自动更新失败。项目已经有 GitHub Actions 发布矩阵，不希望为了这一条分发链路新增自建 API、OSS、CDN、备案或持续运行的服务器成本。已安装旧版本的过渡兼容不在本次范围内；只保证本方案合并后新安装版本的更新路径。

## 决策

- GitHub `GeekMai90/Loby` 仍是唯一正式事实来源，完整发布 macOS、Windows、Linux 安装包、`.sig` 和包含三个平台的 `latest.json`；构建、签名和版本仍只发生一次。
- 使用公开 Gitee 仓库 `geekmai/Loby-Releases` 作为静态国内镜像。正式发布在 GitHub 资产匿名验收成功后，使用 `GITEE_RELEASE_TOKEN` 镜像 macOS/Windows 的 DMG、`.app.tar.gz`、macOS `.sig`、Windows NSIS `.exe`、Windows `.sig`，并上传镜像版 `latest.json`。
- Gitee 仓库同时维护两个 raw 入口：`updates/darwin-aarch64/latest.json` 与 `updates/windows-x86_64/latest.json`。两份清单都只包含 macOS/Windows 镜像条目，签名逐字复用 GitHub 构建收据，下载 URL 指向同版本 Gitee Release 附件；不在 Gitee 重新构建或重新签名。
- Tauri updater 首先请求 `https://gitee.com/geekmai/Loby-Releases/raw/master/updates/{{target}}-{{arch}}/latest.json`，再请求 GitHub 完整清单。Linux 不创建 Gitee 清单，因此其首个请求返回 404 后自然回退 GitHub；macOS/Windows 则在 Gitee 不可用、清单不存在或请求失败时回退 GitHub。
- 正式工作流通过 `release:publish --mirror-gitee` 触发镜像，脚本以版本 tag 幂等创建/更新 Gitee Release，更新 raw 文件，并以匿名 HTTP 下载和 SHA-256 校验验收镜像资产与清单。dry-run、普通 CI 和 Pull Request 不读取 Gitee secret。

## 后果

该方案复用现有构建与签名资产，不增加服务器、OSS、CDN 或备案成本；国内用户获得一个公开静态备用下载源，GitHub 仍保留完整回退能力。代价是 Gitee 的可用性、上传限制和 Release 行为成为额外外部依赖，且正式发布会多一个镜像验收阶段；镜像失败时发布工作流必须失败并重试，不能把未验收的 Gitee 清单视为可用。

Gitee token 只存在于 GitHub Actions secret 和受控本机凭证存储中，不进入仓库、应用包、日志或 updater 清单。未来若需要灰度、强制回滚、按设备分流或更强可用性，再通过新的 ADR 评估动态服务或多 CDN，而不是把规则继续堆入静态清单脚本。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
