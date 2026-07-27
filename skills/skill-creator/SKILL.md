---
name: skill-creator
description: 通过对话把已经验证的多步骤写作工作流创建为落笔 Skill，或帮助分析和迁移来自 Codex、Claude Code 等遵循 Agent Skills 标准的 Skill。仅当用户明确要创建、安装、迁移或改进 Skill 时使用。
---

# 落笔 Skill 创建器

Skill 用于需要多次复用、包含稳定步骤或资源的工作流。一次性改写、几句话能说清的要求和普通写作建议，应继续使用自然语言或快捷提示，不要升级为 Skill。

## 从对话创建

1. 回顾本轮对话中已经实际讨论或验证的工作流实例。
2. 确认 Skill 的触发场景、明确非目标、输入、步骤、输出和验收标准。
3. 识别需要放入 `references/` 或 `assets/` 的可复用材料；当前 `create_skill` 只创建说明文件，额外资源应在创建后由用户通过 Skill 目录管理。
4. 用简洁的 Markdown 写工作流正文，不在正文重复 `name` 和 `description`。
5. 向用户展示名称、描述和关键步骤，得到确认后调用 `create_skill`。
6. 工具成功后才说明已经保存；工具被拒绝或失败时，准确报告当前状态。

名称使用 1–64 位小写英文字母、数字和连字符。description 同时说明“做什么”和“什么时候使用”，以便模型只加载真正相关的 Skill。

## 迁移公开 Skill

落笔采用开放 Agent Skills 包结构：`SKILL.md`，以及可选的 `references/`、`assets/`、`scripts/`。用户应先在“设置 → AI 助手 → Skills”中选择明确的 Skill 目录并查看预检结果，落笔不会自动扫描 Codex 或 Claude 的全部目录。

迁移时逐项检查：

- frontmatter 的 `name`、`description` 和目录名是否符合标准；
- 是否引用原宿主的私有配置目录、固定绝对路径或原宿主私有状态；
- 工具名称能否映射为落笔的 `read_markdown`、`search_documents`、`web_search`、`generate_image`、Skill 或 MCP 工具；
- 是否依赖命令行、子代理、hooks 或动态命令；落笔当前不执行任意脚本；
- 输出路径是否应改为当前写作库、项目资源目录或作者确认的图片动作；
- references/assets 是否使用 Skill 包内相对路径。

“需要适配”不等于格式无效。先保留原包内容并处于未启用状态。调用 `inspect_skill_package` 读取诊断和原始说明，和用户逐项确认宿主依赖的替代方案；确认完整的新说明后调用 `update_skill`。落笔会保留包内其他资源，重新诊断，并只在不存在兼容性提示时自动启用。

## 迭代

用户反馈结果不理想时，先判断是说明不清、工具映射错误、资源缺失还是任务本来不值得使用 Skill。只修改产生问题的工作流边界，并再次用真实样例验证，不要为了兼容假想宿主堆积分支。
