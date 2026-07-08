import { useEffect, useState } from "react";
import type {
  AgentModel,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentProvider,
  AgentReasoningEffort,
  AgentRunActivity,
  AgentUsage,
  CodexModelCatalog,
  AiDocumentReference,
  AiMountedContext,
  AiChangeSet,
  ChatContextPreview,
  ChatMessage,
  CodexProbeResult,
  CodexSkill,
  MentionMode,
  WritingProject,
  WritingSheet,
} from "../types";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "../lib/agentCommands";
import { saveAgentSettings } from "../lib/agentSettings";
import { extractAiChangeSetFromMessage, stripAiChangeBlock } from "../lib/aiChangeSets";
import {
  cancelAgentChatStream,
  listCodexModels,
  listCodexSkills,
  probeAgentCli,
  respondAgentApproval,
  streamAgentChat,
} from "../lib/codex";
import { buildCodexContext } from "../lib/codexContext";
import { useChatConversations } from "./useChatConversations";

interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialPlanMode: boolean;
  initialAgentProvider: AgentProvider;
  initialAgentModel: AgentModel;
  initialAgentReasoningEffort: AgentReasoningEffort;
  initialAgentQuickMode: boolean;
  initialCodexCliPath: string;
  initialClaudeCliPath: string;
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  selectedText: string;
  onOpenAiPanel: () => void;
  onCreateChangeSet: (changeSet: AiChangeSet) => AiChangeSet | void;
}

interface SendMessageOptions {
  replaceMessageId?: string;
  contextPreviews?: ChatContextPreview[];
}

