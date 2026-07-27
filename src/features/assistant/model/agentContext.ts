/**
 * [INPUT]: 依赖 shared 公共契约、编辑器模块、AI 助手模块、写作库模块
 * [OUTPUT]: 对外提供 buildAgentContext、buildAgentContextPayload 与 AgentContextPayload
 * [POS]: AI 助手 feature 的上下文装配边界，每轮从 Loby 本地事实显式构造可审阅的模型输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  AgentModel,
  ChatMessage,
  AgentSkill,
  AgentProvider,
  AgentReasoningEffort,
  AiMountedContext,
  MentionMode,
  ProjectResourceText,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import { formatDocumentPropertiesForContext } from "@/features/editor/model/documentProperties";
import { buildMentionContext, buildSkillContext } from "@/features/assistant/model/agentCommands";
import { formatBytes } from "@/shared/lib/formatters";
import { buildLobyDocumentOutlineContext } from "@/features/assistant/model/lobyDocumentOutlineContext";
import { buildLobyOperatingContext } from "@/features/assistant/model/lobyOperatingContext";
import { buildLobyWritingStructureContext } from "@/features/assistant/model/lobyWritingContext";
import { getWritingBrief, type ProjectResourcePaths } from "@/features/library/model/projectModel";

interface AgentContextInput {
  project: WritingProject;
  sheet: WritingSheet;
  selectedText: string;
  messages: ChatMessage[];
  mentionModes: MentionMode[];
  skills: AgentSkill[];
  mountedContexts?: AiMountedContext[];
  agentRuntime: {
    provider: AgentProvider;
    model: AgentModel;
    reasoningEffort: AgentReasoningEffort;
    quickMode: boolean;
  };
  libraryPath: string;
  resourcePaths?: ProjectResourcePaths | null;
  selectedResourcePaths?: string[];
  selectedResourceTexts?: ProjectResourceText[];
}

export interface AgentContextPayload {
  context: string;
}

export function buildAgentContext(
  project: WritingProject,
  sheet: WritingSheet,
  selectedText: string,
  messages: ChatMessage[],
  mentionModes: MentionMode[],
  skills: AgentSkill[],
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
  return buildAgentContextPayload({
    project,
    sheet,
    selectedText,
    messages,
    mentionModes,
    skills,
    mountedContexts,
    agentRuntime,
    libraryPath,
    resourcePaths,
    selectedResourcePaths,
    selectedResourceTexts,
  }).context;
}

export function buildAgentContextPayload({
  project,
  sheet,
  selectedText,
  mentionModes,
  skills,
  mountedContexts = [],
  agentRuntime,
  libraryPath,
  resourcePaths = null,
  selectedResourcePaths = [],
  selectedResourceTexts = [],
}: AgentContextInput): AgentContextPayload {
  const writingBrief = getWritingBrief(project);
  const effectiveMentionModes = filterDuplicateMentionModes(mentionModes, mountedContexts, sheet.id);
  const currentSheetBodyProvided =
    mountedContexts.some((context) => context.type === "document" && context.sheetId === sheet.id) ||
    effectiveMentionModes.includes("current-sheet");
  const documentContexts = mountedContexts.filter((context) => context.type === "document");
  const selectionContexts = mountedContexts.filter((context) => context.type === "selection");
  const stableContext = [
    `项目：${project.title}`,
    "写作简报：",
    `- 目标读者：${writingBrief.audience || "未填写"}`,
    `- 核心观点：${writingBrief.thesis || "未填写"}`,
    `- 语气风格：${writingBrief.tone || "未填写"}`,
    `- 发布备注：${writingBrief.publishingNotes || "未填写"}`,
    `当前稿件：${sheet.title}`,
    `稿件属性：${formatDocumentPropertiesForContext(project, sheet).join("；") || "未填写"}`,
    `稿件摘要：${sheet.description}`,
    buildLobyWritingStructureContext(project, sheet),
    buildLobyDocumentOutlineContext(sheet, selectedText, { includeParagraphAnchors: !currentSheetBodyProvided }),
    "AI 运行偏好：",
    `- 运行器：${agentRuntime.provider}`,
    `- 模型：${agentRuntime.model || "auto"}`,
    `- 思考程度：${agentRuntime.reasoningEffort || "medium"}`,
    `- 快速模式：${agentRuntime.quickMode ? "开启" : "关闭"}`,
    buildLobyOperatingContext({ libraryPath, project, sheet, resourcePaths }),
    [
      "AI 文稿提案协议：",
      "- 如果用户要求你改写、润色、调整结构、替换段落、修改当前稿件正文，请不要声称自己已经直接写入文件。",
      "- 先用自然语言说明修改标准或思路，再调用 `propose_document_change`；proposedBody 必须是修改后的完整当前稿件正文。",
      "- 如果用户要求新增一小段正文、过渡句、提纲片段、开头、结尾或发布说明，但不要求重写现有正文，调用 `propose_insert_text`。",
      "- 提案只会生成可审阅卡片；用户确认后才会执行。不要输出 `loby-change` 或 `loby-action` 代码块。",
      "- 如果只是回答问题、给建议、生成候选标题或不应改正文，不调用文稿提案工具。",
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
    formatMountedContext(documentContexts),
  ]
    .filter(Boolean)
    .join("\n\n");
  const turnContext = [
    selectedResourcePaths.length > 0 ? `已选择资源文件：\n${selectedResourcePaths.map((path) => `- ${path}`).join("\n")}` : "",
    formatResourceTextContext(selectedResourceTexts),
    selectedText && selectionContexts.length === 0 && !effectiveMentionModes.includes("selection") ? `当前选区：\n${selectedText}` : "",
    formatMountedContext(selectionContexts),
    buildMentionContext({ project, sheet, selectedText, modes: effectiveMentionModes }),
    buildSkillContext(skills),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    context: [stableContext, turnContext].filter(Boolean).join("\n\n"),
  };
}

function filterDuplicateMentionModes(
  mentionModes: MentionMode[],
  mountedContexts: AiMountedContext[],
  activeSheetId: string,
): MentionMode[] {
  const currentSheetMounted = mountedContexts.some((context) => context.type === "document" && context.sheetId === activeSheetId);
  const selectionMounted = mountedContexts.some((context) => context.type === "selection");
  return mentionModes.filter((mode) => !(currentSheetMounted && mode === "current-sheet") && !(selectionMounted && mode === "selection"));
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
