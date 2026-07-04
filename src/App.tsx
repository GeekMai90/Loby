import { getCurrentWindow } from "@tauri-apps/api/window";
import { EditorView } from "@codemirror/view";
import { PanelLeftOpen } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type {
  InspectorTab,
  ProjectGroup,
  SidebarMode,
  SheetVersion,
  WritingProject,
  WritingSheet,
} from "./types";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorToolbar } from "./components/EditorToolbar";
import { EmptyLibraryState } from "./components/EmptyLibraryState";
import { InspectorPanel } from "./components/InspectorPanel";
import { LibraryRail } from "./components/LibraryRail";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { SheetRail, type SheetSortDirection, type SheetSortMode } from "./components/SheetRail";
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
import { today } from "./lib/dates";
import { formatSnapshotTime } from "./lib/formatters";
import { buildImportedMarkdownSheets } from "./lib/importMarkdown";
import { extractFirstHeadingTitle } from "./lib/markdownTitle";
import {
  buildProjectResourcePaths,
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
  NOTES_PROJECT_ID,
  normalizeProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
  sortProjects,
  type ProjectFilter,
} from "./lib/projectModel";
import {
  chooseLibraryFolder,
  importMarkdownFiles,
  loadBrowserProjects,
  loadConversations,
  loadProjects,
  openLocalPath,
  saveProjects,
} from "./lib/persistence";
import { countWords } from "./lib/text";

interface SidebarContextMenuState {
  x: number;
  y: number;
  path: string;
  label: string;
}

