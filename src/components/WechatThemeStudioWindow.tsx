import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadAgentSettings, saveAgentSettings } from "../lib/agentSettings";
import { collectAssistantImagePaths } from "../lib/assistantImageAttachments";
import { listCodexModels } from "../lib/codex";
import { useAgentStreamRun } from "../hooks/useAgentStreamRun";
import { loadProjects } from "../lib/persistence";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { applyWechatThemeBaseStyleChange, type WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import { resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import { isWechatThemeChangeRequestCurrent, parseWechatThemeChange } from "../lib/publishing/wechatThemeChange";
import { buildWechatThemeSkillContext } from "../lib/publishing/wechatThemeSkill";
import { chooseWechatThemeExportPath, chooseWechatThemeFileToImport } from "../lib/publishing/wechatThemeFile";
import type { WechatThemePreviewViewport } from "../lib/publishing/wechatThemePreviewModel";
import {
  WECHAT_THEME_SAMPLE_PROJECT_ID,
  WECHAT_THEME_SAMPLE_SHEET_ID,
  withWechatThemeSampleArticle,
} from "../lib/publishing/wechatThemeSampleArticle";
import {
  createWechatThemeConversation,
  createPersonalWechatTheme,
  deletePersonalWechatTheme,
  deriveWechatThemeConversationTitle,
  getWechatThemeStudioSession,
  loadWechatThemeStore,
  redoPersonalWechatTheme,
  savePersonalWechatTheme,
  saveWechatThemeConversations,
  saveWechatThemePreferences,
  undoPersonalWechatTheme,
  type WechatThemeConversation,
  type WechatThemeStoreSnapshot,
  type WechatThemeStudioSession,
} from "../lib/publishing/wechatThemeStore";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { createWechatThemeMessageId, withWechatThemeConversationMessages } from "../lib/publishing/wechatThemeConversation";
import { useAppTheme } from "../hooks/useAppTheme";
import type { AgentRunInfo, AiImageAttachment, CodexModelCatalog, WritingProject, WritingSheet } from "../types";
import { WechatThemeAssistantPanel, type WechatThemeAssistantMessage } from "./WechatThemeAssistantPanel";
import { WechatThemeLeftRail, type WechatThemeLeftRailView } from "./WechatThemeLeftRail";
import { WechatThemePreview } from "./WechatThemePreview";
import { WechatThemeStudioDialogs } from "./WechatThemeStudioDialogs";
import { WechatThemeStudioHeader, type WechatThemeManualSaveState } from "./WechatThemeStudioHeader";

interface StudioData {
  session: WechatThemeStudioSession;
  projects: WritingProject[];
  store: WechatThemeStoreSnapshot;
}

export function WechatThemeStudioWindow() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const resolvedAppTheme = useAppTheme(initialSettings.appTheme);
  const [data, setData] = useState<StudioData | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeSheetId, setActiveSheetId] = useState("");
  const [themeId, setThemeId] = useState(DEFAULT_WECHAT_THEME_ID as string);
  const activeThemeIdRef = useRef(themeId);
  const activeThemeUpdatedAtRef = useRef("");
  const [search, setSearch] = useState("");
  const [leftRailView, setLeftRailView] = useState<WechatThemeLeftRailView>("articles");
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewViewport, setPreviewViewport] = useState<WechatThemePreviewViewport>("mobile");
  const [status, setStatus] = useState("正在加载主题工作室…");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [conversations, setConversations] = useState<WechatThemeConversation[]>(() => [createWechatThemeConversation()]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalog | null>(null);
  const [agentModel, setAgentModel] = useState(initialSettings.agentModel);
  const [agentReasoningEffort, setAgentReasoningEffort] = useState(initialSettings.agentReasoningEffort);
  const [agentQuickMode, setAgentQuickMode] = useState(initialSettings.agentQuickMode);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [themeActionTargetId, setThemeActionTargetId] = useState("");
  const [manualSaveState, setManualSaveState] = useState<WechatThemeManualSaveState>("idle");
  const manualSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThemeRef = useRef<WechatThemeManifest | null>(null);
  const personalThemeCreationRef = useRef<Promise<WechatThemeManifest> | null>(null);
  const { activeRequestId: activeAssistantRequestId, runAgent: runThemeAgent, cancel: cancelThemeAgent } = useAgentStreamRun();

  const selectThemeId = useCallback((nextThemeId: string) => {
    activeThemeIdRef.current = nextThemeId;
    setThemeId(nextThemeId);
  }, []);

  const loadStudioData = useCallback(async () => {
    try {
      const session = await getWechatThemeStudioSession();
      const [loaded, store] = await Promise.all([loadProjects(session.libraryPath), loadWechatThemeStore()]);
      const projects = withWechatThemeSampleArticle(loaded.projects);
      setData({ session, projects, store });
      setActiveProjectId(WECHAT_THEME_SAMPLE_PROJECT_ID);
      setActiveSheetId(WECHAT_THEME_SAMPLE_SHEET_ID);
      const availableThemes = [...WECHAT_THEMES, ...store.themes];
      const nextThemeId = availableThemes.some((theme) => theme.id === session.selectedThemeId)
        ? session.selectedThemeId
        : DEFAULT_WECHAT_THEME_ID;
      selectThemeId(nextThemeId);
      setStatus("");
    } catch (cause) {
      setStatus(`主题工作室加载失败：${errorMessage(cause)}`);
    }
  }, [selectThemeId]);

  useEffect(() => {
    void loadStudioData();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen("loby://wechat-theme-studio-session-changed", () => void loadStudioData()).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadStudioData]);

  useEffect(() => {
    let cancelled = false;
    listCodexModels()
      .then((catalog) => {
        if (!cancelled) setModelCatalog(catalog);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const themes = useMemo(() => [...WECHAT_THEMES, ...(data?.store.themes ?? [])], [data?.store.themes]);
  const theme = themes.find((item) => item.id === themeId) ?? getWechatTheme(DEFAULT_WECHAT_THEME_ID);
  const favoriteThemes = data ? themes.filter((item) => data.store.preferences.favoriteThemeIds.includes(item.id)) : [];
  activeThemeRef.current = theme;
  const themeActionTarget = themes.find((item) => item.id === themeActionTargetId) ?? null;
  activeThemeUpdatedAtRef.current = theme.updatedAt;
  const activeProject = data?.projects.find((project) => project.id === activeProjectId) ?? data?.projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const undoCount = data?.store.revisions[theme.id]?.length ?? 0;
  const redoCount = data?.store.redos[theme.id]?.length ?? 0;
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0] ?? null;
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    setManualSaveState("idle");
    if (manualSaveTimerRef.current) clearTimeout(manualSaveTimerRef.current);
  }, [theme.id, theme.updatedAt]);

  useEffect(
    () => () => {
      if (manualSaveTimerRef.current) clearTimeout(manualSaveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!data || assistantBusy) return;
    const stored = data.store.conversations[themeId] ?? [];
    const nextConversations = stored.length > 0 ? stored : [createWechatThemeConversation()];
    const preferredId = data.store.activeConversationIds[themeId] ?? "";
    setConversations(nextConversations);
    setActiveConversationId(
      nextConversations.some((conversation) => conversation.id === preferredId) ? preferredId : (nextConversations[0]?.id ?? ""),
    );
  }, [assistantBusy, data, themeId]);

  useEffect(() => {
    if (!data || !activeProject || !activeSheet) return;
    let cancelled = false;
    setPreviewBusy(true);
    setPreviewError("");
    const markdown = resolveWechatPreviewImages(activeSheet.body, data.session.libraryPath, activeProject, activeSheet);
    renderWechatArticle({
      title: activeSheet.title,
      markdown,
      tags: sheetWechatTags(activeProject, activeSheet),
      themeId: theme.id,
      theme,
    })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((cause) => {
        if (!cancelled) setPreviewError(`预览失败：${errorMessage(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, activeSheet, data, theme]);

  function selectArticle(project: WritingProject, sheet: WritingSheet) {
    setActiveProjectId(project.id);
    setActiveSheetId(sheet.id);
  }

  async function ensureEditableTheme(): Promise<WechatThemeManifest> {
    const current = activeThemeRef.current ?? theme;
    if (current.kind === "personal") return current;
    if (personalThemeCreationRef.current) return personalThemeCreationRef.current;

    const creation = (async () => {
      const personal = createPersonalWechatTheme(current);
      const store = await savePersonalWechatTheme(personal);
      activeThemeRef.current = personal;
      activeThemeUpdatedAtRef.current = personal.updatedAt;
      setData((existing) => (existing ? { ...existing, store } : existing));
      selectThemeId(personal.id);
      setStatus(`已创建个人主题「${personal.name}」`);
      return personal;
    })();
    personalThemeCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      personalThemeCreationRef.current = null;
    }
  }

  async function changeBaseStyle(change: WechatThemeBaseStyleChange, commit: boolean) {
    try {
      const editable = await ensureEditableTheme();
      const current = activeThemeRef.current?.id === editable.id ? activeThemeRef.current : editable;
      const next = applyWechatThemeBaseStyleChange(current, change);
      activeThemeRef.current = next;
      activeThemeUpdatedAtRef.current = next.updatedAt;
      setData((existing) => {
        if (!existing) return existing;
        const themes = existing.store.themes.some((item) => item.id === next.id)
          ? existing.store.themes.map((item) => (item.id === next.id ? next : item))
          : [...existing.store.themes, next];
        return { ...existing, store: { ...existing.store, themes } };
      });
      if (!commit) {
        setStatus("正在调整基础样式…");
        return;
      }
      const store = await savePersonalWechatTheme(next);
      setData((existing) => (existing ? { ...existing, store } : existing));
      setStatus(`已自动保存「${next.name}」`);
    } catch (cause) {
      setStatus(`基础样式修改失败：${errorMessage(cause)}`);
    }
  }

  async function duplicateTheme(sourceTheme: WechatThemeManifest) {
    try {
      const personal = createPersonalWechatTheme(sourceTheme);
      const store = await savePersonalWechatTheme(personal);
      setData((current) => (current ? { ...current, store } : current));
      selectThemeId(personal.id);
      setStatus(`已创建个人主题「${personal.name}」`);
    } catch (cause) {
      setStatus(`创建主题失败：${errorMessage(cause)}`);
    }
  }

  async function importTheme() {
    setPreviewError("");
    try {
      const importedTheme = await chooseWechatThemeFileToImport();
      if (!importedTheme) return;
      const store = await savePersonalWechatTheme(importedTheme);
      setData((current) => (current ? { ...current, store } : current));
      selectThemeId(importedTheme.id);
      setStatus(`已导入主题「${importedTheme.name}」`);
    } catch (cause) {
      setStatus(`导入主题失败：${errorMessage(cause)}`);
      setPreviewError(`导入主题失败：${errorMessage(cause)}`);
    }
  }

  async function exportTheme(targetTheme: WechatThemeManifest) {
    setPreviewError("");
    try {
      const path = await chooseWechatThemeExportPath(targetTheme);
      if (!path) return;
      setStatus(`已导出主题「${targetTheme.name}」`);
    } catch (cause) {
      setStatus(`导出主题失败：${errorMessage(cause)}`);
      setPreviewError(`导出主题失败：${errorMessage(cause)}`);
    }
  }

  async function toggleFavoriteTheme(targetTheme: WechatThemeManifest) {
    if (!data) return;
    const favorite = data.store.preferences.favoriteThemeIds.includes(targetTheme.id);
    const nextPreferences = {
      ...data.store.preferences,
      favoriteThemeIds: favorite
        ? data.store.preferences.favoriteThemeIds.filter((id) => id !== targetTheme.id)
        : [...data.store.preferences.favoriteThemeIds, targetTheme.id],
    };
    try {
      const store = await saveWechatThemePreferences(nextPreferences);
      setData((current) => (current ? { ...current, store } : current));
      setStatus(favorite ? `已取消收藏「${targetTheme.name}」` : `已收藏「${targetTheme.name}」`);
    } catch (cause) {
      setStatus(`更新收藏失败：${errorMessage(cause)}`);
    }
  }

  async function setDefaultTheme(targetTheme: WechatThemeManifest) {
    if (!data || data.store.preferences.defaultThemeId === targetTheme.id) return;
    try {
      const store = await saveWechatThemePreferences({ ...data.store.preferences, defaultThemeId: targetTheme.id });
      setData((current) => (current ? { ...current, store } : current));
      setStatus(`已将「${targetTheme.name}」设为默认主题`);
    } catch (cause) {
      setStatus(`设置默认主题失败：${errorMessage(cause)}`);
    }
  }

  async function undoTheme() {
    if (theme.kind !== "personal") return;
    try {
      const store = await undoPersonalWechatTheme(theme.id);
      setData((current) => (current ? { ...current, store } : current));
      setStatus("已撤销上一次主题修改");
    } catch (cause) {
      setStatus(`撤销失败：${errorMessage(cause)}`);
    }
  }

  async function redoTheme() {
    if (theme.kind !== "personal") return;
    try {
      const store = await redoPersonalWechatTheme(theme.id);
      setData((current) => (current ? { ...current, store } : current));
      setStatus("已重做主题修改");
    } catch (cause) {
      setStatus(`重做失败：${errorMessage(cause)}`);
    }
  }

  async function deleteTheme() {
    if (themeActionTarget?.kind !== "personal") return;
    try {
      const deletedTheme = themeActionTarget;
      const store = await deletePersonalWechatTheme(deletedTheme.id);
      setData((current) => (current ? { ...current, store } : current));
      if (theme.id === deletedTheme.id) {
        const availableThemeIds = new Set([...WECHAT_THEMES.map((item) => item.id), ...store.themes.map((item) => item.id)]);
        selectThemeId(availableThemeIds.has(store.preferences.defaultThemeId) ? store.preferences.defaultThemeId : DEFAULT_WECHAT_THEME_ID);
        const fallbackConversation = createWechatThemeConversation();
        setConversations([fallbackConversation]);
        setActiveConversationId(fallbackConversation.id);
      }
      setDeleteOpen(false);
      setThemeActionTargetId("");
      setStatus(`已删除个人主题「${deletedTheme.name}」`);
    } catch (cause) {
      setStatus(`删除失败：${errorMessage(cause)}`);
    }
  }

  function beginRenameTheme(targetTheme: WechatThemeManifest) {
    if (targetTheme.kind !== "personal") return;
    setThemeActionTargetId(targetTheme.id);
    setRenameDraft(targetTheme.name);
    setRenameOpen(true);
  }

  function beginDeleteTheme(targetTheme: WechatThemeManifest) {
    if (targetTheme.kind !== "personal") return;
    setThemeActionTargetId(targetTheme.id);
    setDeleteOpen(true);
  }

  async function renameTheme() {
    const name = renameDraft.trim();
    if (themeActionTarget?.kind !== "personal" || !name) return;
    try {
      const renamed = { ...themeActionTarget, name, updatedAt: new Date().toISOString() };
      const store = await savePersonalWechatTheme(renamed);
      setData((current) => (current ? { ...current, store } : current));
      setRenameOpen(false);
      setThemeActionTargetId("");
      setStatus(`已重命名为「${name}」`);
    } catch (cause) {
      setStatus(`重命名失败：${errorMessage(cause)}`);
    }
  }

  async function saveTheme() {
    if (theme.kind !== "personal" || assistantBusy || manualSaveState === "saving") return;
    if (manualSaveTimerRef.current) clearTimeout(manualSaveTimerRef.current);
    setManualSaveState("saving");
    try {
      const store = await savePersonalWechatTheme(theme);
      setData((current) => (current ? { ...current, store } : current));
      setManualSaveState("saved");
      setStatus(`已确认保存「${theme.name}」`);
    } catch (cause) {
      setManualSaveState("error");
      setStatus(`保存主题失败：${errorMessage(cause)}`);
    }
    manualSaveTimerRef.current = setTimeout(() => setManualSaveState("idle"), 1800);
  }

  async function persistAssistantConversations(nextConversations: WechatThemeConversation[], nextActiveId: string) {
    if (theme.kind !== "personal") return;
    try {
      const store = await saveWechatThemeConversations(theme.id, nextConversations, nextActiveId);
      setData((current) => (current ? { ...current, store } : current));
    } catch (cause) {
      setStatus(`保存主题 AI 对话失败：${errorMessage(cause)}`);
    }
  }

  function selectAssistantConversation(conversationId: string) {
    if (assistantBusy || !conversations.some((conversation) => conversation.id === conversationId)) return;
    setActiveConversationId(conversationId);
    void persistAssistantConversations(conversations, conversationId);
  }

  function createAssistantConversation() {
    if (assistantBusy) return;
    const conversation = createWechatThemeConversation();
    const nextConversations = [conversation, ...conversations];
    setConversations(nextConversations);
    setActiveConversationId(conversation.id);
    void persistAssistantConversations(nextConversations, conversation.id);
  }

  function renameAssistantConversation(conversationId: string, title: string) {
    if (assistantBusy || !title.trim()) return;
    const nextConversations = conversations.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, title: title.trim(), updatedAt: new Date().toISOString() } : conversation,
    );
    setConversations(nextConversations);
    void persistAssistantConversations(nextConversations, activeConversationId);
  }

  function deleteAssistantConversation() {
    if (assistantBusy || !activeConversation) return;
    const remaining = conversations.filter((conversation) => conversation.id !== activeConversation.id);
    const nextConversations = remaining.length > 0 ? remaining : [createWechatThemeConversation()];
    const nextActiveId = nextConversations[0].id;
    setConversations(nextConversations);
    setActiveConversationId(nextActiveId);
    void persistAssistantConversations(nextConversations, nextActiveId);
  }

  async function sendThemePrompt(prompt: string, images: AiImageAttachment[] = []) {
    if (assistantBusy || !data || !activeProject || !activeSheet || !activeConversation) return;
    const modelPrompt = prompt || "请参考这些图片，为当前公众号主题调整视觉设计。";
    const userMessage: WechatThemeAssistantMessage = {
      id: createWechatThemeMessageId(),
      role: "user",
      content: prompt,
      images: images.length > 0 ? images : undefined,
    };
    const conversationId = activeConversation.id;
    const conversationWithUser = [...messages, userMessage];
    const conversationsWithUser = conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title: conversation.title === "新对话" ? deriveWechatThemeConversationTitle(modelPrompt) : conversation.title,
            messages: conversationWithUser,
            updatedAt: new Date().toISOString(),
          }
        : conversation,
    );
    const assistantMessageId = createWechatThemeMessageId();
    let agentThreadId = activeConversation.agentThreadId ?? "";
    let currentRun: AgentRunInfo = { status: "running", activities: [], usage: null };
    const runningMessage: WechatThemeAssistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      run: currentRun,
    };
    setConversations(withWechatThemeConversationMessages(conversationsWithUser, conversationId, [...conversationWithUser, runningMessage]));
    setAssistantBusy(true);
    let editableTheme: WechatThemeManifest | null = null;

    function updateAssistantRun(run: AgentRunInfo) {
      currentRun = run;
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: conversation.messages.map((message) => (message.id === assistantMessageId ? { ...message, run } : message)),
              }
            : conversation,
        ),
      );
    }

    function updateAgentThreadId(threadId: string) {
      agentThreadId = threadId;
      setConversations((current) =>
        current.map((conversation) => (conversation.id === conversationId ? { ...conversation, agentThreadId: threadId } : conversation)),
      );
    }

    function finalizeConversations(nextMessages: WechatThemeAssistantMessage[]) {
      return withWechatThemeConversationMessages(conversationsWithUser, conversationId, nextMessages, agentThreadId);
    }

    try {
      editableTheme = theme;
      if (theme.kind === "built-in") {
        editableTheme = createPersonalWechatTheme(theme);
        await savePersonalWechatTheme(editableTheme);
        const initialStore = await saveWechatThemeConversations(editableTheme.id, conversationsWithUser, conversationId);
        setData((current) => (current ? { ...current, store: initialStore } : current));
        selectThemeId(editableTheme.id);
        activeThemeUpdatedAtRef.current = editableTheme.updatedAt;
      } else {
        const conversationStore = await saveWechatThemeConversations(editableTheme.id, conversationsWithUser, conversationId);
        setData((current) => (current ? { ...current, store: conversationStore } : current));
      }

      const context = buildWechatThemeSkillContext({
        theme: editableTheme,
        previousTheme: data.store.revisions[editableTheme.id]?.at(-1),
        project: activeProject,
        sheet: activeSheet,
        messages: conversationWithUser,
      });
      const response = await runThemeAgent({
        libraryPath: data.session.libraryPath,
        provider: "codex",
        prompt: modelPrompt,
        context,
        imagePaths: collectAssistantImagePaths(conversationWithUser, [], true),
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
          executionMode: "autonomous-read",
        },
        threadId: agentThreadId,
        cliPath: initialSettings.codexCliPath,
        onRunChange: updateAssistantRun,
        onThreadId: updateAgentThreadId,
      });
      currentRun = response.run;
      if (response.run.status === "cancelled") {
        const cancelledMessage: WechatThemeAssistantMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "已取消本次主题调整。",
          run: response.run,
        };
        const nextMessages = [...conversationWithUser, cancelledMessage];
        const nextConversations = finalizeConversations(nextMessages);
        const store = await saveWechatThemeConversations(editableTheme.id, nextConversations, conversationId);
        setData((current) => (current ? { ...current, store } : current));
        setConversations(nextConversations);
        return;
      }
      if (response.run.status === "error") throw new Error(response.run.error || "主题 AI 运行失败。");
      if (!response.output.trim()) throw new Error("AI 没有返回主题修改结果。");
      if (
        !isWechatThemeChangeRequestCurrent(editableTheme, {
          id: activeThemeIdRef.current,
          updatedAt: activeThemeUpdatedAtRef.current,
        })
      ) {
        throw new Error("当前主题已切换或修改，已忽略过期的 AI 返回结果。");
      }
      const change = parseWechatThemeChange(response.output, editableTheme);
      await savePersonalWechatTheme(change.theme);
      const assistantMessage: WechatThemeAssistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: change.message,
        run: response.run,
      };
      const nextMessages = [...conversationWithUser, assistantMessage];
      const nextConversations = finalizeConversations(nextMessages);
      const store = await saveWechatThemeConversations(change.theme.id, nextConversations, conversationId);
      setData((current) => (current ? { ...current, store } : current));
      selectThemeId(change.theme.id);
      setConversations(nextConversations);
      setStatus(`已自动保存「${change.theme.name}」`);
    } catch (cause) {
      const failure = errorMessage(cause);
      const errorMessageItem: WechatThemeAssistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: `这次没有应用主题修改：${failure}`,
        run: {
          ...currentRun,
          status: "error",
          error: failure,
        },
        error: true,
      };
      const nextMessages = [...conversationWithUser, errorMessageItem];
      const nextConversations = finalizeConversations(nextMessages);
      setConversations(nextConversations);
      if (editableTheme?.kind === "personal") {
        try {
          const store = await saveWechatThemeConversations(editableTheme.id, nextConversations, conversationId);
          setData((current) => (current ? { ...current, store } : current));
        } catch {
          // Keep the visible error even if conversation persistence also fails.
        }
      }
    } finally {
      setAssistantBusy(false);
    }
  }

  function changeAgentModel(value: string) {
    setAgentModel(value);
    saveAgentSettings({ agentModel: value });
  }

  function changeReasoningEffort(value: string) {
    setAgentReasoningEffort(value);
    saveAgentSettings({ agentReasoningEffort: value });
  }

  function changeQuickMode(enabled: boolean) {
    setAgentQuickMode(enabled);
    saveAgentSettings({ agentQuickMode: enabled });
  }

  function closeWindow() {
    void getCurrentWindow().close();
  }

  function minimizeWindow() {
    void getCurrentWindow().minimize();
  }

  function toggleMaximizeWindow() {
    void getCurrentWindow().toggleMaximize();
  }

  if (!data || !activeProject || !activeSheet) {
    return (
      <div
        className="loby-window flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground"
        data-app-theme={resolvedAppTheme}
      >
        {status || "写作库中还没有可预览的文章。"}
      </div>
    );
  }

  return (
    <div
      className="loby-window flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      data-app-theme={resolvedAppTheme}
    >
      <WechatThemeStudioHeader
        theme={theme}
        favoriteThemes={favoriteThemes}
        personalThemes={data.store.themes}
        favoriteThemeIds={data.store.preferences.favoriteThemeIds}
        defaultThemeId={data.store.preferences.defaultThemeId}
        undoCount={undoCount}
        redoCount={redoCount}
        previewHtml={result?.html}
        previewBusy={previewBusy}
        assistantBusy={assistantBusy}
        manualSaveState={manualSaveState}
        onClose={closeWindow}
        onMinimize={minimizeWindow}
        onToggleMaximize={toggleMaximizeWindow}
        onSelectTheme={selectThemeId}
        onToggleFavorite={(targetTheme) => void toggleFavoriteTheme(targetTheme)}
        onSetDefault={(targetTheme) => void setDefaultTheme(targetTheme)}
        onDuplicate={(targetTheme) => void duplicateTheme(targetTheme)}
        onExport={(targetTheme) => void exportTheme(targetTheme)}
        onRename={beginRenameTheme}
        onDelete={beginDeleteTheme}
        onImport={() => void importTheme()}
        onUndo={() => void undoTheme()}
        onRedo={() => void redoTheme()}
        onSave={() => void saveTheme()}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(440px,1fr)_minmax(330px,400px)]">
        <WechatThemeLeftRail
          view={leftRailView}
          onViewChange={setLeftRailView}
          projects={data.projects}
          activeSheetId={activeSheet.id}
          search={search}
          onSearchChange={setSearch}
          onSelect={selectArticle}
          baseStyle={theme.baseStyle}
          onBaseStyleChange={(change, commit) => void changeBaseStyle(change, commit)}
        />
        <WechatThemePreview
          result={result}
          theme={theme}
          busy={previewBusy}
          error={previewError}
          viewport={previewViewport}
          onViewportChange={setPreviewViewport}
        />
        <WechatThemeAssistantPanel
          messages={messages}
          conversations={conversations}
          activeConversationId={activeConversation?.id ?? ""}
          busy={assistantBusy}
          modelCatalog={modelCatalog}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          agentQuickMode={agentQuickMode}
          onModelChange={changeAgentModel}
          onReasoningEffortChange={changeReasoningEffort}
          onQuickModeChange={changeQuickMode}
          onSend={sendThemePrompt}
          onCancel={activeAssistantRequestId ? cancelThemeAgent : undefined}
          onSelectConversation={selectAssistantConversation}
          onCreateConversation={createAssistantConversation}
          onDeleteConversation={deleteAssistantConversation}
          onRenameConversation={renameAssistantConversation}
        />
      </div>

      <WechatThemeStudioDialogs
        renameOpen={renameOpen}
        renameDraft={renameDraft}
        deleteOpen={deleteOpen}
        targetThemeName={themeActionTarget?.name ?? ""}
        onRenameOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setThemeActionTargetId("");
        }}
        onRenameDraftChange={setRenameDraft}
        onRename={() => void renameTheme()}
        onDeleteOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setThemeActionTargetId("");
        }}
        onDelete={() => void deleteTheme()}
      />
    </div>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
