import { useEffect, useMemo, useState } from "react";
import type { ChatConversation, ChatMessage } from "../types";
import { createWelcomeConversation, deriveConversationTitle, LEGACY_WELCOME_MESSAGE } from "../lib/conversations";
import { loadBrowserConversations, saveConversations } from "../lib/persistence";

export function useChatConversations(persistenceReady: boolean, libraryPath: string) {
  const initialConversations = useMemo(
    () => normalizeLoadedConversations(loadBrowserConversations([createWelcomeConversation()])),
    [],
  );
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0]?.id ?? "default");

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (!persistenceReady) return;
    saveConversations(conversations, libraryPath.startsWith("/") ? libraryPath : undefined).catch(() => {
      localStorage.setItem("nibva.chatConversations.v1", JSON.stringify(conversations));
    });
  }, [conversations, persistenceReady, libraryPath]);

  function replaceConversations(nextConversations: ChatConversation[]) {
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id ?? "default");
  }

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
    activeConversationId,
    messages,
    setActiveConversationId,
    replaceConversations,
    appendMessage,
    updateMessage,
    renameConversation,
    createConversation,
    deleteConversation,
  };
}

function normalizeLoadedConversations(conversations: ChatConversation[]): ChatConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.filter(
      (message) => !(message.id.endsWith("-welcome") && message.content === LEGACY_WELCOME_MESSAGE),
    ),
  }));
}
