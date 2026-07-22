/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、AI 助手上下文快照/帧批处理模块、写作库模块
 * [OUTPUT]: 对外提供 useAiAssistant
 * [POS]: AI 助手 feature 的React 协调边界，封装 AI 助手 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentModel,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentProvider,
  AgentReasoningEffort,
  AgentRunActivity,
  AgentRunTimings,
  AgentUsage,
  AiImageAttachment,
  AssistantSendMode,
  CodexCliProbeSnapshot,
  CodexModelCatalog,
  AiChangeSet,
  ChatContextPreview,
  ChatConversation,
  ChatMessage,
  CodexProbeResult,
  CodexSkill,
  MentionMode,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type { InlineAiHandoff, InlineAiResult, InlineAiSelection } from "@/features/assistant/model/inlineAi";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "@/features/assistant/model/agentCommands";
import { saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { upsertActivityLine, upsertApprovalRequest } from "@/features/assistant/model/agentRunState";
import { extractAiActionsFromMessage, stripAiActionBlocks } from "@/features/assistant/model/aiActions";
import {
  AI_CHANGE_SET_MESSAGES,
  changeSetIntroducesImageReference,
  extractAiChangeSetFromMessage,
  stripAiChangeBlock,
} from "@/features/assistant/model/aiChangeSets";
import { appendAgentMessageDelta } from "@/features/assistant/model/agentMessageStream";
import {
  addUnique,
  buildAvailableDocuments,
  buildChatContextPreviews,
  buildMountedContexts,
  normalizeSelectionContextText,
  resolveMountedContextsFromPreviews,
} from "@/features/assistant/model/assistantContext";
import {
  cancelAgentChatStream,
  loadCodexSkillInstructions,
  listCodexModels,
  listCodexSkills,
  probeAgentCli,
  respondAgentApproval,
  steerAgentChatStream,
  streamAgentChat,
} from "@/features/assistant/model/codex";
import { buildCodexContext, buildCodexContextPayload } from "@/features/assistant/model/codexContext";
import { buildInlineAiHandoffMessages, buildInlineAiPrompt, parseInlineAiResult } from "@/features/assistant/model/inlineAi";
import { buildProjectResourcePaths } from "@/features/library/model/projectModel";
import { useChatConversations } from "@/features/assistant/hooks/useChatConversations";
import { collectAssistantImagePaths } from "@/features/assistant/model/assistantImageAttachments";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";

interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialAgentModel: AgentModel;
  initialAgentReasoningEffort: AgentReasoningEffort;
  initialAgentQuickMode: boolean;
  initialAssistantSendMode: AssistantSendMode;
  initialCodexCliPath: string;
  initialCodexCliProbe: CodexCliProbeSnapshot | null;
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  selectedText: string;
  onOpenAiPanel: () => void;
  onCreateChangeSet: (changeSet: AiChangeSet) => AiChangeSet | void;
  loadedConversations: ChatConversation[] | null;
}

interface SendMessageOptions {
  replaceMessageId?: string;
  contextPreviews?: ChatContextPreview[];
}

