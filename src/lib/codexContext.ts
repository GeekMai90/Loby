import type {
  AgentModel,
  ChatMessage,
  CodexSkill,
  AgentProvider,
  AgentReasoningEffort,
  AiMountedContext,
  MentionMode,
  ProjectResourceText,
  WritingProject,
  WritingSheet,
} from "../types";
import { buildMentionContext, buildSkillContext } from "./agentCommands";
import { formatBytes } from "./formatters";
import { buildNibvaDocumentOutlineContext } from "./nibvaDocumentOutlineContext";
import { buildNibvaOperatingContext } from "./nibvaOperatingContext";
import { buildNibvaWritingStructureContext } from "./nibvaWritingContext";
import { getWritingBrief, type ProjectResourcePaths } from "./projectModel";

export function buildCodexContext(
  project: WritingProject,
  sheet: WritingSheet,
  selectedText: string,
  messages: ChatMessage[],
  mentionModes: MentionMode[],
  skills: CodexSkill[],
  mountedContexts: AiMountedContext[] = [],
  agentRuntime: {
    provider: AgentProvider;
    model: AgentModel;
    reasoningEffort: AgentReasoningEffort;
    quickMode: boolean;
  },
  libraryPath: string,
  resourcePaths: ProjectResourcePaths | null = null,
  selectedResourcePaths: string[] = [],
  selectedResourceTexts: ProjectResourceText[] = [],
): string {
  const recentMessages = messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const writingBrief = getWritingBrief(project);
  const effectiveMentionModes = filterDuplicateMentionModes(mentionModes, mountedContexts, sheet.id);
  const currentSheetBodyProvided =
    mountedContexts.some((context) => context.type === "document" && context.sheetId === sheet.id) ||
    effectiveMentionModes.includes("current-sheet");

  return [
    `项目：${project.title}`,
    `项目状态：${project.status}`,
    `目标平台：${project.targetPlatform}`,
    `项目描述：${project.description}`,
    "写作简报：",
    `- 目标读者：${writingBrief.audience || "未填写"}`,
    `- 核心观点：${writingBrief.thesis || "未填写"}`,
    `- 语气风格：${writingBrief.tone || "未填写"}`,
    `- 发布备注：${writingBrief.publishingNotes || "未填写"}`,
    `当前稿件：${sheet.title}`,
    `稿件状态：${sheet.status}`,
    `稿件摘要：${sheet.summary}`,
    buildNibvaWritingStructureContext(project, sheet),
    buildNibvaDocumentOutlineContext(sheet, selectedText, { includeParagraphAnchors: !currentSheetBodyProvided }),
    "AI 运行偏好：",
    `- 运行器：${agentRuntime.provider}`,
    `- 模型：${agentRuntime.model || "auto"}`,
    `- 思考程度：${agentRuntime.reasoningEffort || "medium"}`,
    `- 快速模式：${agentRuntime.quickMode ? "开启" : "关闭"}`,
    buildNibvaOperatingContext({ libraryPath, project, sheet, resourcePaths }),
    [
      "AI 修改协议：",
      "- 如果用户要求你改写、润色、调整结构、替换段落、修改当前稿件正文，请不要声称自己已经直接写入文件。",
      "- 先用自然语言说明你的修改标准或修改思路，然后必须追加一个 ```nibva-change 代码块，供 Nibva 自动应用并显示差异。",
      "- 代码块必须是 JSON，格式为：",
      '{ "summary": "一句话概括修改", "proposedBody": "修改后的完整当前稿件正文", "changes": [{ "fromText": "原文片段", "toText": "修改后片段", "reason": "修改理由" }] }',
      "- proposedBody 必须是完整当前稿件正文，不是片段；changes 可以只列主要修改块。",
      "- Nibva 会默认应用 proposedBody，用户可以在编辑器中显示更改或撤销。",
      "- 如果用户要求新增一小段正文、过渡句、提纲片段、开头、结尾或发布说明，但不要求重写现有正文，优先用 `nibva-action` 的 `insertText`，不要为了小段插入输出整篇 proposedBody。",
      "- 如果只是回答问题、给建议、生成候选标题或不应改正文，不要输出 nibva-change。",
    ].join("\n"),
    resourcePaths
      ? [
          "项目资源目录：",
          `project: ${resourcePaths.project}`,
          `assets: ${resourcePaths.assets}`,
          `references: ${resourcePaths.references}`,
          `exports: ${resourcePaths.exports}`,
        ].join("\n")
      : "",
    selectedResourcePaths.length > 0 ? `已选择资源文件：\n${selectedResourcePaths.map((path) => `- ${path}`).join("\n")}` : "",
    formatResourceTextContext(selectedResourceTexts),
    selectedText ? `当前选区：\n${selectedText}` : "当前没有选区。",
    formatMountedContext(mountedContexts),
    buildMentionContext({ project, sheet, selectedText, modes: effectiveMentionModes }),
    buildSkillContext(skills),
    recentMessages ? `最近对话：\n${recentMessages}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function filterDuplicateMentionModes(
  mentionModes: MentionMode[],
  mountedContexts: AiMountedContext[],
  activeSheetId: string,
): MentionMode[] {
  const currentSheetMounted = mountedContexts.some((context) => context.type === "document" && context.sheetId === activeSheetId);
  if (!currentSheetMounted) return mentionModes;
  return mentionModes.filter((mode) => mode !== "current-sheet");
}

function formatMountedContext(contexts: AiMountedContext[]): string {
  if (contexts.length === 0) return "";
  return [
    "### 已挂载上下文",
    ...contexts.map((context, index) =>
      [
        `## ${index + 1}. ${context.title}`,
        `类型：${context.subtitle}`,
        context.projectId ? `projectId: ${context.projectId}` : "",
        `sheetId: ${context.sheetId}`,
        "",
        context.content.trim() || "(空内容)",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

function formatResourceTextContext(resources: ProjectResourceText[]): string {
  if (resources.length === 0) return "";
  const loaded = resources.filter((resource) => resource.status === "loaded");
  const pathOnly = resources.filter((resource) => resource.status !== "loaded");
  const sections = [
    loaded.length > 0
      ? [
          "已读取文本资源内容：",
          ...loaded.map((resource) =>
            [
              `## ${resource.name}`,
              `path: ${resource.path}`,
              `size: ${formatBytes(resource.sizeBytes)}${resource.truncated ? "，内容已截断" : ""}`,
              "",
              "```text",
              resource.content.trim() || "(空文件)",
              "```",
            ].join("\n"),
          ),
        ].join("\n\n")
      : "",
    pathOnly.length > 0
      ? ["以下资源仅作为路径提供：", ...pathOnly.map((resource) => `- ${resource.name} · ${resource.status} · ${resource.path}`)].join("\n")
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}
