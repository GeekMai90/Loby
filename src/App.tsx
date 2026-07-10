import { listen } from "@tauri-apps/api/event";
import type { EditorView } from "@codemirror/view";
import { PanelLeftOpen } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type {
  AiChangeSet,
  SidebarMode,
  SheetSortDirection,
  SheetManualOrders,
  SheetSortMode,
  SheetSortPreference,
  SheetVersion,
  TrashEntry,
  WritingProject,
  WritingSheet,
} from "./types";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import { AppTooltip } from "./components/AppTooltip";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DocumentFunctionRail } from "./components/DocumentFunctionRail";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorToolbar } from "./components/EditorToolbar";
import { EmptyLibraryState } from "./components/EmptyLibraryState";
import { InspectorPanel } from "./components/InspectorPanel";
import { LibraryRail } from "./components/LibraryRail";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { ProjectFieldManagerDialog } from "./components/ProjectFieldManagerDialog";
import { TrashPreview } from "./components/TrashPreview";
import { SettingsDialog } from "./components/SettingsDialog";
import { SheetRail } from "./components/SheetRail";
import { WindowControls } from "./components/WindowControls";
import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "./constants/projectAppearance";
import { useAiAssistant } from "./hooks/useAiAssistant";
import { useAiActionExecutor } from "./hooks/useAiActionExecutor";
import { useAiChangeSetReview } from "./hooks/useAiChangeSetReview";
import { useDocumentRailMode } from "./hooks/useDocumentRailMode";
import { useEditorImages } from "./hooks/useEditorImages";
import { useFocusModeLayout } from "./hooks/useFocusModeLayout";
import { useLibraryPersistence } from "./hooks/useLibraryPersistence";
import { useProjectResources } from "./hooks/useProjectResources";
import { useSheetActions } from "./hooks/useSheetActions";
import { useSidebarContextMenu } from "./hooks/useSidebarContextMenu";
import { useWindowChrome } from "./hooks/useWindowChrome";
import { resolveAiActionNavigationTarget } from "./lib/aiActionNavigation";
import { renderMarkdownHtml } from "./lib/export";
import { loadAgentSettings, saveAgentSettings } from "./lib/agentSettings";
import { nowTimestamp, today } from "./lib/dates";
import { buildImportedMarkdownSheets } from "./lib/importMarkdown";
import { APP_SHORTCUTS, matchesAppShortcut } from "./lib/keyboardShortcuts";
import { extractFirstHeadingTitle } from "./lib/markdownTitle";
import { createSheetVersionSnapshot } from "./lib/sheetVersions";
import { MAX_SHEET_RAIL_WIDTH, MIN_SHEET_RAIL_WIDTH, resolveSheetRailDrag } from "./lib/sheetRailResize";
import {
  addProjectGroup,
  createImportedProjectFromSheets,
  createProjectFromTemplate,
  createProjectGroupDraft,
  getInitialProjectSelection,
  reorderProjectGroupsForRail,
} from "./lib/projectCreation";
import {
  filterProjects,
  filterSheets,
  getProjectFilterTitle,
  getNotesProject,
  getSheetsForProjectFilter,
  getSheetsInGroup,
  getVisibleProjectGroups,
  isNotesProject,
  NOTES_PROJECT_ID,
  normalizeProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
  type ProjectFilter,
} from "./lib/projectModel";
import { deleteTrashEntry, importMarkdownFiles, listLibraryTrash, loadBrowserProjects, restoreTrashEntry } from "./lib/persistence";
import { filterSheetsByDocumentProperty, mergeCompatiblePropertyDefinitions, type DocumentPropertyFilter } from "./lib/documentProperties";
import type { InlineAiPendingEdit } from "./lib/inlineAi";
import { DEFAULT_SHEET_SORT_PREFERENCE, moveIdByPosition, moveItemById, sortSheetList, type RailDropPosition } from "./lib/sheetSorting";

