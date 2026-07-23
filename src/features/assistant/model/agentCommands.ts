/**
 * [INPUT]: 依赖 shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供 SlashCommand、slashCommands、expandSlashCommand、resolveMentionModes、buildMentionContext、resolveSkillMentions、buildSkillContext、usesPluginCapabilities
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { CodexSkill, MentionMode, WritingProject, WritingSheet } from "@/shared/types";
import { formatDocumentPropertiesForContext } from "@/features/editor/model/documentProperties";

export interface SlashCommand {
  name: string;
  label: string;
  prompt: string;
}

export const slashCommands: SlashCommand[] = [
  {
    name: "/polish",
    label: "润色当前选区",
    prompt: "请润色当前选区；如果没有选区，请指出当前稿件中最值得润色的 3 处，不要直接整篇重写。",
  },
  {
    name: "/outline",
    label: "结构诊断",
    prompt: "请诊断当前稿件结构，指出主线、断点、重复和可以调整的顺序。",
  },
  {
    name: "/title",
    label: "标题方向",
    prompt: "请基于当前稿件生成 5 个标题方向，每个标题说明适合的读者预期。",
  },
  {
    name: "/cover",
    label: "配图/封面",
    prompt: "请基于当前稿件生成封面图和正文配图建议，输出可用于图片生成的提示词方向。",
  },
  {
    name: "/wechat",
    label: "公众号发布",
    prompt: "请把当前稿件按微信公众号发布前检查清单审阅，指出标题、摘要、配图、段落节奏和排版问题。",
  },
  {
    name: "/xhs",
    label: "小红书拆条",
    prompt: "请把当前稿件拆成适合小红书的笔记结构，给出标题、分段、卡片图建议和正文文案方向。",
  },
  {
    name: "/compile",
    label: "组合发布",
    prompt: "请基于当前项目的稿件卡片，建议组合发布顺序和合并时需要补充的过渡段。",
  },
];

export function expandSlashCommand(input: string): string {
  const trimmed = input.trim();
  const matched = slashCommands.find((command) => trimmed === command.name || trimmed.startsWith(`${command.name} `));
  if (!matched) return input;
  const rest = trimmed.slice(matched.name.length).trim();
  return rest ? `${matched.prompt}\n\n补充要求：${rest}` : matched.prompt;
}

export function resolveMentionModes(input: string): MentionMode[] {
  const modes = new Set<MentionMode>(["current-sheet"]);
  if (input.includes("@project")) modes.add("project-outline");
  if (input.includes("@all") || input.includes("@all-sheets")) modes.add("all-sheets");
  if (input.includes("@selection")) modes.add("selection");
  return [...modes];
}

export function buildMentionContext({
  project,
  sheet,
  selectedText,
  modes,
  selectedSheetIds = [],
}: {
  project: WritingProject;
  sheet: WritingSheet;
  selectedText: string;
  modes: MentionMode[];
  selectedSheetIds?: string[];
}): string {
  const blocks = new Map<string, string>();

  if (modes.includes("project-outline")) {
    blocks.set(
      "项目结构",
      project.sheets.map((item, index) => `${index + 1}. ${item.title}${formatPropertySuffix(project, item)} - ${item.summary}`).join("\n"),
    );
  }

  if (modes.includes("selection") && selectedText) {
    blocks.set("当前选区", selectedText);
  }

  if (selectedSheetIds.length > 0) {
    const selectedSheets = project.sheets.filter((item) => selectedSheetIds.includes(item.id));
    blocks.set(
      "指定稿件卡片",
      selectedSheets.length > 0
        ? selectedSheets
            .map(
              (item, index) =>
                `## ${index + 1}. ${item.title}\n${formatDocumentPropertiesForContext(project, item).join("\n")}\n摘要：${item.summary}\n\n${item.body}`,
            )
            .join("\n\n")
        : "没有匹配到指定稿件卡片。",
    );
  }

  if (modes.includes("all-sheets")) {
    blocks.set("全部稿件卡片", project.sheets.map((item, index) => `## ${index + 1}. ${item.title}\n${item.body}`).join("\n\n"));
  } else if (modes.includes("current-sheet")) {
    blocks.set("当前稿件正文", sheet.body);
  }

  return [...blocks.entries()].map(([title, content]) => `### ${title}\n${content}`).join("\n\n");
}

function formatPropertySuffix(project: WritingProject, sheet: WritingSheet): string {
  const values = formatDocumentPropertiesForContext(project, sheet);
  return values.length > 0 ? ` [${values.join("；")}]` : "";
}

export function resolveSkillMentions(input: string, skills: CodexSkill[], selectedSkillIds: string[]): CodexSkill[] {
  const normalizedInput = input.toLowerCase();
  const resolved = new Map<string, CodexSkill>();

  for (const skill of skills) {
    if (selectedSkillIds.includes(skill.id)) {
      resolved.set(skill.path, skill);
      continue;
    }

    const nameToken = `$${skill.name.toLowerCase()}`;
    const idToken = `$${skill.id.toLowerCase()}`;
    if (normalizedInput.includes(nameToken) || normalizedInput.includes(idToken)) {
      resolved.set(skill.path, skill);
      continue;
    }

    if (containsIdentifier(normalizedInput, skill.name) || containsIdentifier(normalizedInput, skill.id)) resolved.set(skill.path, skill);
  }

  for (const alias of extractNaturalSkillAliases(normalizedInput)) {
    const matches = skills.filter((skill) => skillAliases(skill).includes(alias));
    if (matches.length === 1) resolved.set(matches[0].path, matches[0]);
  }

  return [...resolved.values()];
}

export function buildSkillContext(skills: CodexSkill[]): string {
  if (skills.length === 0) return "";

  return [
    "### 可用 Codex Skills",
    "用户希望本轮优先参考或调用以下本机 Codex skill。已读取到 instructions 时，必须按该 Skill 的工作流执行；如果需要真实执行文件操作，先说明将要做什么。",
    ...skills.map((skill) =>
      [
        `- ${skill.name}`,
        `  描述：${skill.description || "无"}`,
        `  路径：${skill.path}`,
        skill.instructions
          ? [
              `  Skill.md${skill.instructionsTruncated ? "（已截断）" : ""}：`,
              "  ````markdown",
              indentSkillInstructions(skill.instructions),
              "  ````",
            ].join("\n")
          : "  Skill.md：未读取，仅提供元信息。",
      ].join("\n"),
    ),
  ].join("\n");
}

export function usesPluginCapabilities(skills: CodexSkill[]): boolean {
  return skills.some((skill) => /[\\/]\.codex[\\/]plugins[\\/]/i.test(skill.path));
}

function containsIdentifier(input: string, identifier: string): boolean {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) return false;
  const escaped = normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(input);
}

function extractNaturalSkillAliases(input: string): string[] {
  return [...input.matchAll(/([a-z0-9][a-z0-9._:-]{1,63})\s*(?:技能|skill)/giu)].map((match) => match[1].toLowerCase());
}

function skillAliases(skill: CodexSkill): string[] {
  const identifiers = [skill.name, skill.id].map((value) => value.trim().toLowerCase()).filter(Boolean);
  return [
    ...new Set(identifiers.flatMap((identifier) => [identifier, ...identifier.split(/[-_:./]+/)]).filter((value) => value.length >= 3)),
  ];
}

function indentSkillInstructions(instructions: string): string {
  return instructions
    .trim()
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
