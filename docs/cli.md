# Agent CLI

## 定位

`loby` CLI 是桌面应用之外的受控写入入口，让 Codex 等 Agent 把新 Markdown 文稿创建到落笔收件箱。CLI 与桌面应用保存在同一仓库、独立打包发布；第一阶段不提供 MCP，也不允许修改已有文稿、项目结构或 `.loby/library.json`。

## 安装与分发

CLI 是位于 `cli/` 的无第三方运行时依赖 npm 包，要求 Node.js 20 或更高版本。仓库内可以直接验证和打包：

```bash
npm run test:cli
npm run pack:cli
npm install -g ./loby-cli-0.1.0.tgz
```

打包产物可以发布到 npm 或附加到 GitHub Release；发布后其他用户只需全局安装该 tarball/package，不需要克隆桌面应用源码。正式发布版本号必须与 CLI 的 `--version`、`cli/package.json` 和 release artifact 一致。

发布到 npm 后，用户侧安装命令为：

```bash
npm install -g loby-cli
```

配套 Codex Skill 随 npm 包分发：

```bash
loby skill install codex
```

默认安装到 `$CODEX_HOME/skills/loby-cli`；没有 `CODEX_HOME` 时使用 `~/.codex/skills/loby-cli`。已有 Skill 不会被静默覆盖，显式 `--force` 才执行原子替换。

安装后可一次检查 CLI 版本、Node.js、活动写作库来源、写入权限与 Codex Skill：

```bash
loby doctor --json
```

## 写作库选择

CLI 按以下固定顺序解析写作库：

1. 本次命令的 `--library`；
2. `LOBY_LIBRARY` 环境变量；
3. 当前工作目录向上的第一个落笔写作库；
4. 落笔桌面端最后成功打开的活动写作库；
5. `loby library use <路径>` 保存的 CLI 默认值；
6. `~/Documents/LobyLibrary`。

桌面应用把活动库定位写入与 CLI 配置同目录的 `active-library.json`。该文件只有协议版本和写作库真实路径，不包含 registry、正文、凭证或界面设置；写入失败不会阻断桌面写作。macOS 与 Windows 使用系统配置目录下的 `Loby CLI/`，Linux 使用系统配置目录下的 `loby/`。CLI 不读取 WebKit 私有数据库。

显式路径不存在或不符合落笔目录结构时立即失败，不能把普通目录初始化为写作库。常用命令：

```bash
loby library use "/Users/example/Documents/LobyLibrary"
loby library current --json
```

## 创建收件箱新稿

已有 Markdown 文件时：

```bash
loby inbox create --title "文章标题" --file "/absolute/path/article.md" --json
```

Agent 也可以把正文写入 stdin：

```bash
loby inbox create --title "文章标题" --json < article.md
```

成功回执包含 `action`、`libraryPath`、`path`、`sheetId` 和 `title`。CLI 使用与桌面应用相同的 26 位 Base32 文稿身份、`inbox-default` 分组、可读文件名与同名数字后缀；若索引中存在收件箱目标字数默认值则继承它。新文件不包含“构思/完成”等文稿状态。

CLI 只以排他创建方式新增 Markdown，不覆盖现有文件，也不写索引。桌面应用运行时，现有文件 watcher 会把新增文稿刷新到收件箱；应用未运行时，下次加载会从 Markdown 扫描恢复。

Rust 桌面端与 JavaScript CLI 共同消费 `cli/test/fixtures/document-contract.json`，锁定 UUID v4 Base32 身份、收件箱分组、核心 frontmatter 与禁止写入的旧状态字段，防止两套实现随版本演进发生静默漂移。

## 后续 MCP 边界

只有在需要工具发现、结构化读取或长驻 Agent 客户端连接时才增加 MCP。MCP 应调用同一 CLI/core 契约，不能建立第二套文稿 ID、路径或持久化规则。
