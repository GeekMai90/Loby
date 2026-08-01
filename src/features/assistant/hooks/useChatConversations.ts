/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、AI 助手模块、写作库模块
 * [OUTPUT]: 对外提供 useChatConversations，管理活动排序、标题来源、对话级模型选择、按应用默认值显式创建新会话、两小时重新打开策略与惰性空白会话
 * [POS]: AI 助手 feature 的会话协调边界，统一内存草稿、活动元数据、标题竞态保护和写作库持久化时序
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AiAction,
  AiChangeSet,
  AgentConversationSelection,
  ChatConversation,
  ChatMessage,
  ConversationCompactionCheckpoint,
  ConversationContextStats,
} from "@/shared/types";
import { normalizeLoadedConversations } from "@/features/assistant/model/chatConversationNormalization";
import {
  createConversationBranch,
  createWelcomeConversation,
  deriveConversationTitle,
  hasConversationMessages,
  applyGeneratedConversationTitle,
} from "@/features/assistant/model/conversations";
import { shouldStartNewConversationOnOpen } from "@/features/assistant/model/conversationOpening";
import { loadBrowserConversations, prepareConversationsForPersistence, saveConversations } from "@/features/library/model/persistence";
import { LatestTaskQueue } from "@/shared/lib/latestTaskQueue";

interface ConversationSaveRequest {
  conversations: ChatConversation[];
  libraryPath?: string;
}

const CONVERSATION_SAVE_DEBOUNCE_MS = 500;

