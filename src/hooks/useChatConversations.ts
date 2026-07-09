import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiAction, AiChangeSet, ChatConversation, ChatMessage } from "../types";
import { normalizeLoadedConversations } from "../lib/chatConversationNormalization";
import { createWelcomeConversation, deriveConversationTitle } from "../lib/conversations";
import { loadBrowserConversations, saveConversations } from "../lib/persistence";

export function useChatConversations(persistenceReady: boolean, libraryPath: string, loadedConversations: ChatConversation[] | null) {
  const initialConversations = useMemo(() => normalizeLoadedConversations(loadBrowserConversations([createWelcomeConversation()])), []);
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0]?.id ?? "default");
  const [hydratedLibraryPath, setHydratedLibraryPath] = useState<string | null>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

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
    saveConversations(conversations, libraryPath.startsWith("/") ? libraryPath : undefined).catch(() => {
      localStorage.setItem("nibva.chatConversations.v1", JSON.stringify(conversations));
    });
  }, [conversations, persistenceReady, libraryPath, hydratedLibraryPath]);

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
    setConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversationId ? updater(conversation) : conversation)),
    );
  }

  function appendMessage(message: ChatMessage) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
      title:
        message.role === "user" && (conversation.title === "默认对话" || conversation.title === "新对话")
          ? deriveConversationTitle(message.content)
          : conversation.title,
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateMessage(messageId: string, updater: (message: ChatMessage) => ChatMessage) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
      updatedAt: new Date().toISOString(),
    }));
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

  function replaceMessageAndTruncate(messageId: string, message: ChatMessage) {
    updateActiveConversation((conversation) => {
      const messageIndex = conversation.messages.findIndex((item) => item.id === messageId);
      const previousMessages = messageIndex === -1 ? conversation.messages : conversation.messages.slice(0, messageIndex);
      return {
        ...conversation,
        messages: [...previousMessages, message],
        title:
          message.role === "user" && (conversation.title === "默认对话" || conversation.title === "新对话")
            ? deriveConversationTitle(message.content)
            : conversation.title,
        agentThreadId: undefined,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function setConversationAgentThreadId(conversationId: string, agentThreadId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              agentThreadId,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function createConversation() {
    const conversation = createWelcomeConversation(`chat-${Date.now()}`, "新对话");
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
  }

  function renameConversation(conversationId: string, title: string) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title: normalizedTitle,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  function deleteConversation() {
    setConversations((current) => {
      if (current.length <= 1) {
        const fallback = createWelcomeConversation(`chat-${Date.now()}`, "新对话");
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
    messages,
    setActiveConversationId,
    replaceConversations,
    appendMessage,
    updateMessage,
    updateChangeSet,
    updateAction,
    replaceMessageAndTruncate,
    setConversationAgentThreadId,
    renameConversation,
    createConversation,
    deleteConversation,
  };
}