const LEFT_SIDEBAR_REVEAL_DRAG_DISTANCE = 36;

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const initialProjects = useMemo(() => normalizeProjects(loadBrowserProjects()), []);
  const [projects, setProjects] = useState<WritingProject[]>(initialProjects);
  const initialSelection = resolveSavedProjectSelection(initialProjects, initialSettings.activeProjectId, initialSettings.activeSheetId);
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.projectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.sheetId);
  const [libraryRailOpen, setLibraryRailOpen] = useState(initialSettings.libraryRailOpen);
  const [sheetRailOpen, setSheetRailOpen] = useState(initialSettings.sheetRailOpen);
  const [sheetRailWidth, setSheetRailWidth] = useState(initialSettings.sheetRailWidth);
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
  const [activeGroupIdsByProject, setActiveGroupIdsByProject] = useState<Record<string, string>>(initialSettings.activeGroupIdsByProject);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [propertyManagerProjectId, setPropertyManagerProjectId] = useState("");
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
  const [, setImageInsertStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetPropertyFilter, setSheetPropertyFilter] = useState<DocumentPropertyFilter>({
    fieldKey: "",
    operator: "contains",
    value: "",
  });
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [selectedTrashEntryId, setSelectedTrashEntryId] = useState("");
  const [trashActionBusy, setTrashActionBusy] = useState(false);
  const [editorSelectionText, setEditorSelectionText] = useState("");
  const [sheetSortPreferences, setSheetSortPreferences] = useState<Record<string, SheetSortPreference>>(
    initialSettings.sheetSortPreferences,
  );
  const [sheetManualOrders, setSheetManualOrders] = useState<SheetManualOrders>(initialSettings.sheetManualOrders);
  const editorRef = useRef<EditorView | null>(null);
  const newProjectNameInputRef = useRef<HTMLInputElement | null>(null);
  const newGroupNameInputRef = useRef<HTMLInputElement | null>(null);
  const windowChrome = useWindowChrome({
    inspectorWidth,
    onInspectorWidthChange: setInspectorWidth,
    onInspectorOpenChange: setInspectorOpen,
  });
  const libraryPersistence = useLibraryPersistence({
    appWindow: windowChrome.appWindow,
    projects,
    activeProjectId,
    activeSheetId,
    activeGroupId,
    activeNoteGroupId,
    sidebarMode,
    onProjectsChange: setProjects,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onSidebarModeChange: setSidebarMode,
    onSheetSearchChange: setSheetSearch,
  });
  const { libraryPath, libraryStatus, persistenceReady, setLibraryStatus } = libraryPersistence;

  useEffect(() => {
    if (projectFilter !== "trash") {
      setSelectedTrashEntryId("");
      return;
    }
    let cancelled = false;
    listLibraryTrash(libraryPath)
      .then((entries) => {
        if (!cancelled) setTrashEntries(entries);
      })
      .catch((error) => {
        if (!cancelled) setLibraryStatus(`读取废纸篓失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath, projectFilter, projects, setLibraryStatus]);

  useEffect(() => {
    setEditorSelectionText("");
  }, [activeSheetId]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const selectedTrashEntry = projectFilter === "trash" ? trashEntries.find((entry) => entry.id === selectedTrashEntryId) : undefined;
  const trashSheets = useMemo<WritingSheet[]>(
    () =>
      trashEntries.map((entry) => ({
        id: `trash:${entry.id}`,
        title: entry.title,
        groupId: entry.groupId,
        type: entry.kind === "project" ? "提纲" : "正文",
        status: "构思",
        targetWords: 0,
        summary: entry.kind === "project" ? "已删除项目" : `来自 ${entry.projectTitle || "写作库"}`,
        body: entry.body,
        createdAt: "",
        updatedAt: entry.deletedAt ? new Date(entry.deletedAt * 1000).toISOString() : "",
      })),
    [trashEntries],
  );
  const userProjectCount = useMemo(() => projects.filter((project) => !isNotesProject(project)).length, [projects]);
  const notesProject = useMemo(() => getNotesProject(projects), [projects]);
  const noteGroups = useMemo(() => getVisibleProjectGroups(notesProject), [notesProject]);
  const selectedNoteGroup = noteGroups.find((group) => group.id === activeNoteGroupId) ?? noteGroups[0];
  const documentRailMode = useDocumentRailMode({ hasActiveSheet: Boolean(activeSheet) });
  const focusModeLayout = useFocusModeLayout({
    focusMode,
    libraryRailOpen,
    sheetRailOpen,
    inspectorOpen,
    onFocusModeChange: setFocusMode,
    onLibraryRailOpenChange: setLibraryRailOpen,
    onSheetRailOpenChange: setSheetRailOpen,
    onInspectorOpenChange: setInspectorOpen,
    onRailModeSwitchExpandedChange: documentRailMode.setRailModeSwitchExpanded,
  });
  const visibleProjectGroups = useMemo(() => (activeProject ? getVisibleProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const filteredProjects = useMemo(() => filterProjects(projects, "", projectFilter === "archived"), [projectFilter, projects]);
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
  const sheetListSource = useMemo(() => {
    if (!activeProject) return [];
    if (sidebarMode === "project") {
      return selectedVisibleGroup ? getSheetsInGroup(activeProject, selectedVisibleGroup.id) : [];
    }
    if (activeNoteGroupId) {
      return selectedNoteGroup ? getSheetsInGroup(notesProject, selectedNoteGroup.id) : [];
    }
    const librarySheets = projects.flatMap((project) =>
      project.sheets.map((sheet) => (project.archivedAt && !sheet.archivedAt ? { ...sheet, archivedAt: project.archivedAt } : sheet)),
    );
    return getSheetsForProjectFilter(librarySheets, projectFilter, today());
  }, [activeNoteGroupId, activeProject, notesProject, projectFilter, projects, selectedNoteGroup, selectedVisibleGroup, sidebarMode]);
  const propertyDefinitionsForFilter = useMemo(() => {
    const sourceProjects =
      sidebarMode === "project" && activeProject ? [activeProject] : projects.filter((project) => !isNotesProject(project));
    return mergeCompatiblePropertyDefinitions(sourceProjects);
  }, [activeProject, projects, sidebarMode]);
  const filteredSheets = useMemo(() => {
    const activeSheetManualOrder = sheetManualOrders[sheetSortPreferenceKey] ?? [];
    const definition = propertyDefinitionsForFilter.find((item) => item.key === sheetPropertyFilter.fieldKey);
    const matchingSheets = filterSheetsByDocumentProperty(filterSheets(sheetListSource, sheetSearch), definition, sheetPropertyFilter);
    return sortSheetList(matchingSheets, sheetSortMode, sheetSortDirection, activeSheetManualOrder);
  }, [
    propertyDefinitionsForFilter,
    sheetListSource,
    sheetManualOrders,
    sheetPropertyFilter,
    sheetSearch,
    sheetSortDirection,
    sheetSortMode,
    sheetSortPreferenceKey,
  ]);
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
    sheetSortMode === "manual" &&
    sheetSearch.trim() === "" &&
    !(sidebarMode === "library" && !activeNoteGroupId && projectFilter === "trash");
  const sheetActionProject = activeNoteGroupId ? notesProject : activeProject;
  const sheetActionGroupId = activeNoteGroupId ? activeNoteGroupId : resolvedActiveGroupId;
  const sheetActionActiveSheet = sheetActionProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const sidebarActions = useSidebarContextMenu({
    libraryPath,
    projects,
    activeProjectId,
    activeSheetId,
    onProjectsChange: setProjects,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onSidebarModeChange: setSidebarMode,
    onProjectFilterChange: setProjectFilter,
    onLibraryStatusChange: setLibraryStatus,
    onSkipNextLibrarySave: libraryPersistence.skipNextLibrarySave,
    onEditProject: openEditProjectDialog,
    onManageProjectFields: (project) => setPropertyManagerProjectId(project.id),
  });
  const projectResources = useProjectResources(activeProject, libraryPath);
  const editorImages = useEditorImages({
    activeProject,
    activeSheet,
    libraryPath,
    imageReferenceFormat,
    editorRef,
    onResourcesChanged: projectResources.refresh,
    onImageStatusChange: setImageInsertStatus,
    onLibraryStatusChange: setLibraryStatus,
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
  });
  const aiAssistant = useAiAssistant({
    persistenceReady,
    libraryPath,
    initialPlanMode: initialSettings.planMode,
    initialAgentProvider: initialSettings.agentProvider,
    initialAgentModel: initialSettings.agentModel,
    initialAgentReasoningEffort: initialSettings.agentReasoningEffort,
    initialAgentQuickMode: initialSettings.agentQuickMode,
    initialCodexCliPath: initialSettings.codexCliPath,
    initialClaudeCliPath: initialSettings.claudeCliPath,
    projects,
    activeProject,
    activeSheet,
    selectedText: editorSelectionText,
    onOpenAiPanel: () => {
      setInspectorOpen(true);
    },
    onCreateChangeSet: handleCreateAiChangeSet,
    loadedConversations: libraryPersistence.loadedConversations,
  });
  const aiChangeSets = useMemo(() => aiAssistant.messages.flatMap((message) => message.changeSets ?? []), [aiAssistant.messages]);
  const aiChangeSetReview = useAiChangeSetReview({
    aiChangeSets,
    activeSheet,
    activeSheetId,
    editorRef,
    getSheetById: findSheetById,
    updateSheet,
    updateChangeSet: aiAssistant.updateChangeSet,
    onOpenChangeSetTarget: selectSheetById,
    onInspectorOpenChange: setInspectorOpen,
  });
  const aiActions = useMemo(() => aiAssistant.messages.flatMap((message) => message.actions ?? []), [aiAssistant.messages]);
  const aiActionExecutor = useAiActionExecutor({
    aiActions,
    projects,
    activeProject,
    activeSheet,
    activeProjectId,
    activeSheetId,
    resolvedActiveGroupId,
    libraryPath,
    imageReferenceFormat,
    editorRef,
    updateProject,
    updateSheet,
    updateAction: aiAssistant.updateAction,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onActiveGroupIdsByProjectChange: setActiveGroupIdsByProject,
    onSheetSearchChange: setSheetSearch,
    onInspectorOpenChange: setInspectorOpen,
    onLibraryStatusChange: setLibraryStatus,
    onResourcesChanged: projectResources.refresh,
  });

  function handleCreateAiChangeSet(changeSet: AiChangeSet): AiChangeSet {
    return aiChangeSetReview.createChangeSet(changeSet);
  }

  const agentProbeSummary = aiAssistant.probe
    ? aiAssistant.probe.ok
      ? `已连接 ${aiAssistant.probe.resolvedPath || aiAssistant.agentProvider}`
      : "检测失败"
    : "尚未检测";

  useEffect(() => {
    saveAgentSettings({
      libraryRailOpen,
      sheetRailOpen,
      sheetRailWidth,
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
    sheetRailWidth,
    inspectorOpen,
    inspectorWidth,
    focusMode,
    typewriterMode,
    editorTypography,
    imageReferenceFormat,
    sheetSortPreferences,
    sheetManualOrders,
  ]);

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
    function openSettingsFromShortcut(event: KeyboardEvent) {
      if (!matchesAppShortcut(event, APP_SHORTCUTS.openSettings)) return;
      event.preventDefault();
      setSettingsDialogOpen(true);
    }

    window.addEventListener("keydown", openSettingsFromShortcut);
    return () => window.removeEventListener("keydown", openSettingsFromShortcut);
  }, []);

  useEffect(() => {
    if (!windowChrome.appWindow) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("nibva://open-settings", () => {
      setSettingsDialogOpen(true);
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
  }, [windowChrome.appWindow]);

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

  function resetSheetFilters() {
    setSheetSearch("");
    setSheetPropertyFilter({ fieldKey: "", operator: "contains", value: "" });
    setSheetFilterOpen(false);
  }

  function enterProject(project: WritingProject) {
    documentRailMode.showSheetListRail();
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
    resetSheetFilters();
  }

  function selectProjectFilter(filter: ProjectFilter) {
    documentRailMode.showSheetListRail();
    setActiveNoteGroupId("");
    setProjectFilter(filter);
    resetSheetFilters();
  }

  function selectNoteGroup(groupId: string) {
    documentRailMode.showSheetListRail();
    const group = noteGroups.find((item) => item.id === groupId) ?? noteGroups[0];
    if (!group) return;
    const firstSheet = getSheetsInGroup(notesProject, group.id)[0];
    setSidebarMode("library");
    setActiveProjectId(NOTES_PROJECT_ID);
    setActiveGroupId(group.id);
    setActiveNoteGroupId(group.id);
    setActiveSheetId(firstSheet?.id ?? "");
    resetSheetFilters();
  }

  function selectProjectGroup(groupId: string) {
    if (!activeProject) return;
    documentRailMode.showSheetListRail();
    setActiveGroupId(groupId);
    setActiveGroupIdsByProject((current) => ({ ...current, [activeProject.id]: groupId }));
    const nextSheet = getSheetsInGroup(activeProject, groupId)[0];
    setActiveSheetId(nextSheet?.id ?? "");
    resetSheetFilters();
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

  function openAiActionTarget(actionId: string) {
    const action = aiActions.find((item) => item.id === actionId);
    if (!action) return;
    const target = resolveAiActionNavigationTarget(action, projects);
    if (!target.ok) {
      setLibraryStatus(target.message);
      aiAssistant.updateAction(actionId, (item) => ({ ...item, error: target.message }));
      return;
    }

    if (target.sheetId) {
      const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === target.sheetId));
      if (ownerProject && !isNotesProject(ownerProject)) setProjectFilter("active");
      selectSheetById(target.sheetId);
      resetSheetFilters();
      setInspectorOpen(true);
      setLibraryStatus(`已切回 AI 动作目标文稿「${target.sheetTitle || target.sheetId}」。`);
      return;
    }

    const targetProject = projects.find((project) => project.id === target.projectId);
    if (!targetProject) return;
    const groupId = target.groupId ?? targetProject.groups?.[0]?.id ?? "";
    setActiveProjectId(targetProject.id);
    setActiveGroupId(groupId);
    setActiveSheetId("");
    resetSheetFilters();
    setInspectorOpen(true);
    if (isNotesProject(targetProject)) {
      setSidebarMode("library");
      setActiveNoteGroupId(groupId);
    } else {
      setSidebarMode("project");
      setProjectFilter("active");
      setActiveNoteGroupId("");
      if (groupId) setActiveGroupIdsByProject((current) => ({ ...current, [targetProject.id]: groupId }));
    }
    setLibraryStatus(`已切回 AI 动作目标项目「${target.projectTitle}」。`);
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
    const isNotesGroup = isNotesProject(targetProject);
    const group = createProjectGroupDraft(targetProject, draft);
    updateProject(targetProject.id, (project) => addProjectGroup(project, group));
    setActiveGroupId(group.id);
    setActiveGroupIdsByProject((current) => ({ ...current, [targetProject.id]: group.id }));
    if (isNotesGroup) {
      setActiveProjectId(NOTES_PROJECT_ID);
      setActiveNoteGroupId(group.id);
      setActiveSheetId("");
      setSidebarMode("library");
      setLibraryNotesOpen(true);
      resetSheetFilters();
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
    updateProject(projectId, (project) => reorderProjectGroupsForRail(project, sourceGroupId, targetGroupId, position));
  }

  function updateProject(projectId: string, updater: (project: WritingProject) => WritingProject) {
    setProjects((current) => current.map((project) => (project.id === projectId ? normalizeProject(updater(project)) : project)));
  }

  function updateSheet(sheetId: string, updater: (sheet: WritingSheet) => WritingSheet) {
    setProjects((current) =>
      current.map((project) => {
        if (!project.sheets.some((sheet) => sheet.id === sheetId)) return project;
        return normalizeProject({
          ...project,
          updatedAt: today(),
          sheets: project.sheets.map((sheet) => (sheet.id === sheetId ? updater(sheet) : sheet)),
        });
      }),
    );
  }

  async function restoreSelectedTrashEntry() {
    if (!selectedTrashEntry) return;
    setTrashActionBusy(true);
    try {
      const restoredProjects = normalizeProjects(await restoreTrashEntry(libraryPath, selectedTrashEntry.id));
      libraryPersistence.skipNextLibrarySave();
      setProjects(restoredProjects);
      setTrashEntries(await listLibraryTrash(libraryPath));
      setSelectedTrashEntryId("");
      const restoredProject = restoredProjects.find((project) => project.id === selectedTrashEntry.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === selectedTrashEntry.sheetId);
      if (restoredProject) setActiveProjectId(restoredProject.id);
      if (restoredSheet) {
        setActiveSheetId(restoredSheet.id);
        setActiveGroupId(restoredSheet.groupId ?? "");
      }
      setLibraryStatus(`已恢复${selectedTrashEntry.kind === "project" ? "项目" : "文稿"}「${selectedTrashEntry.title}」`);
    } catch (error) {
      setLibraryStatus(`恢复失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTrashActionBusy(false);
    }
  }

  async function permanentlyDeleteSelectedTrashEntry() {
    if (!selectedTrashEntry) return;
    if (!window.confirm(`永久删除「${selectedTrashEntry.title}」？此操作不可撤销。`)) return;
    setTrashActionBusy(true);
    try {
      setTrashEntries(await deleteTrashEntry(libraryPath, selectedTrashEntry.id));
      setSelectedTrashEntryId("");
      setLibraryStatus(`已永久删除「${selectedTrashEntry.title}」`);
    } catch (error) {
      setLibraryStatus(`永久删除失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTrashActionBusy(false);
    }
  }

  function revealEditorPosition(position: number) {
    const view = editorRef.current;
    if (!view) return;
    const safePosition = Math.max(0, Math.min(position, view.state.doc.length));
    view.dispatch({
      selection: { anchor: safePosition },
      scrollIntoView: true,
    });
    view.focus();
  }

  function replaceActiveSheetBody(body: string) {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [createSheetVersionSnapshot(sheet, "manual", "查找替换前自动保存"), ...(sheet.versions ?? [])].slice(0, 20),
      body,
      updatedAt: nowTimestamp(),
    }));
  }

  function applyInlineAiEdit(edit: InlineAiPendingEdit): boolean {
    const targetSheet = findSheetById(edit.sheetId);
    if (!targetSheet || targetSheet.body !== edit.baseBody || targetSheet.body.slice(edit.from, edit.to) !== edit.text) return false;
    updateSheet(edit.sheetId, (sheet) => ({
      ...sheet,
      versions: [createSheetVersionSnapshot(sheet, "ai", `AI 修改「${edit.summary}」前自动保存`), ...(sheet.versions ?? [])].slice(0, 20),
      title: extractFirstHeadingTitle(edit.proposedBody) || sheet.title,
      body: edit.proposedBody,
      updatedAt: nowTimestamp(),
    }));
    return true;
  }

  function rejectInlineAiEdit(edit: InlineAiPendingEdit): boolean {
    const targetSheet = findSheetById(edit.sheetId);
    if (!targetSheet || targetSheet.body !== edit.proposedBody) return false;
    updateSheet(edit.sheetId, (sheet) => ({
      ...sheet,
      versions: [
        createSheetVersionSnapshot(sheet, "restore", `撤销 AI 修改「${edit.summary}」前自动保存`),
        ...(sheet.versions ?? []),
      ].slice(0, 20),
      title: extractFirstHeadingTitle(edit.baseBody) || sheet.title,
      body: edit.baseBody,
      updatedAt: nowTimestamp(),
    }));
    return true;
  }

  function restoreActiveSheetVersion(version: SheetVersion) {
    if (!activeSheet) return;
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [createSheetVersionSnapshot(sheet, "restore", `恢复到「${version.title}」前自动保存`), ...(sheet.versions ?? [])].slice(
        0,
        20,
      ),
      body: version.body,
      title: extractFirstHeadingTitle(version.body) || sheet.title,
      updatedAt: nowTimestamp(),
    }));
  }

  function findSheetById(sheetId: string): WritingSheet | undefined {
    return projects.flatMap((project) => project.sheets).find((sheet) => sheet.id === sheetId);
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
    setEditingProjectId(project.id);
    setNewProjectDraft({
      title: project.title || DEFAULT_NEW_PROJECT_TITLE,
      icon: project.icon || DEFAULT_PROJECT_ICON,
      iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    });
    setNewProjectDialogOpen(true);
  }

  function createProject(templateId = "blank", draft?: NewProjectDraft) {
    const normalizedProject = createProjectFromTemplate(templateId, draft);
    const { groupId, sheetId } = getInitialProjectSelection(normalizedProject);
    setProjects((current) => [...current, normalizedProject]);
    setActiveProjectId(normalizedProject.id);
    setActiveGroupId(groupId);
    if (groupId) {
      setActiveGroupIdsByProject((current) => ({ ...current, [normalizedProject.id]: groupId }));
    }
    setActiveSheetId(sheetId);
    setSidebarMode("project");
    setProjectFilter("active");
    resetSheetFilters();
  }

  async function createProjectFromMarkdownFiles() {
    try {
      const files = await importMarkdownFiles();
      if (files.length === 0) return;
      const importedSheets = buildImportedMarkdownSheets(files);
      const normalizedProject = createImportedProjectFromSheets(importedSheets, files.length);
      const { groupId, sheetId } = getInitialProjectSelection(normalizedProject);
      setProjects((current) => [...current, normalizedProject]);
      setActiveProjectId(normalizedProject.id);
      setActiveGroupId(groupId);
      if (groupId) {
        setActiveGroupIdsByProject((current) => ({ ...current, [normalizedProject.id]: groupId }));
      }
      setActiveSheetId(sheetId);
      setSidebarMode("project");
      setProjectFilter("active");
      resetSheetFilters();
    } catch (error) {
      window.alert(`导入 Markdown 新建项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const windowControls = (
    <WindowControls
      onClose={windowChrome.closeWindow}
      onMinimize={windowChrome.minimizeWindow}
      onToggleMaximize={windowChrome.toggleMaximizeWindow}
    />
  );

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
        onFocusModeChange={focusModeLayout.setFocusModeEnabled}
        onTypewriterModeChange={setTypewriterMode}
        onEditorTypographyChange={setEditorTypography}
        onImageReferenceFormatChange={setImageReferenceFormat}
        onSheetPreviewModeChange={setSheetPreviewMode}
        onPlanModeChange={aiAssistant.setPlanMode}
        onAgentProviderChange={aiAssistant.setAgentProvider}
        onCodexCliPathChange={aiAssistant.setCodexCliPath}
        onClaudeCliPathChange={aiAssistant.setClaudeCliPath}
        onRunAgentProbe={aiAssistant.runProbe}
        onSwitchLibrary={libraryPersistence.switchLibrary}
        onOpenLibrary={libraryPersistence.openCurrentLibrary}
      />
    );
  }

  function collapseLibraryRail() {
    setSheetRailOpen(true);
    setLibraryRailOpen(false);
  }

  function expandLibraryRail() {
    setLibraryRailOpen(true);
    setSheetRailOpen(true);
  }

  function expandSheetRailOnly() {
    setSheetRailOpen(true);
  }

  function beginSheetRailResize(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sheetRailWidth;
    let collapsed = false;

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      if (collapsed) return;
      const result = resolveSheetRailDrag(startWidth, moveEvent.clientX - startX, !libraryRailOpen);
      if (result.shouldCollapse) {
        collapsed = true;
        setSheetRailOpen(false);
        documentRailMode.setRailModeSwitchExpanded(false);
        return;
      }
      setSheetRailWidth(result.width);
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing-sheet-rail");
    }

    document.body.classList.add("resizing-sheet-rail");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function beginLeftSidebarRevealDrag(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    let revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      expandSheetRailOnly();
    }

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      if (moveEvent.clientX - startX >= LEFT_SIDEBAR_REVEAL_DRAG_DISTANCE) reveal();
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("dragging-left-sidebar-reveal");
    }

    document.body.classList.add("dragging-left-sidebar-reveal");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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
      if (currentPreference.mode === updatedPreference.mode && currentPreference.direction === updatedPreference.direction) {
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
        <div
          className="empty-window-toolbar"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        >
          {windowControls}
        </div>
        <EmptyLibraryState
          libraryPath={libraryPath}
          onCreateBlankProject={openNewProjectDialog}
          onImportMarkdown={createProjectFromMarkdownFiles}
          onSwitchLibrary={libraryPersistence.switchLibrary}
          onOpenLibrary={libraryPersistence.openCurrentLibrary}
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
          windowChrome.inspectorSnap && "inspector-snap",
        )}
        style={
          {
            "--sheet-expanded-col": `${sheetRailWidth}px`,
            "--inspector-expanded-col": `${inspectorWidth}px`,
          } as CSSProperties
        }
      >
        <div
          className="window-controls-overlay"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        >
          {windowControls}
          {!libraryRailOpen && sheetRailOpen && (
            <button className="icon-button glass-toggle-button" onClick={() => setLibraryRailOpen(true)} title="展开导航栏">
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>
        {!focusMode && !libraryRailOpen && !sheetRailOpen && (
          <button
            type="button"
            className="left-sidebar-reveal-handle"
            onMouseDown={beginLeftSidebarRevealDrag}
            onClick={expandSheetRailOnly}
            aria-label="展开列表栏"
            title="向右拖动展开列表栏"
          />
        )}
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
            onWindowDragStart={windowChrome.startWindowDrag}
            onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
            onCreateProject={openNewProjectDialog}
            onCollapse={collapseLibraryRail}
            onProjectFilterChange={selectProjectFilter}
            onProjectsOpenChange={setLibraryProjectsOpen}
            onNotesOpenChange={setLibraryNotesOpen}
            onEnterProject={enterProject}
            onProjectContextMenu={sidebarActions.openProjectContextMenu}
            onSelectNoteGroup={selectNoteGroup}
            onNoteGroupContextMenu={sidebarActions.openNoteGroupContextMenu}
            onCreateNoteGroup={() => openNewGroupDialog(NOTES_PROJECT_ID)}
            onReorderProjects={reorderProjects}
            onReorderNoteGroups={(sourceGroupId, targetGroupId, position) =>
              reorderProjectGroups(NOTES_PROJECT_ID, sourceGroupId, targetGroupId, position)
            }
            onBackToLibrary={() => {
              documentRailMode.showSheetListRail();
              setSidebarMode("library");
            }}
            onRenameProject={(title) => updateProject(activeProject.id, (project) => ({ ...project, title, updatedAt: today() }))}
            onCreateProjectGroup={openNewGroupDialog}
            onSelectProjectGroup={selectProjectGroup}
            onReorderProjectGroups={(sourceGroupId, targetGroupId, position) =>
              reorderProjectGroups(activeProject.id, sourceGroupId, targetGroupId, position)
            }
          />

          {sidebarActions.sidebarContextMenu && (
            <div
              className="sidebar-context-menu"
              style={{
                left: Math.min(sidebarActions.sidebarContextMenu.x, window.innerWidth - 148),
                top: Math.min(
                  sidebarActions.sidebarContextMenu.y,
                  window.innerHeight - (sidebarActions.sidebarContextMenu.kind === "project" ? 172 : 112),
                ),
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {sidebarActions.sidebarContextMenu.kind === "project" && sidebarActions.sidebarContextMenu.projectId && (
                <>
                  <button onClick={sidebarActions.editContextProject}>编辑项目</button>
                  <button onClick={sidebarActions.manageContextProjectFields}>管理文稿字段</button>
                </>
              )}
              <button onClick={sidebarActions.showSidebarContextTargetInFinder}>在访达中显示</button>
              {(sidebarActions.sidebarContextMenu.kind === "project" || sidebarActions.sidebarContextMenu.kind === "sheet") && (
                <button onClick={sidebarActions.toggleContextArchive}>{sidebarActions.contextArchiveLabel()}</button>
              )}
              {sidebarActions.sidebarContextMenu.kind === "project" && (
                <button className="danger-menu-item" onClick={sidebarActions.requestDeleteProjectFromContextMenu}>
                  删除项目
                </button>
              )}
              {sidebarActions.sidebarContextMenu.kind === "sheet" && (
                <button className="danger-menu-item" onClick={sidebarActions.requestDeleteSheetFromContextMenu}>
                  删除文稿
                </button>
              )}
            </div>
          )}

          {sheetRailOpen && documentRailMode.documentFunctionRailOpen && activeProject && activeSheet ? (
            <DocumentFunctionRail
              project={activeProject}
              sheet={activeSheet}
              libraryPath={libraryPath}
              onToggleMode={documentRailMode.showSheetListRail}
              railModeSwitchExpanded={documentRailMode.railModeSwitchExpanded}
              onRailModeSwitchExpandedChange={documentRailMode.setRailModeSwitchExpanded}
              onWindowDragStart={windowChrome.startWindowDrag}
              onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
              onRailWheel={documentRailMode.handleRailWheel}
              onRevealPosition={revealEditorPosition}
              onReplaceBody={replaceActiveSheetBody}
              onRestoreVersion={restoreActiveSheetVersion}
              onUpdateSheet={(updater) => updateSheet(activeSheet.id, updater)}
              onManageFields={() => setPropertyManagerProjectId(activeProject.id)}
            />
          ) : (
            sheetRailOpen && (
              <SheetRail
                title={sheetListTitle}
                search={sheetSearch}
                filterOpen={sheetFilterOpen}
                sortMode={sheetSortMode}
                sortDirection={sheetSortDirection}
                sheets={projectFilter === "trash" ? trashSheets : filteredSheets}
                sheetProjectTitleById={
                  projectFilter === "trash"
                    ? Object.fromEntries(trashEntries.map((entry) => [`trash:${entry.id}`, entry.projectTitle || "废纸篓"]))
                    : sheetProjectTitleById
                }
                activeSheetId={projectFilter === "trash" && selectedTrashEntryId ? `trash:${selectedTrashEntryId}` : activeSheetId}
                draggingSheetId={sheetActions.draggingSheetId}
                dropTarget={sheetActions.sheetDropTarget}
                canReorderSheets={projectFilter === "trash" ? false : canManuallyReorderSheets}
                onWindowDragStart={windowChrome.startWindowDrag}
                onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
                onCreateSheet={sheetActions.createSheet}
                onSearchChange={setSheetSearch}
                onFilterOpenChange={setSheetFilterOpen}
                propertyDefinitions={projectFilter === "trash" ? [] : propertyDefinitionsForFilter}
                propertyFilter={projectFilter === "trash" ? { fieldKey: "", operator: "contains", value: "" } : sheetPropertyFilter}
                onPropertyFilterChange={setSheetPropertyFilter}
                onSortModeChange={updateSheetSortMode}
                onSortDirectionChange={updateSheetSortDirection}
                onSelectSheet={(sheetId) =>
                  projectFilter === "trash" ? setSelectedTrashEntryId(sheetId.replace(/^trash:/, "")) : selectSheetById(sheetId)
                }
                onClearSheetSelection={() => (projectFilter === "trash" ? setSelectedTrashEntryId("") : setActiveSheetId(""))}
                onSheetContextMenu={(event, sheetId) => {
                  if (projectFilter === "trash") {
                    event.preventDefault();
                    return;
                  }
                  sidebarActions.openSheetContextMenu(event, sheetId);
                }}
                onSheetReorderStart={sheetActions.beginSheetReorder}
                onSheetReorderPreview={sheetActions.previewSheetReorder}
                onSheetReorderCommit={commitSheetReorder}
                onSheetReorderEnd={sheetActions.clearSheetDragState}
                trashMode={projectFilter === "trash"}
                onClearTrash={() => sidebarActions.setTrashClearPending(true)}
                railModeSwitchExpanded={documentRailMode.railModeSwitchExpanded}
                onRailModeSwitchExpandedChange={documentRailMode.setRailModeSwitchExpanded}
                onSelectRailMode={(mode) => {
                  if (projectFilter !== "trash") documentRailMode.selectRailMode(mode);
                }}
                onRailWheel={documentRailMode.handleRailWheel}
              />
            )
          )}

          {sheetRailOpen && (
            <div
              className="sheet-rail-resize-handle"
              role="separator"
              aria-label="调整列表栏宽度"
              aria-orientation="vertical"
              aria-valuemin={MIN_SHEET_RAIL_WIDTH}
              aria-valuemax={MAX_SHEET_RAIL_WIDTH}
              aria-valuenow={sheetRailWidth}
              onMouseDown={beginSheetRailResize}
            />
          )}
        </section>

        <main className="editor-zone">
          <EditorToolbar
            inspectorOpen={inspectorOpen}
            focusMode={focusMode}
            leftSidebarHidden={!focusMode && !sheetRailOpen}
            canNavigateBack={activeSheetIndex > 0}
            canNavigateForward={activeSheetIndex >= 0 && activeSheetIndex < filteredSheets.length - 1}
            onExpandLeftSidebar={expandLibraryRail}
            onToggleFocusMode={focusModeLayout.toggleFocusMode}
            onNavigateBack={() => navigateSheet(-1)}
            onNavigateForward={() => navigateSheet(1)}
            onToggleInspector={windowChrome.toggleInspectorPanel}
            onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
          />

          {selectedTrashEntry ? (
            <TrashPreview
              entry={selectedTrashEntry}
              busy={trashActionBusy}
              onRestore={restoreSelectedTrashEntry}
              onDeletePermanently={permanentlyDeleteSelectedTrashEntry}
            />
          ) : activeSheet ? (
            <EditorCanvas
              sheet={activeSheet}
              previewMode={sheetPreviewMode}
              previewHtml={sheetPreviewHtml}
              previewBusy={sheetPreviewBusy}
              typewriterMode={typewriterMode}
              typography={editorTypography}
              reviewChanges={aiChangeSetReview.activeSheetReviewChanges}
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
              onRunInlineAi={aiAssistant.runInlineSelection}
              onCancelInlineAi={aiAssistant.cancelInlineSelection}
              onHandoffInlineAi={aiAssistant.handoffInlineSelection}
              onApplyInlineAiEdit={applyInlineAiEdit}
              onRejectInlineAiEdit={rejectInlineAiEdit}
              onImportImageFiles={editorImages.importImagesIntoActiveSheet}
              onResolveImagePreview={editorImages.resolveActiveSheetImagePreview}
              onOpenImage={editorImages.openImagePreviewSource}
              onSaveImageAs={editorImages.saveImagePreviewAs}
              onInsertImage={editorImages.insertImagesFromPicker}
            />
          ) : (
            <section className="editor-empty-state">没有已选的文稿</section>
          )}
        </main>

        {inspectorOpen && activeSheet && (
          <InspectorPanel
            ai={
              <AiAssistantPanel
                assistant={aiAssistant}
                libraryPath={libraryPath}
                activeProject={activeProject}
                activeSheet={activeSheet}
                changeSets={aiChangeSetReview.reviewPanelChangeSets}
                shownChangeSetIds={aiChangeSetReview.shownChangeSetIds}
                onClose={() => setInspectorOpen(false)}
                onShowChanges={aiChangeSetReview.showChanges}
                onHideChanges={aiChangeSetReview.hideChanges}
                onRollbackChangeSet={aiChangeSetReview.rollbackChangeSet}
                onRejectChangeSet={aiChangeSetReview.rejectChangeSet}
                onOpenChangeSetTarget={selectSheetById}
                onApplyAction={aiActionExecutor.applyAiAction}
                onRejectAction={aiActionExecutor.rejectAiAction}
                onRevertAction={aiActionExecutor.revertAiAction}
                onOpenActionTarget={openAiActionTarget}
              />
            }
            onResizeStart={windowChrome.beginInspectorResize}
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
        open={Boolean(sidebarActions.projectPendingTrash)}
        title="删除项目"
        message={`项目「${sidebarActions.projectPendingTrash?.title ?? ""}」会被移入废纸篓，项目下的所有文件也会一起移动。`}
        confirmLabel="移入废纸篓"
        destructive
        onCancel={() => sidebarActions.setProjectPendingTrash(null)}
        onConfirm={sidebarActions.confirmMoveProjectToTrash}
      />
      <ConfirmDialog
        open={Boolean(sidebarActions.sheetPendingTrash)}
        title="删除文稿"
        message={`文稿「${sidebarActions.sheetPendingTrash?.sheet.title ?? ""}」会被移入废纸篓，可以稍后恢复。`}
        confirmLabel="移入废纸篓"
        destructive
        onCancel={() => sidebarActions.setSheetPendingTrash(null)}
        onConfirm={sidebarActions.confirmMoveSheetToTrash}
      />
      <ConfirmDialog
        open={sidebarActions.trashClearPending}
        title="清空废纸篓"
        message="废纸篓中的项目和文稿会被彻底删除，此操作不可撤销。"
        confirmLabel="清空"
        destructive
        onCancel={() => sidebarActions.setTrashClearPending(false)}
        onConfirm={sidebarActions.confirmClearTrash}
      />
      <ProjectFieldManagerDialog
        open={Boolean(propertyManagerProjectId)}
        project={projects.find((project) => project.id === propertyManagerProjectId)}
        onClose={() => setPropertyManagerProjectId("")}
        onSave={(project) => setProjects((current) => current.map((item) => (item.id === project.id ? normalizeProject(project) : item)))}
      />
      <AppTooltip />
    </div>
  );
}

export default App;