export function useAiAssistant({
  persistenceReady,
  libraryPath,
  initialAgentModel,
  initialAgentReasoningEffort,
  initialAgentQuickMode,
  initialAssistantSendMode,
  initialCodexCliPath,
  initialCodexCliProbe,
  projects,
  activeProject,
  activeSheet,
  selectedText,
  onOpenAiPanel,
  onCreateChangeSet,
  loadedConversations,
}: UseAiAssistantParams) {
  const conversations = useChatConversations(persistenceReady, libraryPath, loadedConversations);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const agentProvider: AgentProvider = "codex";
  const [agentModel, setAgentModel] = useState<AgentModel>(initialAgentModel);
  const [agentReasoningEffort, setAgentReasoningEffort] = useState<AgentReasoningEffort>(initialAgentReasoningEffort);
  const [agentQuickMode, setAgentQuickMode] = useState(initialAgentQuickMode);
  const [assistantSendMode, setAssistantSendMode] = useState<AssistantSendMode>(initialAssistantSendMode);
  const [codexCliPath, setCodexCliPath] = useState(initialCodexCliPath);
  const [skills, setSkills] = useState<CodexSkill[]>([]);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalog | null>(null);
  const [probe, setProbe] = useState<CodexProbeResult | null>(() => (initialCodexCliProbe ? { ...initialCodexCliProbe, steps: [] } : null));
  const [probeBusy, setProbeBusy] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<AgentApprovalRequest[]>([]);
  const activeRequestIdRef = useRef("");
  const syncedContextByConversationRef = useRef(new Map<string, { threadId: string; stableSignature: string }>());
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineRequestId, setInlineRequestId] = useState("");
  const [mountedSheetIds, setMountedSheetIds] = useState<string[]>(activeSheet?.id ? [activeSheet.id] : []);
  const [mountedSelectionText, setMountedSelectionText] = useState("");
  const normalizedSelectedText = normalizeSelectionContextText(selectedText);
  const availableDocuments = useMemo(() => buildAvailableDocuments(projects), [projects]);
  const mountedContexts = useMemo(
    () => buildMountedContexts(activeSheet, availableDocuments, mountedSheetIds, mountedSelectionText),
    [activeSheet, availableDocuments, mountedSelectionText, mountedSheetIds],
  );

  useEffect(() => {
    setMountedSheetIds(activeSheet?.id ? [activeSheet.id] : []);
    setMountedSelectionText("");
  }, [activeSheet?.id]);

  useEffect(() => {
    setMountedSelectionText(normalizedSelectedText);
  }, [normalizedSelectedText]);

  useEffect(() => {
    listCodexSkills()
      .then((loadedSkills) => setSkills(loadedSkills))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    listCodexModels()
      .then((catalog) => setModelCatalog(catalog))
      .catch(() => setModelCatalog(null));
  }, []);

  useEffect(() => {
    saveAgentSettings({
      agentModel,
      agentReasoningEffort,
      agentQuickMode,
      assistantSendMode,
      codexCliPath,
      codexCliProbe: probe ? { ok: probe.ok, resolvedPath: probe.resolvedPath } : null,
    });
  }, [agentModel, agentQuickMode, agentReasoningEffort, assistantSendMode, codexCliPath, probe]);

  async function sendMessage(
    promptOverride?: string,
    selectedSkillIds: string[] = [],
    images: AiImageAttachment[] = [],
    options: SendMessageOptions = {},
  ) {
    if (busy || inlineBusy) return;
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
    if (!rawPrompt && images.length === 0) return;
    const prompt = expandSlashCommand(rawPrompt || "请分析这些图片，并结合当前写作上下文回答。");
    const activeConversationId = conversations.activeConversationId;
    const activeAgentThreadId = options.replaceMessageId ? "" : (conversations.activeConversation?.agentThreadId ?? "");
    const baseBody = activeSheet.body;
    const mountedContextsForTurn = options.contextPreviews
      ? resolveMountedContextsFromPreviews(options.contextPreviews, activeSheet, availableDocuments)
      : mountedContexts;
    const messagesForContext = options.replaceMessageId
      ? conversations.messages.slice(
          0,
          Math.max(
            0,
            conversations.messages.findIndex((message) => message.id === options.replaceMessageId),
          ),
        )
      : conversations.messages;
    const shouldShowDocumentContext = messagesForContext.every((message) => message.role !== "user");
    const userContextPreviews = options.contextPreviews ?? buildChatContextPreviews(mountedContextsForTurn, shouldShowDocumentContext);

    const userMessage: ChatMessage = {
      id: options.replaceMessageId || `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
      images: images.length > 0 ? images : undefined,
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
    let agentMessageItemId = "";
    let failed = false;
    let activityLines: AgentRunActivity[] = [];
    let usage: AgentUsage | null = null;
    let timings: AgentRunTimings = {};
    let resolvedAgentThreadId = activeAgentThreadId;

    function updateAssistantContent() {
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: stripAiActionBlocks(stripAiChangeBlock(accumulated)),
        run: {
          status: failed ? "error" : "running",
          activities: activityLines,
          usage,
          timings,
          error: failed ? message.run?.error : undefined,
        },
      }));
    }
    const streamUpdates = createStreamFrameBatcher(updateAssistantContent);

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
      const resolvedSkillsWithInstructions = await loadCodexSkillInstructions(resolvedSkills).catch(() => resolvedSkills);
      const resourcePaths = buildProjectResourcePaths(libraryPath, activeProject);
      const syncedContext = syncedContextByConversationRef.current.get(activeConversationId);
      const contextPayload = buildCodexContextPayload({
        project: activeProject,
        sheet: activeSheet,
        selectedText: selectedTextForContext,
        messages: messagesForContext,
        mentionModes: resolvedMentionModes,
        skills: resolvedSkillsWithInstructions,
        mountedContexts: mountedContextsForTurn,
        agentRuntime: {
          provider: agentProvider,
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        libraryPath,
        resourcePaths,
        syncedStableSignature:
          activeAgentThreadId && syncedContext?.threadId === activeAgentThreadId ? syncedContext.stableSignature : undefined,
        includeRecentMessages: !activeAgentThreadId,
      });

      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt,
        imagePaths: collectAssistantImagePaths(messagesForContext, images, !activeAgentThreadId),
        context: contextPayload.context,
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        threadId: activeAgentThreadId,
        cliPath: codexCliPath,
        onRequestId: (requestId) => {
          activeRequestIdRef.current = requestId;
        },
        onDelta: (delta, event) => {
          const next = appendAgentMessageDelta({ content: accumulated, itemId: agentMessageItemId }, delta, event?.itemId);
          accumulated = next.content;
          agentMessageItemId = next.itemId;
          activityLines = upsertActivityLine(activityLines, {
            id: "assistant-message-stream",
            rawType: "item/agentMessage/delta",
            title: "生成回复",
            status: "in_progress",
            command: "",
            output: "",
            text: "",
            exitCode: null,
          });
          streamUpdates.schedule();
        },
        onStatus: (event) => {
          if ((event.rawType === "thread/start.result" || event.rawType === "thread/resume.result") && event.status) {
            resolvedAgentThreadId = event.status;
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
          streamUpdates.schedule();
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
          streamUpdates.schedule();
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
          streamUpdates.schedule();
        },
        onMetric: (metric) => {
          timings = applyAgentRunMetric(timings, metric);
          streamUpdates.schedule();
        },
        onError: (message) => {
          failed = true;
          streamUpdates.cancel();
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            role: accumulated ? "assistant" : "system",
            content: stripAiActionBlocks(stripAiChangeBlock(accumulated)) || message,
            run: {
              status: "error",
              activities: activityLines,
              usage,
              timings,
              error: message,
            },
          }));
        },
        onCancelled: (message) => {
          failed = true;
          streamUpdates.cancel();
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            content: stripAiActionBlocks(stripAiChangeBlock(accumulated)) || message,
            run: {
              status: "cancelled",
              activities: activityLines,
              usage,
              timings,
            },
          }));
        },
      });
      streamUpdates.cancel();
      if (!failed && !accumulated.trim()) {
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          role: "system",
          content: "本机 AI CLI 没有返回内容。",
          run: {
            status: "completed",
            activities: activityLines,
            usage,
            timings,
          },
        }));
      } else if (!failed) {
        activityLines = upsertActivityLine(activityLines, {
          id: "assistant-message-stream",
          rawType: "item/agentMessage/delta",
          title: "生成回复",
          status: "completed",
          command: "",
          output: "",
          text: "",
          exitCode: null,
        });
        const parsedChange = extractAiChangeSetFromMessage(accumulated, activeSheet.id, baseBody);
        const parsedActions = extractAiActionsFromMessage(parsedChange.content, {
          projectId: activeProject?.id,
          projectTitle: activeProject?.title,
          sheetId: activeSheet.id,
          sheetTitle: activeSheet.title,
        });
        const hasImageInsertAction = parsedActions.actions.some((action) => action.type === "insertImage");
        const guardedChangeSet =
          parsedChange.changeSet && changeSetIntroducesImageReference(parsedChange.changeSet) && !hasImageInsertAction
            ? { ...parsedChange.changeSet, error: AI_CHANGE_SET_MESSAGES.applyImageReferenceInserted }
            : parsedChange.changeSet;
        const appliedChangeSet =
          guardedChangeSet && guardedChangeSet.error
            ? guardedChangeSet
            : guardedChangeSet
              ? (onCreateChangeSet(guardedChangeSet) ?? guardedChangeSet)
              : null;
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          content:
            parsedActions.content ||
            (appliedChangeSet
              ? appliedChangeSet.error
                ? "AI 修改未自动应用，请查看修改卡片。"
                : "已更新正文。你可以显示更改或撤销这次修改。"
              : "已生成落笔动作建议。"),
          changeSets: appliedChangeSet
            ? [appliedChangeSet, ...(message.changeSets ?? []).filter((changeSet) => changeSet.id !== appliedChangeSet.id)]
            : message.changeSets,
          actions: parsedActions.actions.length > 0 ? parsedActions.actions : message.actions,
          run: {
            status: "completed",
            activities: activityLines,
            usage,
            timings,
          },
        }));
        if (resolvedAgentThreadId) {
          syncedContextByConversationRef.current.set(activeConversationId, {
            threadId: resolvedAgentThreadId,
            stableSignature: contextPayload.stableSignature,
          });
        }
      }
    } catch (error) {
      streamUpdates.cancel();
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
        run: message.run
          ? {
              ...message.run,
              status: "error",
              timings,
              error: error instanceof Error ? error.message : String(error),
            }
          : undefined,
      }));
    } finally {
      streamUpdates.cancel();
      activeRequestIdRef.current = "";
      setBusy(false);
    }
  }

  async function runInlineSelection(prompt: string, selection: InlineAiSelection): Promise<InlineAiResult> {
    if (busy || inlineBusy) throw new Error("AI 正在处理另一项请求，请稍后再试。");
    if (!activeProject || !activeSheet || activeSheet.id !== selection.sheetId) {
      throw new Error("选区所属文稿已切换，请重新选择文字。");
    }
    if (activeSheet.body !== selection.baseBody || activeSheet.body.slice(selection.from, selection.to) !== selection.text) {
      throw new Error("选区内容已经变化，请重新选择后再试。");
    }

    setInlineBusy(true);
    let accumulated = "";
    let failure = "";

    try {
      const resourcePaths = buildProjectResourcePaths(libraryPath, activeProject);
      const context = [
        buildCodexContext(
          activeProject,
          activeSheet,
          selection.text,
          [],
          ["current-sheet", "selection"],
          [],
          [],
          {
            provider: agentProvider,
            model: agentModel,
            reasoningEffort: agentReasoningEffort,
            quickMode: agentQuickMode,
          },
          libraryPath,
          resourcePaths,
        ),
        "本次是编辑器内联选区请求。上面的 loby-change 与 loby-action 协议不适用于本次响应，必须严格使用 loby-inline-ai JSON 协议。",
      ].join("\n\n");

      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt: buildInlineAiPrompt(prompt),
        context,
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        cliPath: codexCliPath,
        onRequestId: setInlineRequestId,
        onDelta: (delta) => {
          accumulated += delta;
        },
        onError: (message) => {
          failure = message;
        },
        onCancelled: (message) => {
          failure = message || "已取消本次请求。";
        },
      });

      if (failure) throw new Error(failure);
      if (accumulated.includes("浏览器开发模式不能直接调用本机 AI CLI")) {
        throw new Error("请在落笔桌面应用中使用选区 AI。");
      }
      return parseInlineAiResult(accumulated, prompt);
    } finally {
      setInlineRequestId("");
      setInlineBusy(false);
    }
  }

  function handoffInlineSelection(handoff: InlineAiHandoff) {
    const timestamp = Date.now();
    const messages = buildInlineAiHandoffMessages(handoff, activeProject?.id, timestamp);
    for (const message of messages) conversations.appendMessage(message);
    onOpenAiPanel();
  }

  async function cancelInlineSelection() {
    if (!inlineRequestId) return;
    await cancelAgentChatStream(inlineRequestId);
  }

  async function cancelMessage() {
    if (!activeRequestIdRef.current) return;
    await cancelAgentChatStream(activeRequestIdRef.current);
  }

  async function steerMessage(content: string) {
    const text = content.trim();
    const requestId = activeRequestIdRef.current;
    if (!text || !busy || !requestId) {
      throw new Error("当前 AI 任务已经结束，无法继续引导。");
    }
    await steerAgentChatStream(requestId, text);
    const runningAssistantMessage = [...conversations.messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.run?.status === "running");
    conversations.insertMessageBefore(runningAssistantMessage?.id ?? "", {
      id: `user-steer-${Date.now()}`,
      role: "user",
      content: text,
    });
  }

  async function runProbe() {
    setProbeBusy(true);
    try {
      const nextProbe = await probeAgentCli(agentProvider, codexCliPath);
      setProbe(nextProbe);
      if (nextProbe.ok && nextProbe.resolvedPath.trim()) {
        setCodexCliPath(nextProbe.resolvedPath.trim());
      }
    } finally {
      setProbeBusy(false);
    }
  }

  function updateCodexCliPath(path: string) {
    setCodexCliPath(path);
    setProbe(null);
  }

  async function respondApproval(approvalId: string, decision: AgentApprovalDecision) {
    setApprovalRequests((current) =>
      current.map((approval) => (approval.id === approvalId ? { ...approval, status: decision } : approval)),
    );
    await respondAgentApproval(approvalId, decision);
  }

  const attachMountedSheet = useCallback(() => {
    if (activeSheet?.id) setMountedSheetIds((current) => addUnique(current, activeSheet.id));
  }, [activeSheet?.id]);

  return {
    conversations: conversations.conversations,
    activeConversation: conversations.activeConversation,
    activeConversationId: conversations.activeConversationId,
    messages: conversations.messages,
    input,
    busy,
    inlineBusy,
    agentProvider,
    agentModel,
    agentReasoningEffort,
    agentQuickMode,
    assistantSendMode,
    modelCatalog,
    codexCliPath,
    skills,
    availableDocuments,
    probe,
    probeBusy,
    approvalRequests,
    mountedContexts,
    replaceConversations: conversations.replaceConversations,
    updateChangeSet: conversations.updateChangeSet,
    updateAction: conversations.updateAction,
    setActiveConversationId: conversations.setActiveConversationId,
    createConversation: conversations.createConversation,
    deleteConversation: conversations.deleteConversation,
    renameConversation: conversations.renameConversation,
    setInput,
    editUserMessage: (messageId: string, content: string, contextPreviews: ChatContextPreview[] = [], images: AiImageAttachment[] = []) =>
      sendMessage(content, [], images, { replaceMessageId: messageId, contextPreviews }),
    setAgentModel,
    setAgentReasoningEffort,
    setAgentQuickMode,
    setAssistantSendMode,
    setCodexCliPath: updateCodexCliPath,
    attachMountedSheet,
    attachMountedDocument: (sheetId: string) => setMountedSheetIds((current) => addUnique(current, sheetId)),
    detachMountedContext: (contextId: string) => {
      if (contextId.startsWith("document:")) {
        const sheetId = contextId.slice("document:".length);
        setMountedSheetIds((current) => current.filter((id) => id !== sheetId));
      }
      if (contextId.startsWith("selection:")) setMountedSelectionText("");
    },
    sendMessage,
    steerMessage,
    cancelMessage,
    runInlineSelection,
    handoffInlineSelection,
    cancelInlineSelection,
    respondApproval,
    runProbe,
  };
}

function waitForNextFrame() {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
