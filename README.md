# 落笔（Loby）

Loby 是一款本地优先、以 Markdown 为核心的专业写作桌面应用。它用可审阅、可撤销的 AI 协作帮助作者写得更好，但不替作者一键生成整篇内容。

## 产品原则

- 作者始终掌握正文与最终决策。
- 本地写作库是唯一事实来源，Markdown 文件离开 Loby 后仍可阅读。
- AI 修改必须可审阅、可撤销，并与本地快照和对话历史关联。
- 写作库注册表只记忆名称与路径；移除或改显示名称不得移动、重命名或删除本地目录。
- 编辑器是主界面，AI 是次级协作表面。

## 当前能力

- 以收件箱、笔记和项目组织本地 Markdown 文稿。
- 使用 CodeMirror 6 完成长文编辑、搜索、历史与 Markdown 装饰。
- 通过 Codex CLI 的 app-server 协议提供对话、上下文与可审阅修改。
- 管理图片资产、项目元数据、废纸篓、写作活动和写作库偏好。
- 提供导出、墨问发布与微信公众号主题工作室。
- 提供亮色、暗色与编辑器主题，普通界面基于 Tailwind CSS v4、shadcn/ui 和共享 Design Token。
- 提供可独立安装的 `loby` CLI，让 Codex 等 Agent 将新稿直接创建到收件箱。

## 技术栈

Tauri 2 + Rust + TypeScript + React 19 + Vite 8 + Tailwind CSS v4 + CodeMirror 6 + unified/remark/rehype。

## 本地开发

```bash
npm install
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
