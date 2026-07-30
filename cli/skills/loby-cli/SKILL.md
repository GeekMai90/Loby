---
name: loby-cli
description: 通过已安装的 loby CLI 把 Agent 撰写或整理的 Markdown 新稿创建到落笔收件箱。Use when the user asks Codex to write, save, capture, or send a document/article/note into Loby or 落笔；不用于直接改写已有文稿。
---

# 落笔 CLI

1. 先运行 `command -v loby`。若命令不存在，停止写入并告诉用户需要安装 Loby CLI；不要猜测写作库路径或直接写入目录。
2. 运行 `loby doctor --json`，确认 `ok: true`，并把回执中的 `library.path` 作为本次目标写作库。若未配置，让用户提供路径后运行 `loby library use <路径>`；不要把普通目录初始化成写作库。若 Skill 未安装，按回执提示运行 `loby skill install codex`。
3. 准备完整 Markdown 正文。已有 UTF-8 文件时使用：

   ```bash
   loby inbox create --title "文稿标题" --file "/absolute/path/draft.md" --json
   ```

   正文尚未落盘时通过 stdin 传入；不要把长正文放进单个命令行参数：

   ```bash
   loby inbox create --title "文稿标题" --json
   ```

4. 解析 JSON 回执。只有 `ok: true` 且存在 `path`、`sheetId` 时，才能告诉用户新稿已经进入收件箱；失败时原样概括错误，不得假报成功。
5. 新建完成后返回标题和落笔收件箱结果。除非用户明确要求，不继续移动到项目、发布或修改其他文稿。

## 边界

- 新文稿直接进入收件箱，不设置“构思/完成”等文稿状态。
- CLI 负责稳定 ID、frontmatter、同名避让和安全写入；Skill 不复制这些规则。
- 不直接编辑 `.loby/library.json`，不覆盖同名 Markdown，不从输出中推测未返回的路径。
- CLI 优先使用落笔桌面端公开的活动写作库；`--library` 只用于用户明确指定的本次写入，`loby library use` 是桌面端状态不可用时的持久回退。
