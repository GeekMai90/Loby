import { listen } from "@tauri-apps/api/event";
import type { EditorView } from "@codemirror/view";
import { PanelLeftOpen } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  AiChangeSet,
  SidebarMode,
  SheetSortDirection,
  SheetManualOrders,
  SheetSortMode,
  SheetSortPreference,
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
import { useEditorImages } from "./hooks/useEditorImages";
import { useLibraryPersistence } from "./hooks/useLibraryPersistence";
import { useProjectExport } from "./hooks/useProjectExport";
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
import { importMarkdownFiles, loadBrowserProjects } from "./lib/persistence";
import { DEFAULT_SHEET_SORT_PREFERENCE, moveIdByPosition, moveItemById, sortSheetList, type RailDropPosition } from "./lib/sheetSorting";

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
  const [activeGroupIdsByProject, setActiveGroupIdsByProject] = useState<Record<string, string>>(initialSettings.activeGroupIdsByProject);
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
  const [, setImageInsertStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [sheetSearch, setSheetSearch] = useState("");
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
    setEditorSelectionText("");
  }, [activeSheetId]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const userProjectCount = useMemo(() => projects.filter((project) => !isNotesProject(project)).length, [projects]);
  const notesProject = useMemo(() => getNotesProject(projects), [projects]);
  const noteGroups = useMemo(() => getVisibleProjectGroups(notesProject), [notesProject]);
  const selectedNoteGroup = noteGroups.find((group) => group.id === activeNoteGroupId) ?? noteGroups[0];
  const visibleProjectGroups = useMemo(() => (activeProject ? getVisibleProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const filteredProjects = useMemo(() => filterProjects(projects, ""), [projects]);
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
    const librarySheets = projects.flatMap((project) => project.sheets);
    return getSheetsForProjectFilter(librarySheets, projectFilter, today());
  }, [activeNoteGroupId, activeProject, notesProject, projectFilter, projects, selectedNoteGroup, selectedVisibleGroup, sidebarMode]);
  const filteredSheets = useMemo(() => {
    const activeSheetManualOrder = sheetManualOrders[sheetSortPreferenceKey] ?? [];
    return sortSheetList(filterSheets(sheetListSource, sheetSearch), sheetSortMode, sheetSortDirection, activeSheetManualOrder);
  }, [sheetListSource, sheetManualOrders, sheetSearch, sheetSortDirection, sheetSortMode, sheetSortPreferenceKey]);
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
    onProjectsChange: setProjects,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onSidebarModeChange: setSidebarMode,
    onProjectFilterChange: setProjectFilter,
    onLibraryStatusChange: setLibraryStatus,
    onSkipNextLibrarySave: libraryPersistence.skipNextLibrarySave,
    onEditProject: openEditProjectDialog,
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
      setSheetSearch("");
      setSheetFilterOpen(false);
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
    setSheetSearch("");
    setSheetFilterOpen(false);
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
    setSheetSearch("");
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
      setSheetSearch("");
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
        style={{ "--inspector-expanded-col": `${inspectorWidth}px` } as CSSProperties}
      >
        <div
          className="window-controls-overlay"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        >
          {windowControls}
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
            onBackToLibrary={() => setSidebarMode("library")}
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
                  window.innerHeight - (sidebarActions.sidebarContextMenu.kind === "project" ? 112 : 52),
                ),
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {sidebarActions.sidebarContextMenu.kind === "project" && sidebarActions.sidebarContextMenu.projectId && (
                <button onClick={sidebarActions.editContextProject}>编辑项目</button>
              )}
              <button onClick={sidebarActions.showSidebarContextTargetInFinder}>在访达中显示</button>
              {sidebarActions.sidebarContextMenu.kind === "project" && (
                <button className="danger-menu-item" onClick={sidebarActions.requestDeleteProjectFromContextMenu}>
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
              onWindowDragStart={windowChrome.startWindowDrag}
              onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
              onCreateSheet={sheetActions.createSheet}
              onSearchChange={setSheetSearch}
              onFilterOpenChange={setSheetFilterOpen}
              onSortModeChange={updateSheetSortMode}
              onSortDirectionChange={updateSheetSortDirection}
              onSelectSheet={selectSheetById}
              onClearSheetSelection={() => setActiveSheetId("")}
              onSheetContextMenu={sidebarActions.openSheetContextMenu}
              onSheetReorderStart={sheetActions.beginSheetReorder}
              onSheetReorderPreview={sheetActions.previewSheetReorder}
              onSheetReorderCommit={commitSheetReorder}
              onSheetReorderEnd={sheetActions.clearSheetDragState}
              trashMode={projectFilter === "trash"}
              onClearTrash={() => sidebarActions.setTrashClearPending(true)}
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
            onToggleInspector={windowChrome.toggleInspectorPanel}
            onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
          />

          {activeSheet ? (
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
        open={sidebarActions.trashClearPending}
        title="清空废纸篓"
        message="废纸篓中的项目和文稿会被彻底删除，此操作不可撤销。"
        confirmLabel="清空"
        destructive
        onCancel={() => sidebarActions.setTrashClearPending(false)}
        onConfirm={sidebarActions.confirmClearTrash}
      />
    </div>
  );
}

export default App;
