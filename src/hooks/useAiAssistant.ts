import { useEffect, useState } from "react";
import type {
  AgentProvider,
  AiMountedContext,
  ChatMessage,
  CodexProbeResult,
  CodexSkill,
  MentionMode,
  WritingProject,
  WritingSheet,
} from "../types";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "../lib/agentCommands";
import { saveAgentSettings } from "../lib/agentSettings";
import { listCodexSkills, probeAgentCli, streamAgentChat } from "../lib/codex";
import { buildCodexContext } from "../lib/codexContext";
import { useChatConversations } from "./useChatConversations";

interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialPlanMode: boolean;
  initialAgentProvider: AgentProvider;
  initialCodexCliPath: string;
  initialClaudeCliPath: string;
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  selectedText: string;
  onOpenAiPanel: () => void;
}

export function useAiAssistant({
  persistenceReady,
  libraryPath,
  initialPlanMode,
  initialAgentProvider,
  initialCodexCliPath,
  initialClaudeCliPath,
  activeProject,
  activeSheet,
  selectedText,
  onOpenAiPanel,
}: UseAiAssistantParams) {
  const conversations = useChatConversations(persistenceReady, libraryPath);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [planMode, setPlanMode] = useState(initialPlanMode);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>(initialAgentProvider);
  const [codexCliPath, setCodexCliPath] = useState(initialCodexCliPath);
  const [claudeCliPath, setClaudeCliPath] = useState(initialClaudeCliPath);
  const [skills, setSkills] = useState<CodexSkill[]>([]);
  const [probe, setProbe] = useState<CodexProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [mountedSheetId, setMountedSheetId] = useState(activeSheet?.id ?? "");
  const [mountedSelectionText, setMountedSelectionText] = useState("");
  const normalizedSelectedText = selectedText.trim();
  const mountedContexts = buildMountedContexts(activeSheet, mountedSheetId, mountedSelectionText);

  useEffect(() => {
    setMountedSheetId(activeSheet?.id ?? "");
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
    saveAgentSettings({ planMode, agentProvider, codexCliPath, claudeCliPath });
  }, [agentProvider, claudeCliPath, codexCliPath, planMode]);

  async function sendMessage(promptOverride?: string, selectedSkillIds: string[] = []) {
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

    const explicitMentionModes = resolveMentionModes(rawPrompt).filter((mode) => mode !== "current-sheet");
    const resolvedMentionModes = Array.from(
      new Set<MentionMode>([
        ...(mountedSheetId && mountedSheetId === activeSheet.id ? (["current-sheet"] as MentionMode[]) : []),
        ...(mountedSelectionText ? (["selection"] as MentionMode[]) : []),
        ...explicitMentionModes,
      ]),
    );
    const selectedTextForContext = mountedSelectionText || (explicitMentionModes.includes("selection") ? normalizedSelectedText : "");
    const resolvedSkills = resolveSkillMentions(rawPrompt, skills, selectedSkillIds);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
    };

    conversations.appendMessage(userMessage);
    setInput("");
    onOpenAiPanel();
    setBusy(true);

    const assistantMessageId = `assistant-${Date.now() + 1}`;
    conversations.appendMessage({
      id: assistantMessageId,
      role: "assistant",
      content: "",
    });

    let accumulated = "";
    let failed = false;

    try {
      await streamAgentChat({
        libraryPath,
        provider: agentProvider,
        prompt,
        context: buildCodexContext(
          activeProject,
          activeSheet,
          selectedTextForContext,
          conversations.messages,
          resolvedMentionModes,
          resolvedSkills,
        ),
        planMode,
        cliPath: agentProvider === "claude" ? claudeCliPath : codexCliPath,
        onDelta: (delta) => {
          accumulated += delta;
          conversations.updateMessage(assistantMessageId, (message) => ({
            ...message,
            content: accumulated,
          }));
        },
        onError: (message) => {
          failed = true;
          conversations.updateMessage(assistantMessageId, (current) => ({
            ...current,
            role: accumulated ? "assistant" : "system",
            content: accumulated ? `${accumulated}\n\n${message}` : message,
          }));
        },
      });
      if (!failed && !accumulated.trim()) {
        conversations.updateMessage(assistantMessageId, (message) => ({
          ...message,
          role: "system",
          content: "本机 AI CLI 没有返回内容。",
        }));
      }
    } catch (error) {
      conversations.updateMessage(assistantMessageId, (message) => ({
        ...message,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }

  async function runProbe() {
    setProbeBusy(true);
    try {
      setProbe(await probeAgentCli(agentProvider, agentProvider === "claude" ? claudeCliPath : codexCliPath));
    } finally {
      setProbeBusy(false);
    }
  }

  return {
    conversations: conversations.conversations,
    activeConversationId: conversations.activeConversationId,
    messages: conversations.messages,
    input,
    busy,
    planMode,
    agentProvider,
    codexCliPath,
    claudeCliPath,
    skills,
    probe,
    probeBusy,
    mountedContexts,
    replaceConversations: conversations.replaceConversations,
    setActiveConversationId: conversations.setActiveConversationId,
    createConversation: conversations.createConversation,
    deleteConversation: conversations.deleteConversation,
    renameConversation: conversations.renameConversation,
    setInput,
    setPlanMode,
    setAgentProvider,
    setCodexCliPath,
    setClaudeCliPath,
    attachMountedSheet: () => setMountedSheetId(activeSheet?.id ?? ""),
    detachMountedContext: (contextId: string) => {
      if (contextId.startsWith("document:")) setMountedSheetId("");
      if (contextId.startsWith("selection:")) setMountedSelectionText("");
    },
    sendMessage,
    runProbe,
  };
}

function buildMountedContexts(
  activeSheet: WritingSheet | undefined,
  mountedSheetId: string,
  mountedSelectionText: string,
): AiMountedContext[] {
  if (!activeSheet) return [];

  const contexts: AiMountedContext[] = [];
  if (mountedSheetId === activeSheet.id) {
    contexts.push({
      id: `document:${activeSheet.id}`,
      type: "document",
      sheetId: activeSheet.id,
      title: activeSheet.title || "当前文稿",
      subtitle: "全文",
      content: activeSheet.body,
    });
  }

  if (mountedSelectionText) {
    contexts.push({
      id: `selection:${activeSheet.id}`,
      type: "selection",
      sheetId: activeSheet.id,
      title: buildSelectionTitle(mountedSelectionText),
      subtitle: "选区",
      content: mountedSelectionText,
    });
  }

  return contexts;
}

function buildSelectionTitle(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "选中的文字范围";
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine;
}
