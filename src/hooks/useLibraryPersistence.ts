import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { Window } from "@tauri-apps/api/window";
import { loadAgentSettings, saveAgentSettings } from "../lib/agentSettings";
import { createWelcomeConversation } from "../lib/conversations";
import { LibrarySaveCoordinator } from "../lib/librarySaveCoordinator";
import {
  chooseLibraryMoveDestination,
  chooseLibraryFolder,
  createLibraryDirectory,
  getDefaultLibrariesPath,
  loadConversations,
  loadProjects,
  moveLibraryDirectory,
  openLocalPath,
  rebuildProjectIndex,
  revealLocalPath,
  saveProjects,
  watchLibrary,
} from "../lib/persistence";
import {
  activeWritingLibrary,
  libraryNameFromPath,
  loadWritingLibraryRegistry,
  registerWritingLibrary,
  removeWritingLibrary,
  saveWritingLibraryRegistry,
  updateWritingLibrary,
} from "../lib/libraryRegistry";
import { isNotesProject, normalizeProjects, resolveProjectGroupId, resolveSavedProjectSelection } from "../lib/projectModel";
import { libraryIndexChangePaths, type LibraryFileChangePayload } from "../lib/libraryFileChanges";
import { reconcileLibraryRefreshSelection } from "../lib/libraryRefresh";
import type { ChatConversation, SidebarMode, WritingLibrary, WritingLibraryRegistry, WritingProject } from "../types";
import { createPersistedWindowCloseHandler } from "../lib/windowClose";

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
  const [libraryRegistry, setLibraryRegistry] = useState<WritingLibraryRegistry>(() =>
    loadWritingLibraryRegistry(loadAgentSettings().libraryPath),
  );
  const [defaultLibrariesPath, setDefaultLibrariesPath] = useState("");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [loadedConversations, setLoadedConversations] = useState<ChatConversation[] | null>(null);
  const skipNextLibrarySaveRef = useRef(false);
  const ignoreFileEventsUntilRef = useRef(0);
  const fileRefreshTimerRef = useRef<number | null>(null);
  const rebuildLibraryIndexRef = useRef<() => void>(() => {});
  const refreshLibraryFromExternalChangeRef = useRef<(paths: string[]) => void>(() => {});
  const saveQueueRef = useRef<LibrarySaveCoordinator | null>(null);

  if (saveQueueRef.current === null) {
    saveQueueRef.current = new LibrarySaveCoordinator({
      delayMs: LIBRARY_SAVE_DEBOUNCE_MS,
      onSaveStart: () => {
        ignoreFileEventsUntilRef.current = Date.now() + 1200;
      },
      onSaved: (savedPath) => {
        setLibraryPath(savedPath);
        saveAgentSettings({ libraryPath: savedPath });
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
        const registry = loadWritingLibraryRegistry(savedSettings.libraryPath);
        setLibraryRegistry(registry);
        setDefaultLibrariesPath(await getDefaultLibrariesPath());
        const library = activeWritingLibrary(registry);
        if (!library) {
          setLibraryPath("");
          setLibraryStatus("");
          return;
        }
        const loaded = await loadProjects(library.path);
        if (cancelled) return;
        const normalizedProjects = normalizeProjects(loaded.projects);
        const restoredSelection = resolveSavedProjectSelection(
          normalizedProjects,
          library.lastProjectId ?? savedSettings.activeProjectId,
          library.lastSheetId ?? savedSettings.activeSheetId,
        );
        onProjectsChange(normalizedProjects);
        onActiveProjectChange(restoredSelection.projectId);
        onActiveSheetChange(restoredSelection.sheetId);
        setLibraryPath(loaded.libraryPath);
        const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
        if (cancelled) return;
        setLoadedConversations(conversations);
        const openedRegistry = updateWritingLibrary(registry, library.id, { lastOpenedAt: Date.now() });
        openedRegistry.activeLibraryId = library.id;
        setLibraryRegistry(openedRegistry);
        saveWritingLibraryRegistry(openedRegistry);
        setLibraryStatus("已恢复上次使用的写作库");
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
    if (!libraryPath) return;
    saveQueueRef.current?.schedule({ projects, libraryPath });
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
    setLibraryRegistry((current) => {
      const active = activeWritingLibrary(current);
      if (!active || (active.lastProjectId === activeProjectId && active.lastSheetId === activeSheetId)) return current;
      const next = updateWritingLibrary(current, active.id, { lastProjectId: activeProjectId, lastSheetId: activeSheetId });
      saveWritingLibraryRegistry(next);
      return next;
    });
  }, [activeProjectId, activeSheetId, persistenceReady]);

  useEffect(() => {
    if (!appWindow) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const handleCloseRequested = createPersistedWindowCloseHandler({
      flush: async () => saveQueueRef.current?.flush(),
      requestClose: () => appWindow.close(),
    });

    appWindow.onCloseRequested(handleCloseRequested).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
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

    listen("loby://rebuild-index", () => {
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

    listen("loby://zen-finished", () => {
      void rebuildLibraryIndexRef.current();
    }).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
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

    listen<LibraryFileChangePayload>("loby://library-files-changed", (event) => {
      if (Date.now() < ignoreFileEventsUntilRef.current) return;
      const indexChangePaths = libraryIndexChangePaths(event.payload.paths);
      if (indexChangePaths.length === 0) return;
      if (fileRefreshTimerRef.current !== null) {
        window.clearTimeout(fileRefreshTimerRef.current);
      }
      fileRefreshTimerRef.current = window.setTimeout(() => {
        fileRefreshTimerRef.current = null;
        void refreshLibraryFromExternalChangeRef.current(indexChangePaths);
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

  async function activateLibrary(library: WritingLibrary, registry = libraryRegistry) {
    if (library.path === libraryPath && persistenceReady) return;
    setLibraryStatus(`正在打开“${library.name}”...`);
    setPersistenceReady(false);
    try {
      await saveQueueRef.current?.flush();
      const loaded = await loadProjects(library.path);
      const normalizedProjects = normalizeProjects(loaded.projects);
      const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, library.lastProjectId ?? "", library.lastSheetId ?? "");
      const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === restoredSelection.sheetId);
      onProjectsChange(normalizedProjects);
      onActiveProjectChange(restoredSelection.projectId);
      onActiveSheetChange(restoredSelection.sheetId);
      onActiveGroupChange(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSheet?.id ?? "") : "");
      onActiveNoteGroupChange("");
      onSidebarModeChange("library");
      onSheetSearchChange("");
      setLoadedConversations(conversations);
      setLibraryPath(loaded.libraryPath);
      const openedRegistry = updateWritingLibrary({ ...registry, activeLibraryId: library.id }, library.id, {
        lastOpenedAt: Date.now(),
        lastProjectId: restoredSelection.projectId,
        lastSheetId: restoredSelection.sheetId,
      });
      setLibraryRegistry(openedRegistry);
      saveWritingLibraryRegistry(openedRegistry);
      setLibraryStatus(loaded.projects.length === 0 ? `“${library.name}”已就绪，可以创建第一个项目。` : `已切换到“${library.name}”。`);
      saveAgentSettings({ libraryPath: loaded.libraryPath });
    } catch (error) {
      setLibraryStatus(`打开写作库失败：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      setPersistenceReady(true);
    }
  }

  async function switchLibrary(libraryId?: string) {
    if (!libraryId) {
      await addExistingLibrary();
      return;
    }
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library) return;
    await activateLibrary(library);
  }

  async function createLibrary(name: string, parentPath?: string) {
    setLibraryStatus("正在创建写作库...");
    const path = await createLibraryDirectory(name, parentPath);
    const registry = registerWritingLibrary(libraryRegistry, { name, path });
    const library = activeWritingLibrary(registry);
    if (!library) throw new Error("写作库注册失败");
    await activateLibrary(library, registry);
  }

  async function addExistingLibrary(path?: string, name?: string) {
    const selectedPath = path ?? (await chooseLibraryFolder());
    if (!selectedPath) return;
    const registry = registerWritingLibrary(libraryRegistry, {
      name: name || libraryNameFromPath(selectedPath),
      path: selectedPath,
    });
    const library = activeWritingLibrary(registry);
    if (!library) throw new Error("写作库注册失败");
    await activateLibrary(library, registry);
  }

  async function chooseLibraryLocation() {
    return chooseLibraryFolder();
  }

  function renameLibrary(libraryId: string, name: string) {
    const registry = updateWritingLibrary(libraryRegistry, libraryId, { name });
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    setLibraryStatus("写作库名称已更新；本地文件夹名称保持不变。");
  }

  function removeLibrary(libraryId: string) {
    if (libraryRegistry.activeLibraryId === libraryId) {
      setLibraryStatus("不能移除当前正在使用的写作库，请先切换到其他库。");
      return false;
    }
    const registry = removeWritingLibrary(libraryRegistry, libraryId);
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    setLibraryStatus("已从列表移除写作库，本地文件没有删除。");
    return true;
  }

  async function moveLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || !library.path.startsWith("/")) {
      throw new Error("当前不是桌面本地写作库，无法移动。");
    }
    const destinationParent = await chooseLibraryMoveDestination();
    if (!destinationParent) return;

    const active = libraryRegistry.activeLibraryId === libraryId;
    if (active) await saveQueueRef.current?.flush();
    setLibraryStatus(`正在移动“${library.name}”...`);
    const nextPath = await moveLibraryDirectory(library.path, destinationParent);
    const registry = updateWritingLibrary(libraryRegistry, libraryId, { path: nextPath });
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    if (active) {
      setLibraryPath(nextPath);
      saveAgentSettings({ libraryPath: nextPath });
    }
    setLibraryStatus(`“${library.name}”已移动到 ${nextPath}`);
  }

  async function revealLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || !library.path.startsWith("/")) {
      throw new Error("当前不是桌面本地写作库，无法在访达中显示。");
    }
    await revealLocalPath(library.path);
    setLibraryStatus(`已在访达中显示“${library.name}”`);
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

  async function openLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || library.path.startsWith("browser://")) {
      setLibraryStatus("当前不是桌面本地写作库，无法打开文件夹");
      return;
    }
    try {
      await openLocalPath(library.path);
      setLibraryStatus(`已在系统文件管理器中打开“${library.name}”`);
    } catch {
      setLibraryStatus("打开写作库失败");
    }
  }

  async function flushPendingSave() {
    await saveQueueRef.current?.flush();
  }

  async function persistProjectsImmediately(nextProjects: WritingProject[]) {
    if (!libraryPath) throw new Error("当前没有可用的写作库。");
    await saveQueueRef.current?.flush();
    ignoreFileEventsUntilRef.current = Date.now() + 1200;
    const savedPath = await saveProjects(nextProjects, libraryPath);
    setLibraryPath(savedPath);
    saveAgentSettings({ libraryPath: savedPath });
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
      const selection = reconcileLibraryRefreshSelection(normalizedProjects, {
        activeProjectId,
        activeSheetId,
        activeGroupId,
        activeNoteGroupId,
      });

      skipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      onActiveProjectChange(selection.activeProjectId);
      onActiveSheetChange(selection.activeSheetId);
      onActiveGroupChange(selection.activeGroupId);
      if (selection.resetSidebarMode) {
        onSidebarModeChange("library");
      }
      if (selection.clearActiveNoteGroup) {
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
    libraries: libraryRegistry.libraries,
    activeLibrary: activeWritingLibrary(libraryRegistry),
    onboardingRequired: libraryRegistry.libraries.length === 0,
    defaultLibrariesPath,
    persistenceReady,
    loadedConversations,
    setLibraryStatus,
    skipNextLibrarySave,
    switchLibrary,
    createLibrary,
    addExistingLibrary,
    chooseLibraryLocation,
    renameLibrary,
    moveLibrary,
    removeLibrary,
    revealLibrary,
    openCurrentLibrary,
    openLibrary,
    flushPendingSave,
    persistProjectsImmediately,
    rebuildLibraryIndex,
  };
}
