import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorSelectionToolbar } from "./EditorSelectionToolbar";
import { WindowControls } from "./WindowControls";
import { ZenModeControlMenu } from "./ZenModeControlMenu";
import { nowTimestamp } from "../lib/dates";
import { createEditorCoreExtensions } from "../lib/editorCoreExtensions";
import { insertImageReferenceBlocks } from "../lib/editorInsertions";
import { applyEditorMarkdownFormat, type MarkdownFormat } from "../lib/editorMarkdown";
import { resolveEditorSelectionToolbarPosition, type EditorSelectionToolbarPosition } from "../lib/editorSelectionToolbarPosition";
import { createEditorTypographyStyle } from "../lib/editorTypography";
import { useLatestCallback } from "../hooks/useLatestCallback";
import {
  createImageReference,
  getPreferredImageFilename,
  isImageFile,
  resolveProjectImageSourcePath,
  resolveInsertedImagePath,
  resolveSheetImageSourcePath,
  stripExtension,
} from "../lib/imageAssets";
import { extractFirstHeadingTitle } from "../lib/markdownTitle";
import { LatestTaskQueue } from "../lib/latestTaskQueue";
import { importProjectImages, openLocalPath, saveLocalImageAs, saveProjectImage } from "../lib/persistence";
import { safeVisiblePathSegment } from "../lib/projectModel";
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

interface ZenSelectionSnapshot {
  from: number;
  to: number;
  position: EditorSelectionToolbarPosition;
}

const ZEN_EDITOR_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  drawSelection: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
} as const;

