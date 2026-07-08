import { useEffect, useState } from "react";
import type {
  AgentModel,
  AgentProvider,
  AgentReasoningEffort,
  CodexModelCatalog,
  AiDocumentReference,
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
import { listCodexModels, listCodexSkills, probeAgentCli, streamAgentChat } from "../lib/codex";
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
        ...(mountedSheetIds.includes(activeSheet.id) ? (["current-sheet"] as MentionMode[]) : []),
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
          mountedContexts,
          {
            provider: agentProvider,
            model: agentModel,
            reasoningEffort: agentReasoningEffort,
            quickMode: agentQuickMode,
          },
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
    mountedContexts,
    replaceConversations: conversations.replaceConversations,
    setActiveConversationId: conversations.setActiveConversationId,
    createConversation: conversations.createConversation,
    deleteConversation: conversations.deleteConversation,
    renameConversation: conversations.renameConversation,
    setInput,
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
    runProbe,
  };
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
