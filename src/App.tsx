import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { EditorView } from "@codemirror/view";
import { PanelLeftOpen, Settings } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type {
  ProjectGroup,
  SidebarMode,
  SheetSortDirection,
  SheetManualOrders,
  SheetSortMode,
  SheetSortPreference,
  SheetVersion,
  WritingProject,
  WritingSheet,
} from "./types";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorToolbar } from "./components/EditorToolbar";
import { EmptyLibraryState } from "./components/EmptyLibraryState";
import { InspectorPanel } from "./components/InspectorPanel";
import { LibraryRail } from "./components/LibraryRail";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SheetRail } from "./components/SheetRail";
import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "./constants/projectAppearance";
import { PROJECT_TEMPLATES } from "./constants/projectTemplates";
import { useAiAssistant } from "./hooks/useAiAssistant";
import { useProjectExport } from "./hooks/useProjectExport";
import { useProjectResources } from "./hooks/useProjectResources";
import { useSheetActions } from "./hooks/useSheetActions";
import { renderMarkdownHtml } from "./lib/export";
import { loadAgentSettings, saveAgentSettings } from "./lib/agentSettings";
import { createWelcomeConversation } from "./lib/conversations";
import { nowTimestamp, today } from "./lib/dates";
import { formatSnapshotTime } from "./lib/formatters";
import { insertImageReferenceBlocks } from "./lib/editorInsertions";
import {
  createImageReference,
  getPreferredImageFilename,
  isImageFile,
  resolveInsertedImagePath,
  resolveSheetImageSourcePath,
  stripExtension,
} from "./lib/imageAssets";
import { buildImportedMarkdownSheets } from "./lib/importMarkdown";
import { extractFirstHeadingTitle } from "./lib/markdownTitle";
import {
  buildProjectFolderPath,
  buildNoteGroupFolderPath,
  buildSheetMarkdownPath,
  createDefaultProjectGroups,
  DEFAULT_PUBLISHING_CHECKLIST,
  DEFAULT_WRITING_BRIEF,
  filterProjects,
  filterSheets,
  getDefaultGroupIdForSheetType,
  getProjectFilterTitle,
  getNotesProject,
  getSheetsForProjectFilter,
  getSheetsInGroup,
  getVisibleProjectGroups,
  getWritingBrief,
  isSystemProjectGroupId,
  isNotesProject,
  NOTES_INBOX_GROUP_ID,
  NOTES_PROJECT_ID,
  normalizeProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
  type ProjectFilter,
} from "./lib/projectModel";
import {
  chooseLibraryFolder,
  importMarkdownFiles,
  loadBrowserProjects,
  loadConversations,
  loadProjects,
  moveProjectToTrash,
  openLocalPath,
  rebuildProjectIndex,
  revealLocalPath,
  saveProjectImage,
  saveProjects,
  clearLibraryTrash,
  importProjectImages,
  watchLibrary,
} from "./lib/persistence";
import { countWords } from "./lib/text";

interface SidebarContextMenuState {
  x: number;
  y: number;
  path: string;
  label: string;
  kind: "project" | "note-group" | "sheet";
  projectId?: string;
}

interface LibraryFileChangePayload {
  paths: string[];
  kind: string;
}

const DEFAULT_SHEET_SORT_PREFERENCE: SheetSortPreference = {
  mode: "manual",
  direction: "desc",
};

type RailDropPosition = "before" | "after";

function sortSheetList(
  sheets: WritingSheet[],
  mode: SheetSortMode,
  direction: SheetSortDirection,
  manualOrder: string[] = [],
): WritingSheet[] {
  if (mode === "manual") return applyManualSheetOrder(sheets, manualOrder);
  return [...sheets].sort((a, b) => {
    if (mode === "title") {
      return getSheetSortTitle(a).localeCompare(getSheetSortTitle(b), "zh-Hans-CN", {
        numeric: true,
        sensitivity: "base",
      });
    }
    if (mode === "updated") {
      return direction === "asc" ? getSheetUpdatedValue(a) - getSheetUpdatedValue(b) : getSheetUpdatedValue(b) - getSheetUpdatedValue(a);
    }
    return direction === "asc" ? getSheetCreatedValue(a) - getSheetCreatedValue(b) : getSheetCreatedValue(b) - getSheetCreatedValue(a);
  });
}

function applyManualSheetOrder(sheets: WritingSheet[], manualOrder: string[]): WritingSheet[] {
  if (manualOrder.length === 0) return sheets;
  const sheetById = new Map(sheets.map((sheet) => [sheet.id, sheet]));
  const orderedSheets: WritingSheet[] = [];
  const usedIds = new Set<string>();
  for (const sheetId of manualOrder) {
    const sheet = sheetById.get(sheetId);
    if (!sheet || usedIds.has(sheetId)) continue;
    orderedSheets.push(sheet);
    usedIds.add(sheetId);
  }
  for (const sheet of sheets) {
    if (!usedIds.has(sheet.id)) orderedSheets.push(sheet);
  }
  return orderedSheets;
}

function getSheetSortTitle(sheet: WritingSheet): string {
  return sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || sheet.title || "无标题";
}

function getSheetUpdatedValue(sheet: WritingSheet): number {
  const value = Date.parse(sheet.updatedAt);
  return Number.isNaN(value) ? getSheetCreatedValue(sheet) : value;
}

