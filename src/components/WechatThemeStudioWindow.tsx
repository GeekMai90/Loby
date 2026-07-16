import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, ChevronDown, Copy, MoreHorizontal, Pencil, Redo2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadAgentSettings, saveAgentSettings } from "../lib/agentSettings";
import { listCodexModels, runAgentChat } from "../lib/codex";
import { loadProjects } from "../lib/persistence";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import { parseWechatThemeChange } from "../lib/publishing/wechatThemeChange";
import { buildWechatThemeSkillContext } from "../lib/publishing/wechatThemeSkill";
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
  WECHAT_SELECTED_THEME_STORAGE_KEY,
} from "../lib/publishing/wechatThemeStore";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { useAppTheme } from "../hooks/useAppTheme";
import type { CodexModelCatalog, WritingProject, WritingSheet } from "../types";
import { WechatThemeArticleRail } from "./WechatThemeArticleRail";
import { WechatThemeAssistantPanel, type WechatThemeAssistantMessage } from "./WechatThemeAssistantPanel";
import { WechatThemePreview } from "./WechatThemePreview";
import { WindowControls } from "./WindowControls";

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
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [zoom, setZoom] = useState(0.9);
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

  const selectThemeId = useCallback((nextThemeId: string) => {
    activeThemeIdRef.current = nextThemeId;
    setThemeId(nextThemeId);
  }, []);

  const loadStudioData = useCallback(async () => {
    try {
      const session = await getWechatThemeStudioSession();
      const [loaded, store] = await Promise.all([loadProjects(session.libraryPath), loadWechatThemeStore()]);
      setData({ session, projects: loaded.projects, store });
      const selected = resolveInitialSelection(loaded.projects, session.activeProjectId, session.activeSheetId);
      setActiveProjectId(selected.projectId);
      setActiveSheetId(selected.sheetId);
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
  const activeProject = data?.projects.find((project) => project.id === activeProjectId) ?? data?.projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const undoCount = data?.store.revisions[theme.id]?.length ?? 0;
  const redoCount = data?.store.redos[theme.id]?.length ?? 0;

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

  async function duplicateTheme() {
    try {
      const personal = createPersonalWechatTheme(theme);
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
    if (theme.kind !== "personal") return;
    try {
      const fallbackId = theme.baseThemeId || DEFAULT_WECHAT_THEME_ID;
      const store = await deletePersonalWechatTheme(theme.id);
      setData((current) => (current ? { ...current, store } : current));
      selectThemeId(fallbackId);
      setMessages([]);
      setStatus(`已删除个人主题「${theme.name}」`);
    } catch (cause) {
      setStatus(`删除失败：${errorMessage(cause)}`);
    }
  }

  function beginRenameTheme() {
    if (theme.kind !== "personal") return;
    setRenameDraft(theme.name);
    setRenameOpen(true);
  }

  async function renameTheme() {
    const name = renameDraft.trim();
    if (theme.kind !== "personal" || !name) return;
    try {
      const renamed = { ...theme, name, updatedAt: new Date().toISOString() };
      const store = await savePersonalWechatTheme(renamed);
      setData((current) => (current ? { ...current, store } : current));
      setRenameOpen(false);
      setStatus(`已重命名为「${name}」`);
    } catch (cause) {
      setStatus(`重命名失败：${errorMessage(cause)}`);
    }
  }

  function useTheme() {
    localStorage.setItem(WECHAT_SELECTED_THEME_STORAGE_KEY, theme.id);
    setStatus(`已将「${theme.name}」设为公众号排版主题`);
  }

  async function sendThemePrompt(prompt: string) {
    if (assistantBusy || !data || !activeProject || !activeSheet) return;
    const userMessage: WechatThemeAssistantMessage = { id: createMessageId(), role: "user", content: prompt };
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
        prompt,
        context,
        runtime: {
          model: agentModel,
          reasoningEffort: agentReasoningEffort,
          quickMode: agentQuickMode,
        },
        cliPath: initialSettings.codexCliPath,
      });
      if (!response.output.trim()) throw new Error(response.error || "AI 没有返回主题修改结果。");
      if (activeThemeIdRef.current !== editableTheme.id) throw new Error("当前主题已切换，已忽略旧主题的 AI 返回结果。");
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
        <div className="min-w-0" data-tauri-drag-region>
          <strong className="block truncate text-sm font-medium">公众号主题工作室</strong>
          <small className="block truncate text-[10px] text-muted-foreground">{activeSheet.title}</small>
        </div>
        <div className="min-w-0 flex-1" data-tauri-drag-region />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-56 gap-2 bg-background/80" data-no-window-drag>
              <ThemeSwatches theme={theme} />
              <span className="truncate">{theme.name}</span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-66">
            <DropdownMenuLabel>内置主题</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme.id} onValueChange={selectThemeId}>
              {WECHAT_THEMES.map((item) => (
                <ThemeMenuItem key={item.id} theme={item} />
              ))}
              {data.store.themes.length > 0 && <DropdownMenuSeparator />}
              {data.store.themes.length > 0 && <DropdownMenuLabel>我的主题</DropdownMenuLabel>}
              {data.store.themes.map((item) => (
                <ThemeMenuItem key={item.id} theme={item} />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="outline" size="sm" onClick={duplicateTheme} data-no-window-drag>
          <Copy /> {theme.kind === "built-in" ? "新建个人主题" : "复制主题"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" disabled={theme.kind !== "personal"} data-no-window-drag>
              <MoreHorizontal />
              <span className="sr-only">管理当前主题</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={beginRenameTheme}>
              <Pencil /> 重命名
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 /> 删除主题
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={theme.kind !== "personal" || undoCount === 0}
          onClick={undoTheme}
          title={undoCount > 0 ? `撤销上一次主题修改（还有 ${undoCount} 步）` : "没有可撤销的修改"}
          data-no-window-drag
        >
          <RotateCcw />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={theme.kind !== "personal" || redoCount === 0}
          onClick={redoTheme}
          title={redoCount > 0 ? `重做主题修改（还有 ${redoCount} 步）` : "没有可重做的修改"}
          data-no-window-drag
        >
          <Redo2 />
        </Button>
        <Button type="button" size="sm" onClick={useTheme} data-no-window-drag>
          <Check /> 使用此主题
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(440px,1fr)_330px]">
        <WechatThemeArticleRail
          projects={data.projects}
          activeSheetId={activeSheet.id}
          search={search}
          onSearchChange={setSearch}
          onSelect={selectArticle}
        />
        <WechatThemePreview result={result} theme={theme} busy={previewBusy} error={previewError} zoom={zoom} onZoomChange={setZoom} />
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

      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-background px-3 text-[10px] text-muted-foreground">
        <span>
          {status || (theme.kind === "built-in" ? "内置主题只读；发送第一条 AI 修改后会自动创建个人副本。" : "修改会自动保存到个人主题。")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-3" /> 实时预览
        </span>
      </footer>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{theme.name}」？</AlertDialogTitle>
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

function ThemeMenuItem({ theme }: { theme: WechatThemeManifest }) {
  return (
    <DropdownMenuRadioItem value={theme.id} className="gap-2">
      <ThemeSwatches theme={theme} />
      <span className="min-w-0 flex-1 truncate">{theme.name}</span>
    </DropdownMenuRadioItem>
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

function resolveInitialSelection(projects: WritingProject[], projectId: string, sheetId: string) {
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const sheet = project?.sheets.find((item) => item.id === sheetId) ?? project?.sheets[0];
  return { projectId: project?.id ?? "", sheetId: sheet?.id ?? "" };
}

function createMessageId() {
  return `theme-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
