import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, ChevronDown, Copy, MoreHorizontal, Pencil, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadAgentSettings, saveAgentSettings } from "../lib/agentSettings";
import { collectAssistantImagePaths } from "../lib/assistantImageAttachments";
import { listCodexModels, runAgentChat } from "../lib/codex";
import { loadProjects } from "../lib/persistence";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { applyWechatThemeBaseStyleChange, type WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import { resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import { isWechatThemeChangeRequestCurrent, parseWechatThemeChange } from "../lib/publishing/wechatThemeChange";
import { buildWechatThemeSkillContext } from "../lib/publishing/wechatThemeSkill";
import { getWechatThemeMenuActions } from "../lib/publishing/wechatThemeMenu";
import type { WechatThemePreviewViewport } from "../lib/publishing/wechatThemePreviewModel";
import {
  WECHAT_THEME_SAMPLE_PROJECT_ID,
  WECHAT_THEME_SAMPLE_SHEET_ID,
  withWechatThemeSampleArticle,
} from "../lib/publishing/wechatThemeSampleArticle";
import {
  createPersonalWechatTheme,
  deletePersonalWechatTheme,
  getWechatThemeStudioSession,
  loadWechatThemeStore,
  redoPersonalWechatTheme,
  savePersonalWechatTheme,
  saveWechatThemeConversation,
  undoPersonalWechatTheme,
  type WechatThemeStoreSnapshot,
  type WechatThemeStudioSession,
} from "../lib/publishing/wechatThemeStore";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { useAppTheme } from "../hooks/useAppTheme";
import type { AiImageAttachment, CodexModelCatalog, WritingProject, WritingSheet } from "../types";
import { WechatThemeAssistantPanel, type WechatThemeAssistantMessage } from "./WechatThemeAssistantPanel";
import { WechatThemeLeftRail, type WechatThemeLeftRailView } from "./WechatThemeLeftRail";
import { WechatThemePreview } from "./WechatThemePreview";
import { WindowControls } from "./WindowControls";

interface StudioData {
  session: WechatThemeStudioSession;
  projects: WritingProject[];
  store: WechatThemeStoreSnapshot;
}

type ManualSaveState = "idle" | "saving" | "saved" | "error";

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
  const [zoom, setZoom] = useState(0.9);
  const [previewViewport, setPreviewViewport] = useState<WechatThemePreviewViewport>("mobile");
  const [status, setStatus] = useState("正在加载主题工作室…");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [messages, setMessages] = useState<WechatThemeAssistantMessage[]>([]);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalog | null>(null);
  const [agentModel, setAgentModel] = useState(initialSettings.agentModel);
  const [agentReasoningEffort, setAgentReasoningEffort] = useState(initialSettings.agentReasoningEffort);
  const [agentQuickMode, setAgentQuickMode] = useState(initialSettings.agentQuickMode);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [themeActionTargetId, setThemeActionTargetId] = useState("");
  const [manualSaveState, setManualSaveState] = useState<ManualSaveState>("idle");
  const manualSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThemeRef = useRef<WechatThemeManifest | null>(null);
  const personalThemeCreationRef = useRef<Promise<WechatThemeManifest> | null>(null);

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
    listen("nibva://wechat-theme-studio-session-changed", () => void loadStudioData()).then((handler) => {
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
  activeThemeRef.current = theme;
  const themeActionTarget = themes.find((item) => item.id === themeActionTargetId) ?? null;
  activeThemeUpdatedAtRef.current = theme.updatedAt;
  const activeProject = data?.projects.find((project) => project.id === activeProjectId) ?? data?.projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const undoCount = data?.store.revisions[theme.id]?.length ?? 0;
  const redoCount = data?.store.redos[theme.id]?.length ?? 0;

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
    setMessages(data.store.conversations[themeId] ?? []);
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
      summary: activeSheet.summary || activeProject.writingBrief?.thesis || "",
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
      const fallbackId = deletedTheme.baseThemeId || DEFAULT_WECHAT_THEME_ID;
      const store = await deletePersonalWechatTheme(deletedTheme.id);
      setData((current) => (current ? { ...current, store } : current));
      if (theme.id === deletedTheme.id) {
        selectThemeId(fallbackId);
        setMessages([]);
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

  async function sendThemePrompt(prompt: string, images: AiImageAttachment[] = []) {
    if (assistantBusy || !data || !activeProject || !activeSheet) return;
    const modelPrompt = prompt || "请参考这些图片，为当前公众号主题调整视觉设计。";
    const userMessage: WechatThemeAssistantMessage = {
      id: createMessageId(),
      role: "user",
      content: prompt,
      images: images.length > 0 ? images : undefined,
    };
    const conversationWithUser = [...messages, userMessage];
    setMessages(conversationWithUser);
    setAssistantBusy(true);
    let editableTheme: WechatThemeManifest | null = null;
    try {
      editableTheme = theme;
      if (theme.kind === "built-in") {
        editableTheme = createPersonalWechatTheme(theme);
        await savePersonalWechatTheme(editableTheme);
        const initialStore = await saveWechatThemeConversation(editableTheme.id, conversationWithUser);
        setData((current) => (current ? { ...current, store: initialStore } : current));
        selectThemeId(editableTheme.id);
        activeThemeUpdatedAtRef.current = editableTheme.updatedAt;
      } else {
        const conversationStore = await saveWechatThemeConversation(editableTheme.id, conversationWithUser);
        setData((current) => (current ? { ...current, store: conversationStore } : current));
      }

      const context = buildWechatThemeSkillContext({
        theme: editableTheme,
        previousTheme: data.store.revisions[editableTheme.id]?.at(-1),
        project: activeProject,
        sheet: activeSheet,
        messages: conversationWithUser,
      });
      const response = await runAgentChat({
        libraryPath: data.session.libraryPath,
        provider: "codex",
        prompt: modelPrompt,
        context,
        imagePaths: collectAssistantImagePaths(conversationWithUser, [], true),
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        cliPath: initialSettings.codexCliPath,
      });
      if (!response.output.trim()) throw new Error(response.error || "AI 没有返回主题修改结果。");
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
        id: createMessageId(),
        role: "assistant",
        content: change.message,
      };
      const nextMessages = [...conversationWithUser, assistantMessage];
      const store = await saveWechatThemeConversation(change.theme.id, nextMessages);
      setData((current) => (current ? { ...current, store } : current));
      selectThemeId(change.theme.id);
      setMessages(nextMessages);
      setStatus(`已自动保存「${change.theme.name}」`);
    } catch (cause) {
      const errorMessageItem: WechatThemeAssistantMessage = {
        id: createMessageId(),
        role: "assistant",
        content: `这次没有应用主题修改：${errorMessage(cause)}`,
        error: true,
      };
      const nextMessages = [...conversationWithUser, errorMessageItem];
      setMessages(nextMessages);
      if (editableTheme?.kind === "personal") {
        try {
          const store = await saveWechatThemeConversation(editableTheme.id, nextMessages);
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
        className="nibva-window flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground"
        data-app-theme={resolvedAppTheme}
      >
        {status || "写作库中还没有可预览的文章。"}
      </div>
    );
  }

  return (
    <div
      className="nibva-window flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      data-app-theme={resolvedAppTheme}
    >
      <header
        className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/92 px-3 backdrop-blur-xl"
        data-tauri-drag-region
        onDoubleClick={toggleMaximizeWindow}
      >
        <WindowControls onClose={closeWindow} onMinimize={minimizeWindow} onToggleMaximize={toggleMaximizeWindow} />
        <strong className="min-w-0 truncate text-sm font-medium" data-tauri-drag-region>
          公众号主题编辑器
        </strong>
        <div className="min-w-0 flex-1" data-tauri-drag-region />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-56 gap-2 bg-background/80" data-no-window-drag>
              <ThemeSwatches theme={theme} />
              <span className="truncate">{theme.name}</span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>内置主题</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme.id} onValueChange={selectThemeId}>
              {WECHAT_THEMES.map((item) => (
                <ThemeMenuItem
                  key={item.id}
                  theme={item}
                  onDuplicate={duplicateTheme}
                  onRename={beginRenameTheme}
                  onDelete={beginDeleteTheme}
                />
              ))}
              {data.store.themes.length > 0 && <DropdownMenuSeparator />}
              {data.store.themes.length > 0 && <DropdownMenuLabel>我的主题</DropdownMenuLabel>}
              {data.store.themes.map((item) => (
                <ThemeMenuItem
                  key={item.id}
                  theme={item}
                  onDuplicate={duplicateTheme}
                  onRename={beginRenameTheme}
                  onDelete={beginDeleteTheme}
                />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-0.5" role="group" aria-label="主题修改历史" data-no-window-drag>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={theme.kind !== "personal" || undoCount === 0}
            onClick={undoTheme}
            title={undoCount > 0 ? `撤销上一次主题修改（还有 ${undoCount} 步）` : "没有可撤销的修改"}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={theme.kind !== "personal" || redoCount === 0}
            onClick={redoTheme}
            title={redoCount > 0 ? `重做主题修改（还有 ${redoCount} 步）` : "没有可重做的修改"}
          >
            <Redo2 />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant={manualSaveState === "error" ? "destructive" : "default"}
          disabled={theme.kind !== "personal" || assistantBusy || manualSaveState === "saving"}
          onClick={() => void saveTheme()}
          title={theme.kind === "built-in" ? "内置主题无需保存；通过 AI 修改后会自动创建个人副本" : "再次确认当前主题已经保存"}
          data-no-window-drag
        >
          {manualSaveState === "saved" ? <Check /> : <Save />}
          {manualSaveState === "saving"
            ? "保存中…"
            : manualSaveState === "saved"
              ? "已保存"
              : manualSaveState === "error"
                ? "保存失败"
                : "保存主题"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(440px,1fr)_330px]">
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
          zoom={zoom}
          onZoomChange={setZoom}
          viewport={previewViewport}
          onViewportChange={setPreviewViewport}
        />
        <WechatThemeAssistantPanel
          messages={messages}
          busy={assistantBusy}
          modelCatalog={modelCatalog}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          agentQuickMode={agentQuickMode}
          onModelChange={changeAgentModel}
          onReasoningEffortChange={changeReasoningEffort}
          onQuickModeChange={changeQuickMode}
          onSend={sendThemePrompt}
        />
      </div>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setThemeActionTargetId("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名个人主题</DialogTitle>
            <DialogDescription>名称只用于主题列表，不会进入公众号正文。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameDraft}
            maxLength={80}
            autoFocus
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void renameTheme();
            }}
          />
          <DialogFooter showCloseButton>
            <Button type="button" disabled={!renameDraft.trim()} onClick={() => void renameTheme()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setThemeActionTargetId("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{themeActionTarget?.name ?? "这个主题"}」？</AlertDialogTitle>
            <AlertDialogDescription>主题和它的修改历史、AI 对话会一起删除，文章 Markdown 不受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteTheme()}>
              删除主题
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ThemeMenuItemProps {
  theme: WechatThemeManifest;
  onDuplicate: (theme: WechatThemeManifest) => void;
  onRename: (theme: WechatThemeManifest) => void;
  onDelete: (theme: WechatThemeManifest) => void;
}

function ThemeMenuItem({ theme, onDuplicate, onRename, onDelete }: ThemeMenuItemProps) {
  const actions = getWechatThemeMenuActions(theme);
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <DropdownMenuRadioItem value={theme.id} className="min-w-0 flex-1 gap-2">
        <ThemeSwatches theme={theme} />
        <span className="min-w-0 flex-1 truncate">{theme.name}</span>
      </DropdownMenuRadioItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger showChevron={false} aria-label={`管理主题「${theme.name}」`} className="size-7 shrink-0 justify-center p-0">
          <MoreHorizontal />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-32">
          <DropdownMenuItem onSelect={() => onDuplicate(theme)}>
            <Copy /> 创建副本
          </DropdownMenuItem>
          {actions.includes("rename") && (
            <>
              <DropdownMenuItem onSelect={() => onRename(theme)}>
                <Pencil /> 重命名
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(theme)}>
                <Trash2 /> 删除主题
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </div>
  );
}

function ThemeSwatches({ theme }: { theme: WechatThemeManifest }) {
  return (
    <span className="flex size-5 shrink-0 overflow-hidden rounded-md border border-border">
      {theme.swatches.map((color) => (
        <i key={color} className="flex-1" style={{ background: color }} />
      ))}
    </span>
  );
}

function createMessageId() {
  return `theme-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
