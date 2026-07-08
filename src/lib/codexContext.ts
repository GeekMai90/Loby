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
  resourcePaths: ProjectResourcePaths | null = null,
  selectedResourcePaths: string[] = [],
  selectedResourceTexts: ProjectResourceText[] = [],
): string {
  const recentMessages = messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const writingBrief = getWritingBrief(project);

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
    "AI 运行偏好：",
    `- 运行器：${agentRuntime.provider}`,
    `- 模型：${agentRuntime.model || "auto"}`,
    `- 思考程度：${agentRuntime.reasoningEffort || "medium"}`,
    `- 快速模式：${agentRuntime.quickMode ? "开启" : "关闭"}`,
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
    buildMentionContext({ project, sheet, selectedText, modes: mentionModes }),
    buildSkillContext(skills),
    recentMessages ? `最近对话：\n${recentMessages}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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
      ? [
          "以下资源仅作为路径提供：",
          ...pathOnly.map((resource) => `- ${resource.name} · ${resource.status} · ${resource.path}`),
        ].join("\n")
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}