export function useChatConversations(persistenceReady: boolean, libraryPath: string, loadedConversations: ChatConversation[] | null) {
  const initialConversations = useMemo(() => normalizeLoadedConversations(loadBrowserConversations([createWelcomeConversation()])), []);
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0]?.id ?? "default");
  const [hydratedLibraryPath, setHydratedLibraryPath] = useState<string | null>(null);
  const saveQueueRef = useRef<LatestTaskQueue<ConversationSaveRequest> | null>(null);

  if (saveQueueRef.current === null) {
    saveQueueRef.current = new LatestTaskQueue<ConversationSaveRequest>({
      delayMs: CONVERSATION_SAVE_DEBOUNCE_MS,
      run: async (request) => {
        await saveConversations(request.conversations, request.libraryPath);
      },
      onError: (_error, request) => {
        localStorage.setItem("loby.chatConversations.v1", JSON.stringify(prepareConversationsForPersistence(request.conversations)));
      },
    });
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const conversationsReady = persistenceReady && hydratedLibraryPath === libraryPath;

  useEffect(() => {
    if (!persistenceReady) return;
    if (loadedConversations) {
      const normalized = normalizeLoadedConversations(loadedConversations);
      setConversations(normalized);
      setActiveConversationId(normalized[0]?.id ?? "default");
      setHydratedLibraryPath(libraryPath);
      return;
    }
    if (!libraryPath.startsWith("/")) {
      setHydratedLibraryPath(libraryPath);
    }
  }, [loadedConversations, persistenceReady, libraryPath]);

  useEffect(() => {
    if (!persistenceReady || hydratedLibraryPath !== libraryPath) return;
    saveQueueRef.current?.schedule({
      conversations,
      libraryPath: libraryPath.startsWith("/") ? libraryPath : undefined,
    });
  }, [conversations, persistenceReady, libraryPath, hydratedLibraryPath]);

  useEffect(
    () => () => {
      void saveQueueRef.current?.flush();
    },
    [],
  );

  const replaceConversations = useCallback(
    (nextConversations: ChatConversation[]) => {
      const normalized = normalizeLoadedConversations(nextConversations);
      setConversations(normalized);
      setActiveConversationId(normalized[0]?.id ?? "default");
      setHydratedLibraryPath(libraryPath);
    },
    [libraryPath],
  );

  function updateActiveConversation(updater: (conversation: ChatConversation) => ChatConversation) {
    updateConversation(activeConversationId, updater);
  }

  function updateConversation(conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((current) => {
      const activeIndex = current.findIndex((conversation) => conversation.id === conversationId);
      if (activeIndex === -1) return current;
      const updatedConversation = updater(current[activeIndex]);
      return [updatedConversation, ...current.filter((_, index) => index !== activeIndex)];
    });
  }

  function appendMessage(message: ChatMessage, contextSheetId = "", conversationId = activeConversationId) {
    const now = new Date().toISOString();
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
      title:
        message.role === "user" &&
        conversation.titleSource !== "manual" &&
        (conversation.title === "默认对话" || conversation.title === "新对话")
          ? deriveConversationTitle(message.content)
          : conversation.title,
      titleSource:
        message.role === "user" &&
        conversation.titleSource !== "manual" &&
        (conversation.title === "默认对话" || conversation.title === "新对话")
          ? "derived"
          : conversation.titleSource,
      lastUserMessageAt: message.role === "user" ? now : conversation.lastUserMessageAt,
      lastContextSheetId: message.role === "user" && contextSheetId ? contextSheetId : conversation.lastContextSheetId,
      updatedAt: now,
    }));
    return conversationId;
  }

  function insertMessageBefore(messageId: string, message: ChatMessage) {
    updateActiveConversation((conversation) => {
      const index = conversation.messages.findIndex((item) => item.id === messageId);
      const messages = [...conversation.messages];
      messages.splice(index === -1 ? messages.length : index, 0, message);
      return {
        ...conversation,
        messages,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateMessage(messageId: string, updater: (message: ChatMessage) => ChatMessage) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.messages.some((message) => message.id === messageId)
          ? {
              ...conversation,
              messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function updateChangeSet(changeSetId: string, updater: (changeSet: AiChangeSet) => AiChangeSet) {
    setConversations((current) =>
      current.map((conversation) => {
        let changed = false;
        const messages = conversation.messages.map((message) => {
          if (!message.changeSets?.some((changeSet) => changeSet.id === changeSetId)) return message;
          changed = true;
          return {
            ...message,
            changeSets: message.changeSets.map((changeSet) => (changeSet.id === changeSetId ? updater(changeSet) : changeSet)),
          };
        });
        return changed ? { ...conversation, messages, updatedAt: new Date().toISOString() } : conversation;
      }),
    );
  }

  function updateAction(actionId: string, updater: (action: AiAction) => AiAction) {
    setConversations((current) =>
      current.map((conversation) => {
        let changed = false;
        const messages = conversation.messages.map((message) => {
          if (!message.actions?.some((action) => action.id === actionId)) return message;
          changed = true;
          return {
            ...message,
            actions: message.actions.map((action) => (action.id === actionId ? updater(action) : action)),
          };
        });
        return changed ? { ...conversation, messages, updatedAt: new Date().toISOString() } : conversation;
      }),
    );
  }

  function forkConversationFromMessage(messageId: string, message: ChatMessage, contextSheetId = "") {
    const now = new Date().toISOString();
    const branchId = `chat-${Date.now()}-branch`;
    setConversations((current) => {
      const source = current.find((conversation) => conversation.id === activeConversationId);
      if (!source) return current;
      const branch = createConversationBranch(source, messageId, message, contextSheetId, branchId, now);
      return [branch, ...current];
    });
    setActiveConversationId(branchId);
    return branchId;
  }

  function updateContextProjection(
    checkpoint: ConversationCompactionCheckpoint | undefined,
    stats: ConversationContextStats,
    conversationId = activeConversationId,
  ) {
    updateConversation(conversationId, (conversation) => ({ ...conversation, checkpoint, lastContextStats: stats }));
  }

  function updateAgentSelection(selection: AgentConversationSelection, conversationId = activeConversationId) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      agentSelection: selection,
      updatedAt: new Date().toISOString(),
    }));
  }

  const createConversation = useCallback(
    (agentSelection?: AgentConversationSelection) => {
      if (!hasConversationMessages(activeConversation)) return;
      const conversation = createWelcomeConversation(`chat-${Date.now()}`, "新对话", agentSelection);
      setConversations((current) => [conversation, ...current.filter(hasConversationMessages)]);
      setActiveConversationId(conversation.id);
    },
    [activeConversation],
  );

  const prepareConversationForOpen = useCallback(
    ({
      activeSheetId,
      blocked,
      agentSelection,
    }: {
      activeSheetId: string;
      blocked: boolean;
      agentSelection?: AgentConversationSelection;
    }) => {
      if (
        !conversationsReady ||
        !shouldStartNewConversationOnOpen({
          conversation: activeConversation,
          activeSheetId,
          blocked,
        })
      ) {
        return;
      }
      const conversation = createWelcomeConversation(`chat-${Date.now()}`, "新对话", agentSelection);
      setConversations((current) => [conversation, ...current.filter(hasConversationMessages)]);
      setActiveConversationId(conversation.id);
    },
    [activeConversation, conversationsReady],
  );

  function renameConversation(conversationId: string, title: string) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title: normalizedTitle,
              titleSource: "manual",
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function applyGeneratedTitle(conversationId: string, title: string, expectedMessageId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? applyGeneratedConversationTitle(conversation, title, expectedMessageId) : conversation,
      ),
    );
  }

  function deleteConversation(agentSelection?: AgentConversationSelection) {
    setConversations((current) => {
      if (current.length <= 1) {
        const fallback = createWelcomeConversation(`chat-${Date.now()}`, "新对话", agentSelection);
        setActiveConversationId(fallback.id);
        return [fallback];
      }
      const next = current.filter((conversation) => conversation.id !== activeConversationId);
      setActiveConversationId(next[0]?.id ?? "default");
      return next;
    });
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    conversationsReady,
    messages,
    setActiveConversationId,
    replaceConversations,
    appendMessage,
    insertMessageBefore,
    updateMessage,
    updateChangeSet,
    updateAction,
    forkConversationFromMessage,
    updateContextProjection,
    updateAgentSelection,
    renameConversation,
    applyGeneratedTitle,
    createConversation,
    prepareConversationForOpen,
    deleteConversation,
  };
}
