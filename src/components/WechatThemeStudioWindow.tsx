import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, ChevronDown, Copy, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadAgentSettings } from "../lib/agentSettings";
import { loadProjects } from "../lib/persistence";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import {
  createPersonalWechatTheme,
  getWechatThemeStudioSession,
  loadWechatThemeStore,
  savePersonalWechatTheme,
  undoPersonalWechatTheme,
  type WechatThemeStoreSnapshot,
  type WechatThemeStudioSession,
  WECHAT_SELECTED_THEME_STORAGE_KEY,
} from "../lib/publishing/wechatThemeStore";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { useAppTheme } from "../hooks/useAppTheme";
import type { WritingProject, WritingSheet } from "../types";
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
  const resolvedAppTheme = useAppTheme(loadAgentSettings().appTheme);
  const [data, setData] = useState<StudioData | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeSheetId, setActiveSheetId] = useState("");
  const [themeId, setThemeId] = useState(DEFAULT_WECHAT_THEME_ID as string);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState("正在加载主题工作室…");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [messages, setMessages] = useState<WechatThemeAssistantMessage[]>([]);

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
      setThemeId(nextThemeId);
      setStatus("");
    } catch (cause) {
      setStatus(`主题工作室加载失败：${errorMessage(cause)}`);
    }
  }, []);

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

  const themes = useMemo(() => [...WECHAT_THEMES, ...(data?.store.themes ?? [])], [data?.store.themes]);
  const theme = themes.find((item) => item.id === themeId) ?? getWechatTheme(DEFAULT_WECHAT_THEME_ID);
  const activeProject = data?.projects.find((project) => project.id === activeProjectId) ?? data?.projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const undoCount = data?.store.revisions[theme.id]?.length ?? 0;

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
      setThemeId(personal.id);
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

  async function useTheme() {
    localStorage.setItem(WECHAT_SELECTED_THEME_STORAGE_KEY, theme.id);
    await emit("nibva://wechat-theme-selected", { themeId: theme.id });
    setStatus(`已将「${theme.name}」设为公众号排版主题`);
  }

  async function sendThemePrompt(prompt: string) {
    const userMessage: WechatThemeAssistantMessage = { id: createMessageId(), role: "user", content: prompt };
    setMessages((current) => [...current, userMessage]);
    setAssistantBusy(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: "主题 AI 协议正在接入，当前这条指令尚未修改主题。",
          error: true,
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
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
            <DropdownMenuRadioGroup value={theme.id} onValueChange={setThemeId}>
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={theme.kind !== "personal" || undoCount === 0}
          onClick={undoTheme}
          data-no-window-drag
        >
          <RotateCcw /> 撤销{undoCount > 0 ? ` ${undoCount}` : ""}
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
        <WechatThemeAssistantPanel messages={messages} busy={assistantBusy} onSend={sendThemePrompt} />
      </div>

      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-background px-3 text-[10px] text-muted-foreground">
        <span>
          {status || (theme.kind === "built-in" ? "内置主题只读；发送第一条 AI 修改后会自动创建个人副本。" : "修改会自动保存到个人主题。")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-3" /> 实时预览
        </span>
      </footer>
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
