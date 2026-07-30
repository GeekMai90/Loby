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
README.md - npm 包安装、写作库配置、收件箱创建、既有文稿直改与 Codex Skill 快速入口
</member>

CLI 通过新增 Markdown 或直接替换指定文稿正文与落笔协作，不修改 `.loby/library.json`，避免与桌面应用争夺索引写入；桌面 watcher 负责刷新外部变化。写作库解析顺序固定为显式参数、环境变量、当前目录祖先、桌面活动库、CLI 配置和默认目录；`doctor` 必须以结构化结果暴露最终来源、写入权限与 Skill 状态。创建必须拒绝覆盖同名文件；修改必须由稳定 ID 或受管目录内的绝对路径精确定位，保留 frontmatter、自定义属性、标题与文件名，只刷新 `updatedAt` 并原子替换正文。所有成功操作都返回可供 Agent 解析的 JSON 回执。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