export function useAiAssistant({
  persistenceReady,
  libraryPath,
  initialPlanMode,
  initialAgentProvider,
  initialAgentModel,
  initialAgentReasoningEffort,
  initialAgentQuickMode,
  initialCodexCliPath,
  initialClaudeCliPath,
  projects,
  activeProject,
  activeSheet,
  selectedText,
  onOpenAiPanel,
  onCreateChangeSet,
}: UseAiAssistantParams) {
  const conversations = useChatConversations(persistenceReady, libraryPath);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [planMode, setPlanMode] = useState(initialPlanMode);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>(initialAgentProvider);
  const [agentModel, setAgentModel] = useState<AgentModel>(initialAgentModel);
  const [agentReasoningEffort, setAgentReasoningEffort] = useState<AgentReasoningEffort>(initialAgentReasoningEffort);
  const [agentQuickMode, setAgentQuickMode] = useState(initialAgentQuickMode);
  const [codexCliPath, setCodexCliPath] = useState(initialCodexCliPath);
  const [claudeCliPath, setClaudeCliPath] = useState(initialClaudeCliPath);
  const [skills, setSkills] = useState<CodexSkill[]>([]);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalog | null>(null);
  const [probe, setProbe] = useState<CodexProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<AgentApprovalRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState("");
  const [mountedSheetIds, setMountedSheetIds] = useState<string[]>(activeSheet?.id ? [activeSheet.id] : []);
  const [mountedSelectionText, setMountedSelectionText] = useState("");
  const normalizedSelectedText = selectedText.trim();
  const availableDocuments = buildAvailableDocuments(projects);
  const mountedContexts = buildMountedContexts(activeSheet, availableDocuments, mountedSheetIds, mountedSelectionText);

  useEffect(() => {
    setMountedSheetIds(activeSheet?.id ? [activeSheet.id] : []);
    setMountedSelectionText("");
  }, [activeSheet?.id]);

  useEffect(() => {
    if (normalizedSelectedText) setMountedSelectionText(normalizedSelectedText);
  }, [normalizedSelectedText]);

  useEffect(() => {
    listCodexSkills()
      .then((loadedSkills) => setSkills(loadedSkills))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    listCodexModels()
      .then((catalog) => {
        setModelCatalog(catalog);
        if (initialAgentModel === "auto" && catalog.currentModel) setAgentModel(catalog.currentModel);
        if (initialAgentReasoningEffort === "medium" && catalog.currentReasoningEffort) {
          setAgentReasoningEffort(catalog.currentReasoningEffort);
        }
      })
      .catch(() => setModelCatalog(null));
  }, []);

  useEffect(() => {
    saveAgentSettings({ planMode, agentProvider, agentModel, agentReasoningEffort, agentQuickMode, codexCliPath, claudeCliPath });
  }, [agentModel, agentProvider, agentQuickMode, agentReasoningEffort, claudeCliPath, codexCliPath, planMode]);

  async function sendMessage(promptOverride?: string, selectedSkillIds: string[] = [], options: SendMessageOptions = {}) {
    if (busy) return;
    if (!activeProject || !activeSheet) {
      conversations.appendMessage({
        id: `missing-context-${Date.now()}`,
        role: "system",
        content: "请先选择一篇文稿，再使用 AI 助手。",
      });
      onOpenAiPanel();
      return;
    }

    const rawPrompt = (promptOverride ?? input).trim();
    const prompt = expandSlashCommand(rawPrompt);
    if (!prompt) return;
    const activeConversationId = conversations.activeConversationId;
    const activeAgentThreadId = options.replaceMessageId ? "" : (conversations.activeConversation?.agentThreadId ?? "");
    const baseBody = activeSheet.body;
    const mountedContextsForTurn = options.contextPreviews
      ? resolveMountedContextsFromPreviews(options.contextPreviews, activeSheet, availableDocuments)
      : mountedContexts;
    const messagesForContext = options.replaceMessageId
      ? conversations.messages.slice(0, Math.max(0, conversations.messages.findIndex((message) => message.id === options.replaceMessageId)))
      : conversations.messages;
    const shouldShowDocumentContext = messagesForContext.every((message) => message.role !== "user");
    const userContextPreviews = options.contextPreviews ?? buildChatContextPreviews(mountedContextsForTurn, shouldShowDocumentContext);

    const userMessage: ChatMessage = {
      id: options.replaceMessageId || `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
      contexts: userContextPreviews,
    };

    if (options.replaceMessageId) {
      conversations.replaceMessageAndTruncate(options.replaceMessageId, userMessage);
    } else {
      conversations.appendMessage(userMessage);
    }
    setInput("");
    setMountedSelectionText("");
    onOpenAiPanel();
    setBusy(true);

    const assistantMessageId = `assistant-${Date.now() + 1}`;
    conversations.appendMessage({
      id: assistantMessageId,
      role: "assistant",
      content: "",
      run: {
        status: "running",
        activities: [],
        usage: null,
      },
    });

    let accumulated = "";
    let failed = false;
    let activityLines: AgentRunActivity[] = [];
    let usage: AgentUsage | null = null;

    function updateAssistantContent() {
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: stripAiChangeBlock(accumulated),
        run: {
          status: failed ? "error" : "running",
          activities: activityLines,
          usage,
          error: failed ? message.run?.error : undefined,
        },
      }));
    }

    try {
      await waitForNextFrame();
      const explicitMentionModes = resolveMentionModes(rawPrompt).filter((mode) => mode !== "current-sheet");
      const resolvedMentionModes = Array.from(
        new Set<MentionMode>([
          ...(mountedSheetIds.includes(activeSheet.id) ? (["current-sheet"] as MentionMode[]) : []),
          ...(mountedContextsForTurn.some((context) => context.type === "selection") ? (["selection"] as MentionMode[]) : []),
          ...explicitMentionModes,
        ]),
      );
      const selectedTextForContext =
        mountedContextsForTurn.find((context) => context.type === "selection")?.content ||
        (explicitMentionModes.includes("selection") ? normalizedSelectedText : "");
      const resolvedSkills = resolveSkillMentions(rawPrompt, skills, selectedSkillIds);

      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt,
        context: buildCodexContext(
          activeProject,
          activeSheet,
          selectedTextForContext,
          messagesForContext,
          resolvedMentionModes,
          resolvedSkills,
          mountedContextsForTurn,
          {
            provider: agentProvider,
            model: agentModel,
            reasoningEffort: agentReasoningEffort,
            quickMode: agentQuickMode,
          },
        ),
        planMode,
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        threadId: activeAgentThreadId,
        cliPath: agentProvider === "claude" ? claudeCliPath : codexCliPath,
        onRequestId: setActiveRequestId,
        onDelta: (delta) => {
          accumulated += delta;
          updateAssistantContent();
        },
        onStatus: (event) => {
          if ((event.rawType === "thread/start.result" || event.rawType === "thread/resume.result") && event.status) {
            conversations.setConversationAgentThreadId(activeConversationId, event.status);
          }
          activityLines = upsertActivityLine(activityLines, {
            id: event.rawType || `status-${activityLines.length}`,
            rawType: event.rawType || "",
            title: event.title || "Codex 状态",
            status: event.status || "",
            command: "",
            output: "",
            text: event.text || "",
            exitCode: null,
          });
          updateAssistantContent();
        },
        onActivity: (event) => {
          const nextLine = {
            id: event.itemId || `${event.rawType}-${activityLines.length}`,
            rawType: event.rawType || "",
            title: event.title || "Codex 步骤",
            status: event.status || "",
            command: event.command || "",
            output: event.output || "",
            text: event.text || "",
            exitCode: event.exitCode ?? null,
          };
          activityLines = upsertActivityLine(activityLines, nextLine);
          updateAssistantContent();
          if (event.kind === "approval" && event.itemId) {
            const approvalId = event.itemId;
            setApprovalRequests((current) =>
              upsertApprovalRequest(current, {
                id: approvalId,
                assistantMessageId,
                title: nextLine.title,
                command: nextLine.command,
                reason: nextLine.text,
                status: "pending",
              }),
            );
          }
        },
        onUsage: (nextUsage) => {
          usage = nextUsage;
          updateAssistantContent();
        },
        onError: (message) => {
          failed = true;
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            role: accumulated ? "assistant" : "system",
            content: stripAiChangeBlock(accumulated) || message,
            run: accumulated
              ? {
                  status: "error",
                  activities: activityLines,
                  usage,
                  error: message,
                }
              : current.run,
          }));
        },
        onCancelled: (message) => {
          failed = true;
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            content: stripAiChangeBlock(accumulated) || message,
            run: {
              status: "cancelled",
              activities: activityLines,
              usage,
            },
          }));
        },
      });
      if (!failed && !accumulated.trim()) {
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          role: "system",
          content: "本机 AI CLI 没有返回内容。",
        }));
      } else if (!failed) {
        const parsedChange = extractAiChangeSetFromMessage(accumulated, activeSheet.id, baseBody);
        const appliedChangeSet = parsedChange.changeSet ? (onCreateChangeSet(parsedChange.changeSet) ?? parsedChange.changeSet) : null;
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          content: parsedChange.content || "已更新正文。你可以显示更改或撤销这次修改。",
          changeSets: appliedChangeSet
            ? [appliedChangeSet, ...(message.changeSets ?? []).filter((changeSet) => changeSet.id !== appliedChangeSet.id)]
            : message.changeSets,
          run: {
            status: "completed",
            activities: activityLines,
            usage,
          },
        }));
      }
    } catch (error) {
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
        run: message.run
          ? {
              ...message.run,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            }
          : undefined,
      }));
    } finally {
      setActiveRequestId("");
      setBusy(false);
    }
  }

  async function cancelMessage() {
    if (!activeRequestId) return;
    await cancelAgentChatStream(activeRequestId);
  }

  async function runProbe() {
    setProbeBusy(true);
    try {
      setProbe(await probeAgentCli(agentProvider, agentProvider === "claude" ? claudeCliPath : codexCliPath));
    } finally {
      setProbeBusy(false);
    }
  }

  async function respondApproval(approvalId: string, decision: AgentApprovalDecision) {
    setApprovalRequests((current) =>
      current.map((approval) => (approval.id === approvalId ? { ...approval, status: decision } : approval)),
    );
    await respondAgentApproval(approvalId, decision);
  }

  return {
    conversations: conversations.conversations,
    activeConversation: conversations.activeConversation,
    activeConversationId: conversations.activeConversationId,
    messages: conversations.messages,
    input,
    busy,
    planMode,
    agentProvider,
    agentModel,
    agentReasoningEffort,
    agentQuickMode,
    modelCatalog,
    codexCliPath,
    claudeCliPath,
    skills,
    availableDocuments,
    probe,
    probeBusy,
    approvalRequests,
    mountedContexts,
    replaceConversations: conversations.replaceConversations,
    updateChangeSet: conversations.updateChangeSet,
    setActiveConversationId: conversations.setActiveConversationId,
    createConversation: conversations.createConversation,
    deleteConversation: conversations.deleteConversation,
    renameConversation: conversations.renameConversation,
    setInput,
    editUserMessage: (messageId: string, content: string, contextPreviews: ChatContextPreview[] = []) =>
      sendMessage(content, [], { replaceMessageId: messageId, contextPreviews }),
    setPlanMode,
    setAgentProvider,
    setAgentModel,
    setAgentReasoningEffort,
    setAgentQuickMode,
    setCodexCliPath,
    setClaudeCliPath,
    attachMountedSheet: () => {
      if (activeSheet?.id) setMountedSheetIds((current) => addUnique(current, activeSheet.id));
    },
    attachMountedDocument: (sheetId: string) => setMountedSheetIds((current) => addUnique(current, sheetId)),
    detachMountedContext: (contextId: string) => {
      if (contextId.startsWith("document:")) {
        const sheetId = contextId.slice("document:".length);
        setMountedSheetIds((current) => current.filter((id) => id !== sheetId));
      }
      if (contextId.startsWith("selection:")) setMountedSelectionText("");
    },
    sendMessage,
    cancelMessage,
    respondApproval,
    runProbe,
  };
}

function upsertApprovalRequest(requests: AgentApprovalRequest[], next: AgentApprovalRequest): AgentApprovalRequest[] {
  const index = requests.findIndex((request) => request.id === next.id);
  if (index === -1) return [...requests, next];
  return [...requests.slice(0, index), { ...requests[index], ...next }, ...requests.slice(index + 1)];
}

function upsertActivityLine(lines: AgentRunActivity[], next: AgentRunActivity): AgentRunActivity[] {
  const index = lines.findIndex((line) => line.id === next.id);
  if (index === -1) return [...lines, next];
  const previous = lines[index];
  const appendOutput = shouldAppendActivityOutput(next.rawType);
  const merged = {
    ...previous,
    ...next,
    title: appendOutput && previous.title ? previous.title : next.title || previous.title,
    status: next.status || previous.status,
    command: next.command || previous.command,
    output: appendOutput ? appendActivityText(previous.output, next.output) : next.output || previous.output,
    text: next.text || previous.text,
    exitCode: next.exitCode ?? previous.exitCode,
  };
  return [...lines.slice(0, index), merged, ...lines.slice(index + 1)];
}

function shouldAppendActivityOutput(rawType: string) {
  return (
    rawType.endsWith("/outputDelta") ||
    rawType.endsWith("/progress") ||
    rawType.endsWith("/summaryTextDelta") ||
    rawType.endsWith("/textDelta") ||
    rawType.endsWith("/delta")
  );
}

function appendActivityText(previous: string, next: string) {
  if (!next) return previous;
  if (!previous) return next;
  return `${previous}${next}`;
}

function waitForNextFrame() {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function buildChatContextPreviews(contexts: AiMountedContext[], showDocumentContext: boolean): ChatContextPreview[] {
  return contexts.map((context) => ({
    id: context.id,
    type: context.type,
    sheetId: context.sheetId,
    projectId: context.projectId,
    title: context.title,
    subtitle: context.subtitle,
    excerpt: context.type === "document" ? context.title : truncateContextExcerpt(context.content),
    content: context.type === "selection" ? context.content : undefined,
    visible: context.type === "document" ? showDocumentContext : true,
  }));
}

function truncateContextExcerpt(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 44) return normalized;
  return `${normalized.slice(0, 44)}...`;
}

function resolveMountedContextsFromPreviews(
  previews: ChatContextPreview[],
  activeSheet: WritingSheet,
  availableDocuments: AiDocumentReference[],
): AiMountedContext[] {
  return previews
    .map((preview): AiMountedContext | null => {
      if (preview.type === "document") {
        const sheetId = preview.sheetId || preview.id.replace(/^document:/, "");
        const document = availableDocuments.find((item) => item.sheetId === sheetId);
        if (!document) return null;
        return {
          id: `document:${document.sheetId}`,
          type: "document",
          projectId: document.projectId,
          sheetId: document.sheetId,
          title: document.title || preview.title || "未命名文档",
          subtitle: document.sheetId === activeSheet.id ? "当前文稿" : document.subtitle,
          content: document.content,
        };
      }

      const content = preview.content || preview.excerpt;
      if (!content.trim()) return null;
      return {
        id: preview.id || `selection:${activeSheet.id}`,
        type: "selection",
        projectId: preview.projectId,
        sheetId: preview.sheetId || activeSheet.id,
        title: preview.title || buildSelectionTitle(content),
        subtitle: preview.subtitle || "选区",
        content,
      };
    })
    .filter((context): context is AiMountedContext => Boolean(context));
}

function buildMountedContexts(
  activeSheet: WritingSheet | undefined,
  availableDocuments: AiDocumentReference[],
  mountedSheetIds: string[],
  mountedSelectionText: string,
): AiMountedContext[] {
  const contexts: AiMountedContext[] = [];
  for (const sheetId of mountedSheetIds) {
    const document = availableDocuments.find((item) => item.sheetId === sheetId);
    if (!document) continue;
    contexts.push({
      id: `document:${document.sheetId}`,
      type: "document",
      projectId: document.projectId,
      sheetId: document.sheetId,
      title: document.title || "未命名文档",
      subtitle: document.sheetId === activeSheet?.id ? "当前文稿" : document.subtitle,
      content: document.content,
    });
  }

  if (activeSheet && mountedSelectionText) {
    contexts.push({
      id: `selection:${activeSheet.id}`,
      type: "selection",
      projectId: undefined,
      sheetId: activeSheet.id,
      title: buildSelectionTitle(mountedSelectionText),
      subtitle: "选区",
      content: mountedSelectionText,
    });
  }

  return contexts;
}

function buildAvailableDocuments(projects: WritingProject[]): AiDocumentReference[] {
  return projects.flatMap((project) => {
    const groups = project.groups ?? [];
    return project.sheets.map((sheet) => {
      const group = groups.find((item) => item.id === sheet.groupId);
      return {
        id: `${project.id}:${sheet.id}`,
        projectId: project.id,
        sheetId: sheet.id,
        title: sheet.title || "未命名文档",
        subtitle: [project.title, group?.title, sheet.type].filter(Boolean).join(" / "),
        type: sheet.type,
        status: sheet.status,
        summary: sheet.summary,
        content: sheet.body,
      };
    });
  });
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function buildSelectionTitle(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "选中的文字范围";
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine;
}
