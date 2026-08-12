# 落笔（Loby）

> 本地优先、以 Markdown 为核心的专业写作桌面应用。

[![Latest Release](https://img.shields.io/github/v/release/GeekMai90/Loby-Releases?display_name=tag&sort=semver)](https://github.com/GeekMai90/Loby-Releases/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-111827)](https://github.com/GeekMai90/Loby-Releases/releases/latest)

## 关于落笔

落笔是一款面向长期写作者的本地优先桌面应用。它把 Markdown 写作、项目组织、资料管理、AI 协作与发布准备放在一个安静、可控的工作环境中。

- Markdown 文件是内容的唯一事实来源，离开落笔仍可直接阅读和编辑。
- 通过项目、分组和文稿组织长期写作与零散灵感。
- 通过本地全文搜索快速找到文章、标题和正文内容。
- AI 作为可审阅、可撤销的协作者，帮助作者思考和修改，而不是替作者做最终决定。
- 图片资源、文稿元数据和本地写作库都由作者掌控。

## 下载与安装

前往 [Latest Release](https://github.com/GeekMai90/Loby-Releases/releases/latest) 下载当前版本。普通用户只需下载与系统对应的安装资产：

- macOS Apple Silicon：下载 `Loby_<version>_aarch64.dmg`，打开后将“落笔”拖入“应用程序”。
- Windows x64：下载 `Loby_<version>_x64-setup.exe` 并运行 NSIS 安装器。当前安装器尚未配置 Authenticode，首次安装可能显示 SmartScreen 提示。
- Linux x64：下载 `Loby_<version>_amd64.AppImage`，添加执行权限后运行：`chmod +x Loby_<version>_amd64.AppImage`。

应用首次启动可能请求访问 Documents 文件夹，这是为了读取默认的本地写作库；也可以在应用内选择其他写作文件夹。

## 自动更新

落笔通过本仓库的静态 `latest.json` 检查新版本，并使用 Tauri 签名校验当前平台的更新包。`latest.json` 同时提供 macOS Apple Silicon、Windows x64 和 Linux x64 AppImage 条目；更新清单、更新包和 `.sig` 必须来自同一个 Release。

除上述用户安装资产外，Release 还包含应用内更新使用的 `.app.tar.gz`、`.AppImage.tar.gz`、对应 `.sig` 和 `latest.json`。这些文件不需要手动安装。

## 发布资产说明

本仓库只托管落笔的官方桌面发布资产和更新元数据，不包含应用源码。正式版本使用 `v<version>` tag，资产命名如下：

```text
Loby_<version>_aarch64.dmg
Loby_<version>_aarch64.app.tar.gz
Loby_<version>_aarch64.app.tar.gz.sig
Loby_<version>_x64-setup.exe
Loby_<version>_x64-setup.exe.sig
Loby_<version>_amd64.AppImage
Loby_<version>_amd64.AppImage.tar.gz
Loby_<version>_amd64.AppImage.tar.gz.sig
latest.json
```

## 安全提示

请只从本仓库的 [Latest Release](https://github.com/GeekMai90/Loby-Releases/releases/latest) 下载官方安装包。不要将 Tauri 签名私钥、发布凭证或任何写作库文件上传到本仓库。

## English

Loby is a local-first Markdown writing app for macOS Apple Silicon, Windows x64, and Linux x64. This repository is its official public distribution channel for installers, updater packages, signatures, and update metadata. Download the installer for your platform from the [latest release](https://github.com/GeekMai90/Loby-Releases/releases/latest).