function getSheetCreatedValue(sheet: WritingSheet): number {
  const createdAt = sheet.createdAt ? Date.parse(sheet.createdAt) : Number.NaN;
  if (!Number.isNaN(createdAt)) return createdAt;
  const match = sheet.id.match(/(?:sheet|version)-(\d{10,})/);
  if (match) return Number(match[1]);
  const fallback = Date.parse(sheet.updatedAt);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function moveItemById<T extends { id: string }>(items: T[], sourceId: string, targetId: string, position: RailDropPosition): T[] {
  if (sourceId === targetId) return items;
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const nextItems = [...items];
  const [sourceItem] = nextItems.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextItems.findIndex((item) => item.id === targetId);
  if (adjustedTargetIndex < 0) return items;
  nextItems.splice(position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, sourceItem);
  return nextItems;
}

function moveIdByPosition(ids: string[], sourceId: string, targetId: string, position: RailDropPosition): string[] {
  if (sourceId === targetId) return ids;
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;
  const nextIds = [...ids];
  nextIds.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextIds.indexOf(targetId);
  if (adjustedTargetIndex < 0) return ids;
  nextIds.splice(position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, sourceId);
  return nextIds;
}

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const initialProjects = useMemo(() => normalizeProjects(loadBrowserProjects()), []);
  const [projects, setProjects] = useState<WritingProject[]>(initialProjects);
  const initialSelection = resolveSavedProjectSelection(initialProjects, initialSettings.activeProjectId, initialSettings.activeSheetId);
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.projectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.sheetId);
  const [libraryRailOpen, setLibraryRailOpen] = useState(initialSettings.libraryRailOpen);
  const [sheetRailOpen, setSheetRailOpen] = useState(initialSettings.sheetRailOpen);
  const [inspectorOpen, setInspectorOpen] = useState(initialSettings.inspectorOpen);
  const [inspectorWidth, setInspectorWidth] = useState(initialSettings.inspectorWidth);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
  const [editorTypography, setEditorTypography] = useState(initialSettings.editorTypography);
  const [imageReferenceFormat, setImageReferenceFormat] = useState(initialSettings.imageReferenceFormat);
  const [sheetPreviewMode, setSheetPreviewMode] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("library");
  const [libraryProjectsOpen, setLibraryProjectsOpen] = useState(true);
  const [libraryNotesOpen, setLibraryNotesOpen] = useState(true);
  const [activeNoteGroupId, setActiveNoteGroupId] = useState("");
  const [sheetFilterOpen, setSheetFilterOpen] = useState(false);
  const [activeGroupIdsByProject, setActiveGroupIdsByProject] = useState<Record<string, string>>(
    initialSettings.activeGroupIdsByProject,
  );
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [newProjectDraft, setNewProjectDraft] = useState<NewProjectDraft>({
    title: DEFAULT_NEW_PROJECT_TITLE,
    icon: DEFAULT_PROJECT_ICON,
    iconColor: DEFAULT_PROJECT_ICON_COLOR,
  });
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newGroupDraft, setNewGroupDraft] = useState<NewProjectDraft>({
    title: "无标题",
    icon: DEFAULT_PROJECT_ICON,
    iconColor: DEFAULT_PROJECT_ICON_COLOR,
  });
  const [newGroupTargetProjectId, setNewGroupTargetProjectId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [sheetPreviewHtml, setSheetPreviewHtml] = useState("");
  const [sheetPreviewBusy, setSheetPreviewBusy] = useState(false);
  const [imageInsertStatus, setImageInsertStatus] = useState("");
  const [libraryPath, setLibraryPath] = useState("Loading library");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [sheetSearch, setSheetSearch] = useState("");
  const [editorSelectionText, setEditorSelectionText] = useState("");
  const [sidebarContextMenu, setSidebarContextMenu] = useState<SidebarContextMenuState | null>(null);
  const [projectPendingTrash, setProjectPendingTrash] = useState<WritingProject | null>(null);
  const [trashClearPending, setTrashClearPending] = useState(false);
  const [sheetSortPreferences, setSheetSortPreferences] = useState<Record<string, SheetSortPreference>>(
    initialSettings.sheetSortPreferences,
  );
  const [sheetManualOrders, setSheetManualOrders] = useState<SheetManualOrders>(initialSettings.sheetManualOrders);
  const [writingSessionStarts, setWritingSessionStarts] = useState<Record<string, number>>({});
  const editorRef = useRef<EditorView | null>(null);
  const skipNextLibrarySaveRef = useRef(false);
  const ignoreFileEventsUntilRef = useRef(0);
  const fileRefreshTimerRef = useRef<number | null>(null);
  const newProjectNameInputRef = useRef<HTMLInputElement | null>(null);
  const newGroupNameInputRef = useRef<HTMLInputElement | null>(null);
  const appWindow = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );

  useEffect(() => {
    setEditorSelectionText("");
  }, [activeSheetId]);

  useEffect(() => {
    if (!sidebarContextMenu) return;
    function closeMenu() {
      setSidebarContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [sidebarContextMenu]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const userProjectCount = useMemo(() => projects.filter((project) => !isNotesProject(project)).length, [projects]);
  const notesProject = useMemo(() => getNotesProject(projects), [projects]);
  const noteGroups = useMemo(() => getVisibleProjectGroups(notesProject), [notesProject]);
  const selectedNoteGroup = noteGroups.find((group) => group.id === activeNoteGroupId) ?? noteGroups[0];
  const visibleProjectGroups = useMemo(() => (activeProject ? getVisibleProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const filteredProjects = useMemo(
    () => filterProjects(projects, ""),
    [projects],
  );
  const filteredProjectIds = filteredProjects.map((project) => project.id).join("|");
  const selectedVisibleGroup = visibleProjectGroups.find((group) => group.id === activeGroupId) ?? visibleProjectGroups[0];
  const sheetListTitle =
    sidebarMode === "project"
      ? (selectedVisibleGroup?.title ?? activeProject?.title ?? "全部")
      : activeNoteGroupId
        ? (selectedNoteGroup?.title ?? "收件箱")
        : getProjectFilterTitle(projectFilter);
  const sheetSortPreferenceKey = useMemo(() => {
    if (sidebarMode === "project") {
      return `project:${activeProject?.id ?? "unknown"}:group:${selectedVisibleGroup?.id ?? resolvedActiveGroupId ?? "default"}`;
    }
    if (activeNoteGroupId) return `notes:${activeNoteGroupId}`;
    return `library:${projectFilter}`;
  }, [activeNoteGroupId, activeProject?.id, projectFilter, resolvedActiveGroupId, selectedVisibleGroup?.id, sidebarMode]);
  const activeSheetSortPreference = sheetSortPreferences[sheetSortPreferenceKey] ?? DEFAULT_SHEET_SORT_PREFERENCE;
  const sheetSortMode = activeSheetSortPreference.mode;
  const sheetSortDirection = activeSheetSortPreference.direction;
  const activeSheetManualOrder = sheetManualOrders[sheetSortPreferenceKey] ?? [];
  const sheetListSource = useMemo(
    () => {
      if (!activeProject) return [];
      if (sidebarMode === "project") {
        return selectedVisibleGroup ? getSheetsInGroup(activeProject, selectedVisibleGroup.id) : [];
      }
      if (activeNoteGroupId) {
        return selectedNoteGroup ? getSheetsInGroup(notesProject, selectedNoteGroup.id) : [];
      }
      const librarySheets = projects.flatMap((project) => project.sheets);
      return getSheetsForProjectFilter(librarySheets, projectFilter, today());
    },
    [activeNoteGroupId, activeProject, notesProject, projectFilter, projects, selectedNoteGroup, selectedVisibleGroup, sidebarMode],
  );
  const filteredSheets = useMemo(
    () => sortSheetList(filterSheets(sheetListSource, sheetSearch), sheetSortMode, sheetSortDirection, activeSheetManualOrder),
    [activeSheetManualOrder, sheetListSource, sheetSearch, sheetSortDirection, sheetSortMode],
  );
  const sheetProjectTitleById = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const project of projects) {
      if (isNotesProject(project)) continue;
      for (const sheet of project.sheets) {
        titles[sheet.id] = project.title;
      }
    }
    return titles;
  }, [projects]);
  const activeSheetIndex = filteredSheets.findIndex((sheet) => sheet.id === activeSheetId);
  const canManuallyReorderSheets =
    sheetSortMode === "manual" && sheetSearch.trim() === "" && !(sidebarMode === "library" && !activeNoteGroupId && projectFilter === "trash");
  const sheetActionProject = activeNoteGroupId ? notesProject : activeProject;
  const sheetActionGroupId = activeNoteGroupId ? activeNoteGroupId : resolvedActiveGroupId;
  const sheetActionActiveSheet = sheetActionProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const projectResources = useProjectResources(activeProject, libraryPath);
  const exportManager = useProjectExport({
    project: activeProject,
    libraryPath,
    activeGroupId: resolvedActiveGroupId,
    knownResourcePaths: projectResources.projectResources.map((resource) => resource.path),
    updateProject,
    onSelectSheet: setActiveSheetId,
    onShowInfo: () => setInspectorOpen(true),
    onResourceChanged: projectResources.refresh,
  });
  const sheetActions = useSheetActions({
    activeProject: sheetActionProject,
    activeSheet: sheetActionActiveSheet,
    activeGroupId: sheetActionGroupId,
    activeSheetId,
    updateProject,
    onSelectSheet: setActiveSheetId,
    onSelectGroup: setActiveGroupId,
    onSheetSearchChange: setSheetSearch,
    onRemoveSheetFromExport: exportManager.removeSheetFromSelection,
  });
  const aiAssistant = useAiAssistant({
    persistenceReady,
    libraryPath,
    initialPlanMode: initialSettings.planMode,
    initialAgentProvider: initialSettings.agentProvider,
    initialCodexCliPath: initialSettings.codexCliPath,
    initialClaudeCliPath: initialSettings.claudeCliPath,
    activeProject,
    activeSheet,
    selectedText: editorSelectionText,
    onOpenAiPanel: () => {
      setInspectorOpen(true);
    },
  });
  const agentProbeSummary = aiAssistant.probe
    ? aiAssistant.probe.ok
      ? `已连接 ${aiAssistant.probe.resolvedPath || aiAssistant.agentProvider}`
      : "检测失败"
    : "尚未检测";

  useEffect(() => {
    let cancelled = false;
    async function loadInitialState() {
      try {
        const savedSettings = loadAgentSettings();
        const savedLibraryPath = savedSettings.libraryPath;
        const loaded = await loadProjects(savedLibraryPath || undefined);
        if (cancelled) return;
        const normalizedProjects = normalizeProjects(loaded.projects);
        const restoredSelection = resolveSavedProjectSelection(normalizedProjects, savedSettings.activeProjectId, savedSettings.activeSheetId);
        setProjects(normalizedProjects);
        setActiveProjectId(restoredSelection.projectId);
        setActiveSheetId(restoredSelection.sheetId);
        setLibraryPath(loaded.libraryPath);
        const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
        if (cancelled) return;
        aiAssistant.replaceConversations(conversations);
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
  }, []);

  useEffect(() => {
    if (!persistenceReady) return;
    if (skipNextLibrarySaveRef.current) {
      skipNextLibrarySaveRef.current = false;
      return;
    }
    ignoreFileEventsUntilRef.current = Date.now() + 1200;
    saveProjects(projects, libraryPath.startsWith("/") ? libraryPath : undefined)
      .then((path) => {
        setLibraryPath(path);
        if (path.startsWith("/")) saveAgentSettings({ libraryPath: path });
      })
      .catch(() => {
        setLibraryStatus("写作库保存失败");
      });
  }, [projects, persistenceReady, libraryPath]);

  useEffect(() => {
    if (!persistenceReady || !libraryPath.startsWith("/")) return;
    watchLibrary(libraryPath).catch(() => {
      setLibraryStatus("写作库文件监听启动失败");
    });
  }, [libraryPath, persistenceReady]);

  useEffect(() => {
    saveAgentSettings({
      libraryRailOpen,
      sheetRailOpen,
      inspectorOpen,
      inspectorWidth,
      focusMode,
      typewriterMode,
      editorTypography,
      imageReferenceFormat,
      activeGroupIdsByProject,
      sheetSortPreferences,
      sheetManualOrders,
    });
  }, [
    activeGroupIdsByProject,
    libraryRailOpen,
    sheetRailOpen,
    inspectorOpen,
    inspectorWidth,
    focusMode,
    typewriterMode,
    editorTypography,
    imageReferenceFormat,
    sheetSortPreferences,
    sheetManualOrders,
  ]);

  function beginInspectorResize(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const delta = moveEvent.clientX - startX;
      setInspectorWidth(Math.min(520, Math.max(360, Math.round(startWidth - delta))));
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing-inspector");
    }

    document.body.classList.add("resizing-inspector");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  useEffect(() => {
    if (!persistenceReady) return;
    saveAgentSettings({ activeProjectId, activeSheetId });
  }, [activeProjectId, activeSheetId, persistenceReady]);

  useEffect(() => {
    if (!newProjectDialogOpen) return;
    window.setTimeout(() => {
      newProjectNameInputRef.current?.focus();
      newProjectNameInputRef.current?.select();
    }, 0);
  }, [newProjectDialogOpen]);

  useEffect(() => {
    if (!newGroupDialogOpen) return;
    window.setTimeout(() => {
      newGroupNameInputRef.current?.focus();
      newGroupNameInputRef.current?.select();
    }, 0);
  }, [newGroupDialogOpen]);

  useEffect(() => {
    if (!activeSheet) return;
    setWritingSessionStarts((current) => {
      if (current[activeSheet.id] !== undefined) return current;
      return { ...current, [activeSheet.id]: countWords(activeSheet.body) };
    });
  }, [activeSheet?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!sheetPreviewMode || !activeSheet) {
      setSheetPreviewBusy(false);
      return;
    }

    setSheetPreviewBusy(true);
    renderMarkdownHtml(activeSheet.body)
      .then((html) => {
        if (!cancelled) setSheetPreviewHtml(html);
      })
      .catch(() => {
        if (!cancelled) setSheetPreviewHtml("<pre>Markdown preview failed.</pre>");
      })
      .finally(() => {
        if (!cancelled) setSheetPreviewBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSheet, sheetPreviewMode]);

  useEffect(() => {
    if (!appWindow) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("nibva://rebuild-index", () => {
      void rebuildLibraryIndex();
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
  }, [appWindow, activeProjectId, activeSheetId, libraryPath, sidebarMode]);

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
        void refreshLibraryFromExternalChange(event.payload.paths);
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
  }, [appWindow, activeProjectId, activeSheetId, activeGroupId, activeNoteGroupId, libraryPath, sidebarMode]);

  useEffect(() => {
    if (!activeProject) return;
    if (sidebarMode === "project") return;
    if (!activeSheetId) return;
    if (activeNoteGroupId) {
      const noteGroupSheets = selectedNoteGroup ? getSheetsInGroup(notesProject, selectedNoteGroup.id) : [];
      if (!noteGroupSheets.some((sheet) => sheet.id === activeSheetId)) {
        setActiveSheetId(noteGroupSheets[0]?.id ?? "");
      }
      return;
    }
    if (!activeProject.sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(activeProject.sheets[0]?.id ?? "");
    }
  }, [activeNoteGroupId, activeProject, activeSheetId, notesProject, selectedNoteGroup, sidebarMode]);

  useEffect(() => {
    if (!activeProject) return;
    if (sidebarMode === "project") {
      const nextGroup = selectedVisibleGroup ?? visibleProjectGroups[0];
      if (!nextGroup) {
        if (activeGroupId) setActiveGroupId("");
        if (activeSheetId) setActiveSheetId("");
        return;
      }
      const nextGroupSheets = getSheetsInGroup(activeProject, nextGroup.id);
      if (nextGroup && nextGroup.id !== activeGroupId) {
        setActiveGroupId(nextGroup.id);
        setActiveGroupIdsByProject((current) => ({ ...current, [activeProject.id]: nextGroup.id }));
        setActiveSheetId(nextGroupSheets[0]?.id ?? "");
        return;
      }
      if (!activeSheetId) {
        return;
      }
      if (activeSheetId && nextGroupSheets.some((sheet) => sheet.id === activeSheetId)) {
        return;
      }
      setActiveSheetId(nextGroupSheets[0]?.id ?? "");
      return;
    }
    const nextGroupId = resolveProjectGroupId(activeProject, activeGroupId, activeSheetId);
    if (nextGroupId && nextGroupId !== activeGroupId) {
      setActiveGroupId(nextGroupId);
    }
  }, [activeProject, activeGroupId, activeSheetId, selectedVisibleGroup, sidebarMode, visibleProjectGroups]);

  useEffect(() => {
    if (activeNoteGroupId || projectFilter === "trash") return;
    if (!activeSheetId) return;
    if (activeSheetId && sheetListSource.some((sheet) => sheet.id === activeSheetId)) return;
    if (filteredProjects.length === 0 || filteredProjects.some((project) => project.id === activeProjectId)) return;
    setActiveProjectId(filteredProjects[0].id);
    setActiveSheetId(filteredProjects[0].sheets[0]?.id ?? "");
    setActiveGroupId(resolveProjectGroupId(filteredProjects[0], "", filteredProjects[0].sheets[0]?.id ?? ""));
  }, [activeNoteGroupId, activeProjectId, activeSheetId, filteredProjectIds, filteredProjects, projectFilter, sheetListSource]);

  function enterProject(project: WritingProject) {
    const groups = getVisibleProjectGroups(project);
    const savedGroupId = activeGroupIdsByProject[project.id];
    const selectedGroup = groups.find((group) => group.id === savedGroupId) ?? groups[0];
    const firstSheet = selectedGroup ? getSheetsInGroup(project, selectedGroup.id)[0] : project.sheets[0];
    setActiveNoteGroupId("");
    setActiveProjectId(project.id);
    setActiveGroupId(selectedGroup?.id ?? "");
    setActiveSheetId(firstSheet?.id ?? "");
    setSidebarMode("project");
    setProjectFilter("active");
    setSheetSearch("");
    setSheetFilterOpen(false);
  }

  function selectProjectFilter(filter: ProjectFilter) {
    setActiveNoteGroupId("");
    setProjectFilter(filter);
    if (filter === "trash") {
      setActiveSheetId("");
      setSheetSearch("");
      setSheetFilterOpen(false);
    }
  }

  function selectNoteGroup(groupId: string) {
    const group = noteGroups.find((item) => item.id === groupId) ?? noteGroups[0];
    if (!group) return;
    const firstSheet = getSheetsInGroup(notesProject, group.id)[0];
    setSidebarMode("library");
    setActiveProjectId(NOTES_PROJECT_ID);
    setActiveGroupId(group.id);
    setActiveNoteGroupId(group.id);
    setActiveSheetId(firstSheet?.id ?? "");
    setSheetSearch("");
    setSheetFilterOpen(false);
  }

  function selectProjectGroup(groupId: string) {
    if (!activeProject) return;
    setActiveGroupId(groupId);
    setActiveGroupIdsByProject((current) => ({ ...current, [activeProject.id]: groupId }));
    const nextSheet = getSheetsInGroup(activeProject, groupId)[0];
    setActiveSheetId(nextSheet?.id ?? "");
    setSheetSearch("");
    setSheetFilterOpen(false);
  }

  function selectSheetById(sheetId: string) {
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    if (!ownerProject) return;
    const ownerSheet = ownerProject.sheets.find((sheet) => sheet.id === sheetId);
    const shouldKeepLibraryFilterContext = sidebarMode === "library" && !activeNoteGroupId;
    if (ownerProject && ownerProject.id !== activeProjectId) {
      setActiveProjectId(ownerProject.id);
      if (ownerSheet?.groupId) {
        setActiveGroupId(ownerSheet.groupId);
        setActiveGroupIdsByProject((current) => ({ ...current, [ownerProject.id]: ownerSheet.groupId ?? "" }));
      }
    }
    if (shouldKeepLibraryFilterContext) {
      setActiveNoteGroupId("");
      setSidebarMode("library");
      setActiveSheetId(sheetId);
      return;
    }
    if (isNotesProject(ownerProject)) {
      setActiveNoteGroupId(ownerSheet?.groupId ?? selectedNoteGroup?.id ?? "");
      setSidebarMode("library");
    } else {
      setActiveNoteGroupId("");
    }
    setActiveSheetId(sheetId);
  }

  function openNewGroupDialog(targetProjectId = activeProject?.id ?? "") {
    setNewGroupTargetProjectId(targetProjectId);
    setNewGroupDraft({
      title: "无标题",
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewGroupDialogOpen(true);
  }

  function closeNewGroupDialog() {
    setNewGroupDialogOpen(false);
    setNewGroupTargetProjectId("");
  }

  function submitNewGroupDialog() {
    createProjectGroup(newGroupDraft, newGroupTargetProjectId || activeProject?.id || "");
    setNewGroupDialogOpen(false);
    setNewGroupTargetProjectId("");
  }

  function createProjectGroup(draft: NewProjectDraft, targetProjectId: string) {
    const targetProject = projects.find((project) => project.id === targetProjectId) ?? activeProject;
    if (!targetProject) return;
    const title = draft.title.trim() || "无标题";
    const isNotesGroup = isNotesProject(targetProject);
    const group: ProjectGroup = {
      id: `${isNotesGroup ? "note-group" : "group"}-${Date.now()}`,
      title,
      icon: draft.icon || DEFAULT_PROJECT_ICON,
      iconColor: draft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
      description: "",
    };
    updateProject(targetProject.id, (project) => ({
      ...project,
      groups: [...(project.groups ?? []).filter((item) => !isSystemProjectGroupId(item.id)), group],
      updatedAt: today(),
    }));
    setActiveGroupId(group.id);
    setActiveGroupIdsByProject((current) => ({ ...current, [targetProject.id]: group.id }));
    if (isNotesGroup) {
      setActiveProjectId(NOTES_PROJECT_ID);
      setActiveNoteGroupId(group.id);
      setActiveSheetId("");
      setSidebarMode("library");
      setLibraryNotesOpen(true);
      setSheetSearch("");
      setSheetFilterOpen(false);
      return;
    }
    setActiveNoteGroupId("");
    setSidebarMode("project");
  }

  function reorderProjects(sourceProjectId: string, targetProjectId: string, position: RailDropPosition) {
    setProjects((current) => {
      const sourceProject = current.find((project) => project.id === sourceProjectId);
      const targetProject = current.find((project) => project.id === targetProjectId);
      if (!sourceProject || !targetProject || isNotesProject(sourceProject) || isNotesProject(targetProject)) return current;
      return moveItemById(current, sourceProjectId, targetProjectId, position);
    });
  }

  function reorderProjectGroups(projectId: string, sourceGroupId: string, targetGroupId: string, position: RailDropPosition) {
    updateProject(projectId, (project) => {
      const visibleGroups = (project.groups ?? []).filter((group) => !isSystemProjectGroupId(group.id));
      if (isNotesProject(project)) {
        if (sourceGroupId === NOTES_INBOX_GROUP_ID || targetGroupId === NOTES_INBOX_GROUP_ID) return project;
        const inboxGroup = visibleGroups.find((group) => group.id === NOTES_INBOX_GROUP_ID);
        const reorderableGroups = visibleGroups.filter((group) => group.id !== NOTES_INBOX_GROUP_ID);
        const reorderedGroups = moveItemById(reorderableGroups, sourceGroupId, targetGroupId, position);
        return {
          ...project,
          groups: inboxGroup ? [inboxGroup, ...reorderedGroups] : reorderedGroups,
          updatedAt: today(),
        };
      }
      return {
        ...project,
        groups: moveItemById(visibleGroups, sourceGroupId, targetGroupId, position),
        updatedAt: today(),
      };
    });
  }

  function updateProject(projectId: string, updater: (project: WritingProject) => WritingProject) {
    setProjects((current) => current.map((project) => (project.id === projectId ? normalizeProject(updater(project)) : project)));
  }

  function updateSheet(sheetId: string, updater: (sheet: WritingSheet) => WritingSheet) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: today(),
      sheets: project.sheets.map((sheet) => (sheet.id === sheetId ? updater(sheet) : sheet)),
    }));
  }

  function openNewProjectDialog() {
    setEditingProjectId("");
    setNewProjectDraft({
      title: DEFAULT_NEW_PROJECT_TITLE,
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewProjectDialogOpen(true);
  }

  function closeNewProjectDialog() {
    setNewProjectDialogOpen(false);
    setEditingProjectId("");
  }

  function submitNewProjectDialog() {
    if (editingProjectId) {
      updateProject(editingProjectId, (project) => ({
        ...project,
        title: newProjectDraft.title.trim() || DEFAULT_NEW_PROJECT_TITLE,
        icon: newProjectDraft.icon || DEFAULT_PROJECT_ICON,
        iconColor: newProjectDraft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
        updatedAt: today(),
      }));
      setNewProjectDialogOpen(false);
      setEditingProjectId("");
      return;
    }
    createProject("blank", newProjectDraft);
    setNewProjectDialogOpen(false);
  }

  function openEditProjectDialog(project: WritingProject) {
    setSidebarContextMenu(null);
    setEditingProjectId(project.id);
    setNewProjectDraft({
      title: project.title || DEFAULT_NEW_PROJECT_TITLE,
      icon: project.icon || DEFAULT_PROJECT_ICON,
      iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewProjectDialogOpen(true);
  }

  function createProject(templateId = "blank", draft?: NewProjectDraft) {
    const template = PROJECT_TEMPLATES.find((item) => item.id === templateId) ?? PROJECT_TEMPLATES[0];
    const id = `project-${Date.now()}`;
    const now = nowTimestamp();
    const projectTitle = draft?.title.trim() || DEFAULT_NEW_PROJECT_TITLE;
    const project: WritingProject = {
      id,
      title: projectTitle,
      icon: draft?.icon ?? DEFAULT_PROJECT_ICON,
      iconColor: draft?.iconColor ?? DEFAULT_PROJECT_ICON_COLOR,
      description: template.projectDescription,
      status: "构思",
      targetPlatform: template.targetPlatform,
      targetWords: template.targetWords,
      tags: template.tags,
      updatedAt: now,
      groups: createDefaultProjectGroups(),
      sheets: template.sheets.map((sheet, index) => ({
        ...sheet,
        id: `sheet-${Date.now()}-${index}`,
        groupId: sheet.groupId ?? getDefaultGroupIdForSheetType(sheet.type),
        createdAt: now,
        updatedAt: now,
      })),
    };

    const normalizedProject = normalizeProject(project);
    const firstGroup = getVisibleProjectGroups(normalizedProject)[0];
    const firstSheet = firstGroup ? getSheetsInGroup(normalizedProject, firstGroup.id)[0] : normalizedProject.sheets[0];
    setProjects((current) => [...current, normalizedProject]);
    setActiveProjectId(id);
    setActiveGroupId(firstGroup?.id ?? "");
    if (firstGroup) {
      setActiveGroupIdsByProject((current) => ({ ...current, [id]: firstGroup.id }));
    }
    setActiveSheetId(firstSheet?.id ?? normalizedProject.sheets[0]?.id ?? "");
    setSidebarMode("project");
    setProjectFilter("active");
    setSheetSearch("");
  }

  async function switchLibrary() {
    const selectedPath = await chooseLibraryFolder();
    if (!selectedPath) return;
    setLibraryStatus("正在切换写作库...");
    setPersistenceReady(false);
    try {
      const loaded = await loadProjects(selectedPath);
      const normalizedProjects = normalizeProjects(loaded.projects);
      const conversations = await loadConversations(loaded.libraryPath, [createWelcomeConversation()]);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
      setProjects(normalizedProjects);
      setActiveProjectId(restoredSelection.projectId);
      setActiveSheetId(restoredSelection.sheetId);
      aiAssistant.replaceConversations(conversations);
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
      const indexedProjects = await rebuildProjectIndex(libraryPath);
      const normalizedProjects = normalizeProjects(indexedProjects);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, activeProjectId, activeSheetId);
      const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === restoredSelection.sheetId);

      skipNextLibrarySaveRef.current = true;
      setProjects(normalizedProjects);
      setActiveProjectId(restoredSelection.projectId);
      setActiveSheetId(restoredSelection.sheetId);
      setActiveGroupId(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSheet?.id ?? "") : "");
      if (sidebarMode === "project" && (!restoredProject || isNotesProject(restoredProject))) {
        setSidebarMode("library");
      }
      setSheetSearch("");
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
      const activeNoteGroupStillExists = normalizedProjects
        .find(isNotesProject)
        ?.groups?.some((group) => group.id === activeNoteGroupId);

      skipNextLibrarySaveRef.current = true;
      setProjects(normalizedProjects);
      if (activeProjectStillExists) {
        setActiveProjectId(activeProjectStillExists.id);
        setActiveSheetId(activeSheetStillExists?.id ?? "");
        setActiveGroupId(
          activeGroupStillExists
            ? activeGroupId
            : resolveProjectGroupId(activeProjectStillExists, "", activeSheetStillExists?.id ?? ""),
        );
      } else {
        const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
        const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
        setActiveProjectId(restoredSelection.projectId);
        setActiveSheetId(restoredSelection.sheetId);
        setActiveGroupId(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSelection.sheetId) : "");
        setSidebarMode("library");
      }
      if (activeNoteGroupId && !activeNoteGroupStillExists) {
        setActiveNoteGroupId("");
      }
      setLibraryStatus(paths.length > 1 ? "已同步外部文件改动" : "已同步外部文件改动");
    } catch (error) {
      setLibraryStatus(`同步外部文件改动失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openProjectContextMenu(event: MouseEvent<HTMLElement>, project: WritingProject) {
    event.preventDefault();
    event.stopPropagation();
    const path = buildProjectFolderPath(libraryPath, project);
    if (!path) {
      setLibraryStatus("当前项目还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: project.title,
      kind: "project",
      projectId: project.id,
    });
  }

  function openNoteGroupContextMenu(event: MouseEvent<HTMLElement>, group: ProjectGroup) {
    event.preventDefault();
    event.stopPropagation();
    const path = buildNoteGroupFolderPath(libraryPath, group);
    if (!path) {
      setLibraryStatus("当前笔记分组还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: group.title,
      kind: "note-group",
    });
  }

  function openSheetContextMenu(event: MouseEvent<HTMLElement>, sheetId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (!libraryPath.startsWith("/")) {
      setLibraryStatus("当前文稿还没有可显示的本地 Markdown 文件");
      return;
    }
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = ownerProject?.sheets.find((item) => item.id === sheetId);
    if (!ownerProject || !sheet) return;
    const path = buildSheetMarkdownPath(libraryPath, ownerProject, sheet);
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: sheet.title || "无标题",
      kind: "sheet",
    });
  }

  async function showSidebarContextTargetInFinder() {
    if (!sidebarContextMenu) return;
    const target = sidebarContextMenu;
    setSidebarContextMenu(null);
    setLibraryStatus(`正在访达中显示：${target.label}`);
    try {
      await saveProjects(projects, libraryPath);
      await revealLocalPath(target.path);
      setLibraryStatus(`已在访达中显示：${target.label}`);
    } catch (error) {
      setLibraryStatus(`在访达中显示失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function requestDeleteProjectFromContextMenu() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project || isNotesProject(project)) return;
    setSidebarContextMenu(null);
    setProjectPendingTrash(project);
  }

  async function confirmMoveProjectToTrash() {
    if (!projectPendingTrash) return;
    setLibraryStatus(`正在将「${projectPendingTrash.title}」移入废纸篓...`);
    try {
      const nextProjects = await moveProjectToTrash(libraryPath, projectPendingTrash);
      const normalizedProjects = normalizeProjects(nextProjects);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
      const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
      skipNextLibrarySaveRef.current = true;
      setProjects(normalizedProjects);
      setProjectPendingTrash(null);
      setActiveProjectId(restoredSelection.projectId);
      setActiveSheetId(restoredSelection.sheetId);
      setActiveGroupId(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSelection.sheetId) : "");
      setSidebarMode("library");
      setProjectFilter("active");
      setLibraryStatus(`已将「${projectPendingTrash.title}」移入废纸篓`);
    } catch (error) {
      setLibraryStatus(`删除项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmClearTrash() {
    if (!libraryPath.startsWith("/")) return;
    setLibraryStatus("正在清空废纸篓...");
    try {
      const nextProjects = await clearLibraryTrash(libraryPath);
      const normalizedProjects = normalizeProjects(nextProjects);
      skipNextLibrarySaveRef.current = true;
      setProjects(normalizedProjects);
      setTrashClearPending(false);
      setLibraryStatus("已清空废纸篓");
    } catch (error) {
      setLibraryStatus(`清空废纸篓失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openCurrentSheetMarkdown() {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      setLibraryStatus("当前稿件还没有可打开的本地 Markdown 文件");
      return;
    }
    const markdownPath = buildSheetMarkdownPath(libraryPath, activeProject, activeSheet);
    setLibraryStatus(`正在打开 ${activeSheet.title} 的 Markdown...`);
    try {
      await saveProjects(projects, libraryPath);
      await openLocalPath(markdownPath);
      setLibraryStatus(`已打开当前稿件 Markdown：${activeSheet.title}`);
    } catch (error) {
      setLibraryStatus(`打开当前稿件 Markdown 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function importImagesIntoActiveSheet(files: File[]): Promise<string[]> {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      const message = "当前项目还不能保存图片，请先使用本地写作库。";
      setImageInsertStatus(message);
      setLibraryStatus(message);
      return [];
    }
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return [];

    setImageInsertStatus(`正在导入 ${imageFiles.length} 张图片...`);
    setLibraryStatus(`正在导入 ${imageFiles.length} 张图片...`);
    try {
      const references: string[] = [];
      for (const file of imageFiles) {
        const buffer = await file.arrayBuffer();
        const imported = await saveProjectImage(
          libraryPath,
          activeProject,
          getPreferredImageFilename(file, `image-${Date.now()}`),
          Array.from(new Uint8Array(buffer)),
        );
        const referencePath = resolveInsertedImagePath(imported.path, libraryPath, activeProject, activeSheet, imageReferenceFormat);
        references.push(createImageReference(referencePath, stripExtension(imported.name), imageReferenceFormat));
      }
      projectResources.refresh();
      setImageInsertStatus(`已导入 ${references.length} 张图片`);
      setLibraryStatus(`已导入 ${references.length} 张图片到 assets/images。`);
      return references;
    } catch (error) {
      const message = `导入图片失败：${error instanceof Error ? error.message : String(error)}`;
      setImageInsertStatus(message);
      setLibraryStatus(message);
      return [];
    }
  }

  async function insertImagesFromPicker() {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      const message = "当前项目还不能插入图片，请先使用本地写作库。";
      setImageInsertStatus(message);
      setLibraryStatus(message);
      return;
    }

    setImageInsertStatus("正在选择图片...");
    setLibraryStatus("正在选择图片...");
    try {
      const importedImages = await importProjectImages(libraryPath, activeProject);
      if (importedImages.length === 0) {
        setImageInsertStatus("未选择图片");
        setLibraryStatus("未选择图片。");
        return;
      }
      const references = importedImages.map((image) => {
        const referencePath = resolveInsertedImagePath(image.path, libraryPath, activeProject, activeSheet, imageReferenceFormat);
        return createImageReference(referencePath, stripExtension(image.name), imageReferenceFormat);
      });
      insertImagesIntoActiveEditor(references);
      projectResources.refresh();
      setImageInsertStatus(`已插入 ${references.length} 张图片`);
      setLibraryStatus(`已插入 ${references.length} 张图片。`);
    } catch (error) {
      const message = `插入图片失败：${error instanceof Error ? error.message : String(error)}`;
      setImageInsertStatus(message);
      setLibraryStatus(message);
    }
  }

  function insertImagesIntoActiveEditor(references: string[]) {
    const view = editorRef.current;
    if (!view || references.length === 0) return;
    const selection = view.state.selection.main;
    insertImageReferenceBlocks(view, references, selection.from, selection.to);
  }

  function resolveActiveSheetImagePreview(referencePath: string, alt: string) {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) return null;
    const sourcePath = resolveSheetImageSourcePath(libraryPath, activeProject, activeSheet, referencePath);
    if (!sourcePath) return null;
    return {
      src: convertFileSrc(sourcePath),
      alt,
      label: referencePath,
    };
  }

  async function createProjectFromMarkdownFiles() {
    try {
      const files = await importMarkdownFiles();
      if (files.length === 0) return;
      const importedSheets = buildImportedMarkdownSheets(files);
      const id = `project-import-${Date.now()}`;
      const projectTitle = importedSheets.length === 1 ? importedSheets[0].title : `${importedSheets[0].title} 等 ${importedSheets.length} 篇`;
      const project: WritingProject = {
        id,
        title: projectTitle,
        icon: DEFAULT_PROJECT_ICON,
        iconColor: DEFAULT_PROJECT_ICON_COLOR,
        description: `从 ${files.length} 个 Markdown/text 文件创建。`,
        status: "构思",
        targetPlatform: "未指定",
        targetWords: Math.max(1000, importedSheets.reduce((total, sheet) => total + sheet.targetWords, 0)),
        tags: ["导入"],
        groups: createDefaultProjectGroups(),
        sheets: importedSheets,
        updatedAt: nowTimestamp(),
        publishingChecklist: DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({ ...item })),
        writingBrief: DEFAULT_WRITING_BRIEF,
        exportHistory: [],
      };
      const normalizedProject = normalizeProject(project);
      const firstGroup = getVisibleProjectGroups(normalizedProject)[0];
      const firstSheet = firstGroup ? getSheetsInGroup(normalizedProject, firstGroup.id)[0] : normalizedProject.sheets[0];
      setProjects((current) => [...current, normalizedProject]);
      setActiveProjectId(id);
      setActiveGroupId(firstGroup?.id ?? "");
      if (firstGroup) {
        setActiveGroupIdsByProject((current) => ({ ...current, [id]: firstGroup.id }));
      }
      setActiveSheetId(firstSheet?.id ?? importedSheets[0]?.id ?? "");
      setSidebarMode("project");
      setProjectFilter("active");
      setSheetSearch("");
    } catch (error) {
      window.alert(`导入 Markdown 新建项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function jumpToSheetHeading(line: number) {
    const view = editorRef.current;
    if (!view) return;
    const targetLine = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
    view.dispatch({
      selection: { anchor: targetLine.from },
      effects: EditorView.scrollIntoView(targetLine.from, { y: "center" }),
    });
    view.focus();
  }

  function saveActiveSheetVersion() {
    if (!activeSheet) return;
    const now = new Date();
    const version: SheetVersion = {
      id: `version-${now.getTime()}`,
      title: `${activeSheet.title} · ${formatSnapshotTime(now.toISOString())}`,
      body: activeSheet.body,
      createdAt: now.toISOString(),
      wordCount: countWords(activeSheet.body),
    };
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [version, ...(sheet.versions ?? [])].slice(0, 20),
      updatedAt: nowTimestamp(),
    }));
  }

  function restoreSheetVersion(version: SheetVersion) {
    if (!activeSheet) return;
    const confirmed = window.confirm(`恢复版本「${version.title}」？当前正文会被这个版本替换。`);
    if (!confirmed) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      body: version.body,
      status: sheet.status === "已发布" || sheet.status === "已归档" ? "修改中" : sheet.status,
      updatedAt: nowTimestamp(),
    }));
  }


  function closeWindow() {
    void appWindow?.close();
  }

  function minimizeWindow() {
    void appWindow?.minimize();
  }

  function toggleMaximizeWindow() {
    void appWindow?.toggleMaximize();
  }

  function startWindowDrag(event: MouseEvent<HTMLElement>) {
    if (!appWindow || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, textarea, select, a, [data-no-window-drag]")) return;
    void appWindow.startDragging();
  }

  function renderWindowControls() {
    return (
      <div className="window-controls" aria-label="窗口控制">
        <button className="window-control close" onClick={closeWindow} aria-label="关闭窗口" />
        <button className="window-control minimize" onClick={minimizeWindow} aria-label="最小化窗口" />
        <button className="window-control zoom" onClick={toggleMaximizeWindow} aria-label="最大化窗口" />
      </div>
    );
  }

  function renderSettingsButton() {
    return (
      <button className="icon-button glass-toggle-button" onClick={() => setSettingsDialogOpen(true)} title="打开设置">
        <Settings size={16} />
      </button>
    );
  }

  function renderSettingsDialog(activeProjectTitle: string) {
    return (
      <SettingsDialog
        open={settingsDialogOpen}
        libraryPath={libraryPath}
        libraryStatus={libraryStatus}
        projectCount={userProjectCount}
        activeProjectTitle={activeProjectTitle}
        libraryRailOpen={libraryRailOpen}
        sheetRailOpen={sheetRailOpen}
        inspectorOpen={inspectorOpen}
        inspectorWidth={inspectorWidth}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        editorTypography={editorTypography}
        imageReferenceFormat={imageReferenceFormat}
        sheetPreviewMode={sheetPreviewMode}
        planMode={aiAssistant.planMode}
        agentProvider={aiAssistant.agentProvider}
        codexCliPath={aiAssistant.codexCliPath}
        claudeCliPath={aiAssistant.claudeCliPath}
        probeSummary={agentProbeSummary}
        probeBusy={aiAssistant.probeBusy}
        onClose={() => setSettingsDialogOpen(false)}
        onLibraryRailOpenChange={setLibraryRailOpen}
        onSheetRailOpenChange={setSheetRailOpen}
        onInspectorOpenChange={setInspectorOpen}
        onInspectorWidthChange={setInspectorWidth}
        onFocusModeChange={setFocusMode}
        onTypewriterModeChange={setTypewriterMode}
        onEditorTypographyChange={setEditorTypography}
        onImageReferenceFormatChange={setImageReferenceFormat}
        onSheetPreviewModeChange={setSheetPreviewMode}
        onPlanModeChange={aiAssistant.setPlanMode}
        onAgentProviderChange={aiAssistant.setAgentProvider}
        onCodexCliPathChange={aiAssistant.setCodexCliPath}
        onClaudeCliPathChange={aiAssistant.setClaudeCliPath}
        onRunAgentProbe={aiAssistant.runProbe}
        onSwitchLibrary={switchLibrary}
        onOpenLibrary={openCurrentLibrary}
      />
    );
  }

  function collapseLibraryRail() {
    setSheetRailOpen(true);
    setLibraryRailOpen(false);
  }

  function expandLibraryRail() {
    setLibraryRailOpen(true);
  }

  function navigateSheet(direction: -1 | 1) {
    const nextSheet = filteredSheets[activeSheetIndex + direction];
    if (!nextSheet) return;
    selectSheetById(nextSheet.id);
  }

  function updateSheetSortPreference(nextPreference: Partial<SheetSortPreference>) {
    setSheetSortPreferences((current) => {
      const currentPreference = current[sheetSortPreferenceKey] ?? DEFAULT_SHEET_SORT_PREFERENCE;
      const updatedPreference = { ...currentPreference, ...nextPreference };
      if (
        currentPreference.mode === updatedPreference.mode &&
        currentPreference.direction === updatedPreference.direction
      ) {
        return current;
      }
      return {
        ...current,
        [sheetSortPreferenceKey]: updatedPreference,
      };
    });
  }

  function updateSheetSortMode(mode: SheetSortMode) {
    updateSheetSortPreference({ mode });
  }

  function updateSheetSortDirection(direction: SheetSortDirection) {
    updateSheetSortPreference({ direction });
  }

  function updateCurrentSheetManualOrder(sourceSheetId: string, targetSheetId: string, position: RailDropPosition) {
    const visibleSheetIds = filteredSheets.map((sheet) => sheet.id);
    setSheetManualOrders((current) => {
      const savedOrder = current[sheetSortPreferenceKey] ?? [];
      const savedVisibleIds = savedOrder.filter((sheetId) => visibleSheetIds.includes(sheetId));
      const missingVisibleIds = visibleSheetIds.filter((sheetId) => !savedVisibleIds.includes(sheetId));
      const baseOrder = [...savedVisibleIds, ...missingVisibleIds];
      const nextOrder = moveIdByPosition(baseOrder, sourceSheetId, targetSheetId, position);
      if (nextOrder.join("|") === baseOrder.join("|")) return current;
      return {
        ...current,
        [sheetSortPreferenceKey]: nextOrder,
      };
    });
  }

  function commitSheetReorder(sourceSheetId: string, targetSheetId: string, position: RailDropPosition) {
    updateCurrentSheetManualOrder(sourceSheetId, targetSheetId, position);
    if (sidebarMode === "project" || activeNoteGroupId) {
      sheetActions.commitSheetReorder(sourceSheetId, targetSheetId, position);
    } else {
      sheetActions.clearSheetDragState();
    }
  }

  if (!activeProject) {
    return (
      <div className="nibva-window">
        <div className="empty-window-toolbar" data-tauri-drag-region onMouseDown={startWindowDrag}>
          {renderWindowControls()}
          {renderSettingsButton()}
        </div>
        <EmptyLibraryState
          libraryPath={libraryPath}
          onCreateBlankProject={openNewProjectDialog}
          onImportMarkdown={createProjectFromMarkdownFiles}
          onSwitchLibrary={switchLibrary}
          onOpenLibrary={openCurrentLibrary}
          onCreateFromTemplate={createProject}
        />
        <NewProjectDialog
          open={newProjectDialogOpen}
          draft={newProjectDraft}
          inputRef={newProjectNameInputRef}
          title={editingProjectId ? "编辑项目" : "新建项目"}
          submitLabel={editingProjectId ? "保存" : "创建"}
          onClose={closeNewProjectDialog}
          onSubmit={submitNewProjectDialog}
          onDraftChange={setNewProjectDraft}
        />
        {renderSettingsDialog("")}
      </div>
    );
  }

  return (
    <div className="nibva-window">
    <div
      className={clsx(
        "app-shell",
        focusMode && "focus-mode",
        !libraryRailOpen && "hide-library-rail",
        !sheetRailOpen && "hide-sheet-rail",
        (!inspectorOpen || !activeSheet) && "hide-inspector",
      )}
      style={{ "--inspector-expanded-col": `${inspectorWidth}px` } as CSSProperties}
    >
      <div className="window-controls-overlay" data-tauri-drag-region onMouseDown={startWindowDrag}>
        {renderWindowControls()}
        {renderSettingsButton()}
        {!libraryRailOpen && sheetRailOpen && (
          <button className="icon-button glass-toggle-button" onClick={expandLibraryRail} title="展开导航栏">
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>
      <section className="left-workspace">
      <LibraryRail
        open={libraryRailOpen}
        sidebarMode={sidebarMode}
        activeProject={activeProject}
        projectFilter={projectFilter}
        projectsOpen={libraryProjectsOpen}
        notesOpen={libraryNotesOpen}
        filteredProjects={filteredProjects}
        notesGroups={noteGroups}
        projectGroups={visibleProjectGroups}
        resolvedActiveGroupId={resolvedActiveGroupId}
        activeNoteGroupId={activeNoteGroupId}
        onWindowDragStart={startWindowDrag}
        onCreateProject={openNewProjectDialog}
        onCollapse={collapseLibraryRail}
        onProjectFilterChange={selectProjectFilter}
        onProjectsOpenChange={setLibraryProjectsOpen}
        onNotesOpenChange={setLibraryNotesOpen}
        onEnterProject={enterProject}
        onProjectContextMenu={openProjectContextMenu}
        onSelectNoteGroup={selectNoteGroup}
        onNoteGroupContextMenu={openNoteGroupContextMenu}
        onCreateNoteGroup={() => openNewGroupDialog(NOTES_PROJECT_ID)}
        onReorderProjects={reorderProjects}
        onReorderNoteGroups={(sourceGroupId, targetGroupId, position) =>
          reorderProjectGroups(NOTES_PROJECT_ID, sourceGroupId, targetGroupId, position)
        }
        onBackToLibrary={() => setSidebarMode("library")}
        onRenameProject={(title) => updateProject(activeProject.id, (project) => ({ ...project, title, updatedAt: today() }))}
        onCreateProjectGroup={openNewGroupDialog}
        onSelectProjectGroup={selectProjectGroup}
        onReorderProjectGroups={(sourceGroupId, targetGroupId, position) =>
          reorderProjectGroups(activeProject.id, sourceGroupId, targetGroupId, position)
        }
      />

      {sidebarContextMenu && (
        <div
          className="sidebar-context-menu"
          style={{
            left: Math.min(sidebarContextMenu.x, window.innerWidth - 148),
            top: Math.min(sidebarContextMenu.y, window.innerHeight - (sidebarContextMenu.kind === "project" ? 112 : 52)),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {sidebarContextMenu.kind === "project" && sidebarContextMenu.projectId && (
            <button
              onClick={() => {
                const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
                if (project) openEditProjectDialog(project);
              }}
            >
              编辑项目
            </button>
          )}
          <button onClick={showSidebarContextTargetInFinder}>在访达中显示</button>
          {sidebarContextMenu.kind === "project" && (
            <button className="danger-menu-item" onClick={requestDeleteProjectFromContextMenu}>
              删除项目
            </button>
          )}
        </div>
      )}

      {sheetRailOpen && (
        <SheetRail
          title={sheetListTitle}
          search={sheetSearch}
          filterOpen={sheetFilterOpen}
          sortMode={sheetSortMode}
          sortDirection={sheetSortDirection}
          sheets={filteredSheets}
          sheetProjectTitleById={sheetProjectTitleById}
          activeSheetId={activeSheetId}
          draggingSheetId={sheetActions.draggingSheetId}
          dropTarget={sheetActions.sheetDropTarget}
          canReorderSheets={canManuallyReorderSheets}
          onWindowDragStart={startWindowDrag}
          onCreateSheet={sheetActions.createSheet}
          onSearchChange={setSheetSearch}
          onFilterOpenChange={setSheetFilterOpen}
          onSortModeChange={updateSheetSortMode}
          onSortDirectionChange={updateSheetSortDirection}
          onSelectSheet={selectSheetById}
          onClearSheetSelection={() => setActiveSheetId("")}
          onSheetContextMenu={openSheetContextMenu}
          onSheetReorderStart={sheetActions.beginSheetReorder}
          onSheetReorderPreview={sheetActions.previewSheetReorder}
          onSheetReorderCommit={commitSheetReorder}
          onSheetReorderEnd={sheetActions.clearSheetDragState}
          trashMode={projectFilter === "trash"}
          onClearTrash={() => setTrashClearPending(true)}
        />
      )}
      </section>

      <main className="editor-zone">
        <EditorToolbar
          inspectorOpen={inspectorOpen}
          canNavigateBack={activeSheetIndex > 0}
          canNavigateForward={activeSheetIndex >= 0 && activeSheetIndex < filteredSheets.length - 1}
          canInsertImage={Boolean(activeSheet && libraryPath.startsWith("/"))}
          imageStatus={imageInsertStatus}
          onNavigateBack={() => navigateSheet(-1)}
          onNavigateForward={() => navigateSheet(1)}
          onInsertImage={insertImagesFromPicker}
          onToggleInspector={() => setInspectorOpen((value) => !value)}
        />

        {activeSheet ? (
          <EditorCanvas
            sheet={activeSheet}
            previewMode={sheetPreviewMode}
            previewHtml={sheetPreviewHtml}
            previewBusy={sheetPreviewBusy}
            typewriterMode={typewriterMode}
            typography={editorTypography}
            onCreateEditor={(view) => {
              editorRef.current = view;
            }}
            onBodyChange={(value) =>
              updateSheet(activeSheet.id, (sheet) => {
                const headingTitle = extractFirstHeadingTitle(value);
                return {
                  ...sheet,
                  title: headingTitle || sheet.title,
                  body: value,
                  updatedAt: nowTimestamp(),
                };
              })
            }
            onSelectionChange={(text) => setEditorSelectionText((current) => (current === text ? current : text))}
            onImportImageFiles={importImagesIntoActiveSheet}
            onResolveImagePreview={resolveActiveSheetImagePreview}
          />
        ) : (
          <section className="editor-empty-state">没有已选的文稿</section>
        )}
      </main>

      {inspectorOpen && activeSheet && (
        <InspectorPanel
          ai={<AiAssistantPanel assistant={aiAssistant} activeSheet={activeSheet} onClose={() => setInspectorOpen(false)} />}
          onResizeStart={beginInspectorResize}
        />
      )}
    </div>
    <NewProjectDialog
      open={newProjectDialogOpen}
      draft={newProjectDraft}
      inputRef={newProjectNameInputRef}
      title={editingProjectId ? "编辑项目" : "新建项目"}
      submitLabel={editingProjectId ? "保存" : "创建"}
      onClose={closeNewProjectDialog}
      onSubmit={submitNewProjectDialog}
      onDraftChange={setNewProjectDraft}
    />
    <NewProjectDialog
      open={newGroupDialogOpen}
      draft={newGroupDraft}
      inputRef={newGroupNameInputRef}
      title="新建组"
      onClose={closeNewGroupDialog}
      onSubmit={submitNewGroupDialog}
      onDraftChange={setNewGroupDraft}
    />
    {renderSettingsDialog(activeProject.title)}
    <ConfirmDialog
      open={Boolean(projectPendingTrash)}
      title="删除项目"
      message={`项目「${projectPendingTrash?.title ?? ""}」会被移入废纸篓，项目下的所有文件也会一起移动。`}
      confirmLabel="移入废纸篓"
      destructive
      onCancel={() => setProjectPendingTrash(null)}
      onConfirm={confirmMoveProjectToTrash}
    />
    <ConfirmDialog
      open={trashClearPending}
      title="清空废纸篓"
      message="废纸篓中的项目和文稿会被彻底删除，此操作不可撤销。"
      confirmLabel="清空"
      destructive
      onCancel={() => setTrashClearPending(false)}
      onConfirm={confirmClearTrash}
    />
    </div>
  );
}

export default App;
