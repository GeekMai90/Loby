# 落笔（Loby）

[![CI](https://github.com/GeekMai90/Loby/actions/workflows/ci.yml/badge.svg)](https://github.com/GeekMai90/Loby/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/GeekMai90/Loby?display_name=tag&sort=semver)](https://github.com/GeekMai90/Loby/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-111827)](https://github.com/GeekMai90/Loby/releases/latest)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

Loby 是一款本地优先、以 Markdown 为核心的专业写作桌面应用。它用可审阅、可撤销的应用内 AI 协作帮助作者写得更好，并允许用户显式授权外部 Agent 通过 CLI 新建或直接修改文稿。

## 下载

前往 [Latest Release](https://github.com/GeekMai90/Loby/releases/latest) 下载与你的系统对应的安装包：

- macOS Apple Silicon：`Loby_<version>_aarch64.dmg`
- Windows x64：`Loby_<version>_x64-setup.exe`
- Linux x64：`Loby_<version>_amd64.AppImage`

`.sig`、`.tar.gz` 和 `latest.json` 用于应用在线更新，普通安装不需要手动下载。当前 macOS 安装包使用 ad-hoc 签名，Windows 安装包尚未配置 Authenticode，系统可能显示未验证开发者或 SmartScreen 提示；相关发行者签名仍在完善中。

## 产品原则

- 作者始终掌握正文与最终决策。
- 本地写作库是唯一事实来源，Markdown 文件离开 Loby 后仍可阅读。
- 应用内 AI 修改必须可审阅、可撤销，并与本地快照和对话历史关联；外部 Agent 的 CLI 直改由用户显式指令授权。
- 写作库注册表只记忆名称与路径；移除或改显示名称不得移动、重命名或删除本地目录。
- 编辑器是主界面，AI 是次级协作表面。

## 当前能力

- 以收件箱、笔记和项目组织本地 Markdown 文稿。
- 使用 CodeMirror 6 完成长文编辑、搜索、历史与 Markdown 装饰。
- 通过内置的 Loby Agent Runtime 连接用户配置的模型服务，提供流式对话、上下文、工具调用与可审阅修改，不依赖外部 Codex runtime。
- 管理图片资产、项目元数据、废纸篓、写作活动和写作库偏好。
- 支持开放 Agent Skills、受审批的 MCP 工具、联网搜索与图片生成，并把正文变更继续收敛到作者确认边界。
- 提供 Markdown/HTML 导出、GitHub Hugo/Starlight 目标、墨问、WordPress 与微信公众号草稿发布，以及公众号主题工作室。
- 提供亮色、暗色与编辑器主题，普通界面基于 Tailwind CSS v4、shadcn/ui 和共享 Design Token。
- 提供可独立安装的 `loby` CLI，让 Codex 等 Agent 将新稿直接创建到收件箱，或按文稿 ID/路径直接替换已有正文。

## 技术栈

Tauri 2 + Rust + TypeScript + React 19 + Vite 8 + Tailwind CSS v4 + CodeMirror 6 + unified/remark/rehype。

## 本地开发

```bash
npm ci --legacy-peer-deps
npm run dev
```

常用命令：

```bash
npm run dev:web       # 只启动 Web 前端
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint
npm run test          # 前端测试
npm run test:cli      # CLI 测试
npm run test:rust     # Rust 测试
npm run check         # 完整本地门禁
```

Agent CLI 安装后可运行 `loby doctor --json` 检查当前活动写作库、写入权限与 Codex Skill。

运行环境、Git 流程和完整门禁见 [开发指南](docs/development.md)。

## 参与项目

欢迎提交 Issue 和 Pull Request。开始开发前请阅读 [贡献指南](CONTRIBUTING.md)；安全漏洞请按照 [安全政策](SECURITY.md) 私下报告，不要在公开 Issue 中披露。项目的源代码采用 [ISC License](LICENSE)，名称与图标的使用边界见 [商标政策](TRADEMARKS.md)。

## 文档导航

- [产品简述](docs/product-brief.md)
- [本地优先文件架构](docs/local-first-file-architecture.md)
- [AI 集成](docs/ai-integration.md)
- [Agent CLI](docs/cli.md)
- [设计语言](docs/design-language.md)
- [前端结构](docs/frontend-structure.md)
- [原生结构](docs/native-structure.md)
- [发布架构](docs/publishing.md)
- [工程路线图](docs/engineering-roadmap.md)
- [架构决策记录](docs/adr/AGENTS.md)

项目级规则与 GEB 文档地图以 [AGENTS.md](AGENTS.md) 为准。