function sortSheetList(sheets: WritingSheet[], mode: SheetSortMode, direction: SheetSortDirection): WritingSheet[] {
  if (mode === "manual") return sheets;
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

function getSheetSortTitle(sheet: WritingSheet): string {
  return sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || sheet.title || "无标题";
}

function getSheetUpdatedValue(sheet: WritingSheet): number {
  const value = Date.parse(sheet.updatedAt);
  return Number.isNaN(value) ? getSheetCreatedValue(sheet) : value;
}

function getSheetCreatedValue(sheet: WritingSheet): number {
  const match = sheet.id.match(/(?:sheet|version)-(\d{10,})/);
  if (match) return Number(match[1]);
  const fallback = Date.parse(sheet.updatedAt);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const initialProjects = useMemo(() => normalizeProjects(loadBrowserProjects()), []);
  const [projects, setProjects] = useState<WritingProject[]>(initialProjects);
  const initialSelection = resolveSavedProjectSelection(initialProjects, initialSettings.activeProjectId, initialSettings.activeSheetId);
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.projectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.sheetId);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("信息");
  const [libraryRailOpen, setLibraryRailOpen] = useState(initialSettings.libraryRailOpen);
  const [sheetRailOpen, setSheetRailOpen] = useState(initialSettings.sheetRailOpen);
  const [inspectorOpen, setInspectorOpen] = useState(initialSettings.inspectorOpen);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
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
  const [activeGroupId, setActiveGroupId] = useState("");
  const [sheetPreviewHtml, setSheetPreviewHtml] = useState("");
  const [sheetPreviewBusy, setSheetPreviewBusy] = useState(false);
  const [libraryPath, setLibraryPath] = useState("Loading library");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [projectSearch, setProjectSearch] = useState("");
  const [sheetSearch, setSheetSearch] = useState("");
  const [sidebarContextMenu, setSidebarContextMenu] = useState<SidebarContextMenuState | null>(null);
  const [sheetSortMode, setSheetSortMode] = useState<SheetSortMode>("manual");
  const [sheetSortDirection, setSheetSortDirection] = useState<SheetSortDirection>("desc");
  const [writingSessionStarts, setWritingSessionStarts] = useState<Record<string, number>>({});
  const editorRef = useRef<EditorView | null>(null);
  const newProjectNameInputRef = useRef<HTMLInputElement | null>(null);
  const newGroupNameInputRef = useRef<HTMLInputElement | null>(null);
  const appWindow = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );

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
  const notesProject = useMemo(() => getNotesProject(projects), [projects]);
  const noteGroups = useMemo(() => getVisibleProjectGroups(notesProject), [notesProject]);
  const selectedNoteGroup = noteGroups.find((group) => group.id === activeNoteGroupId) ?? noteGroups[0];
  const visibleProjectGroups = useMemo(() => (activeProject ? getVisibleProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const filteredProjects = useMemo(
    () => sortProjects(filterProjects(projects, projectSearch)),
    [projects, projectSearch],
  );
  const filteredProjectIds = filteredProjects.map((project) => project.id).join("|");
  const selectedVisibleGroup = visibleProjectGroups.find((group) => group.id === activeGroupId) ?? visibleProjectGroups[0];
  const sheetListTitle =
    sidebarMode === "project"
      ? (selectedVisibleGroup?.title ?? activeProject?.title ?? "全部")
      : activeNoteGroupId
        ? (selectedNoteGroup?.title ?? "收件箱")
        : getProjectFilterTitle(projectFilter);
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
    () => sortSheetList(filterSheets(sheetListSource, sheetSearch), sheetSortMode, sheetSortDirection),
    [sheetListSource, sheetSearch, sheetSortDirection, sheetSortMode],
  );
  const activeSheetIndex = filteredSheets.findIndex((sheet) => sheet.id === activeSheetId);
  const projectResourcePaths = useMemo(
    () => (activeProject ? buildProjectResourcePaths(libraryPath, activeProject) : null),
    [activeProject, libraryPath],
  );
  const projectResources = useProjectResources(activeProject, libraryPath);
  const exportManager = useProjectExport({
    project: activeProject,
    libraryPath,
    activeGroupId: resolvedActiveGroupId,
    updateProject,
    onSelectSheet: setActiveSheetId,
    onShowInfo: () => setInspectorTab("信息"),
    onResourceChanged: projectResources.refresh,
  });
  const sheetActions = useSheetActions({
    activeProject,
    activeSheet,
    activeGroupId: resolvedActiveGroupId,
    activeSheetId,
    updateProject,
    onSelectSheet: setActiveSheetId,
    onSelectGroup: setActiveGroupId,
    onSheetSearchChange: setSheetSearch,
    onShowInfo: () => setInspectorTab("信息"),
    onRemoveSheetFromExport: exportManager.removeSheetFromSelection,
    onFocusEditor: () => {
      window.setTimeout(() => {
        editorRef.current?.focus();
      }, 0);
    },
  });
  const aiAssistant = useAiAssistant({
    persistenceReady,
    libraryPath,
    initialPlanMode: initialSettings.planMode,
    initialCodexCliPath: initialSettings.codexCliPath,
    activeProject,
    activeSheet,
    projectResourcePaths,
    selectedResourcePaths: projectResources.selectedResourcePaths,
    getEditorView: () => editorRef.current,
    updateActiveSheet: (updater) => {
      if (!activeSheet) return;
      updateSheet(activeSheet.id, updater);
    },
    onCreateSuggestionMaterialSheet: sheetActions.saveSuggestionAsMaterialSheet,
    onOpenAiPanel: () => {
      setInspectorTab("AI");
      setInspectorOpen(true);
    },
  });

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
    saveAgentSettings({
      libraryRailOpen,
      sheetRailOpen,
      inspectorOpen,
      focusMode,
      typewriterMode,
      activeGroupIdsByProject,
    });
  }, [activeGroupIdsByProject, libraryRailOpen, sheetRailOpen, inspectorOpen, focusMode, typewriterMode]);

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
    if (filteredProjects.length === 0 || filteredProjects.some((project) => project.id === activeProjectId)) return;
    setActiveProjectId(filteredProjects[0].id);
    setActiveSheetId(filteredProjects[0].sheets[0]?.id ?? "");
    setActiveGroupId(resolveProjectGroupId(filteredProjects[0], "", filteredProjects[0].sheets[0]?.id ?? ""));
  }, [activeProjectId, filteredProjectIds, filteredProjects]);

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
    if (ownerProject && ownerProject.id !== activeProjectId) {
      setActiveProjectId(ownerProject.id);
      if (ownerSheet?.groupId) {
        setActiveGroupId(ownerSheet.groupId);
        setActiveGroupIdsByProject((current) => ({ ...current, [ownerProject.id]: ownerSheet.groupId ?? "" }));
      }
    }
    if (isNotesProject(ownerProject)) {
      setActiveNoteGroupId(ownerSheet?.groupId ?? selectedNoteGroup?.id ?? "");
      setSidebarMode("library");
    } else {
      setActiveNoteGroupId("");
    }
    setActiveSheetId(sheetId);
  }

  function openNewGroupDialog() {
    setNewGroupDraft({
      title: "无标题",
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewGroupDialogOpen(true);
  }

  function closeNewGroupDialog() {
    setNewGroupDialogOpen(false);
  }

  function submitNewGroupDialog() {
    createProjectGroup(newGroupDraft);
    setNewGroupDialogOpen(false);
  }

  function createProjectGroup(draft: NewProjectDraft) {
    if (!activeProject) return;
    const title = draft.title.trim() || "无标题";
    const group: ProjectGroup = {
      id: `group-${Date.now()}`,
      title,
      icon: draft.icon || DEFAULT_PROJECT_ICON,
      iconColor: draft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
      description: "",
    };
    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: [...(project.groups ?? []).filter((item) => !isSystemProjectGroupId(item.id)), group],
      updatedAt: today(),
    }));
    setActiveGroupId(group.id);
    setActiveGroupIdsByProject((current) => ({ ...current, [activeProject.id]: group.id }));
    setSidebarMode("project");
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
    setNewProjectDraft({
      title: DEFAULT_NEW_PROJECT_TITLE,
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewProjectDialogOpen(true);
  }

  function closeNewProjectDialog() {
    setNewProjectDialogOpen(false);
  }

  function submitNewProjectDialog() {
    createProject("blank", newProjectDraft);
    setNewProjectDialogOpen(false);
  }

  function createProject(templateId = "blank", draft?: NewProjectDraft) {
    const template = PROJECT_TEMPLATES.find((item) => item.id === templateId) ?? PROJECT_TEMPLATES[0];
    const id = `project-${Date.now()}`;
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
      updatedAt: today(),
      groups: createDefaultProjectGroups(),
      sheets: template.sheets.map((sheet, index) => ({
        ...sheet,
        id: `sheet-${Date.now()}-${index}`,
        groupId: sheet.groupId ?? getDefaultGroupIdForSheetType(sheet.type),
        updatedAt: today(),
      })),
    };

    const normalizedProject = normalizeProject(project);
    const firstGroup = getVisibleProjectGroups(normalizedProject)[0];
    const firstSheet = firstGroup ? getSheetsInGroup(normalizedProject, firstGroup.id)[0] : normalizedProject.sheets[0];
    setProjects((current) => [normalizedProject, ...current]);
    setActiveProjectId(id);
    setActiveGroupId(firstGroup?.id ?? "");
    if (firstGroup) {
      setActiveGroupIdsByProject((current) => ({ ...current, [id]: firstGroup.id }));
    }
    setActiveSheetId(firstSheet?.id ?? normalizedProject.sheets[0]?.id ?? "");
    setSidebarMode("project");
    setProjectSearch("");
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
    });
  }

  async function showSidebarContextTargetInFinder() {
    if (!sidebarContextMenu) return;
    const target = sidebarContextMenu;
    setSidebarContextMenu(null);
    setLibraryStatus(`正在访达中显示：${target.label}`);
    try {
      await saveProjects(projects, libraryPath);
      await openLocalPath(target.path);
      setLibraryStatus(`已在访达中显示：${target.label}`);
    } catch (error) {
      setLibraryStatus(`在访达中显示失败：${error instanceof Error ? error.message : String(error)}`);
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
        updatedAt: today(),
        publishingChecklist: DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({ ...item })),
        writingBrief: DEFAULT_WRITING_BRIEF,
        exportHistory: [],
      };
      const normalizedProject = normalizeProject(project);
      const firstGroup = getVisibleProjectGroups(normalizedProject)[0];
      const firstSheet = firstGroup ? getSheetsInGroup(normalizedProject, firstGroup.id)[0] : normalizedProject.sheets[0];
      setProjects((current) => [normalizedProject, ...current]);
      setActiveProjectId(id);
      setActiveGroupId(firstGroup?.id ?? "");
      if (firstGroup) {
        setActiveGroupIdsByProject((current) => ({ ...current, [id]: firstGroup.id }));
      }
      setActiveSheetId(firstSheet?.id ?? importedSheets[0]?.id ?? "");
      setSidebarMode("project");
      setProjectFilter("active");
      setProjectSearch("");
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
      updatedAt: today(),
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
      updatedAt: today(),
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

  if (!activeProject) {
    return (
      <div className="nibva-window">
        <div className="empty-window-toolbar" data-tauri-drag-region onMouseDown={startWindowDrag}>
          {renderWindowControls()}
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
          onClose={closeNewProjectDialog}
          onSubmit={submitNewProjectDialog}
          onDraftChange={setNewProjectDraft}
        />
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
    >
      <div className="window-controls-overlay" data-tauri-drag-region onMouseDown={startWindowDrag}>
        {renderWindowControls()}
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
        projectSearch={projectSearch}
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
        onProjectSearchChange={setProjectSearch}
        onProjectsOpenChange={setLibraryProjectsOpen}
        onNotesOpenChange={setLibraryNotesOpen}
        onEnterProject={enterProject}
        onProjectContextMenu={openProjectContextMenu}
        onSelectNoteGroup={selectNoteGroup}
        onNoteGroupContextMenu={openNoteGroupContextMenu}
        onBackToLibrary={() => setSidebarMode("library")}
        onRenameProject={(title) => updateProject(activeProject.id, (project) => ({ ...project, title, updatedAt: today() }))}
        onCreateProjectGroup={openNewGroupDialog}
        onSelectProjectGroup={selectProjectGroup}
      />

      {sidebarContextMenu && (
        <div
          className="sidebar-context-menu"
          style={{
            left: Math.min(sidebarContextMenu.x, window.innerWidth - 190),
            top: Math.min(sidebarContextMenu.y, window.innerHeight - 52),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={showSidebarContextTargetInFinder}>在访达中显示</button>
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
          activeSheetId={activeSheetId}
          draggingSheetId={sheetActions.draggingSheetId}
          dropTarget={sheetActions.sheetDropTarget}
          onWindowDragStart={startWindowDrag}
          onCreateSheet={sheetActions.createSheet}
          onSearchChange={setSheetSearch}
          onFilterOpenChange={setSheetFilterOpen}
          onSortModeChange={setSheetSortMode}
          onSortDirectionChange={setSheetSortDirection}
          onSelectSheet={selectSheetById}
          onClearSheetSelection={() => setActiveSheetId("")}
          onSheetDragStart={sheetActions.handleSheetDragStart}
          onSheetDragOver={sheetActions.handleSheetDragOver}
          onSheetDrop={sheetActions.handleSheetDrop}
          onSheetDragEnd={sheetActions.clearSheetDragState}
        />
      )}
      </section>

      <main className="editor-zone">
        <EditorToolbar
          inspectorOpen={inspectorOpen}
          canNavigateBack={activeSheetIndex > 0}
          canNavigateForward={activeSheetIndex >= 0 && activeSheetIndex < filteredSheets.length - 1}
          onNavigateBack={() => navigateSheet(-1)}
          onNavigateForward={() => navigateSheet(1)}
          onToggleInspector={() => setInspectorOpen((value) => !value)}
        />

        {activeSheet ? (
          <EditorCanvas
            sheet={activeSheet}
            previewMode={sheetPreviewMode}
            previewHtml={sheetPreviewHtml}
            previewBusy={sheetPreviewBusy}
            typewriterMode={typewriterMode}
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
                  updatedAt: today(),
                };
              })
            }
          />
        ) : (
          <section className="editor-empty-state">没有已选的文稿</section>
        )}
      </main>

      {inspectorOpen && activeSheet && (
        <InspectorPanel
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          info={{
            activeProject,
            activeSheet,
            sessionStartWords: writingSessionStarts[activeSheet.id] ?? countWords(activeSheet.body),
            updateProject: (updater) => updateProject(activeProject.id, updater),
            updateSheet: (updater) => updateSheet(activeSheet.id, updater),
            onResetWritingSession: () =>
              setWritingSessionStarts((current) => ({
                ...current,
                [activeSheet.id]: countWords(activeSheet.body),
              })),
            onJumpToHeading: jumpToSheetHeading,
            getCurrentDate: today,
          }}
          ai={
            <AiAssistantPanel
              assistant={aiAssistant}
              projectSheets={activeProject.sheets}
              resourcePaths={projectResourcePaths}
              projectResources={projectResources.projectResources}
              selectedResourcePaths={projectResources.selectedResourcePaths}
              resourceImportStatus={projectResources.resourceImportStatus}
              resourcePreview={projectResources.resourcePreview}
              resourcePreviewBusy={projectResources.resourcePreviewBusy}
              onSelectedResourcePathsChange={projectResources.setSelectedResourcePaths}
              onImportAssets={() => projectResources.importTarget("assets")}
              onImportReferences={() => projectResources.importTarget("references")}
              onOpenResourcePath={projectResources.openResourcePath}
              onPreviewResource={projectResources.previewResource}
              onClearResourcePreview={projectResources.clearResourcePreview}
            />
          }
          resources={{
            resourcePaths: projectResourcePaths,
            projectResources: projectResources.projectResources,
            selectedResourcePaths: projectResources.selectedResourcePaths,
            resourceImportStatus: projectResources.resourceImportStatus,
            resourcePreview: projectResources.resourcePreview,
            resourcePreviewBusy: projectResources.resourcePreviewBusy,
            onSelectedResourcePathsChange: projectResources.setSelectedResourcePaths,
            onImportAssets: () => projectResources.importTarget("assets"),
            onImportReferences: () => projectResources.importTarget("references"),
            onOpenResourcePath: projectResources.openResourcePath,
            onPreviewResource: projectResources.previewResource,
            onClearResourcePreview: projectResources.clearResourcePreview,
          }}
          history={{
            project: activeProject,
            activeSheet,
            onSaveVersion: saveActiveSheetVersion,
            onRestoreVersion: restoreSheetVersion,
            onOpenExportHistoryItem: exportManager.openExportHistoryItem,
          }}
          exportPanel={exportManager.exportPanelProps}
        />
      )}
    </div>
    <NewProjectDialog
      open={newProjectDialogOpen}
      draft={newProjectDraft}
      inputRef={newProjectNameInputRef}
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
    </div>
  );
}

export default App;
