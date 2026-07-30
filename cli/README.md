# Loby CLI

让 Codex 等 Agent 把 Markdown 新稿创建到落笔（Loby）收件箱，并在用户明确要求时直接修改既有文稿正文。

## 安装

```bash
npm install -g loby-cli
```

CLI 需要 Node.js 20 或更高版本。首次使用先指定桌面应用已经创建的落笔写作库：

```bash
loby library use "/absolute/path/to/LobyLibrary"
loby library current --json
```

新版落笔会自动向 CLI 同步当前活动写作库；`library use` 是桌面端状态尚不可用时的手动回退。可以一次检查活动库、写入权限与 Codex Skill：

```bash
loby doctor --json
```

## 创建新稿

从 Markdown 文件创建：

```bash
loby inbox create --title "文章标题" --file "/absolute/path/article.md" --json
```

也可以通过 stdin 传入正文。新稿只会进入 `inbox/`；CLI 不覆盖同名文件，不修改 `.loby/library.json`，也不写入文稿状态。

## 直接修改文稿

优先使用创建回执中的稳定文稿 ID：

```bash
loby document update --id "sheet-..." --file "/absolute/path/revised.md" --json
```

也可以使用 CLI 回执中的当前绝对路径：

```bash
loby document update --path "/absolute/path/document.md" --file "/absolute/path/revised.md" --json
```

未提供 `--file` 时从 stdin 读取新正文。修改立即生效，不显示确认或审阅步骤；CLI 保留原有 frontmatter、自定义属性、标题和文件名，只刷新 `updatedAt`。路径必须位于当前写作库的 `inbox/`、`notes/` 或 `projects/` 中。桌面 watcher 可能随后按标题整理文件名，因此后续修改以 `sheetId` 为稳定依据。

## 安装 Codex Skill

```bash
loby skill install codex
```

详细设计与发布边界见 Loby 仓库中的 `docs/cli.md`。
