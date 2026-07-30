# Loby CLI

让 Codex 等 Agent 把 Markdown 新稿安全创建到落笔（Loby）收件箱。

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

## 安装 Codex Skill

```bash
loby skill install codex
```

详细设计与发布边界见 Loby 仓库中的 `docs/cli.md`。
