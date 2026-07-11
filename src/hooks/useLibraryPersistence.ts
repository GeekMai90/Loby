import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { Window } from "@tauri-apps/api/window";
import { loadAgentSettings, saveAgentSettings } from "../lib/agentSettings";
import { createWelcomeConversation } from "../lib/conversations";
import { LatestTaskQueue } from "../lib/latestTaskQueue";
import {
  chooseLibraryFolder,
  loadConversations,
  loadProjects,
  openLocalPath,
  rebuildProjectIndex,
  saveProjects,
  watchLibrary,
} from "../lib/persistence";
import {
  getNotesProject,
  isNotesProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
} from "../lib/projectModel";
import type { ChatConversation, SidebarMode, WritingProject } from "../types";

interface LibraryFileChangePayload {
  paths: string[];
  kind: string;
}

interface LibrarySaveRequest {
  projects: WritingProject[];
  libraryPath?: string;
}

const LIBRARY_SAVE_DEBOUNCE_MS = 500;

interface UseLibraryPersistenceOptions {
  appWindow: Window | null;
  projects: WritingProject[];
  activeProjectId: string;
  activeSheetId: string;
  activeGroupId: string;
  activeNoteGroupId: string;
  sidebarMode: SidebarMode;
  onProjectsChange: (projects: WritingProject[]) => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onActiveNoteGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onSheetSearchChange: (search: string) => void;
}

