/**
 * [INPUT]: 依赖 Tauri API、React 运行时、AI 助手模块、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 useLibraryPersistence，包括并行恢复、dirty document 队列、手动文稿立即保存、写作文件夹切换与关闭前落盘
 * [POS]: 写作库 feature 的 React 协调边界，封装启动恢复、持久状态、副作用与用户动作；互不依赖的原生读取不得串行阻塞首屏
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Window } from "@tauri-apps/api/window";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { createWelcomeConversation } from "@/features/assistant/model/conversations";
import {
  detectSingleDocumentChange,
  documentProjectContext,
  DocumentSaveCoordinator,
  materializeDocumentSnapshots,
} from "@/features/library/model/documentSaveCoordinator";
import { LibrarySaveCoordinator } from "@/features/library/model/librarySaveCoordinator";
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
  saveProjectMetadata,
  saveProjects,
  validateExistingLibraryDirectory,
  type LibraryRebuildProgress,
  type LibraryRebuildSummary,
  watchLibrary,
} from "@/features/library/model/persistence";
import {
  activeWritingLibrary,
  isDesktopLibraryPath,
  libraryNameFromPath,
  loadWritingLibraryRegistry,
  registerWritingLibrary,
  removeWritingLibrary,
  saveWritingLibraryRegistry,
  updateWritingLibrary,
} from "@/features/library/model/libraryRegistry";
import {
  isNotesProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
} from "@/features/library/model/projectModel";
import { libraryIndexChangePaths, type LibraryFileChangePayload } from "@/features/library/model/libraryFileChanges";
import { reconcileLibraryRefreshSelection } from "@/features/library/model/libraryRefresh";
import type { ChatConversation, SidebarMode, WritingLibrary, WritingLibraryRegistry, WritingProject, WritingSheet } from "@/shared/types";
import { createPersistedWindowCloseHandler } from "@/shared/lib/windowClose";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";

const LIBRARY_SAVE_DEBOUNCE_MS = 500;
const DOCUMENT_SAVE_DEBOUNCE_MS = 400;
const DOCUMENT_SAVE_MAX_DELAY_MS = 2_000;
const LIBRARY_METADATA_SAVE_DEBOUNCE_MS = 2_500;
const SELF_WRITE_RECEIPT_TTL_MS = 3_000;

function normalizeFileEventPath(path: string) {
  return path.replaceAll("\\", "/");
}

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

interface PendingDocumentSnapshot {
  revision: number;
  baseSheet: WritingSheet;
  readBody: () => string;
  updatedAt: string;
  snapshot?: WritingSheet;
  saved: boolean;
  acknowledged: boolean;
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
  const selfWriteReceiptsRef = useRef(new Map<string, number>());
  const fileRefreshTimerRef = useRef<number | null>(null);
  const rebuildLibraryIndexRef = useRef<() => Promise<LibraryRebuildSummary>>(async () => ({
    indexedSheetCount: 0,
    migratedSheetCount: 0,
  }));
  const refreshLibraryFromExternalChangeRef = useRef<(paths: string[]) => void>(() => {});
  const previousProjectsRef = useRef(projects);
  const documentRevisionsRef = useRef(new Map<string, number>());
  const latestDocumentSnapshotsRef = useRef(new Map<string, PendingDocumentSnapshot>());
  const documentSaveQueueRef = useRef<DocumentSaveCoordinator | null>(null);
  const metadataSaveQueueRef = useRef<LibrarySaveCoordinator | null>(null);
  const saveQueueRef = useRef<LibrarySaveCoordinator | null>(null);

  if (documentSaveQueueRef.current === null) {
    documentSaveQueueRef.current = new DocumentSaveCoordinator({
      delayMs: DOCUMENT_SAVE_DEBOUNCE_MS,
      maxDelayMs: DOCUMENT_SAVE_MAX_DELAY_MS,
      onSaved: (receipt, request) => {
        if (receipt.written) {
          selfWriteReceiptsRef.current.set(normalizeFileEventPath(receipt.path), Date.now() + SELF_WRITE_RECEIPT_TTL_MS);
        }
        const revisionKey = documentRevisionKey(request.libraryPath, request.sheetId);
        const pending = latestDocumentSnapshotsRef.current.get(revisionKey);
        if (!pending || pending.revision !== request.revision) return;
        pending.saved = true;
        if (pending.acknowledged) latestDocumentSnapshotsRef.current.delete(revisionKey);
      },
      onError: () => {
        setLibraryStatus("当前文稿保存失败");
      },
    });
  }

  if (metadataSaveQueueRef.current === null) {
    metadataSaveQueueRef.current = new LibrarySaveCoordinator({
      delayMs: LIBRARY_METADATA_SAVE_DEBOUNCE_MS,
      persist: (nextProjects, nextLibraryPath) =>
        saveProjectMetadata(materializePendingDocumentSnapshots(nextProjects, nextLibraryPath), nextLibraryPath),
      onError: () => {
        setLibraryStatus("写作库索引保存失败");
      },
    });
  }

  if (saveQueueRef.current === null) {
    saveQueueRef.current = new LibrarySaveCoordinator({
      delayMs: LIBRARY_SAVE_DEBOUNCE_MS,
      persist: async (nextProjects, nextLibraryPath) => {
        await documentSaveQueueRef.current?.flush();
        await metadataSaveQueueRef.current?.flush();
        return saveProjects(materializePendingDocumentSnapshots(nextProjects, nextLibraryPath), nextLibraryPath);
      },
      onSaveStart: () => {
        ignoreFileEventsUntilRef.current = Date.now() + 1200;
      },
      onSaved: (savedPath) => {
        setLibraryPath(savedPath);
        saveAgentSettings({ libraryPath: savedPath });
      },
      onError: () => {
        setLibraryStatus("本地文件保存失败");
      },
    });
  }

  const scheduleDocumentSave = useCallback(
    (
      project: WritingProject,
      sheet: WritingSheet,
      readBody: () => string = () => sheet.body,
      updatedAt = sheet.updatedAt,
      acknowledged = false,
    ) => {
      if (!persistenceReady || !libraryPath) return;
      const revisionKey = documentRevisionKey(libraryPath, sheet.id);
      const revision = (documentRevisionsRef.current.get(revisionKey) ?? 0) + 1;
      documentRevisionsRef.current.set(revisionKey, revision);
      const pending: PendingDocumentSnapshot = {
        revision,
        baseSheet: sheet,
        readBody,
        updatedAt,
        saved: false,
        acknowledged,
      };
      latestDocumentSnapshotsRef.current.set(revisionKey, pending);
      documentSaveQueueRef.current?.schedule({
        libraryPath,
        project: documentProjectContext(project),
        sheetId: sheet.id,
        resolveSheet: () => resolvePendingDocumentSnapshot(pending),
        revision,
      });
    },
    [libraryPath, persistenceReady],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadInitialState() {
      try {
        const savedSettings = loadAgentSettings();
        const registry = loadWritingLibraryRegistry(savedSettings.libraryPath);
        setLibraryRegistry(registry);
        const library = activeWritingLibrary(registry);
        if (!library) {
          setDefaultLibrariesPath(await getDefaultLibrariesPath());
          setLibraryPath("");
          setLibraryStatus("");
          return;
        }
        const defaultPathPromise = getDefaultLibrariesPath().then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        const conversationsPromise = loadConversations(library.path, [createWelcomeConversation()]).then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
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
        const [defaultPathResult, conversationResult] = await Promise.all([defaultPathPromise, conversationsPromise]);
        if ("error" in defaultPathResult) throw defaultPathResult.error;
        if ("error" in conversationResult) throw conversationResult.error;
        if (cancelled) return;
        setDefaultLibrariesPath(defaultPathResult.value);
        setLoadedConversations(conversationResult.value);
        const openedRegistry = updateWritingLibrary(registry, library.id, { lastOpenedAt: Date.now() });
        openedRegistry.activeLibraryId = library.id;
        setLibraryRegistry(openedRegistry);
        saveWritingLibraryRegistry(openedRegistry);
        setLibraryStatus("已恢复上次写作位置");
      } catch {
        if (cancelled) return;
        setLibraryPath("Browser localStorage");
        setLibraryStatus("本地写作文件加载失败，已回退到浏览器本地存储");
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
    const previousProjects = previousProjectsRef.current;
    previousProjectsRef.current = projects;
    if (skipNextLibrarySaveRef.current) {
      skipNextLibrarySaveRef.current = false;
      return;
    }
    if (!libraryPath) return;
    const documentChange = detectSingleDocumentChange(previousProjects, projects);
    if (documentChange) {
      const revisionKey = documentRevisionKey(libraryPath, documentChange.sheet.id);
      const pendingSnapshot = latestDocumentSnapshotsRef.current.get(revisionKey);
      if (pendingSnapshot && sameDocumentSnapshot(resolvePendingDocumentSnapshot(pendingSnapshot), documentChange.sheet)) {
        pendingSnapshot.acknowledged = true;
        if (pendingSnapshot.saved) latestDocumentSnapshotsRef.current.delete(revisionKey);
      } else {
        scheduleDocumentSave(
          documentChange.project,
          documentChange.sheet,
          () => documentChange.sheet.body,
          documentChange.sheet.updatedAt,
          true,
        );
      }
      metadataSaveQueueRef.current?.schedule({ projects, libraryPath });
      return;
    }
    saveQueueRef.current?.schedule({ projects, libraryPath });
  }, [projects, persistenceReady, libraryPath, scheduleDocumentSave]);

  useEffect(
    () => () => {
      void flushPendingWrites();
    },
    [],
  );

  useEffect(() => {
    if (!persistenceReady || !isDesktopLibraryPath(libraryPath)) return;
    watchLibrary(libraryPath).catch(() => {
      setLibraryStatus("本地文件监听启动失败");
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
      flush: flushPendingWrites,
      dismissWindow: () => invoke("dismiss_main_window"),
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
      void rebuildLibraryIndexRef.current().catch(() => undefined);
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
      void refreshLibraryFromExternalChangeRef.current([]);
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
      const now = Date.now();
      for (const [path, expiresAt] of selfWriteReceiptsRef.current) {
        if (expiresAt <= now) selfWriteReceiptsRef.current.delete(path);
      }
      const externalPaths = event.payload.paths.filter((path) => !selfWriteReceiptsRef.current.has(normalizeFileEventPath(path)));
      const indexChangePaths = libraryIndexChangePaths(externalPaths);
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

  async function flushPendingWrites() {
    await documentSaveQueueRef.current?.flush();
    await metadataSaveQueueRef.current?.flush();
    await saveQueueRef.current?.flush();
  }

  function materializePendingDocumentSnapshots(nextProjects: WritingProject[], path?: string) {
    const targetPath = path ?? libraryPath;
    const snapshots = new Map<string, WritingSheet>();
    for (const project of nextProjects) {
      for (const sheet of project.sheets) {
        const snapshot = latestDocumentSnapshotsRef.current.get(documentRevisionKey(targetPath, sheet.id));
        if (snapshot) snapshots.set(sheet.id, resolvePendingDocumentSnapshot(snapshot));
      }
    }
    return materializeDocumentSnapshots(nextProjects, snapshots);
  }

  function skipNextLibrarySave() {
    skipNextLibrarySaveRef.current = true;
  }

  async function activateLibrary(library: WritingLibrary, registry = libraryRegistry) {
    if (library.path === libraryPath && persistenceReady) return;
    setLibraryStatus("正在打开写作文件夹...");
    setPersistenceReady(false);
    try {
      await flushPendingWrites();
      const [loaded, conversations] = await Promise.all([
        loadProjects(library.path),
        loadConversations(library.path, [createWelcomeConversation()]),
      ]);
      const normalizedProjects = normalizeProjects(loaded.projects);
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
      setLibraryStatus(loaded.projects.length === 0 ? "写作文件夹已就绪，可以创建第一个项目。" : "已打开写作文件夹");
      saveAgentSettings({ libraryPath: loaded.libraryPath });
    } catch (error) {
      setLibraryStatus(`打开写作文件夹失败：${error instanceof Error ? error.message : String(error)}`);
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
    setLibraryStatus("正在准备写作文件夹...");
    const path = await createLibraryDirectory(name, parentPath);
    const registry = registerWritingLibrary(libraryRegistry, { name, path });
    const library = activeWritingLibrary(registry);
    if (!library) throw new Error("写作文件夹注册失败");
    await activateLibrary(library, registry);
  }

  async function addExistingLibrary(path?: string, name?: string) {
    const selectedPath = path ?? (await chooseLibraryFolder());
    if (!selectedPath) return;
    const validatedPath = await validateExistingLibraryDirectory(selectedPath);
    const registry = registerWritingLibrary(libraryRegistry, {
      name: name || libraryNameFromPath(validatedPath),
      path: validatedPath,
    });
    const library = activeWritingLibrary(registry);
    if (!library) throw new Error("写作文件夹注册失败");
    await activateLibrary(library, registry);
  }

  async function chooseLibraryLocation() {
    return chooseLibraryFolder();
  }

  function renameLibrary(libraryId: string, name: string) {
    const registry = updateWritingLibrary(libraryRegistry, libraryId, { name });
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    setLibraryStatus("显示名称已更新；本地文件夹名称保持不变。");
  }

  function removeLibrary(libraryId: string) {
    if (libraryRegistry.activeLibraryId === libraryId) {
      setLibraryStatus("不能移除当前正在使用的写作位置。");
      return false;
    }
    const registry = removeWritingLibrary(libraryRegistry, libraryId);
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    setLibraryStatus("已从内部记录中移除写作位置，本地文件没有删除。");
    return true;
  }

  async function moveLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || !isDesktopLibraryPath(library.path)) {
      throw new Error("当前不是本地写作文件夹，无法移动。");
    }
    const destinationParent = await chooseLibraryMoveDestination();
    if (!destinationParent) return;

    const active = libraryRegistry.activeLibraryId === libraryId;
    if (active) await flushPendingWrites();
    setLibraryStatus("正在移动写作文件夹...");
    const nextPath = await moveLibraryDirectory(library.path, destinationParent);
    const registry = updateWritingLibrary(libraryRegistry, libraryId, { path: nextPath });
    setLibraryRegistry(registry);
    saveWritingLibraryRegistry(registry);
    if (active) {
      setLibraryPath(nextPath);
      saveAgentSettings({ libraryPath: nextPath });
    }
    setLibraryStatus(`写作文件夹已移动到 ${nextPath}`);
  }

  async function moveCurrentLibrary() {
    const library = activeWritingLibrary(libraryRegistry);
    if (!library) throw new Error("当前没有可移动的写作文件夹。");
    await moveLibrary(library.id);
  }

  async function revealLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || !isDesktopLibraryPath(library.path)) {
      throw new Error("当前不是本地写作文件夹，无法在访达中显示。");
    }
    await revealLocalPath(library.path);
    setLibraryStatus(`已在访达中显示“${library.name}”`);
  }

  async function openCurrentLibrary() {
    if (!isDesktopLibraryPath(libraryPath)) {
      setLibraryStatus("当前不是本地写作文件夹，无法打开");
      return;
    }
    try {
      await openLocalPath(libraryPath);
      setLibraryStatus("已在系统文件管理器中打开写作文件夹");
    } catch {
      setLibraryStatus("打开写作文件夹失败");
    }
  }

  async function openLibrary(libraryId: string) {
    const library = libraryRegistry.libraries.find((item) => item.id === libraryId);
    if (!library || !isDesktopLibraryPath(library.path)) {
      setLibraryStatus("当前不是本地写作文件夹，无法打开");
      return;
    }
    try {
      await openLocalPath(library.path);
      setLibraryStatus(`已在系统文件管理器中打开“${library.name}”`);
    } catch {
      setLibraryStatus("打开写作文件夹失败");
    }
  }

  async function flushPendingSave() {
    await flushPendingWrites();
  }

  async function persistDocumentImmediately(project: WritingProject, sheet: WritingSheet, nextProjects: WritingProject[]) {
    if (!libraryPath) throw new Error("当前没有可用的写作文件夹。");
    scheduleDocumentSave(project, sheet, () => sheet.body, sheet.updatedAt);
    metadataSaveQueueRef.current?.schedule({ projects: nextProjects, libraryPath });
    await flushPendingWrites();
  }

  async function persistProjectsImmediately(nextProjects: WritingProject[]) {
    if (!libraryPath) throw new Error("当前没有可用的写作文件夹。");
    await flushPendingWrites();
    ignoreFileEventsUntilRef.current = Date.now() + 1200;
    const savedPath = await saveProjects(nextProjects, libraryPath);
    setLibraryPath(savedPath);
    saveAgentSettings({ libraryPath: savedPath });
  }

  async function rebuildLibraryIndex(onProgress?: (progress: LibraryRebuildProgress) => void): Promise<LibraryRebuildSummary> {
    if (!isDesktopLibraryPath(libraryPath)) {
      setLibraryStatus("当前不是本地写作文件夹，无法重建索引");
      throw new Error("当前不是本地写作文件夹，无法重建索引");
    }

    setLibraryStatus("正在重建索引...");
    onProgress?.({ value: 10, label: "正在保存当前内容…" });
    try {
      await flushPendingWrites();
      onProgress?.({ value: 35, label: "正在扫描写作文件夹并检查文稿 ID…" });
      const result = await rebuildProjectIndex(libraryPath, true);
      onProgress?.({ value: 75, label: "正在恢复文稿列表和当前选择…" });
      const normalizedProjects = normalizeProjects(result.projects);
      const migratedSheetId = result.idChanges.find((change) => change.oldId === activeSheetId)?.newId ?? activeSheetId;
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, activeProjectId, migratedSheetId);
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
      setLibraryRegistry((current) => {
        const active = activeWritingLibrary(current);
        if (!active) return current;
        const next = updateWritingLibrary(current, active.id, { lastSheetId: restoredSelection.sheetId });
        saveWritingLibraryRegistry(next);
        return next;
      });
      onProgress?.({ value: 90, label: "正在恢复写作位置和 AI 对话…" });
      setLoadedConversations(await loadConversations(libraryPath, [createWelcomeConversation()]));
      setLibraryStatus(
        result.migratedSheetCount > 0
          ? `已重建索引，并统一 ${result.migratedSheetCount} 篇文稿 ID`
          : `已重建索引，共索引 ${result.indexedSheetCount} 篇文稿`,
      );
      onProgress?.({ value: 100, label: "索引重建完成" });
      return {
        indexedSheetCount: result.indexedSheetCount,
        migratedSheetCount: result.migratedSheetCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLibraryStatus(`重建索引失败：${message}`);
      throw error;
    }
  }

  async function refreshLibraryFromExternalChange(_paths: string[]) {
    if (!isDesktopLibraryPath(libraryPath)) return;

    try {
      const result = await rebuildProjectIndex(libraryPath);
      const normalizedProjects = normalizeProjects(result.projects);
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
      setLibraryStatus("已同步外部文件改动");
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
    moveCurrentLibrary,
    removeLibrary,
    revealLibrary,
    openCurrentLibrary,
    openLibrary,
    flushPendingSave,
    scheduleDocumentSave,
    persistDocumentImmediately,
    persistProjectsImmediately,
    rebuildLibraryIndex,
  };
}

function documentRevisionKey(libraryPath: string, sheetId: string) {
  return `${libraryPath}\u0000${sheetId}`;
}

function sameDocumentSnapshot(previous: WritingSheet, current: WritingSheet) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const key of keys) {
    if (!Object.is(previous[key as keyof WritingSheet], current[key as keyof WritingSheet])) return false;
  }
  return true;
}

function resolvePendingDocumentSnapshot(pending: PendingDocumentSnapshot) {
  if (pending.snapshot) return pending.snapshot;
  const body = pending.readBody();
  pending.snapshot = {
    ...pending.baseSheet,
    title: extractFirstHeadingTitle(body) || pending.baseSheet.title,
    body,
    updatedAt: pending.updatedAt,
  };
  return pending.snapshot;
}
