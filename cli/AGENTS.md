# cli/ - Agent 可安装的落笔命令行

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
src/ - argv 适配与写作库安全写入核心
test/ - Node 内建测试覆盖路径发现、文件契约、冲突处理与真实进程调用
skills/ - 随 npm 包分发并可由 CLI 安装的 Agent Skills
</directory>

<member>
package.json - `loby` 可执行入口、Node 版本、发布文件白名单与独立测试命令
LICENSE - CLI npm 发布包携带的 ISC 授权文本
README.md - npm 包安装、写作库配置、收件箱创建与 Codex Skill 快速入口
</member>

CLI 只通过新增 Markdown 与落笔协作，不修改 `.loby/library.json`，避免与正在运行的桌面应用争夺索引写入；桌面 watcher 负责把外部新稿刷新进 React。写作库解析顺序固定为显式参数、环境变量、当前目录祖先、桌面活动库、CLI 配置和默认目录；`doctor` 必须以结构化结果暴露最终来源、写入权限与 Skill 状态。所有写入必须验证真实落笔目录、使用 Rust/CLI 共用 fixture 锁定的稳定文稿 ID 与 frontmatter、拒绝覆盖同名文件并返回可供 Agent 解析的 JSON 回执。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