export function useLibraryPersistence({
  appWindow,
  projects,
  activeProjectId,
  activeSheetId,
  activeGroupId,
  activeNoteGroupId,
  sidebarMode,
  onProjectsChange,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveGroupChange,
  onActiveNoteGroupChange,
  onSidebarModeChange,
  onSheetSearchChange,
}: UseLibraryPersistenceOptions) {
  const [libraryPath, setLibraryPath] = useState("Loading library");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [loadedConversations, setLoadedConversations] = useState<ChatConversation[] | null>(null);
  const skipNextLibrarySaveRef = useRef(false);
  const ignoreFileEventsUntilRef = useRef(0);
  const fileRefreshTimerRef = useRef<number | null>(null);
  const rebuildLibraryIndexRef = useRef<() => void>(() => {});
  const refreshLibraryFromExternalChangeRef = useRef<(paths: string[]) => void>(() => {});
  const saveQueueRef = useRef<LatestTaskQueue<LibrarySaveRequest> | null>(null);

  if (saveQueueRef.current === null) {
    saveQueueRef.current = new LatestTaskQueue<LibrarySaveRequest>({
      delayMs: LIBRARY_SAVE_DEBOUNCE_MS,
      run: async (request) => {
        ignoreFileEventsUntilRef.current = Date.now() + 1200;
        const savedPath = await saveProjects(request.projects, request.libraryPath);
        setLibraryPath(savedPath);
        if (savedPath.startsWith("/")) saveAgentSettings({ libraryPath: savedPath });
      },
      onError: () => {
        setLibraryStatus("写作库保存失败");
      },
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialState() {
      try {
        const savedSettings = loadAgentSettings();
        const savedLibraryPath = savedSettings.libraryPath;
        const loaded = await loadProjects(savedLibraryPath || undefined);
        if (cancelled) return;
        const normalizedProjects = normalizeProjects(loaded.projects);
        const restoredSelection = resolveSavedProjectSelection(
          normalizedProjects,
          savedSettings.activeProjectId,
          savedSettings.activeSheetId,
        );
        onProjectsChange(normalizedProjects);
        onActiveProjectChange(restoredSelection.projectId);
        onActiveSheetChange(restoredSelection.sheetId);
        setLibraryPath(loaded.libraryPath);
        const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
        if (cancelled) return;
        setLoadedConversations(conversations);
        setLibraryStatus(savedLibraryPath ? "已恢复上次使用的写作库" : "");
      } catch {
        if (cancelled) return;
        setLibraryPath("Browser localStorage");
        setLibraryStatus("桌面写作库加载失败，已回退到浏览器本地存储");
      } finally {
        if (!cancelled) setPersistenceReady(true);
      }
    }

    loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [onActiveProjectChange, onActiveSheetChange, onProjectsChange]);

  useEffect(() => {
    if (!persistenceReady) return;
    if (skipNextLibrarySaveRef.current) {
      skipNextLibrarySaveRef.current = false;
      return;
    }
    saveQueueRef.current?.schedule({
      projects,
      libraryPath: libraryPath.startsWith("/") ? libraryPath : undefined,
    });
  }, [projects, persistenceReady, libraryPath]);

  useEffect(
    () => () => {
      void saveQueueRef.current?.flush();
    },
    [],
  );

  useEffect(() => {
    if (!persistenceReady || !libraryPath.startsWith("/")) return;
    watchLibrary(libraryPath).catch(() => {
      setLibraryStatus("写作库文件监听启动失败");
    });
  }, [libraryPath, persistenceReady]);

  useEffect(() => {
    if (!persistenceReady) return;
    saveAgentSettings({ activeProjectId, activeSheetId });
  }, [activeProjectId, activeSheetId, persistenceReady]);

  useEffect(() => {
    if (!appWindow) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("nibva://rebuild-index", () => {
      void rebuildLibraryIndexRef.current();
    }).then((handler) => {
      if (disposed) {
        handler();
      } else {
        unlisten = handler;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow]);

  useEffect(() => {
    if (!appWindow) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<LibraryFileChangePayload>("nibva://library-files-changed", (event) => {
      if (Date.now() < ignoreFileEventsUntilRef.current) return;
      if (fileRefreshTimerRef.current !== null) {
        window.clearTimeout(fileRefreshTimerRef.current);
      }
      fileRefreshTimerRef.current = window.setTimeout(() => {
        fileRefreshTimerRef.current = null;
        void refreshLibraryFromExternalChangeRef.current(event.payload.paths);
      }, 350);
    }).then((handler) => {
      if (disposed) {
        handler();
      } else {
        unlisten = handler;
      }
    });

    return () => {
      disposed = true;
      if (fileRefreshTimerRef.current !== null) {
        window.clearTimeout(fileRefreshTimerRef.current);
        fileRefreshTimerRef.current = null;
      }
      unlisten?.();
    };
  }, [appWindow]);

  rebuildLibraryIndexRef.current = rebuildLibraryIndex;
  refreshLibraryFromExternalChangeRef.current = refreshLibraryFromExternalChange;

  function skipNextLibrarySave() {
    skipNextLibrarySaveRef.current = true;
  }

  async function switchLibrary() {
    const selectedPath = await chooseLibraryFolder();
    if (!selectedPath) return;
    setLibraryStatus("正在切换写作库...");
    setPersistenceReady(false);
    try {
      await saveQueueRef.current?.flush();
      const loaded = await loadProjects(selectedPath);
      const normalizedProjects = normalizeProjects(loaded.projects);
      const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
      onProjectsChange(normalizedProjects);
      onActiveProjectChange(restoredSelection.projectId);
      onActiveSheetChange(restoredSelection.sheetId);
      setLoadedConversations(conversations);
      setLibraryPath(loaded.libraryPath);
      setLibraryStatus(loaded.projects.length === 0 ? "已切换到空写作库，可以创建第一个项目。" : "已切换写作库。");
      saveAgentSettings({ libraryPath: loaded.libraryPath });
    } catch {
      setLibraryStatus("切换写作库失败，当前写作库未改变");
    } finally {
      setPersistenceReady(true);
    }
  }

  async function openCurrentLibrary() {
    if (!libraryPath.startsWith("/")) {
      setLibraryStatus("当前不是桌面本地写作库，无法打开文件夹");
      return;
    }
    try {
      await openLocalPath(libraryPath);
      setLibraryStatus("已在系统文件管理器中打开当前写作库");
    } catch {
      setLibraryStatus("打开当前写作库失败");
    }
  }

  async function rebuildLibraryIndex() {
    if (!libraryPath.startsWith("/")) {
      setLibraryStatus("当前不是桌面本地写作库，无法重建索引");
      return;
    }

    setLibraryStatus("正在重建索引...");
    try {
      await saveQueueRef.current?.flush();
      const indexedProjects = await rebuildProjectIndex(libraryPath);
      const normalizedProjects = normalizeProjects(indexedProjects);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, activeProjectId, activeSheetId);
      const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === restoredSelection.sheetId);

      skipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      onActiveProjectChange(restoredSelection.projectId);
      onActiveSheetChange(restoredSelection.sheetId);
      onActiveGroupChange(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSheet?.id ?? "") : "");
      if (sidebarMode === "project" && (!restoredProject || isNotesProject(restoredProject))) {
        onSidebarModeChange("library");
      }
      onSheetSearchChange("");
      setLibraryStatus("已重建索引");
    } catch (error) {
      setLibraryStatus(`重建索引失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function refreshLibraryFromExternalChange(paths: string[]) {
    if (!libraryPath.startsWith("/")) return;

    try {
      const indexedProjects = await rebuildProjectIndex(libraryPath);
      const normalizedProjects = normalizeProjects(indexedProjects);
      const activeProjectStillExists = normalizedProjects.find((project) => project.id === activeProjectId);
      const activeSheetStillExists = activeProjectStillExists?.sheets.find((sheet) => sheet.id === activeSheetId);
      const activeGroupStillExists = activeProjectStillExists?.groups?.some((group) => group.id === activeGroupId);
      const activeNoteGroupStillExists = getNotesProject(normalizedProjects)?.groups?.some((group) => group.id === activeNoteGroupId);

      skipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      if (activeProjectStillExists) {
        onActiveProjectChange(activeProjectStillExists.id);
        onActiveSheetChange(activeSheetStillExists?.id ?? "");
        onActiveGroupChange(
          activeGroupStillExists ? activeGroupId : resolveProjectGroupId(activeProjectStillExists, "", activeSheetStillExists?.id ?? ""),
        );
      } else {
        const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
        const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
        onActiveProjectChange(restoredSelection.projectId);
        onActiveSheetChange(restoredSelection.sheetId);
        onActiveGroupChange(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSelection.sheetId) : "");
        onSidebarModeChange("library");
      }
      if (activeNoteGroupId && !activeNoteGroupStillExists) {
        onActiveNoteGroupChange("");
      }
      setLibraryStatus(paths.length > 1 ? "已同步外部文件改动" : "已同步外部文件改动");
    } catch (error) {
      setLibraryStatus(`同步外部文件改动失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    libraryPath,
    libraryStatus,
    persistenceReady,
    loadedConversations,
    setLibraryStatus,
    skipNextLibrarySave,
    switchLibrary,
    openCurrentLibrary,
    rebuildLibraryIndex,
  };
}
