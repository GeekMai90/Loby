/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、AI 助手上下文快照/帧批处理/活动终态模块、写作库模块
 * [OUTPUT]: 对外提供 useAiAssistant，并在主对话完成、失败或取消时封口全部子活动、在面板重新打开时协调任务会话边界
 * [POS]: AI 助手 feature 的 React 协调边界，统一主对话状态、副作用、重新打开策略、终态与用户动作
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
  AgentCredentialStatus,
  AiAttachment,
  AssistantSendMode,
  AgentModelCatalog,
  AiChangeSet,
  ChatContextPreview,
  ChatConversation,
  ChatMessage,
  AgentSkill,
  MentionMode,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type { InlineAiHandoff, InlineAiResult, InlineAiSelection } from "@/features/assistant/model/inlineAi";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "@/features/assistant/model/agentCommands";
import { saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { settleActivityLines, upsertActivityLine, upsertApprovalRequest } from "@/features/assistant/model/agentRunState";
import { extractAiActionsFromMessage, stripAiActionBlocks } from "@/features/assistant/model/aiActions";
import { linkGeneratedImageActions } from "@/features/assistant/model/agentImageArtifacts";
import {
  AI_CHANGE_SET_MESSAGES,
  changeSetIntroducesImageReference,
  extractAiChangeSetFromMessage,
  stripAiChangeBlock,
} from "@/features/assistant/model/aiChangeSets";
import { appendAgentMessageDelta, completeAgentMessage } from "@/features/assistant/model/agentMessageStream";
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
  deleteAgentCredential,
  getAgentCredentialStatus,
  loadAgentSkillInstructions,
  listAgentModels,
  listAgentSkills,
  prewarmAgentRuntime,
  respondAgentApproval,
  saveAgentCredential,
  steerAgentChatStream,
  streamAgentChat,
} from "@/features/assistant/model/agentRuntime";
import { buildAgentContext, buildAgentContextPayload } from "@/features/assistant/model/agentContext";
import { buildInlineAiHandoffMessages, buildInlineAiPrompt, parseInlineAiResult } from "@/features/assistant/model/inlineAi";
import { buildProjectResourcePaths } from "@/features/library/model/projectModel";
import { useChatConversations } from "@/features/assistant/hooks/useChatConversations";
import { collectAssistantAttachmentPaths } from "@/features/assistant/model/assistantAttachments";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";

interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialAgentProvider: AgentProvider;
  initialProviderBaseUrl: string;
  initialAgentModel: AgentModel;
  initialAgentReasoningEffort: AgentReasoningEffort;
  initialAgentQuickMode: boolean;
  initialAssistantSendMode: AssistantSendMode;
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
  initialAgentProvider,
  initialProviderBaseUrl,
  initialAgentModel,
  initialAgentReasoningEffort,
  initialAgentQuickMode,
  initialAssistantSendMode,
  projects,
  activeProject,
  activeSheet,
  selectedText,
  onOpenAiPanel,
  onCreateChangeSet,
  loadedConversations,
}: UseAiAssistantParams) {
  const conversations = useChatConversations(persistenceReady, libraryPath, loadedConversations);
  const prepareChatConversationForOpen = conversations.prepareConversationForOpen;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>(initialAgentProvider);
  const [providerBaseUrl, setProviderBaseUrl] = useState(initialProviderBaseUrl);
  const [agentModel, setAgentModel] = useState<AgentModel>(initialAgentModel);
  const [agentReasoningEffort, setAgentReasoningEffort] = useState<AgentReasoningEffort>(initialAgentReasoningEffort);
  const [agentQuickMode, setAgentQuickMode] = useState(initialAgentQuickMode);
  const [assistantSendMode, setAssistantSendMode] = useState<AssistantSendMode>(initialAssistantSendMode);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [modelCatalog, setModelCatalog] = useState<AgentModelCatalog | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<AgentCredentialStatus>({
    provider: initialAgentProvider,
    configured: false,
  });
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState("");
  const [approvalRequests, setApprovalRequests] = useState<AgentApprovalRequest[]>([]);
  const activeRequestIdRef = useRef("");
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
    listAgentSkills(libraryPath)
      .then((loadedSkills) => setSkills(loadedSkills))
      .catch(() => setSkills([]));
  }, [libraryPath]);

  useEffect(() => {
    listAgentModels(agentProvider)
      .then((catalog) => {
        setModelCatalog(catalog);
        setAgentModel((current) =>
          current === "auto" || !catalog.models.some((model) => model.slug === current) ? catalog.currentModel : current,
        );
      })
      .catch(() => setModelCatalog(null));
  }, [agentProvider]);

  useEffect(() => {
    let cancelled = false;
    setCredentialMessage("");
    getAgentCredentialStatus(agentProvider)
      .then((status) => {
        if (!cancelled) setCredentialStatus(status);
      })
      .catch((error) => {
        if (!cancelled) setCredentialMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [agentProvider]);

  useEffect(() => {
    saveAgentSettings({
      agentProvider,
      providerBaseUrl,
      agentModel,
      agentReasoningEffort,
      agentQuickMode,
      assistantSendMode,
    });
  }, [agentModel, agentProvider, agentQuickMode, agentReasoningEffort, assistantSendMode, providerBaseUrl]);

  async function sendMessage(
    promptOverride?: string,
    selectedSkillIds: string[] = [],
    attachments: AiAttachment[] = [],
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
    if (!rawPrompt && attachments.length === 0) return;
    const prompt = expandSlashCommand(rawPrompt || "请阅读这些附件，并结合当前写作上下文回答。");
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
      attachments: attachments.length > 0 ? attachments : undefined,
      contexts: userContextPreviews,
    };

    if (options.replaceMessageId) {
      conversations.replaceMessageAndTruncate(options.replaceMessageId, userMessage, activeSheet.id);
    } else {
      conversations.appendMessage(userMessage, activeSheet.id);
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
    let agentMessageSegments: { itemId: string; text: string }[] | undefined;
    let hasNonEmptyFinalAnswer = false;
    let failed = false;
    let activityLines: AgentRunActivity[] = [];
    let usage: AgentUsage | null = null;
    let timings: AgentRunTimings = {};

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
          ...explicitMentionModes,
        ]),
      );
      const selectedTextForContext =
        mountedContextsForTurn.find((context) => context.type === "selection")?.content ||
        (explicitMentionModes.includes("selection") ? normalizedSelectedText : "");
      const resolvedSkills = resolveSkillMentions(rawPrompt, skills, selectedSkillIds);
      const resolvedSkillsWithInstructions = await loadAgentSkillInstructions(libraryPath, resolvedSkills).catch(() => resolvedSkills);
      const resourcePaths = buildProjectResourcePaths(libraryPath, activeProject);
      const contextPayload = buildAgentContextPayload({
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
      });

      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt,
        attachmentPaths: collectAssistantAttachmentPaths(messagesForContext, attachments, true),
        context: contextPayload.context,
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
          baseUrl: agentProvider === "openai-compatible" ? providerBaseUrl : undefined,
        },
        onRequestId: (requestId) => {
          activeRequestIdRef.current = requestId;
        },
        onDelta: (delta, event) => {
          const next = appendAgentMessageDelta(
            { content: accumulated, itemId: agentMessageItemId, segments: agentMessageSegments },
            delta,
            event?.itemId,
          );
          accumulated = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
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
        onMessage: (text, event) => {
          const next = completeAgentMessage(
            { content: accumulated, itemId: agentMessageItemId, segments: agentMessageSegments },
            text,
            event.itemId,
          );
          accumulated = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
          if (event.phase === "final_answer" && text.trim()) hasNonEmptyFinalAnswer = true;
          activityLines = upsertActivityLine(activityLines, {
            id: "assistant-message-stream",
            rawType: "item/agentMessage/completed",
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
          activityLines = upsertActivityLine(activityLines, {
            id: event.rawType || `status-${activityLines.length}`,
            rawType: event.rawType || "",
            title: event.title || "Agent 状态",
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
            title: event.title || "Agent 步骤",
            status: event.status || "",
            command: event.command || "",
            output: event.output || "",
            text: event.text || "",
            exitCode: event.exitCode ?? null,
            artifactPath: event.artifactPath || undefined,
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
          activityLines = settleActivityLines(activityLines, "error");
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
          activityLines = settleActivityLines(activityLines, "cancelled");
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
      streamUpdates.flushNow();
      const hasGeneratedImage = activityLines.some((activity) => Boolean(activity.artifactPath));
      if (!failed && hasGeneratedImage && !hasNonEmptyFinalAnswer) {
        const next = completeAgentMessage(
          { content: accumulated, itemId: agentMessageItemId, segments: agentMessageSegments },
          "图片已生成，可以在下方查看；双击可打开原图。",
          "loby-image-completion",
        );
        accumulated = next.content;
        agentMessageItemId = next.itemId;
        agentMessageSegments = next.segments;
      }
      if (!failed && !accumulated.trim()) {
        activityLines = settleActivityLines(activityLines, "completed");
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          role: hasGeneratedImage ? "assistant" : "system",
          content: hasGeneratedImage ? "图片已生成，可以在下方查看；双击可打开原图。" : "AI Provider 没有返回内容。",
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
        activityLines = settleActivityLines(activityLines, "completed");
        const parsedChange = extractAiChangeSetFromMessage(accumulated, activeSheet.id, baseBody);
        const parsedActions = extractAiActionsFromMessage(parsedChange.content, {
          projectId: activeProject?.id,
          projectTitle: activeProject?.title,
          sheetId: activeSheet.id,
          sheetTitle: activeSheet.title,
        });
        const linkedActions = linkGeneratedImageActions(parsedActions.actions, activityLines);
        const hasImageInsertAction = linkedActions.some((action) => action.type === "insertImage");
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
          actions: linkedActions.length > 0 ? linkedActions : message.actions,
          run: {
            status: "completed",
            activities: activityLines,
            usage,
            timings,
          },
        }));
      }
    } catch (error) {
      streamUpdates.cancel();
      activityLines = settleActivityLines(activityLines, "error");
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
        run: message.run
          ? {
              ...message.run,
              status: "error",
              activities: activityLines,
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
    let agentMessageItemId = "";
    let agentMessageSegments: { itemId: string; text: string }[] | undefined;
    let failure = "";

    try {
      const resourcePaths = buildProjectResourcePaths(libraryPath, activeProject);
      const context = [
        buildAgentContext(
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
          baseUrl: agentProvider === "openai-compatible" ? providerBaseUrl : undefined,
        },
        onRequestId: setInlineRequestId,
        onDelta: (delta, event) => {
          const next = appendAgentMessageDelta(
            { content: accumulated, itemId: agentMessageItemId, segments: agentMessageSegments },
            delta,
            event?.itemId,
          );
          accumulated = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
        },
        onMessage: (text, event) => {
          if (event.phase && event.phase !== "final_answer") return;
          const next = completeAgentMessage(
            { content: accumulated, itemId: agentMessageItemId, segments: agentMessageSegments },
            text,
            event.itemId,
          );
          accumulated = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
        },
        onError: (message) => {
          failure = message;
        },
        onCancelled: (message) => {
          failure = message || "已取消本次请求。";
        },
      });

      if (failure) throw new Error(failure);
      if (accumulated.includes("浏览器开发模式不能连接 AI Provider")) {
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
    for (const message of messages) conversations.appendMessage(message, handoff.selection.sheetId);
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

  async function respondApproval(approvalId: string, decision: AgentApprovalDecision) {
    setApprovalRequests((current) =>
      current.map((approval) => (approval.id === approvalId ? { ...approval, status: decision } : approval)),
    );
    await respondAgentApproval(approvalId, decision);
  }

  async function storeCredential(secret: string) {
    if (!secret.trim()) throw new Error("请输入有效的访问凭证。");
    setCredentialBusy(true);
    setCredentialMessage("");
    try {
      await saveAgentCredential(agentProvider, secret.trim());
      setCredentialStatus({ provider: agentProvider, configured: true });
      setCredentialMessage("凭证已安全保存到系统钥匙串。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCredentialMessage(message);
    } finally {
      setCredentialBusy(false);
    }
  }

  async function removeCredential() {
    setCredentialBusy(true);
    setCredentialMessage("");
    try {
      await deleteAgentCredential(agentProvider);
      setCredentialStatus({ provider: agentProvider, configured: false });
      setCredentialMessage("已从系统钥匙串移除凭证。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCredentialMessage(message);
    } finally {
      setCredentialBusy(false);
    }
  }

  const attachMountedSheet = useCallback(() => {
    if (activeSheet?.id) setMountedSheetIds((current) => addUnique(current, activeSheet.id));
  }, [activeSheet?.id]);
  const prepareConversationForOpen = useCallback(() => {
    prepareChatConversationForOpen({
      activeSheetId: activeSheet?.id ?? "",
      blocked: busy || inlineBusy || approvalRequests.some((approval) => approval.status === "pending"),
    });
  }, [activeSheet?.id, approvalRequests, busy, inlineBusy, prepareChatConversationForOpen]);
  const prewarmRuntime = useCallback(() => prewarmAgentRuntime(agentProvider), [agentProvider]);

  return {
    conversations: conversations.conversations,
    activeConversation: conversations.activeConversation,
    activeConversationId: conversations.activeConversationId,
    conversationsReady: conversations.conversationsReady,
    messages: conversations.messages,
    input,
    busy,
    inlineBusy,
    agentProvider,
    providerBaseUrl,
    agentModel,
    agentReasoningEffort,
    agentQuickMode,
    assistantSendMode,
    modelCatalog,
    credentialStatus,
    credentialBusy,
    credentialMessage,
    skills,
    availableDocuments,
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
    editUserMessage: (messageId: string, content: string, contextPreviews: ChatContextPreview[] = [], attachments: AiAttachment[] = []) =>
      sendMessage(content, [], attachments, { replaceMessageId: messageId, contextPreviews }),
    setAgentProvider,
    setProviderBaseUrl,
    setAgentModel,
    setAgentReasoningEffort,
    setAgentQuickMode,
    setAssistantSendMode,
    attachMountedSheet,
    prepareConversationForOpen,
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
    storeCredential,
    removeCredential,
    prewarmRuntime,
  };
}

function waitForNextFrame() {
  return typeof window === "undefined" ? Promise.resolve() : new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}
