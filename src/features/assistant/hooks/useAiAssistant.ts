/**
 * [INPUT]: 依赖 React、shared 契约、Conversation Context Planner、Agent Event Protocol、受管附件、Skill、提案与写作库模块
 * [OUTPUT]: 对外提供 useAiAssistant，并以单一 Runtime 快照协调多轮模型视图、会话分支、跨轮产物、审批、无窗口恢复交接与终态
 * [POS]: AI 助手 feature 的主协调边界；持久化完整事实但只向 Provider 投影有界上下文，不解释原生阶段标题
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
  AgentRunCheckpoint,
  AgentUsage,
  AiAction,
  AiAttachment,
  AssistantSendMode,
  AgentModelCatalog,
  AiChangeSet,
  ChatContextPreview,
  ChatMessage,
  AgentSkill,
  MentionMode,
} from "@/shared/types";
import type { SendMessageOptions, UseAiAssistantParams } from "@/features/assistant/hooks/useAiAssistantTypes";
import type { InlineAiHandoff, InlineAiResult, InlineAiSelection } from "@/features/assistant/model/inlineAi";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "@/features/assistant/model/agentCommands";
import { saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { resolveAgentRuntimeSettings } from "@/features/assistant/model/agentRuntimeSettings";
import { settleActivityLines, upsertActivityLine, upsertApprovalRequest } from "@/features/assistant/model/agentRunState";
import { stripAiActionBlocks } from "@/features/assistant/model/aiActions";
import { stripAiChangeBlock } from "@/features/assistant/model/aiChangeSets";
import { normalizeAgentProposal, resolveAssistantProposals } from "@/features/assistant/model/agentProposals";
import { collectConversationImageArtifactActivities } from "@/features/assistant/model/agentImageArtifacts";
import { activityFromAgentEvent, writingContextActivity } from "@/features/assistant/model/agentRunEvents";
import { createAgentRun, reduceAgentRunEvent, setAgentRunPhase } from "@/features/assistant/model/agentRunReducer";
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
  dismissAgentRunCheckpoint,
  loadAgentSkillInstructions,
  listAgentModels,
  listAgentRunCheckpoints,
  listAgentSkills,
  prewarmAgentRuntime,
  respondAgentApproval,
  steerAgentChatStream,
  streamAgentChat,
} from "@/features/assistant/model/agentRuntime";
import { buildAgentContext, buildAgentContextPayload } from "@/features/assistant/model/agentContext";
import { planConversationContext } from "@/features/assistant/model/conversationContextPlanner";
import { buildInlineAiHandoffMessages, buildInlineAiPrompt, parseInlineAiResult } from "@/features/assistant/model/inlineAi";
import { buildProjectResourcePaths } from "@/features/library/model/projectModel";
import { useChatConversations } from "@/features/assistant/hooks/useChatConversations";
import { useAgentCredentials } from "@/features/assistant/hooks/useAgentCredentials";
import { collectAssistantAttachmentPaths, persistAssistantAttachments } from "@/features/assistant/model/assistantAttachments";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";
import { buildRecoveryPrompt, checkpointToApproval, recoveryRequestId } from "@/features/assistant/model/agentRunRecovery";
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
  const credentials = useAgentCredentials(agentProvider);
  const [approvalRequests, setApprovalRequests] = useState<AgentApprovalRequest[]>([]);
  const [recoveryCheckpoints, setRecoveryCheckpoints] = useState<AgentRunCheckpoint[]>([]);
  const recoveryLoadedLibraryRef = useRef("");
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
  const refreshSkills = useCallback(() => {
    listAgentSkills(libraryPath)
      .then((loadedSkills) => setSkills(loadedSkills.filter((skill) => skill.enabled)))
      .catch(() => setSkills([]));
  }, [libraryPath]);

  useEffect(() => {
    refreshSkills();
    window.addEventListener("loby:skills-changed", refreshSkills);
    return () => window.removeEventListener("loby:skills-changed", refreshSkills);
  }, [refreshSkills]);
  useEffect(() => {
    if (!conversations.conversationsReady || recoveryLoadedLibraryRef.current === libraryPath) return;
    recoveryLoadedLibraryRef.current = libraryPath;
    let cancelled = false;
    const conversationIds = new Set(conversations.conversations.map((conversation) => conversation.id));
    listAgentRunCheckpoints(libraryPath)
      .then((checkpoints) => {
        if (!cancelled) setRecoveryCheckpoints(checkpoints.filter((checkpoint) => conversationIds.has(checkpoint.conversationId)));
      })
      .catch(() => !cancelled && setRecoveryCheckpoints([]));
    return () => {
      cancelled = true;
    };
  }, [conversations.conversations, conversations.conversationsReady, libraryPath]);
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
    const persistedAttachments = await persistAssistantAttachments(libraryPath, attachments);
    const baseBody = activeSheet.body;
    const mountedContextsForTurn = options.contextPreviews
      ? resolveMountedContextsFromPreviews(options.contextPreviews, activeSheet, availableDocuments)
      : mountedContexts;
    const sourceConversation = options.conversationId
      ? conversations.conversations.find((conversation) => conversation.id === options.conversationId)
      : conversations.activeConversation;
    const sourceMessages = sourceConversation?.messages ?? conversations.messages;
    const messagesForContext = options.replaceMessageId
      ? sourceMessages.slice(
          0,
          Math.max(
            0,
            sourceMessages.findIndex((message) => message.id === options.replaceMessageId),
          ),
        )
      : conversations.messages;
    const shouldShowDocumentContext = messagesForContext.every((message) => message.role !== "user");
    const userContextPreviews = options.contextPreviews ?? buildChatContextPreviews(mountedContextsForTurn, shouldShowDocumentContext);

    const userMessage: ChatMessage = {
      id: options.replaceMessageId || `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
      attachments: persistedAttachments.length > 0 ? persistedAttachments : undefined,
      contexts: userContextPreviews,
    };

    const targetConversationId = options.replaceMessageId
      ? conversations.forkConversationFromMessage(options.replaceMessageId, userMessage, activeSheet.id)
      : conversations.appendMessage(userMessage, activeSheet.id, sourceConversation?.id);
    setInput("");
    setMountedSelectionText("");
    onOpenAiPanel();
    setBusy(true);

    const assistantMessageId = `assistant-${Date.now() + 1}`;
    conversations.appendMessage(
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        run: { schemaVersion: 2, status: "running", phase: "preparingContext", activities: [], usage: null },
      },
      activeSheet.id,
      targetConversationId,
    );

    let accumulated = "";
    let agentMessageItemId = "";
    let agentMessageSegments: { itemId: string; text: string }[] | undefined;
    let hasNonEmptyFinalAnswer = false;
    let failed = false;
    let activityLines: AgentRunActivity[] = [];
    let structuredActions: AiAction[] = [];
    let structuredChangeSet: AiChangeSet | null = null;
    let usage: AgentUsage | null = null;
    let timings: AgentRunTimings = {};
    let runSnapshot = createAgentRun();

    function updateAssistantContent() {
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: stripAiActionBlocks(stripAiChangeBlock(accumulated)),
        run: {
          ...runSnapshot,
          status: failed ? "error" : runSnapshot.status,
          activities: activityLines,
          usage,
          timings,
          error: failed ? message.run?.error : undefined,
        },
      }));
    }
    const streamUpdates = createStreamFrameBatcher(updateAssistantContent);

    try {
      activityLines = upsertActivityLine(activityLines, writingContextActivity("in_progress"));
      runSnapshot = { ...setAgentRunPhase(runSnapshot, "preparingContext"), activities: activityLines };
      streamUpdates.schedule();
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
      const contextPlan = planConversationContext({
        context: contextPayload.context,
        prompt,
        messages: messagesForContext,
        provider: agentProvider,
        model: agentModel,
        previousCheckpoint: options.replaceMessageId ? undefined : sourceConversation?.checkpoint,
        contextWindowTokens: modelCatalog?.models.find((model) => model.slug === agentModel)?.contextWindowTokens,
      });
      const providerMessageIds = new Set(contextPlan.messages.map((message) => message.id));
      const providerHistory = messagesForContext.filter((message) => providerMessageIds.has(message.id));
      conversations.updateContextProjection(contextPlan.checkpoint, contextPlan.stats, targetConversationId);
      activityLines = upsertActivityLine(activityLines, writingContextActivity("completed"));
      runSnapshot = { ...runSnapshot, activities: activityLines };

      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt: contextPlan.prompt,
        attachmentPaths: collectAssistantAttachmentPaths(providerHistory, persistedAttachments, true),
        context: contextPlan.context,
        conversationMessages: contextPlan.messages,
        conversationId: targetConversationId,
        supersedesRequestId: options.recoveryRequestId,
        runtime: resolveAgentRuntimeSettings(agentProvider, agentModel, agentReasoningEffort, agentQuickMode, providerBaseUrl),
        onRequestId: (requestId) => {
          activeRequestIdRef.current = requestId;
        },
        onStarted: () => {
          if (options.recoveryRequestId) {
            setRecoveryCheckpoints((current) => current.filter((item) => item.requestId !== options.recoveryRequestId));
          }
        },
        onEvent: (event) => {
          runSnapshot = reduceAgentRunEvent({ ...runSnapshot, activities: activityLines, usage, timings }, event);
          activityLines = runSnapshot.activities;
          streamUpdates.schedule();
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
          streamUpdates.schedule();
        },
        onActivity: (event) => {
          if (event.kind === "approval" && event.itemId) {
            const approvalId = event.itemId;
            const nextLine =
              activityLines.find((activity) => activity.id === approvalId) ?? activityFromAgentEvent(approvalId, event, "需要工具审批");
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
        onProposal: (event) => {
          const proposal = normalizeAgentProposal(event, {
            projectId: activeProject.id,
            projectTitle: activeProject.title,
            sheetId: activeSheet.id,
            sheetTitle: activeSheet.title,
            baseBody,
          });
          if (proposal.action) structuredActions = [...structuredActions, proposal.action];
          if (proposal.changeSet) structuredChangeSet = proposal.changeSet;
        },
        onUsage: (nextUsage) => {
          usage = nextUsage;
          runSnapshot = { ...runSnapshot, usage };
          streamUpdates.schedule();
        },
        onMetric: (metric) => {
          timings = applyAgentRunMetric(timings, metric);
          runSnapshot = { ...runSnapshot, timings };
          streamUpdates.schedule();
        },
        onError: (message) => {
          failed = true;
          streamUpdates.cancel();
          activityLines = settleActivityLines(activityLines, "error");
          runSnapshot = {
            ...runSnapshot,
            status: "error",
            phase: "failed",
            activeActivityId: undefined,
            activities: activityLines,
            error: message,
          };
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            role: accumulated ? "assistant" : "system",
            content: stripAiActionBlocks(stripAiChangeBlock(accumulated)) || message,
            run: {
              ...runSnapshot,
              usage,
              timings,
            },
          }));
        },
        onCancelled: (message) => {
          failed = true;
          streamUpdates.cancel();
          activityLines = settleActivityLines(activityLines, "cancelled");
          runSnapshot = {
            ...runSnapshot,
            status: "cancelled",
            phase: "cancelled",
            activeActivityId: undefined,
            activities: activityLines,
          };
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            content: stripAiActionBlocks(stripAiChangeBlock(accumulated)) || message,
            run: {
              ...runSnapshot,
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
        runSnapshot = {
          ...runSnapshot,
          status: "completed",
          phase: "completed",
          activeActivityId: undefined,
          activities: activityLines,
        };
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          role: hasGeneratedImage ? "assistant" : "system",
          content: hasGeneratedImage ? "图片已生成，可以在下方查看；双击可打开原图。" : "AI Provider 没有返回内容。",
          run: {
            ...runSnapshot,
            usage,
            timings,
          },
        }));
      } else if (!failed) {
        activityLines = settleActivityLines(activityLines, "completed");
        runSnapshot = {
          ...runSnapshot,
          status: "completed",
          phase: "completed",
          activeActivityId: undefined,
          activities: activityLines,
        };
        const resolved = resolveAssistantProposals({
          message: accumulated,
          structuredActions,
          structuredChangeSet,
          context: {
            projectId: activeProject?.id,
            projectTitle: activeProject?.title,
            sheetId: activeSheet.id,
            sheetTitle: activeSheet.title,
            baseBody,
          },
          activities: [...collectConversationImageArtifactActivities(messagesForContext), ...activityLines],
        });
        const appliedChangeSet =
          resolved.changeSet && resolved.changeSet.error
            ? resolved.changeSet
            : resolved.changeSet
              ? (onCreateChangeSet(resolved.changeSet) ?? resolved.changeSet)
              : null;
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          content:
            resolved.content ||
            (appliedChangeSet
              ? appliedChangeSet.error
                ? "AI 修改未自动应用，请查看修改卡片。"
                : "已更新正文。你可以显示更改或撤销这次修改。"
              : "已生成落笔动作建议。"),
          changeSets: appliedChangeSet
            ? [appliedChangeSet, ...(message.changeSets ?? []).filter((changeSet) => changeSet.id !== appliedChangeSet.id)]
            : message.changeSets,
          actions: resolved.actions.length > 0 ? resolved.actions : message.actions,
          run: {
            ...runSnapshot,
            usage,
            timings,
          },
        }));
      }
    } catch (error) {
      streamUpdates.cancel();
      activityLines = settleActivityLines(activityLines, "error");
      runSnapshot = {
        ...runSnapshot,
        status: "error",
        phase: "failed",
        activeActivityId: undefined,
        activities: activityLines,
        error: error instanceof Error ? error.message : String(error),
      };
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
        run: message.run
          ? {
              ...message.run,
              ...runSnapshot,
              timings,
            }
          : undefined,
      }));
    } finally {
      streamUpdates.cancel();
      activeRequestIdRef.current = "";
      setBusy(false);
      refreshSkills();
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
        conversationId: conversations.activeConversationId,
        runtime: resolveAgentRuntimeSettings(agentProvider, agentModel, agentReasoningEffort, agentQuickMode, providerBaseUrl),
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
    const recoveryId = recoveryRequestId(approvalId);
    if (recoveryId) {
      const checkpoint = recoveryCheckpoints.find((item) => item.requestId === recoveryId);
      const targetConversation = conversations.conversations.find((item) => item.id === checkpoint?.conversationId);
      if (
        checkpoint &&
        (decision === "accept" || decision === "acceptForSession") &&
        targetConversation?.lastContextSheetId &&
        targetConversation.lastContextSheetId !== activeSheet?.id
      ) {
        conversations.setActiveConversationId(checkpoint.conversationId);
        conversations.appendMessage(
          { id: `recovery-sheet-${Date.now()}`, role: "system", content: "请先打开这次对话原来关联的文稿，再恢复未完成任务。" },
          "",
          checkpoint.conversationId,
        );
        return;
      }
      if (checkpoint && (decision === "accept" || decision === "acceptForSession")) {
        conversations.setActiveConversationId(checkpoint.conversationId);
        await sendMessage(buildRecoveryPrompt(checkpoint), [], [], {
          conversationId: checkpoint.conversationId,
          recoveryRequestId: recoveryId,
        });
      } else {
        await dismissAgentRunCheckpoint(libraryPath, recoveryId);
        setRecoveryCheckpoints((current) => current.filter((item) => item.requestId !== recoveryId));
      }
      return;
    }
    setApprovalRequests((current) =>
      current.map((approval) => (approval.id === approvalId ? { ...approval, status: decision } : approval)),
    );
    await respondAgentApproval(approvalId, decision);
  }

  const attachMountedSheet = useCallback(() => {
    if (activeSheet?.id) setMountedSheetIds((current) => addUnique(current, activeSheet.id));
  }, [activeSheet?.id]);
  const prepareConversationForOpen = useCallback(() => {
    prepareChatConversationForOpen({
      activeSheetId: activeSheet?.id ?? "",
      blocked: busy || inlineBusy || recoveryCheckpoints.length > 0 || approvalRequests.some((approval) => approval.status === "pending"),
    });
  }, [activeSheet?.id, approvalRequests, busy, inlineBusy, prepareChatConversationForOpen, recoveryCheckpoints.length]);
  const prewarmRuntime = useCallback(() => prewarmAgentRuntime(agentProvider), [agentProvider]);
  const visibleApprovalRequests = [...approvalRequests, ...recoveryCheckpoints.map(checkpointToApproval)];

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
    credentialStatus: credentials.status,
    credentialBusy: credentials.busy,
    credentialMessage: credentials.message,
    skills,
    availableDocuments,
    approvalRequests: visibleApprovalRequests,
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
    storeCredential: credentials.store,
    removeCredential: credentials.remove,
    prewarmRuntime,
  };
}

function waitForNextFrame() {
  return typeof window === "undefined" ? Promise.resolve() : new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}
