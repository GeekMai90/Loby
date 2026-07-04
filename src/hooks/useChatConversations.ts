import { useEffect, useMemo, useState } from "react";
import type { ChatConversation, ChatMessage } from "../types";
import { createWelcomeConversation, deriveConversationTitle } from "../lib/conversations";
import { loadBrowserConversations, saveConversations } from "../lib/persistence";

export function useChatConversations(persistenceReady: boolean, libraryPath: string) {
  const initialConversations = useMemo(() => loadBrowserConversations([createWelcomeConversation()]), []);
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

  function createConversation() {
    const conversation = createWelcomeConversation(`chat-${Date.now()}`, "新对话");
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
  }

  function forkConversation() {
    const source = activeConversation;
    if (!source) return;
    const forked: ChatConversation = {
      ...source,
      id: `chat-${Date.now()}`,
      title: `${source.title} 副本`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: source.messages.map((message) => ({ ...message, id: `${message.id}-fork-${Date.now()}` })),
    };
    setConversations((current) => [forked, ...current]);
    setActiveConversationId(forked.id);
  }

  function compactConversation() {
    const source = activeConversation;
    if (!source || source.messages.length <= 6) return;
    const preserved = source.messages.slice(-5);
    const summary: ChatMessage = {
      id: `compact-${Date.now()}`,
      role: "system",
      content: [
        "本地 compact 摘要：",
        ...source.messages.slice(0, -5).map((message) => `${message.role}: ${message.content.slice(0, 180)}`),
      ].join("\n"),
    };
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: [summary, ...preserved],
      updatedAt: new Date().toISOString(),
    }));
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
    createConversation,
    forkConversation,
    compactConversation,
    deleteConversation,
  };
}
