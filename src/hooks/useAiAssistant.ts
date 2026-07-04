import type { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import type {
  AiSuggestion,
  ChatMessage,
  CodexProbeResult,
  CodexSkill,
  MentionMode,
  ProjectResourceFile,
  ProjectResourceText,
  WritingProject,
  WritingSheet,
} from "../types";
import { expandSlashCommand, resolveMentionModes, resolveSkillMentions } from "../lib/agentCommands";
import { saveAgentSettings } from "../lib/agentSettings";
import { listCodexSkills, probeCodexCli, runCodexChat, writeSkillTask } from "../lib/codex";
import { buildCodexContext } from "../lib/codexContext";
import { buildLineDiff } from "../lib/diff";
import { getEditorSelection, getEditorSelectionRange } from "../lib/editorSelection";
import { buildLocalImageIdeas, buildLocalSheetSummary, polishText } from "../lib/localSuggestions";
import type { ProjectResourcePaths } from "../lib/projectModel";
import { loadSelectedResourceTexts } from "../lib/resourceTexts";
import { today } from "../lib/dates";
import { useChatConversations } from "./useChatConversations";

interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialPlanMode: boolean;
  initialCodexCliPath: string;
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  projectResourcePaths: ProjectResourcePaths | null;
  selectedResourcePaths: string[];
  getEditorView: () => EditorView | null;
  updateActiveSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onCreateSuggestionMaterialSheet: (suggestion: AiSuggestion) => void;
  onOpenAiPanel: () => void;
}

