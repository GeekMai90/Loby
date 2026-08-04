# Agent Skills 开发与迁移

## 产品分层

落笔的 AI 交互分三层：

1. 自然语言：一次性问题、建议和临时要求；
2. 快捷提示：几句话能稳定表达、需要频繁输入的提示词；
3. Skill：经真实任务验证、包含多步骤、资源或固定验收标准的可复用工作流。

不要为了“看起来更智能”把普通提示词包装成 Skill。Skill 的价值是保存已经打磨好的工作方法，而不是增加一个新的提示词收藏夹。

## 目录与包格式

```text
<application resources>/skills/
  skill-creator/
    SKILL.md

<writing library>/.agents/skills/
  every-editorial-cover/
    SKILL.md
    references/
    assets/
    scripts/

<writing library>/.loby/
  skill-state.json
```

最小 `SKILL.md`：

```markdown
---
name: article-polish
description: 对已经完成的中文文章做轻量润色；当用户要求保持原意、只修正表达问题时使用。
---

# 工作流

1. 阅读当前文章与用户限制。
2. 只修改错别字、标点和明显病句。
3. 通过落笔审阅协议提供完整候选正文。
```

名称必须与目录名一致，只使用小写英文字母、数字和连字符。`name`、`description` 和 frontmatter 后的 Markdown 工作流都是必填项；不再用目录名补齐缺失的 `name`。description 应写清楚“做什么”和“何时使用”；模型只在相关时加载正文。

落笔把上下文留给真实写作任务：可直接激活的 `SKILL.md` 最多 48 KB 且不超过 500 行，对话新建/更新的工作流正文最多 40 KB。更长的格式规则、样例和领域资料应放入 `references/`，并在主工作流中写清何时读取。

## 用户工作流

### 从对话创建

用户可以在助手中说“把刚才这套流程创建成一个 Skill”。内置 `skill-creator` 会先补齐触发场景、输入、步骤、输出和验收标准，再展示概要。只有用户确认后，Agent Runtime 才批准 `create_skill` 写入当前写作库。

创建工具只负责 `SKILL.md`。参考文档、样例图片和模板可以随后放入同目录的 `references/` 或 `assets/`；未来的编辑器应继续调用同一原生 Skill Store，而不是绕过它直接写文件。

### 导入 Codex 或 Claude Skill

1. 在“设置 → AI 助手 → Skills”点击“导入”；
2. 选择**直接包含 `SKILL.md` 的单个 Skill 目录**，或选择 `.skill` / `.zip` 包；
3. 查看兼容性、文件数量、脚本和宿主依赖诊断；
4. 可直接使用的 Skill 安装后启用；需要适配的 Skill 会复制到写作库但保持停用，且不能绕过诊断强制启用；
5. 回到助手说“帮我迁移刚导入的 `<skill-id>`”，确认改写方案后批准更新；
6. 用一个真实文章任务验证，再继续迭代。

导入是复制，不是软链接。删除或升级原 Codex/Claude Skill 不会影响落笔中的副本；反之亦然。

### 在对话中直接提供本地路径

用户也可以直接说：

```text
帮我把 /Users/example/.agents/skills/every-editorial-cover 转成落笔 Skill 并安装
```

Agent Runtime 必须先调用只读的 `inspect_external_skill(sourcePath)`，复用设置页相同的包大小、符号链接、路径逃逸和兼容性检查。模型只能使用用户明确提供的单个绝对路径或 `~/` 路径，不能枚举父目录、猜测其他 Skill，也不能扫描 Codex 或 Claude 的整个目录。

用户决定继续安装后，`install_external_skill(sourcePath)` 作为写入型工具显示审批卡，并把包复制到当前写作库。可兼容 Skill 自动启用；需要适配的 Skill 保持停用，再通过 `inspect_skill_package` 和 `update_skill` 完成转换。路径在预检和安装之间会重新校验，不能依赖第一次检查结果绕过安全边界。

## 兼容性映射

| 外部能力                         | 落笔处理                                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| `SKILL.md` name/description/body | 直接兼容                                                         |
| `references/`、`assets/`         | 保留；激活后按需读取                                             |
| `scripts/`                       | 保留但不执行，标记需要适配                                       |
| Codex/Claude 私有目录            | 改为写作库或包内相对路径                                         |
| `image_gen` / `imagegen`         | 改为 `generate_image`；包内参考图使用 `skillId + referencePaths` |
| web search                       | 改为 `web_search`                                                |
| 本地 Markdown 查找               | 使用 `list_documents`、`read_markdown`、`search_documents`       |
| MCP 宿主专用名称                 | 映射到落笔实际注册的 MCP tool；仍受审批                          |
| Bash/Shell/hooks/subagent        | V1 不支持，必须移除或改写                                        |
| `allowed-tools`                  | 可保留为元数据，但不授予权限                                     |

## Runtime 协议

普通请求只把启用 Skill 的 name/description catalog 放入 system prompt。模型需要 Skill 时调用：

```text
activate_skill(skillId)
  -> instructions + resource paths + compatibility

read_skill_resource(skillId, path)
  -> text page + startByte/endByte/nextOffset
  -> binary metadata only; never an absolute local path

generate_image(prompt, skillId, referencePaths)
  -> 仅允许把该已启用 Skill 包内的 PNG/JPEG/WebP 作为参考图
```

外部路径导入分为只读预检和审批安装：

```text
inspect_external_skill(sourcePath) -> read
install_external_skill(sourcePath) -> write
```

创建和更新同样是写入型工具：

```text
create_skill(name, description, instructions)
update_skill(skillId, description, instructions)
```

`install_external_skill`、`create_skill` 和 `update_skill` 必须经过 Agent Runtime 的写入审批；`inspect_external_skill` 只返回安全预检结果。Skill 不会自动获得命令执行、写正文、联网、图片或 MCP 权限；这些能力仍由 Tool Registry 与 Permission Controller 决定。

`activate_skill` 只返回有界资源目录；`read_skill_resource` 的 `offset` / `maxBytes` 用于按 UTF-8 边界分页，单次最多请求 32 KB，且序列化结果会继续收紧到 48 KB 以内。二进制 assets 只返回相对路径和体积；参考图必须通过 `generate_image(skillId, referencePaths)` 在原生边界内解析。

## 兼容性判断原则

Skill 迁移必须分别判断开放格式兼容性与宿主能力兼容性：前者检查 frontmatter、目录结构和 references/assets 等包结构，后者检查工具映射、资源路径和正文写回边界。需要适配时应保留可复用的视觉或参考资料，只转换运行边界，并通过 `insertImage` 或审阅动作等受控接口写回内容。一次性迁移记录不属于本长期契约，另行留在发布或验收记录中。

## 开发验证

涉及 Skill 的变更至少验证：

- 合法与非法 frontmatter；
- 目录名不一致、符号链接、路径逃逸和大小上限；
- 内置与写作库同名时，写作库副本的覆盖行为；
- 兼容、待适配、不支持三种状态；
- 安装后不依赖原目录；
- 创建/更新必须审批，拒绝后不落盘；
- 未激活时不注入完整说明；激活后能按需读 references/assets；
- 资源目录、长文本分页与 JSON 转义后的工具结果不超过各自预算；
- 二进制资源结果不暴露本机绝对路径；
- scripts 永远不会因 Skill 声明而执行；
- 正式 bundle 能发现 `skills/` resources。
