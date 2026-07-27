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

名称必须与目录名一致，只使用小写英文字母、数字和连字符。description 应写清楚“做什么”和“何时使用”；模型只在相关时加载正文。

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
  -> text content or a controlled local binary path

generate_image(prompt, skillId, referencePaths)
  -> 仅允许把该已启用 Skill 包内的 PNG/JPEG/WebP 作为参考图
```

创建和更新是写入型工具：

```text
create_skill(name, description, instructions)
update_skill(skillId, description, instructions)
```

它们必须经过 Agent Runtime 的写入审批。Skill 不会自动获得命令执行、写正文、联网、图片或 MCP 权限；这些能力仍由 Tool Registry 与 Permission Controller 决定。

## 真实迁移样例

2026-07-27 使用用户现有的两个配图 Skill 对规则做了验收：

- `every-editorial-cover`：只有 `SKILL.md` 与宿主展示元数据，不依赖固定路径、脚本或私有工具名；落笔应判定为 `compatible`，可以直接复制安装。执行到生成步骤时，Agent Runtime 根据说明调用 `generate_image`。
- `xiaomai-article-illustrate`：包体约 1.7 MB，含 5 个 references 与 3 张人物参考图，均在单文件和总包限制内；但说明包含 `image_gen`、固定 `/Users/.../GeekMaiOB/_attachments` 路径，以及直接回写 Obsidian `![[...]]` 的宿主行为，因此应判定为 `adaptation-required`。

小麦配图的适配目标不是删除视觉资料，而是保留 references/assets 并只改运行边界：`image_gen` 映射为 `generate_image`，参考图片通过 `skillId + referencePaths` 传入图片编辑接口；固定附件目录改为当前项目 assets；直接改 Markdown 改为落笔 `insertImage` / 审阅动作。这个样例也是“开放格式兼容”和“宿主能力兼容”必须分开判断的原因。

## 开发验证

涉及 Skill 的变更至少验证：

- 合法与非法 frontmatter；
- 目录名不一致、符号链接、路径逃逸和大小上限；
- 内置与写作库同名时，写作库副本的覆盖行为；
- 兼容、待适配、不支持三种状态；
- 安装后不依赖原目录；
- 创建/更新必须审批，拒绝后不落盘；
- 未激活时不注入完整说明；激活后能按需读 references/assets；
- scripts 永远不会因 Skill 声明而执行；
- 正式 bundle 能发现 `skills/` resources。