export function useAiAssistant({
  persistenceReady,
  libraryPath,
  initialPlanMode,
  initialCodexCliPath,
  activeProject,
  activeSheet,
  projectResourcePaths,
  selectedResourcePaths,
  getEditorView,
  updateActiveSheet,
  onCreateSuggestionMaterialSheet,
  onOpenAiPanel,
}: UseAiAssistantParams) {
  const conversations = useChatConversations(persistenceReady, libraryPath);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [planMode, setPlanMode] = useState(initialPlanMode);
  const [mentionModes, setMentionModes] = useState<MentionMode[]>(["current-sheet"]);
  const [selectedContextSheetIds, setSelectedContextSheetIds] = useState<string[]>([]);
  const [skills, setSkills] = useState<CodexSkill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [skillTaskStatus, setSkillTaskStatus] = useState("");
  const [codexCliPath, setCodexCliPath] = useState(initialCodexCliPath);
  const [providerMode, setProviderMode] = useState<"exec" | "app-server">("exec");
  const [probe, setProbe] = useState<CodexProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);

  useEffect(() => {
    listCodexSkills()
      .then((loadedSkills) => setSkills(loadedSkills))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    saveAgentSettings({ planMode, codexCliPath });
  }, [planMode, codexCliPath]);

  useEffect(() => {
    if (!activeProject) return;
    setSelectedContextSheetIds((current) => current.filter((sheetId) => activeProject.sheets.some((sheet) => sheet.id === sheetId)));
  }, [activeProject]);

  function openAiPanel() {
    onOpenAiPanel();
  }

  function getSelection() {
    return getEditorSelection(getEditorView());
  }

  function generatePolishSuggestion() {
    if (!activeSheet) return;
    const selection = getSelection();
    const source = selection || activeSheet.body;
    const result = polishText(source);
    setSuggestion({
      id: `suggestion-${Date.now()}`,
      title: selection ? "润色选中文本" : "润色当前稿件",
      source,
      result,
      scope: selection ? "selection" : "sheet",
    });
    openAiPanel();
  }

  function generateTitleSuggestion() {
    if (!activeSheet) return;
    const result = [
      `为什么${activeSheet.title.replace(/^#\s*/, "")}值得重新思考`,
      `${activeSheet.title}：从写作流程开始`,
      "不是多一个工具，而是重做写作工作台",
    ].join("\n");
    setSuggestion({
      id: `suggestion-title-${Date.now()}`,
      title: "标题备选",
      source: activeSheet.title,
      result,
      scope: "sheet",
    });
    openAiPanel();
  }

  function generateSummarySuggestion() {
    if (!activeSheet) return;
    setSuggestion({
      id: `suggestion-summary-${Date.now()}`,
      title: "稿件总结",
      source: activeSheet.body,
      result: buildLocalSheetSummary(activeSheet),
      scope: "sheet",
      reviewMode: "note",
    });
    openAiPanel();
  }

  function generateImageIdeaSuggestion() {
    if (!activeProject || !activeSheet) return;
    setSuggestion({
      id: `suggestion-image-${Date.now()}`,
      title: "配图构思",
      source: activeSheet.body,
      result: buildLocalImageIdeas(activeProject, activeSheet),
      scope: "sheet",
      reviewMode: "note",
    });
    openAiPanel();
  }

  async function sendMessage(promptOverride?: string) {
    if (!activeProject || !activeSheet || busy) return;
    const rawPrompt = (promptOverride ?? input).trim();
    const prompt = expandSlashCommand(rawPrompt);
    if (!prompt) return;
    const resolvedMentionModes = Array.from(new Set([...mentionModes, ...resolveMentionModes(rawPrompt)]));
    const resolvedSkills = resolveSkillMentions(rawPrompt, skills, selectedSkillIds);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
    };

    conversations.appendMessage(userMessage);
    setInput("");
    openAiPanel();
    setBusy(true);

    try {
      const selectedResourceTexts = await loadSelectedResourceTexts(libraryPath, selectedResourcePaths);
      const response = await runCodexChat({
        libraryPath,
        prompt,
        context: buildCodexContext(
          activeProject,
          activeSheet,
          getSelection(),
          conversations.messages,
          resolvedMentionModes,
          resolvedSkills,
          selectedContextSheetIds,
          projectResourcePaths,
          selectedResourcePaths,
          selectedResourceTexts,
        ),
        planMode,
        codexCliPath,
      });
      conversations.appendMessage({
        id: `assistant-${Date.now()}`,
        role: response.output ? "assistant" : "system",
        content: response.output || response.error || "Codex CLI 没有返回内容。",
        command: response.command,
      });
    } catch (error) {
      conversations.appendMessage({
        id: `error-${Date.now()}`,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  async function createLocalSkillTasks() {
    if (!activeProject || !activeSheet) return;
    if (!libraryPath.startsWith("/")) {
      setSkillTaskStatus("当前没有可写的桌面写作库，请使用 Tauri 桌面应用并选择本地库。");
      return;
    }
    const action = expandSlashCommand(input.trim()) || "请根据当前项目、稿件卡片和选中上下文执行这个 Codex skill。";
    const selectedSkills = resolveSkillMentions(input, skills, selectedSkillIds);
    if (selectedSkills.length === 0) {
      setSkillTaskStatus("请先选择一个 $skill，或在输入框里写入 $skill-name。");
      return;
    }
    setSkillTaskStatus("正在写入本地 skill 任务...");
    try {
      const selectedText = getSelection();
      const taskPaths = await Promise.all(
        selectedSkills.map((skill) =>
          writeSkillTask({
            libraryPath,
            skill,
            project: activeProject,
            sheet: activeSheet,
            selectedText,
            action,
            selectedContextSheetIds,
            resourcePaths: selectedResourcePaths,
          }),
        ),
      );
      setSkillTaskStatus(`已写入 ${taskPaths.length} 个 skill 任务：${taskPaths.join(" | ")}`);
    } catch (error) {
      setSkillTaskStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function requestInlineEdit() {
    if (!activeProject || !activeSheet || busy) return;
    const selection = getSelection();
    const source = selection || activeSheet.body;
    const prompt = selection
      ? "请改写当前选区，保留原意和作者语气，只输出改写后的文本，不要解释。"
      : "请给当前稿件卡片做一次轻量改写，保留原意和作者语气，只输出改写后的正文，不要解释。";

    openAiPanel();
    setBusy(true);

    try {
      const response = await runCodexChat({
        libraryPath,
        prompt,
        context: buildCodexContext(activeProject, activeSheet, selection, conversations.messages, ["current-sheet", "selection"], []),
        planMode: false,
        codexCliPath,
      });
      const result = response.output.trim();
      if (!result) {
        conversations.appendMessage({
          id: `inline-error-${Date.now()}`,
          role: "system",
          content: response.error || "Codex 没有返回可用于 inline edit 的文本。",
          command: response.command,
        });
        return;
      }

      setSuggestion({
        id: `codex-inline-${Date.now()}`,
        title: selection ? "Codex 改写选区" : "Codex 改写当前稿件",
        source,
        result,
        scope: selection ? "selection" : "sheet",
      });
    } catch (error) {
      conversations.appendMessage({
        id: `inline-error-${Date.now()}`,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  async function runProbe() {
    setProbeBusy(true);
    try {
      setProbe(await probeCodexCli(codexCliPath));
    } finally {
      setProbeBusy(false);
    }
  }

  function saveSuggestionAsMaterialSheet() {
    if (!suggestion || suggestion.reviewMode !== "note") return;
    onCreateSuggestionMaterialSheet(suggestion);
    setSuggestion(null);
  }

  function acceptSuggestion() {
    if (!activeSheet || !suggestion) return;
    if (suggestion.reviewMode === "note" || suggestion.title === "标题备选") {
      setSuggestion(null);
      return;
    }

    const selection = getEditorSelectionRange(getEditorView());
    updateActiveSheet((sheet) => {
      const body =
        selection && suggestion.scope === "selection"
          ? `${sheet.body.slice(0, selection.from)}${suggestion.result}${sheet.body.slice(selection.to)}`
          : suggestion.result;
      return { ...sheet, body, updatedAt: today() };
    });
    setSuggestion(null);
  }

  return {
    suggestion,
    diffLines: suggestion && suggestion.reviewMode !== "note" ? buildLineDiff(suggestion.source, suggestion.result) : [],
    conversations: conversations.conversations,
    activeConversationId: conversations.activeConversationId,
    messages: conversations.messages,
    input,
    busy,
    planMode,
    mentionModes,
    selectedContextSheetIds,
    skills,
    selectedSkillIds,
    skillTaskStatus,
    codexCliPath,
    providerMode,
    probe,
    probeBusy,
    replaceConversations: conversations.replaceConversations,
    setActiveConversationId: conversations.setActiveConversationId,
    createConversation: conversations.createConversation,
    forkConversation: conversations.forkConversation,
    compactConversation: conversations.compactConversation,
    deleteConversation: conversations.deleteConversation,
    setInput,
    setPlanMode,
    setMentionModes,
    setSelectedContextSheetIds,
    setSelectedSkillIds,
    setCodexCliPath,
    setProviderMode,
    sendMessage,
    createLocalSkillTasks,
    runProbe,
    requestInlineEdit,
    generatePolishSuggestion,
    generateTitleSuggestion,
    generateSummarySuggestion,
    generateImageIdeaSuggestion,
    saveSuggestionAsMaterialSheet,
    acceptSuggestion,
    rejectSuggestion: () => setSuggestion(null),
  };
}
