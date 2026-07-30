---
name: loby-cli
description: 通过已安装的 loby CLI 把 Agent 撰写或整理的 Markdown 新稿创建到落笔收件箱，或在用户明确要求时直接替换既有落笔文稿正文。Use when the user asks Codex to write, save, capture, send, revise, or update a document/article/note in Loby or 落笔。
---

# 落笔 CLI

1. 先运行 `command -v loby`。若命令不存在，停止写入并告诉用户需要安装 Loby CLI；不要猜测写作库路径或直接写入目录。
2. 运行 `loby doctor --json`，确认 `ok: true`，并把回执中的 `library.path` 作为本次目标写作库。若未配置，让用户提供路径后运行 `loby library use <路径>`；不要把普通目录初始化成写作库。若 Skill 未安装，按回执提示运行 `loby skill install codex`。
3. 判断用户要新建还是修改，并准备完整 Markdown 正文。新建时，已有 UTF-8 文件使用：

   ```bash
   loby inbox create --title "文稿标题" --file "/absolute/path/draft.md" --json
   ```

   正文尚未落盘时通过 stdin 传入；不要把长正文放进单个命令行参数：

   ```bash
   loby inbox create --title "文稿标题" --json
   ```

4. 用户明确要求修改既有文稿时，优先使用稳定 `sheetId`；只有没有 ID 且 CLI 先前回执路径仍然有效时才使用绝对 `path`，两者只选一个。已有 UTF-8 新正文文件时使用：

   ```bash
   loby document update --id "sheet-..." --file "/absolute/path/revised.md" --json
   ```

   或：

   ```bash
   loby document update --path "/absolute/path/document.md" --file "/absolute/path/revised.md" --json
   ```

   正文尚未落盘时通过 stdin 传入。`document update` 会立即替换整篇正文，不出现确认或审阅步骤；因此没有明确文稿 ID/回执路径时不得猜测目标。

5. 解析 JSON 回执。只有 `ok: true` 且存在 `path`、`sheetId` 时，才能告诉用户新建或修改成功；失败时原样概括错误，不得假报成功。
6. 完成后返回标题和落笔结果。除非用户明确要求，不继续移动文稿、发布或修改其他文稿。

## 边界

- 新文稿直接进入收件箱，不设置“构思/完成”等文稿状态。
- 既有文稿只在用户明确要求时直接修改；CLI 保留 frontmatter、自定义属性、标题和文件名，只替换正文并刷新 `updatedAt`。
- 直改采用最后一次写入生效，不提供提案、确认或 CLI 级撤销；执行前必须确保目标和完整替换正文都明确。
- 桌面 watcher 可能在写入后按标题整理文件名；后续操作以回执中的 `sheetId` 为权威，不把曾经返回的 `path` 当作永久身份。
- CLI 负责稳定 ID、frontmatter、同名避让和安全写入；Skill 不复制这些规则。
- 不直接编辑 `.loby/library.json`，创建时不覆盖同名 Markdown，不从输出中推测未返回的路径。
- CLI 优先使用落笔桌面端公开的活动写作库；`--library` 只用于用户明确指定的本次写入，`loby library use` 是桌面端状态不可用时的持久回退。
