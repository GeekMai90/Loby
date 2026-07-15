import CodeMirror from "@uiw/react-codemirror";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Image, MoonStar, Music2, Paintbrush, Power, Trees } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Switch } from "./ui/switch";
import { WindowControls } from "./WindowControls";
import { nowTimestamp } from "../lib/dates";
import { nibvaMarkdownExtensions } from "../lib/editorMarkdownLanguage";
import { extractFirstHeadingTitle } from "../lib/markdownTitle";
import { LatestTaskQueue } from "../lib/latestTaskQueue";
import {
  DEFAULT_ZEN_MODE_PREFERENCES,
  ZEN_MODE_EXIT_REQUESTED_EVENT,
  ZEN_MODE_SESSION_STORAGE_KEY,
  ZEN_SOUND_OPTIONS,
  chooseZenBackgroundImage,
  exitZenModeWindow,
  loadZenModePreferences,
  loadZenModeSession,
  markZenModeWindowReady,
  notifyZenModePreferencesChanged,
  saveZenModePreferences,
  saveZenModeSession,
  saveZenSheet,
  type ZenModePreferences,
  type ZenModeSession,
  type ZenSoundId,
} from "../lib/zenMode";
import { ZenSoundscape } from "../lib/zenSound";

interface ZenSaveRequest {
  body: string;
  title: string;
  updatedAt: string;
}

export function ZenModeWindow() {
  const [session, setSession] = useState<ZenModeSession | null>(() => loadZenModeSession());
  const [body, setBody] = useState(() => session?.sheet.body ?? "");
  const [preferences, setPreferences] = useState<ZenModePreferences>(() => loadZenModePreferences());
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowExpanded, setWindowExpanded] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const sessionRef = useRef(session);
  const lastSavedBodyRef = useRef(session?.sheet.body ?? "");
  const saveFailedRef = useRef(false);
  const exitPendingRef = useRef(false);
  const handleExitRef = useRef<() => Promise<void>>(async () => undefined);
  const soundscapeRef = useRef(new ZenSoundscape());
  const saveQueueRef = useRef<LatestTaskQueue<ZenSaveRequest> | null>(null);
  const appWindow = useMemo(() => ("__TAURI_INTERNALS__" in window ? getCurrentWindow() : null), []);

  if (saveQueueRef.current === null) {
    saveQueueRef.current = new LatestTaskQueue<ZenSaveRequest>({
      delayMs: 480,
      run: async (request) => {
        const activeSession = sessionRef.current;
        if (!activeSession || request.body === lastSavedBodyRef.current) return;
        saveFailedRef.current = false;
        setSaveState("saving");
        setSaveError("");
        const savedSheet = await saveZenSheet(activeSession, request);
        const nextSession = { ...activeSession, sheet: savedSheet };
        sessionRef.current = nextSession;
        setSession(nextSession);
        saveZenModeSession(nextSession);
        lastSavedBodyRef.current = request.body;
        setSaveState("saved");
      },
      onError: (error) => {
        saveFailedRef.current = true;
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : String(error));
      },
    });
  }

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    void markZenModeWindowReady();
  }, []);

  useEffect(() => {
    if (!session || body === lastSavedBodyRef.current) return;
    const title = extractFirstHeadingTitle(body) || session.sheet.title;
    saveQueueRef.current?.schedule({ body, title, updatedAt: nowTimestamp() });
  }, [body, session]);

  useEffect(() => {
    const soundscape = soundscapeRef.current;
    if (preferences.soundEnabled) {
      void soundscape.play(preferences.soundId).catch(() => undefined);
    } else {
      soundscape.stop();
    }
    return () => soundscape.stop();
  }, [preferences.soundEnabled, preferences.soundId]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen(ZEN_MODE_EXIT_REQUESTED_EVENT, () => void handleExitRef.current()).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || menuOpen || event.isComposing) return;
      event.preventDefault();
      void handleExit();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!appWindow) return;
    const activeWindow = appWindow;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    async function syncExpandedState() {
      const expanded = (await activeWindow.isMaximized()) || (await activeWindow.isFullscreen());
      if (!disposed) setWindowExpanded(expanded);
    }

    void syncExpandedState();
    activeWindow
      .onResized(() => void syncExpandedState())
      .then((handler) => {
        if (disposed) handler();
        else unlisten = handler;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow]);

  const editorStyle = useMemo(
    () =>
      ({
        "--zen-editor-font": resolveEditorFontFamily(session?.typography),
        "--zen-editor-line-height": String(session?.typography.lineHeight ?? 1.76),
        "--zen-editor-font-size": `${session?.typography.bodyFontSize ?? 18}px`,
      }) as CSSProperties,
    [session?.typography],
  );

  const activeSoundLabel = ZEN_SOUND_OPTIONS.find((option) => option.id === preferences.soundId)?.label ?? "细雨";

  function updatePreferences(update: Partial<ZenModePreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...update };
      saveZenModePreferences(next);
      void notifyZenModePreferencesChanged(next);
      return next;
    });
  }

  async function selectBackgroundImage() {
    const path = await chooseZenBackgroundImage();
    if (path) updatePreferences({ backgroundImagePath: path });
  }

  function resetPreferences() {
    soundscapeRef.current.stop();
    setPreferences(DEFAULT_ZEN_MODE_PREFERENCES);
    saveZenModePreferences(DEFAULT_ZEN_MODE_PREFERENCES);
    void notifyZenModePreferencesChanged(DEFAULT_ZEN_MODE_PREFERENCES);
  }

  function setSoundEnabled(enabled: boolean) {
    if (enabled) {
      void soundscapeRef.current.play(preferences.soundId).catch(() => undefined);
    } else {
      soundscapeRef.current.stop();
    }
    updatePreferences({ soundEnabled: enabled });
  }

  function selectSound(soundId: ZenSoundId) {
    if (preferences.soundEnabled) {
      void soundscapeRef.current.play(soundId).catch(() => undefined);
    }
    updatePreferences({ soundId });
  }

  async function handleExit() {
    if (exitPendingRef.current) return;
    exitPendingRef.current = true;
    await saveQueueRef.current?.flush();
    if (saveFailedRef.current) {
      exitPendingRef.current = false;
      return;
    }
    soundscapeRef.current.stop();
    try {
      await exitZenModeWindow();
      localStorage.removeItem(ZEN_MODE_SESSION_STORAGE_KEY);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
      exitPendingRef.current = false;
    }
  }

  handleExitRef.current = handleExit;

  function minimizeWindow() {
    void appWindow?.minimize();
  }

  function toggleMaximizeWindow() {
    void appWindow?.toggleMaximize();
  }

  if (!session) {
    return (
      <main className="zen-editor-window-root zen-mode-empty">
        <p>没有找到当前文稿，请返回 Nibva 后重新进入禅模式。</p>
        <button type="button" onClick={() => void exitZenModeWindow()}>
          返回 Nibva
        </button>
      </main>
    );
  }

  return (
    <main className="zen-editor-window-root" data-expanded={windowExpanded}>
      <section className="zen-writing-panel" aria-label={`禅模式：${session.sheet.title}`} style={editorStyle}>
        <header className="zen-writing-header" data-tauri-drag-region onDoubleClick={toggleMaximizeWindow}>
          <WindowControls onClose={() => void handleExit()} onMinimize={minimizeWindow} onToggleMaximize={toggleMaximizeWindow} />
          <span className="zen-document-title" data-tauri-drag-region>
            {session.sheet.title}
          </span>
          <span className="zen-save-status" data-state={saveState} title={saveError || undefined} data-tauri-drag-region>
            {saveState === "saving" ? "保存中…" : saveState === "error" ? "保存失败" : "已保存"}
          </span>
        </header>

        <CodeMirror
          className="zen-editor"
          value={body}
          height="100%"
          theme={zenEditorTheme}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            drawSelection: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={[
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            markdown({ extensions: nibvaMarkdownExtensions }),
            EditorView.lineWrapping,
          ]}
          onChange={setBody}
          autoFocus
        />

        <div className="zen-control-anchor">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="zen-control-trigger" aria-label="禅模式设置">
                <MoonStar size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="zen-control-menu w-80 p-1.5"
              side="top"
              align="start"
              sideOffset={12}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuItem className="zen-control-item" onSelect={() => void selectBackgroundImage()}>
                <Image />
                <span>背景图像</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="zen-control-item" onSelect={resetPreferences}>
                <Paintbrush />
                <span>将设置还原成默认</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="zen-control-item"
                onSelect={(event) => {
                  event.preventDefault();
                  setSoundEnabled(!preferences.soundEnabled);
                }}
              >
                <Music2 />
                <span>背景音</span>
                <Switch className="pointer-events-none ml-auto" checked={preferences.soundEnabled} tabIndex={-1} aria-hidden="true" />
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="zen-control-item">
                  <Trees />
                  <span>背景音</span>
                  <span className="ml-auto text-xs text-muted-foreground">{activeSoundLabel}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="zen-control-menu w-36 p-1.5">
                  <DropdownMenuRadioGroup value={preferences.soundId} onValueChange={(value) => selectSound(value as ZenSoundId)}>
                    {ZEN_SOUND_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.id} value={option.id} className="min-h-9 px-3">
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="zen-control-item" onSelect={() => void handleExit()}>
                <Power />
                <span>退出禅模式</span>
                <span className="ml-auto text-xs text-muted-foreground">Esc</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>
    </main>
  );
}

const zenEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "rgb(235 241 246 / 88%)",
    backgroundColor: "transparent",
    fontSize: "var(--zen-editor-font-size)",
  },
  ".cm-scroller": {
    height: "100%",
    overflow: "auto",
    fontFamily: "var(--zen-editor-font)",
    lineHeight: "var(--zen-editor-line-height)",
  },
  ".cm-content": {
    width: "min(760px, calc(100% - 112px))",
    minHeight: "100%",
    margin: "0 auto",
    padding: "28px 0 140px",
    caretColor: "#5ac8fa",
  },
  ".cm-line": {
    padding: "0 2px 5px",
  },
  ".cm-content ::selection": {
    backgroundColor: "rgb(90 200 250 / 28%)",
  },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#5ac8fa",
    borderLeftWidth: "2px",
  },
  ".cm-gutters": { display: "none" },
});

function resolveEditorFontFamily(typography: ZenModeSession["typography"] | undefined): string {
  if (!typography) return "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif";
  if (typography.fontPreset === "pingfang") return "'PingFang SC', 'SF Pro Text', sans-serif";
  if (typography.fontPreset === "songti") return "'Songti SC', 'STSong', serif";
  if (typography.fontPreset === "kaiti") return "'Kaiti SC', 'STKaiti', KaiTi, serif";
  if (typography.fontPreset === "lxgw-wenkai") return "'LXGW WenKai', 'LXGW WenKai SC', '霞鹜文楷', serif";
  if (typography.fontPreset === "huiwen-mincho") return "'Huiwen-mincho', 'Huiwen Mincho', '汇文明朝体', serif";
  if (typography.fontPreset === "mono") return "'SF Mono', 'SFMono-Regular', Menlo, monospace";
  if (typography.fontPreset === "custom" && typography.customFontFamily.trim()) return typography.customFontFamily.trim();
  return "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif";
}