export function ZenModeWindow() {
  const [session, setSession] = useState<ZenModeSession | null>(() => loadZenModeSession());
  const [body, setBody] = useState(() => session?.sheet.body ?? "");
  const [preferences, setPreferences] = useState<ZenModePreferences>(() => loadZenModePreferences());
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowExpanded, setWindowExpanded] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [selectionSnapshot, setSelectionSnapshot] = useState<ZenSelectionSnapshot | null>(null);
  const sessionRef = useRef(session);
  const lastSavedBodyRef = useRef(session?.sheet.body ?? "");
  const saveFailedRef = useRef(false);
  const exitPendingRef = useRef(false);
  const handleExitRef = useRef<() => Promise<void>>(async () => undefined);
  const soundscapeRef = useRef(new ZenSoundscape());
  const writingPanelRef = useRef<HTMLElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const saveQueueRef = useRef<LatestTaskQueue<ZenSaveRequest> | null>(null);
  const appWindow = useMemo(() => ("__TAURI_INTERNALS__" in window ? getCurrentWindow() : null), []);
  const handleImportImages = useLatestCallback(importImages);
  const handleResolveImagePreview = useLatestCallback(resolveImagePreview);
  const handleOpenImage = useLatestCallback(openImage);
  const handleSaveImageAs = useLatestCallback(saveImageAs);
  const handleInsertImagesFromPicker = useLatestCallback(insertImagesFromPicker);
  const handleEditorViewUpdate = useLatestCallback(handleEditorUpdate);
  const editorExtensions = useMemo(
    () =>
      createEditorCoreExtensions({
        onImportImageFiles: handleImportImages,
        onResolveImagePreview: handleResolveImagePreview,
        onOpenImage: handleOpenImage,
        onSaveImageAs: handleSaveImageAs,
        onInsertImage: () => void handleInsertImagesFromPicker(),
        onUpdate: (update) => {
          if (!update.selectionSet && !update.docChanged && !update.viewportChanged) return;
          handleEditorViewUpdate(update.view, update.selectionSet, update.docChanged);
        },
      }),
    [
      handleEditorViewUpdate,
      handleImportImages,
      handleInsertImagesFromPicker,
      handleOpenImage,
      handleResolveImagePreview,
      handleSaveImageAs,
    ],
  );

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
      if (event.key !== "Escape" || event.defaultPrevented || menuOpen || event.isComposing) return;
      event.preventDefault();
      if (selectionSnapshot) {
        setSelectionSnapshot(null);
        return;
      }
      void handleExit();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!selectionSnapshot) return;
    function closeSelectionToolbarFromOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const panel = writingPanelRef.current;
      const toolbar = panel?.querySelector(".editor-selection-toolbar");
      const editor = panel?.querySelector(".zen-editor");
      if (toolbar?.contains(target) || editor?.contains(target)) return;
      setSelectionSnapshot(null);
    }
    window.addEventListener("pointerdown", closeSelectionToolbarFromOutside);
    return () => window.removeEventListener("pointerdown", closeSelectionToolbarFromOutside);
  }, [selectionSnapshot]);

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

  const editorStyle = useMemo(() => (session ? createEditorTypographyStyle(session.typography) : undefined), [session]);

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

  async function importImages(files: File[]): Promise<string[]> {
    const activeSession = sessionRef.current;
    const project = activeSession?.project;
    if (!activeSession || !project || !activeSession.libraryPath.startsWith("/")) return [];
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return [];
    try {
      const references: string[] = [];
      for (const file of imageFiles) {
        const buffer = await file.arrayBuffer();
        const imported = await saveProjectImage(
          activeSession.libraryPath,
          project,
          getPreferredImageFilename(file, `image-${Date.now()}`),
          Array.from(new Uint8Array(buffer)),
        );
        const referencePath = resolveInsertedImagePath(
          imported.path,
          activeSession.libraryPath,
          project,
          activeSession.sheet,
          activeSession.imageReferenceFormat ?? "markdown",
        );
        references.push(
          createImageReference(referencePath, stripExtension(imported.name), activeSession.imageReferenceFormat ?? "markdown"),
        );
      }
      return references;
    } catch (error) {
      window.alert(`导入图片失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async function insertImagesFromPicker() {
    const activeSession = sessionRef.current;
    const project = activeSession?.project;
    const view = editorViewRef.current;
    if (!activeSession || !project || !view || !activeSession.libraryPath.startsWith("/")) return;
    try {
      const importedImages = await importProjectImages(activeSession.libraryPath, project);
      if (importedImages.length === 0) return;
      const references = importedImages.map((image) => {
        const referencePath = resolveInsertedImagePath(
          image.path,
          activeSession.libraryPath,
          project,
          activeSession.sheet,
          activeSession.imageReferenceFormat ?? "markdown",
        );
        return createImageReference(referencePath, stripExtension(image.name), activeSession.imageReferenceFormat ?? "markdown");
      });
      const selection = view.state.selection.main;
      insertImageReferenceBlocks(view, references, selection.from, selection.to);
    } catch (error) {
      window.alert(`插入图片失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function resolveImagePreview(referencePath: string, alt: string) {
    const activeSession = sessionRef.current;
    if (!activeSession || !activeSession.libraryPath.startsWith("/")) return null;
    const sourcePath = activeSession.project
      ? resolveSheetImageSourcePath(activeSession.libraryPath, activeSession.project, activeSession.sheet, referencePath)
      : resolveProjectImageSourcePath(
          `${activeSession.libraryPath}/projects/${safeVisiblePathSegment(activeSession.projectTitle, activeSession.projectId)}`,
          referencePath,
        );
    if (!sourcePath) return null;
    return {
      src: convertFileSrc(sourcePath),
      alt,
      label: referencePath,
      sourcePath,
    };
  }

  function openImage(sourcePath: string) {
    void openLocalPath(sourcePath).catch((error) => {
      window.alert(`打开图片失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  function saveImageAs(sourcePath: string, label: string) {
    void saveLocalImageAs(sourcePath, label).catch((error) => {
      window.alert(`另存图片失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  function handleEditorUpdate(view: EditorView, selectionChanged: boolean, documentChanged: boolean) {
    if (!selectionChanged && !documentChanged) {
      if (!selectionSnapshot) return;
      const position = resolveEditorSelectionToolbarPosition(
        view,
        selectionSnapshot.from,
        selectionSnapshot.to,
        writingPanelRef.current,
        "format",
      );
      if (position) setSelectionSnapshot((current) => (current ? { ...current, position } : current));
      return;
    }

    const range = view.state.selection.main;
    if (view.compositionStarted) {
      if (selectionSnapshot) setSelectionSnapshot(null);
      return;
    }
    if (range.empty) {
      setSelectionSnapshot(null);
      return;
    }
    const position = resolveEditorSelectionToolbarPosition(view, range.from, range.to, writingPanelRef.current, "format");
    if (!position) return;
    setSelectionSnapshot({ from: range.from, to: range.to, position });
  }

  function applySelectionFormat(format: MarkdownFormat) {
    applyEditorMarkdownFormat(editorViewRef.current, format);
    setSelectionSnapshot(null);
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
        <p>没有找到当前文稿，请返回落笔后重新进入禅模式。</p>
        <button type="button" onClick={() => void exitZenModeWindow()}>
          返回落笔
        </button>
      </main>
    );
  }

  return (
    <main className="zen-editor-window-root" data-expanded={windowExpanded}>
      <section ref={writingPanelRef} className="zen-writing-panel" aria-label={`禅模式：${session.sheet.title}`} style={editorStyle}>
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
          theme="light"
          basicSetup={ZEN_EDITOR_BASIC_SETUP}
          extensions={editorExtensions}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
          }}
          onChange={setBody}
          autoFocus
        />

        {selectionSnapshot && (
          <EditorSelectionToolbar
            position={selectionSnapshot.position}
            session={{ status: "ready" }}
            handoffDone={false}
            formatOnly
            onFormat={applySelectionFormat}
            onSubmit={() => undefined}
            onCancel={() => undefined}
            onClose={() => setSelectionSnapshot(null)}
            onCopyAnswer={() => undefined}
            onHandoff={() => undefined}
            onRejectEdit={() => undefined}
            onAcceptEdit={() => undefined}
          />
        )}

        <ZenModeControlMenu
          open={menuOpen}
          preferences={preferences}
          activeSoundLabel={activeSoundLabel}
          onOpenChange={setMenuOpen}
          onSelectBackgroundImage={() => void selectBackgroundImage()}
          onResetPreferences={resetPreferences}
          onSoundEnabledChange={setSoundEnabled}
          onSelectSound={selectSound}
          onExit={() => void handleExit()}
        />
      </section>
    </main>
  );
}
