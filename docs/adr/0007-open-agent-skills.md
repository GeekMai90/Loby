# ADR 0007：采用开放 Agent Skills 作为落笔 Skill 标准

日期：2026-07-27

## 状态

已接受

## 背景

用户已经在 Codex、Claude Code 等 Agent 中打磨过写作工作流，网络上分享的 Skill 也主要采用 `SKILL.md` 包结构。若落笔再创造一套专用 schema，用户需要维护重复副本，公开资源也必须手工重写；若直接运行外部客户端的 Skill 目录，则会继承对方的工具名、路径、脚本权限和宿主状态，既不可靠也不符合落笔的写作边界。

Skill 还不应吞掉普通提示词。大多数润色、拟标题和一次性建议用自然语言或快捷提示即可；只有经过验证、需要重复调用的多步骤工作流才值得成为 Skill。

## 决策

落笔采用 [Agent Skills 开放规范](https://agentskills.io/specification) 的包结构，不定义落笔专用的替代格式：

- 每个 Skill 是一个与 `name` 同名的目录，以 `SKILL.md` 为入口；
- frontmatter 至少包含 `name` 与 `description`；
- 可选使用 `references/`、`assets/`、`scripts/`，说明和资源使用包内相对路径；
- 运行时先只暴露名称与描述，相关时通过 `activate_skill` 渐进读取完整说明，再按需读取资源；
- `allowed-tools` 等宿主扩展可以保留，但不能向落笔授予权限。

落笔只拥有两类 Skill：

- 应用内置：随 bundle 发布，用户可停用但不能原地修改或删除；
- 写作库 Skill：保存在 `<library>/.agents/skills/<name>/`，与写作库一起备份、迁移和管理。

不自动扫描 `~/.codex`、`~/.claude` 或其他应用的全部目录。导入必须由用户选择一个明确的本地 Skill 目录，原生层预检后复制到当前写作库；安装后的运行不依赖原目录。启停和来源状态独立保存在 `<library>/.loby/skill-state.json`，不污染开放 Skill 包。

## 创建与迁移

内置 `skill-creator` 负责模型侧的对话工作流，原生 Skill Store 负责确定性写入：

1. 用户与助手用真实例子讨论并稳定工作流；
2. 助手判断它是否值得成为 Skill，确认触发场景、非目标、输入、步骤、输出和验收；
3. 用户确认后，助手调用写入型 `create_skill`；
4. Agent Runtime 展示审批，原生层校验名称、大小和内容后原子写入；
5. 创建成功后才进入 Skill catalog。

导入采用三级诊断：

- `compatible`：开放格式和落笔工具边界都可直接支持，安装后启用；
- `adaptation-required`：格式有效，但引用宿主工具、固定路径或脚本，安装后保持停用；
- `unsupported`：缺少基础字段、目录名不一致、包含符号链接或超过安全限制，不允许安装。

对于待适配 Skill，助手通过 `inspect_skill_package` 读取原始说明和诊断，与用户确认映射后调用写入型 `update_skill`。更新只替换 `SKILL.md`，保留 references/assets/scripts，重新诊断并仅在完全兼容时自动启用。

## 权限与执行

- Skill 是工作流说明，不是权限主体；它只能调用 Agent Runtime 已注册的 Tool；
- V1 保留但不执行任意 `scripts/`，也不提供 Bash/Shell；
- 本地 Markdown、联网、图片、MCP 和写入继续遵循各自的范围、凭证和审批政策；
- 导入拒绝符号链接、路径逃逸、单文件超过 4 MB、包超过 256 个文件或 24 MB；
- 删除只允许当前写作库 `.agents/skills` 下的一级目录，不能删除内置资源或包外路径。

## 影响

- Codex/Claude Skill 在只使用开放字段和通用说明时可直接导入；宿主扩展必须显式适配，不能承诺无条件兼容；
- Skill 可随写作库迁移，且不依赖用户机器上是否安装 Codex 或 Claude Code；
- 运行时上下文不再预载所有说明，普通对话成本与 Skill 数量解耦；
- 本地目录、ZIP 与 `.skill` 只是导入 source adapter，不改变包标准或 Skill Store；Git URL 可在后续以同样边界加入，不能绕过预检和复制安装。
