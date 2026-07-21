import { listen } from "@tauri-apps/api/event";
import type { EditorView } from "@codemirror/view";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, CircleCheck, Columns3Cog, FileSliders, FolderOpen, PanelLeftOpen, Text, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  AiChangeSet,
  AppThemePreference,
  AssistantPresentation,
  ResolvedAppTheme,
  SidebarMode,
  SheetManualOrders,
  SheetSortPreference,
  SheetVersion,
  WritingProject,
  WritingSheet,
} from "./types";
import { AiAssistantLauncher } from "./components/AiAssistantLauncher";
import { AppTooltip } from "./components/AppTooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import { DocumentFunctionRail } from "./components/DocumentFunctionRail";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorToolbar } from "./components/EditorToolbar";
import { DocumentInformationPopover } from "./components/DocumentInformationPopover";
import { EditorVersionPreviewBar } from "./components/EditorVersionPreviewBar";
import { EmptyLibraryState } from "./components/EmptyLibraryState";
import { InspectorPanel } from "./components/InspectorPanel";
import { LibraryRail } from "./components/LibraryRail";
import { LiquidGlassButton } from "./components/LiquidGlassButton";
import { LibraryOnboarding } from "./components/LibraryOnboarding";
import { TrashPreview } from "./components/TrashPreview";
import { SheetRail } from "./components/SheetRail";
import { SheetMoveContextMenu } from "./components/SheetMoveContextMenu";
import type { NewProjectDraft } from "./constants/projectAppearance";
import type { SettingsTabId } from "./constants/settingsDialog";
import { useAiAssistant } from "./hooks/useAiAssistant";
import { useAiActionExecutor } from "./hooks/useAiActionExecutor";
import { useAiChangeSetReview } from "./hooks/useAiChangeSetReview";
import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppThemeTransition } from "./hooks/useAppThemeTransition";
import { useArticleGoalCelebration } from "./hooks/useArticleGoalCelebration";
import { useDocumentRailMode } from "./hooks/useDocumentRailMode";
import { useEditorImages } from "./hooks/useEditorImages";
import { useFocusModeLayout } from "./hooks/useFocusModeLayout";
import { useLibraryPersistence } from "./hooks/useLibraryPersistence";
import { useLibraryPreferences } from "./hooks/useLibraryPreferences";
import { useLibraryTrash } from "./hooks/useLibraryTrash";
import { useProjectResources } from "./hooks/useProjectResources";
import { useProjectDraftDialogs } from "./hooks/useProjectDraftDialogs";
import { useQuickPrompts } from "./hooks/useQuickPrompts";
import { useSheetActions } from "./hooks/useSheetActions";
import { useSheetList } from "./hooks/useSheetList";
import { useSidebarContextMenu } from "./hooks/useSidebarContextMenu";
import { useUnusedImageCleanup } from "./hooks/useUnusedImageCleanup";
import { useWindowChrome } from "./hooks/useWindowChrome";
import { useViewportWidth } from "./hooks/useViewportWidth";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import { useWritingActivity } from "./hooks/useWritingActivity";
import { resolveAiActionNavigationTarget } from "./lib/aiActionNavigation";
import { showAppToast } from "./lib/appToast";
import { resolveAssistantPresentation } from "./lib/assistantPresentation";
import { libraryPreferencesFromAgentSettings } from "./lib/libraryPreferences";
import { renderMarkdownHtml } from "./lib/export";
import { loadAgentSettings, saveAgentSettings } from "./lib/agentSettings";
import { formatCodexProbePresentation } from "./lib/codexProbePresentation";
import { nowTimestamp, today } from "./lib/dates";
import { applyProjectArticleGoalTarget } from "./lib/documentProperties";
import type { AppShortcutId } from "./lib/keyboardShortcuts";
import type { PublishChannelId } from "./lib/publishing/types";
import { extractFirstHeadingTitle } from "./lib/markdownTitle";
import { rewriteSheetImageReferencesForLocationChange } from "./lib/imageAssets";
import { createSheetVersionSnapshot, restoreSheetVersion } from "./lib/sheetVersions";
import { MAX_SHEET_RAIL_WIDTH, MIN_SHEET_RAIL_WIDTH, resolveSheetRailDrag } from "./lib/sheetRailResize";
import { countWords } from "./lib/text";
import { resolveCurrentAppTheme } from "./lib/themes";
import {
  addProjectGroup,
  createImportedProjectFromSheets,
  createProjectFromTemplate,
  createProjectGroupDraft,
  getInitialProjectSelection,
  reorderProjectGroupsForRail,
  resolveSheetMoveGroupId,
  type SheetMoveTarget,
} from "./lib/projectCreation";
import {
  getVisibleProjectGroups,
  isInboxProject,
  isNotesProject,
  NOTES_QUICK_GROUP_ID,
  NOTES_PROJECT_ID,
  normalizeProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveNewSheetTarget,
  resolveSavedProjectSelection,
  type ProjectFilter,
} from "./lib/projectModel";
import { cleanEmptySheets, importMarkdownFiles, loadBrowserProjects } from "./lib/persistence";
import type { InlineAiPendingEdit } from "./lib/inlineAi";
import { moveItemById, type RailDropPosition } from "./lib/sheetSorting";
import { applySheetMoveBatch, type MovedSheetRecord, type PrepareSheetMoveContext } from "./lib/sheetMoveBatch";
import {
  pruneSheetSelection,
  resolveContextSheetSelection,
  resolveSheetSelection,
  type SheetSelectionModifiers,
} from "./lib/sheetSelection";
import type { WorkspaceSelectionSnapshot } from "./lib/workspaceSelection";
import { enterZenModeWindow, saveZenModeSession } from "./lib/zenMode";

const LEFT_SIDEBAR_REVEAL_DRAG_DISTANCE = 36;
type ActiveWorkspaceRegion = "navigation" | "list" | "editor" | "assistant";
type SheetDragNavigationPreview = { mode: "library" } | { mode: "project"; projectId: string };
const AiAssistantPanel = lazy(() => import("./components/AiAssistantPanel").then((module) => ({ default: module.AiAssistantPanel })));
const ProjectFieldManagerDialog = lazy(() =>
  import("./components/ProjectFieldManagerDialog").then((module) => ({ default: module.ProjectFieldManagerDialog })),
);
const SettingsDialog = lazy(() => import("./components/SettingsDialog").then((module) => ({ default: module.SettingsDialog })));
const ConfirmDialog = lazy(() => import("./components/ConfirmDialog").then((module) => ({ default: module.ConfirmDialog })));
const KeyboardShortcutsDialog = lazy(() =>
  import("./components/KeyboardShortcutsDialog").then((module) => ({ default: module.KeyboardShortcutsDialog })),
);
const QuickCaptureDialog = lazy(() => import("./components/QuickCaptureDialog").then((module) => ({ default: module.QuickCaptureDialog })));
const MoveSheetDialog = lazy(() => import("./components/MoveSheetDialog").then((module) => ({ default: module.MoveSheetDialog })));
const UnusedImageCleanupDialog = lazy(() =>
  import("./components/UnusedImageCleanupDialog").then((module) => ({ default: module.UnusedImageCleanupDialog })),
);
const ProjectDraftDialogs = lazy(() =>
  import("./components/ProjectDraftDialogs").then((module) => ({ default: module.ProjectDraftDialogs })),
);
const WechatPublishDialog = lazy(() =>
  import("./components/WechatPublishDialog").then((module) => ({ default: module.WechatPublishDialog })),
);
const DirectPublishDialog = lazy(() =>
  import("./components/DirectPublishDialog").then((module) => ({ default: module.DirectPublishDialog })),
);

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const initialProjects = useMemo(() => normalizeProjects(loadBrowserProjects()), []);
  const [projects, setProjects] = useState<WritingProject[]>(initialProjects);
  const initialSelection = resolveSavedProjectSelection(initialProjects, initialSettings.activeProjectId, initialSettings.activeSheetId);
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.projectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.sheetId);
  const [activeWorkspaceRegion, setActiveWorkspaceRegion] = useState<ActiveWorkspaceRegion>(
    initialSelection.sheetId ? "list" : "navigation",
  );
  const [libraryRailOpen, setLibraryRailOpen] = useState(initialSettings.libraryRailOpen);
  const [sheetRailOpen, setSheetRailOpen] = useState(initialSettings.sheetRailOpen);
  const [sheetRailWidth, setSheetRailWidth] = useState(initialSettings.sheetRailWidth);
  const [inspectorOpen, setInspectorOpen] = useState(initialSettings.inspectorOpen);
  const [inspectorWidth, setInspectorWidth] = useState(initialSettings.inspectorWidth);
  const [assistantPresentationPreference, setAssistantPresentationPreference] = useState(initialSettings.assistantPresentationPreference);
  const [assistantPresentationOverride, setAssistantPresentationOverride] = useState<AssistantPresentation | null>(null);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
  const [goalCelebrationEnabled, setGoalCelebrationEnabled] = useState(initialSettings.goalCelebrationEnabled);
  const [appTheme, setAppTheme] = useState(initialSettings.appTheme);
  const [appThemeOverride, setAppThemeOverride] = useState<ResolvedAppTheme | null>(null);
  const [editorThemeId, setEditorThemeId] = useState(initialSettings.editorTheme);
  const [editorTypography, setEditorTypography] = useState(initialSettings.editorTypography);
  const [imageReferenceFormat, setImageReferenceFormat] = useState(initialSettings.imageReferenceFormat);
  const [markdownFormatting, setMarkdownFormatting] = useState(initialSettings.markdownFormatting);
  const [sheetPreviewMode, setSheetPreviewMode] = useState(initialSettings.sheetPreviewMode);
  const [versionPreviewTarget, setVersionPreviewTarget] = useState<{ sheetId: string; versionId: string } | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("library");
  const [sheetDragNavigationPreview, setSheetDragNavigationPreview] = useState<SheetDragNavigationPreview | null>(null);
  const [libraryProjectsOpen, setLibraryProjectsOpen] = useState(true);
  const [libraryNotesOpen, setLibraryNotesOpen] = useState(true);
  const [activeNoteGroupId, setActiveNoteGroupId] = useState("");
  const [sheetFilterOpen, setSheetFilterOpen] = useState(false);
  const [activeGroupIdsByProject, setActiveGroupIdsByProject] = useState<Record<string, string>>(initialSettings.activeGroupIdsByProject);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDialogInitialTab, setSettingsDialogInitialTab] = useState<SettingsTabId>("writing");
  const [wechatPublishOpen, setWechatPublishOpen] = useState(false);
  const [directPublishChannel, setDirectPublishChannel] = useState<"wordpress" | "mowen" | null>(null);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [moveSheetIds, setMoveSheetIds] = useState<string[]>([]);
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>(initialSelection.sheetId ? [initialSelection.sheetId] : []);
  const [sheetSelectionAnchorId, setSheetSelectionAnchorId] = useState(initialSelection.sheetId);
  const [zenModeBusy, setZenModeBusy] = useState(false);
  const [propertyManagerProjectId, setPropertyManagerProjectId] = useState("");
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
  const handleSystemAppThemeChange = useCallback(() => {
    if (appTheme === "system") setAppThemeOverride(null);
  }, [appTheme]);
  const resolvedAppTheme = useAppTheme(appTheme, {
    override: appThemeOverride,
    onSystemThemeChange: handleSystemAppThemeChange,
  });
  const viewportWidth = useViewportWidth();
  const prefersReducedMotion = useReducedMotion();
  const runAppThemeTransition = useAppThemeTransition({
    resolvedTheme: resolvedAppTheme,
    prefersReducedMotion: Boolean(prefersReducedMotion),
  });
  const changeAppThemePreference = useCallback(
    (nextTheme: AppThemePreference) => {
      const nextResolvedTheme = resolveCurrentAppTheme(nextTheme);
      runAppThemeTransition(nextResolvedTheme, () => {
        setAppThemeOverride(null);
        setAppTheme(nextTheme);
      });
    },
    [runAppThemeTransition],
  );
  const changeTemporaryAppTheme = useCallback(
    (nextTheme: ResolvedAppTheme) => {
      const persistentResolvedTheme = resolveCurrentAppTheme(appTheme);
      const nextOverride = nextTheme === persistentResolvedTheme ? null : nextTheme;
      runAppThemeTransition(nextTheme, () => setAppThemeOverride(nextOverride));
    },
    [appTheme, runAppThemeTransition],
  );
  const editorRef = useRef<EditorView | null>(null);
  const cleanEmptySheetsRef = useRef<() => void>(() => {});
  const cleanUnusedImagesRef = useRef<() => void>(() => {});
  const cleanEmptySheetsBusyRef = useRef(false);
  const windowChrome = useWindowChrome({
    inspectorWidth,
    onInspectorWidthChange: setInspectorWidth,
    onInspectorOpenChange: setInspectorOpen,
  });
  const assistantPresentation = resolveAssistantPresentation({
    preference: assistantPresentationPreference,
    manualOverride: assistantPresentationOverride,
    viewportWidth,
    libraryRailOpen,
    sheetRailOpen,
    sheetRailWidth,
    inspectorWidth,
  });

  function toggleAssistantPresentation() {
    setAssistantPresentationOverride(assistantPresentation === "floating" ? "docked" : "floating");
  }

  const setInspectorOpenWithMotion = useCallback((open: boolean) => {
    startTransition(() => setInspectorOpen(open));
  }, []);
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
  const quickPrompts = useQuickPrompts({ libraryPath, persistenceReady });
  const portableLibraryPreferences = useMemo(
    () =>
      libraryPreferencesFromAgentSettings(
        {
          ...initialSettings,
          activeProjectId,
          activeSheetId,
          focusMode,
          typewriterMode,
          sheetPreviewMode,
          goalCelebrationEnabled,
          appTheme,
          editorTheme: editorThemeId,
          editorTypography,
          imageReferenceFormat,
          markdownFormatting,
          activeGroupIdsByProject,
          sheetSortPreferences,
          sheetManualOrders,
        },
        { lastProjectId: activeProjectId, lastSheetId: activeSheetId },
      ),
    [
      activeGroupIdsByProject,
      activeProjectId,
      activeSheetId,
      appTheme,
      editorThemeId,
      editorTypography,
      focusMode,
      goalCelebrationEnabled,
      imageReferenceFormat,
      initialSettings,
      markdownFormatting,
      sheetPreviewMode,
      sheetManualOrders,
      sheetSortPreferences,
      typewriterMode,
    ],
  );
  useLibraryPreferences({
    libraryPath,
    persistenceReady,
    fallback: portableLibraryPreferences,
    preferences: portableLibraryPreferences,
    onHydrate: (preferences) => {
      const selection = resolveSavedProjectSelection(projects, preferences.lastProjectId, preferences.lastSheetId);
      setActiveProjectId(selection.projectId);
      setActiveSheetId(selection.sheetId);
      setFocusMode(preferences.focusMode);
      setTypewriterMode(preferences.typewriterMode);
      setSheetPreviewMode(preferences.sheetPreviewMode);
      setGoalCelebrationEnabled(preferences.goalCelebrationEnabled);
      setAppTheme(preferences.appTheme);
      setEditorThemeId(preferences.editorTheme);
      setEditorTypography(preferences.editorTypography);
      setImageReferenceFormat(preferences.imageReferenceFormat);
      setMarkdownFormatting(preferences.markdownFormatting);
      setActiveGroupIdsByProject(preferences.activeGroupIdsByProject);
      setSheetSortPreferences(preferences.sheetSortPreferences);
      setSheetManualOrders(preferences.sheetManualOrders);
    },
  });
  const writingActivity = useWritingActivity({ projects, libraryPath, persistenceReady });

  const libraryTrash = useLibraryTrash({
    enabled: projectFilter === "trash",
    libraryPath,
    onLibraryStatusChange: setLibraryStatus,
    onProjectsRestored: setProjects,
    onRestoreSelection: (entry, restoredProjects) => {
      const restoredProject = restoredProjects.find((project) => project.id === entry.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === entry.sheetId);
      if (restoredProject) setActiveProjectId(restoredProject.id);
      if (restoredSheet) {
        setActiveSheetId(restoredSheet.id);
        setActiveGroupId(restoredSheet.groupId ?? "");
      }
    },
    onSkipNextLibrarySave: libraryPersistence.skipNextLibrarySave,
  });
  const unusedImageCleanup = useUnusedImageCleanup({
    libraryPath,
    persistenceReady,
    projects,
    persistProjectsImmediately: libraryPersistence.persistProjectsImmediately,
    onLibraryStatusChange: setLibraryStatus,
    onTrashChanged: libraryTrash.refresh,
  });

  useEffect(() => {
    setEditorSelectionText("");
    setVersionPreviewTarget(null);
  }, [activeSheetId]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const activeSheetWordCount = activeSheet ? countWords(activeSheet.body) : 0;
  useArticleGoalCelebration({
    sheet: activeSheet,
    activity: writingActivity.activity,
    ready: writingActivity.ready,
    enabled: goalCelebrationEnabled,
    onCelebrateTarget: writingActivity.recordCelebratedTarget,
  });
  const moveSheetEntries = moveSheetIds.flatMap((sheetId) => {
    const project = projects.find((item) => item.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = project?.sheets.find((item) => item.id === sheetId);
    return project && sheet ? [{ project, sheet }] : [];
  });
  const previewedVersion =
    activeSheet && versionPreviewTarget && versionPreviewTarget.sheetId === activeSheet.id
      ? (activeSheet.versions?.find((version) => version.id === versionPreviewTarget.versionId) ?? null)
      : null;
  const editorSheet = activeSheet && previewedVersion ? { ...activeSheet, body: previewedVersion.body } : activeSheet;
  const userProjectCount = useMemo(
    () => projects.filter((project) => !isNotesProject(project) && !isInboxProject(project)).length,
    [projects],
  );
  const sheetList = useSheetList({
    projects,
    activeProject,
    activeSheetId,
    activeGroupId,
    activeNoteGroupId,
    sidebarMode,
    projectFilter,
    sheetSearch,
    sheetSortPreferences,
    sheetManualOrders,
    onSheetSortPreferencesChange: setSheetSortPreferences,
    onSheetManualOrdersChange: setSheetManualOrders,
  });
  const {
    inboxProject,
    notesProject,
    noteGroups,
    selectedNoteGroup,
    visibleProjectGroups,
    resolvedActiveGroupId,
    filteredProjects,
    selectedVisibleGroup,
    sourceSheets: sheetListSource,
    filteredSheets,
    sheetProjectTitleById,
    activeSheetIndex,
    canManuallyReorderSheets,
    sheetActionProject,
    sheetActionGroupId,
    sheetActionActiveSheet,
  } = sheetList;
  const visibleSheetIds = useMemo(() => filteredSheets.map((sheet) => sheet.id), [filteredSheets]);

  useEffect(() => {
    if (projectFilter === "trash") return;
    setSelectedSheetIds((current) => {
      const pruned = pruneSheetSelection(current, visibleSheetIds);
      if (activeSheetId && visibleSheetIds.includes(activeSheetId) && !pruned.includes(activeSheetId)) return [activeSheetId];
      if (!activeSheetId) return [];
      return pruned;
    });
    setSheetSelectionAnchorId((current) =>
      visibleSheetIds.includes(current) ? current : activeSheetId && visibleSheetIds.includes(activeSheetId) ? activeSheetId : "",
    );
  }, [activeSheetId, projectFilter, visibleSheetIds]);
  const sheetDragPreviewProject =
    sheetDragNavigationPreview?.mode === "project"
      ? projects.find((project) => project.id === sheetDragNavigationPreview.projectId)
      : undefined;
  const displayedSidebarMode = sheetDragNavigationPreview?.mode ?? sidebarMode;
  const displayedSidebarProject = sheetDragPreviewProject ?? activeProject;
  const displayedProjectGroups = getVisibleProjectGroups(displayedSidebarProject);
  const displayedResolvedGroupId = resolveProjectGroupId(
    displayedSidebarProject,
    activeGroupIdsByProject[displayedSidebarProject.id] ?? "",
    displayedSidebarProject.sheets[0]?.id ?? "",
  );
  const sheetListTitle = sheetList.title;
  const sheetSortMode = sheetList.sortPreference.mode;
  const sheetSortDirection = sheetList.sortPreference.direction;
  const workspaceSelection: WorkspaceSelectionSnapshot = {
    activeProjectId,
    activeSheetId,
    activeGroupId,
    activeNoteGroupId,
    sidebarMode,
    projectFilter,
    activeGroupIdsByProject,
  };
  const newSheetTarget = resolveNewSheetTarget({ projects, activeProject, activeGroupId, activeNoteGroupId, sidebarMode });
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
  const workspaceNavigation = useWorkspaceNavigation({
    selection: workspaceSelection,
    projects,
    activeProject,
    inboxProject,
    notesProject,
    noteGroups,
    selectedNoteGroupId: selectedNoteGroup?.id,
    visibleProjectGroups,
    selectedVisibleGroup,
    filteredProjects,
    sourceSheets: sheetListSource,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onSidebarModeChange: setSidebarMode,
    onProjectFilterChange: setProjectFilter,
    onActiveGroupIdsByProjectChange: setActiveGroupIdsByProject,
    onShowSheetListRail: documentRailMode.showSheetListRail,
    onResetSheetFilters: resetSheetFilters,
  });
  const { enterProject, selectProjectFilter, selectNoteGroup, selectProjectGroup } = workspaceNavigation;

  function resetSheetFilters() {
    setSheetSearch("");
    setSheetFilterOpen(false);
  }
  const projectDialogs = useProjectDraftDialogs({
    activeProjectId: activeProject?.id ?? "",
    onCreateProject: (draft) => createProject("blank", draft),
    onUpdateProject: (projectId, draft) =>
      updateProject(projectId, (project) =>
        applyProjectArticleGoalTarget(
          {
            ...project,
            title: draft.title,
            icon: draft.icon,
            iconColor: draft.iconColor,
            targetWords: draft.goalEnabled && draft.goalUnit === "words" ? Math.max(0, Math.round(draft.goalTarget ?? 0)) : 0,
            projectGoal: {
              enabled: Boolean(draft.goalEnabled) && (draft.goalTarget ?? 0) > 0,
              unit: draft.goalUnit ?? "words",
              target: Math.max(0, Math.round(draft.goalTarget ?? 0)),
            },
            updatedAt: today(),
          },
          draft.articleGoalEnabled ? Math.max(0, Math.round(draft.articleGoalTarget ?? 0)) : 0,
        ),
      ),
    onCreateGroup: (projectId, draft) => createProjectGroup(draft, projectId),
  });
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
    onTrashChanged: libraryTrash.refresh,
    onEditProject: projectDialogs.openEditProjectDialog,
    onManageProjectFields: (project) => setPropertyManagerProjectId(project.id),
    onFormatSheet: formatSheet,
  });
  const contextSheetIds =
    sidebarActions.sidebarContextMenu?.kind === "sheet"
      ? (sidebarActions.sidebarContextMenu.sheetIds ?? [sidebarActions.sidebarContextMenu.sheetId ?? ""]).filter(Boolean)
      : [];
  const contextSheetEntries = contextSheetIds.flatMap((sheetId) => {
    const project = projects.find((item) => item.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = project?.sheets.find((item) => item.id === sheetId);
    return project && sheet ? [{ project, sheet }] : [];
  });
  const contextSheetSources = contextSheetEntries.map(({ project, sheet }) => ({ projectId: project.id, groupId: sheet.groupId }));
  const contextSheetCount = contextSheetEntries.length;
  const projectResources = useProjectResources(activeProject, libraryPath, windowChrome.appWindow);
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
    newSheetProject: newSheetTarget.project,
    newSheetGroupId: newSheetTarget.groupId,
    quickNotesProject: notesProject,
    quickNotesGroupId: NOTES_QUICK_GROUP_ID,
    updateProject,
    onSelectProject: setActiveProjectId,
    onSelectSheet: setActiveSheetId,
    onSelectGroup: setActiveGroupId,
    onSheetSearchChange: setSheetSearch,
  });
  const aiAssistant = useAiAssistant({
    persistenceReady,
    libraryPath,
    initialAgentModel: initialSettings.agentModel,
    initialAgentReasoningEffort: initialSettings.agentReasoningEffort,
    initialAgentQuickMode: initialSettings.agentQuickMode,
    initialAssistantSendMode: initialSettings.assistantSendMode,
    initialCodexCliPath: initialSettings.codexCliPath,
    initialCodexCliProbe: initialSettings.codexCliProbe,
    projects,
    activeProject,
    activeSheet,
    selectedText: editorSelectionText,
    onOpenAiPanel: () => {
      setInspectorOpenWithMotion(true);
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

  const agentProbePresentation = formatCodexProbePresentation(aiAssistant.probe);

  useEffect(() => {
    if (!inspectorOpen) setAssistantPresentationOverride(null);
  }, [inspectorOpen]);

  useEffect(() => {
    saveAgentSettings({
      libraryRailOpen,
      sheetRailOpen,
      sheetRailWidth,
      inspectorOpen,
      inspectorWidth,
      assistantPresentationPreference,
      focusMode,
      typewriterMode,
      sheetPreviewMode,
      goalCelebrationEnabled,
      appTheme,
      editorTheme: editorThemeId,
      editorTypography,
      imageReferenceFormat,
      markdownFormatting,
      activeGroupIdsByProject,
      sheetSortPreferences,
      sheetManualOrders,
    });
  }, [
    activeGroupIdsByProject,
    assistantPresentationPreference,
    libraryRailOpen,
    sheetRailOpen,
    sheetRailWidth,
    inspectorOpen,
    inspectorWidth,
    focusMode,
    typewriterMode,
    sheetPreviewMode,
    goalCelebrationEnabled,
    appTheme,
    editorThemeId,
    editorTypography,
    imageReferenceFormat,
    markdownFormatting,
    sheetSortPreferences,
    sheetManualOrders,
  ]);

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

  function selectSheetById(sheetId: string, preserveMultiSelection = false) {
    workspaceNavigation.selectSheet(sheetId);
    if (!preserveMultiSelection) {
      setSelectedSheetIds(sheetId ? [sheetId] : []);
      setSheetSelectionAnchorId(sheetId);
    }
  }

  function selectSheetFromList(sheetId: string, modifiers: SheetSelectionModifiers) {
    const next = resolveSheetSelection({
      selectedSheetIds,
      anchorSheetId: sheetSelectionAnchorId,
      visibleSheetIds,
      sheetId,
      modifiers,
    });
    setSelectedSheetIds(next.selectedSheetIds);
    setSheetSelectionAnchorId(next.anchorSheetId);

    const nextActiveSheetId = next.selectedSheetIds.includes(sheetId)
      ? sheetId
      : (next.selectedSheetIds[next.selectedSheetIds.length - 1] ?? "");
    if (nextActiveSheetId) selectSheetById(nextActiveSheetId, true);
    else setActiveSheetId("");
  }

  function clearSheetSelection() {
    setSelectedSheetIds([]);
    setSheetSelectionAnchorId("");
    setActiveSheetId("");
  }

  function openSheetContextMenu(event: ReactMouseEvent<HTMLElement>, sheetId: string) {
    const nextSelection = resolveContextSheetSelection(selectedSheetIds, sheetId);
    if (!selectedSheetIds.includes(sheetId)) {
      setSelectedSheetIds(nextSelection);
      setSheetSelectionAnchorId(sheetId);
      selectSheetById(sheetId, true);
    }
    sidebarActions.openSheetContextMenu(event, sheetId, nextSelection);
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

  async function formatSheet(projectId: string, sheetId: string) {
    const project = projects.find((item) => item.id === projectId);
    const sheet = project?.sheets.find((item) => item.id === sheetId);
    if (!project || !sheet) return;
    setLibraryStatus(`正在排版「${sheet.title}」...`);
    try {
      const { formatMarkdownDocument } = await import("./lib/markdownFormatting");
      const formattedBody = formatMarkdownDocument(sheet.body, markdownFormatting);
      if (formattedBody === sheet.body) {
        setLibraryStatus(`「${sheet.title}」已符合当前排版规则`);
        showAppToast({
          variant: "info",
          title: "无需排版",
          description: "内容已符合所选规则",
        });
        return;
      }
      updateSheet(sheet.id, (current) => ({
        ...current,
        body: formattedBody,
        versions: [createSheetVersionSnapshot(current, "manual", "Markdown 排版前自动保存"), ...(current.versions ?? [])].slice(0, 20),
        updatedAt: nowTimestamp(),
      }));
      setLibraryStatus(`已完成「${sheet.title}」的 Markdown 排版`);
      showAppToast({
        variant: "success",
        title: "排版完成",
        description: "已按所选规则处理",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLibraryStatus(`排版「${sheet.title}」失败：${message}`);
      showAppToast({
        variant: "error",
        title: "排版失败",
        description: "请稍后重试",
      });
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
    setVersionPreviewTarget(null);
    updateSheet(activeSheet.id, (sheet) => ({ ...restoreSheetVersion(sheet, version), updatedAt: nowTimestamp() }));
  }

  function previewActiveSheetVersion(version: SheetVersion) {
    if (!activeSheet) return;
    setEditorSelectionText("");
    setVersionPreviewTarget({ sheetId: activeSheet.id, versionId: version.id });
  }

  function closeVersionPreview() {
    setEditorSelectionText("");
    setVersionPreviewTarget(null);
  }

  function findSheetById(sheetId: string): WritingSheet | undefined {
    return projects.flatMap((project) => project.sheets).find((sheet) => sheet.id === sheetId);
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
      const { buildImportedMarkdownSheets } = await import("./lib/importMarkdown");
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

  async function enterZenMode() {
    if (!activeProject || !activeSheet || zenModeBusy) return;
    setZenModeBusy(true);
    try {
      await libraryPersistence.flushPendingSave();
      saveZenModeSession({
        libraryPath,
        projectId: activeProject.id,
        projectTitle: activeProject.title,
        project: { ...activeProject, sheets: [activeSheet] },
        sheet: activeSheet,
        typography: editorTypography,
        imageReferenceFormat,
      });
      await enterZenModeWindow();
    } catch (error) {
      window.alert(`进入禅模式失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setZenModeBusy(false);
    }
  }

  function renderSettingsDialog() {
    if (!settingsDialogOpen) return null;
    return (
      <Suspense fallback={null}>
        <SettingsDialog
          open={settingsDialogOpen}
          initialTab={settingsDialogInitialTab}
          libraryPath={libraryPath}
          libraryStatus={libraryStatus}
          projectCount={userProjectCount}
          focusMode={focusMode}
          typewriterMode={typewriterMode}
          goalCelebrationEnabled={goalCelebrationEnabled}
          appTheme={appTheme}
          appThemeOverride={appThemeOverride}
          resolvedAppTheme={resolvedAppTheme}
          editorTheme={editorThemeId}
          editorTypography={editorTypography}
          imageReferenceFormat={imageReferenceFormat}
          markdownFormatting={markdownFormatting}
          sheetPreviewMode={sheetPreviewMode}
          assistantSendMode={aiAssistant.assistantSendMode}
          assistantPresentationPreference={assistantPresentationPreference}
          codexCliPath={aiAssistant.codexCliPath}
          probeStatus={agentProbePresentation.status}
          probeDetail={agentProbePresentation.detail}
          probeBusy={aiAssistant.probeBusy}
          quickPrompts={quickPrompts.prompts}
          quickPromptsReady={quickPrompts.ready}
          onClose={() => setSettingsDialogOpen(false)}
          onFocusModeChange={focusModeLayout.setFocusModeEnabled}
          onTypewriterModeChange={setTypewriterMode}
          onGoalCelebrationEnabledChange={setGoalCelebrationEnabled}
          onAppThemeChange={changeAppThemePreference}
          onEditorThemeChange={setEditorThemeId}
          onEditorTypographyChange={setEditorTypography}
          onImageReferenceFormatChange={setImageReferenceFormat}
          onMarkdownFormattingChange={setMarkdownFormatting}
          onSheetPreviewModeChange={setSheetPreviewMode}
          onAssistantSendModeChange={aiAssistant.setAssistantSendMode}
          onAssistantPresentationPreferenceChange={setAssistantPresentationPreference}
          onCodexCliPathChange={aiAssistant.setCodexCliPath}
          onRunAgentProbe={aiAssistant.runProbe}
          onAddQuickPrompt={quickPrompts.addPrompt}
          onEditQuickPrompt={quickPrompts.editPrompt}
          onDeleteQuickPrompt={quickPrompts.deletePrompt}
          onMoveQuickPrompt={quickPrompts.movePrompt}
          onOpenLibrary={libraryPersistence.openCurrentLibrary}
          onMoveLibrary={libraryPersistence.moveCurrentLibrary}
        />
      </Suspense>
    );
  }

  const projectDraftDialogs =
    projectDialogs.projectDialogOpen || projectDialogs.groupDialogOpen ? (
      <Suspense fallback={null}>
        <ProjectDraftDialogs
          projectDialogOpen={projectDialogs.projectDialogOpen}
          groupDialogOpen={projectDialogs.groupDialogOpen}
          editingProjectId={projectDialogs.editingProjectId}
          projectDraft={projectDialogs.projectDraft}
          groupDraft={projectDialogs.groupDraft}
          onCloseProject={projectDialogs.closeProjectDialog}
          onSubmitProject={projectDialogs.submitProjectDialog}
          onProjectDraftChange={projectDialogs.setProjectDraft}
          onCloseGroup={projectDialogs.closeGroupDialog}
          onSubmitGroup={projectDialogs.submitGroupDialog}
          onGroupDraftChange={projectDialogs.setGroupDraft}
        />
      </Suspense>
    ) : null;

  function collapseLibraryRail() {
    startTransition(() => {
      setSheetRailOpen(true);
      setLibraryRailOpen(false);
    });
  }

  function expandLibraryRail() {
    startTransition(() => {
      setLibraryRailOpen(true);
      setSheetRailOpen(true);
    });
  }

  function expandSheetRailOnly() {
    startTransition(() => setSheetRailOpen(true));
  }

  function selectPublishChannel(channelId: PublishChannelId) {
    if (channelId === "wechat") {
      setWechatPublishOpen(true);
      return;
    }
    setDirectPublishChannel(channelId);
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

  function commitSheetReorder(sourceSheetId: string, targetSheetId: string, position: RailDropPosition) {
    sheetList.updateManualOrder(sourceSheetId, targetSheetId, position);
    if (sidebarMode === "project" || activeNoteGroupId) {
      sheetActions.commitSheetReorder(sourceSheetId, targetSheetId, position);
    } else {
      sheetActions.clearSheetDragState();
    }
  }

  function prepareSheetForLocationChange({
    sourceProject,
    sourceSheet,
    targetProject,
    targetSheet,
  }: PrepareSheetMoveContext): WritingSheet {
    if (!libraryPath.startsWith("/")) return targetSheet;
    return {
      ...targetSheet,
      body: rewriteSheetImageReferencesForLocationChange(
        sourceSheet.body,
        libraryPath,
        sourceProject,
        sourceSheet,
        targetProject,
        targetSheet,
      ),
    };
  }

  function undoSheetMoves(moves: MovedSheetRecord[]) {
    const firstMove = moves[0];
    if (!firstMove) return;
    setProjects((current) =>
      moves.reduce(
        (nextProjects, move) =>
          applySheetMoveBatch({
            projects: nextProjects,
            sheetIds: [move.sourceSheet.id],
            target: { projectId: move.sourceProject.id, groupId: move.sourceSheet.groupId },
            prepareSheet: prepareSheetForLocationChange,
          }).projects,
        current,
      ),
    );

    const restoredSheetIds = moves.map((move) => move.sourceSheet.id);
    setActiveProjectId(firstMove.sourceProject.id);
    setActiveGroupId(firstMove.sourceSheet.groupId ?? "");
    setActiveSheetId(firstMove.sourceSheet.id);
    setSelectedSheetIds(restoredSheetIds);
    setSheetSelectionAnchorId(firstMove.sourceSheet.id);
    if (sidebarMode === "project" && firstMove.sourceSheet.groupId) {
      setActiveGroupIdsByProject((current) => ({
        ...current,
        [firstMove.sourceProject.id]: firstMove.sourceSheet.groupId ?? "",
      }));
    }
    setLibraryStatus(moves.length > 1 ? `已撤销 ${moves.length} 篇文稿的移动` : `已将「${firstMove.sourceSheet.title}」移回原位置`);
    showAppToast({
      variant: "info",
      title: "已撤销移动",
      description: moves.length > 1 ? `${moves.length} 篇文稿已回到原位置` : `「${firstMove.sourceSheet.title}」已回到原位置`,
    });
  }

  function moveSheetsToTarget(sheetIds: string[], target: SheetMoveTarget, preserveNavigation = false) {
    const uniqueSheetIds = Array.from(new Set(sheetIds));
    const {
      projects: nextProjects,
      movedSheets,
      alreadyInTargetCount,
    } = applySheetMoveBatch({
      projects,
      sheetIds: uniqueSheetIds,
      target,
      prepareSheet: prepareSheetForLocationChange,
    });

    if (movedSheets.length === 0) return;
    setProjects(nextProjects);

    const targetProject = nextProjects.find((project) => project.id === target.projectId);
    const firstMove = movedSheets[0];
    if (!targetProject || !firstMove) return;
    const targetGroupId = firstMove.movedSheet.groupId ?? resolveSheetMoveGroupId(targetProject, target.groupId);
    const targetGroupTitle = getVisibleProjectGroups(targetProject).find((group) => group.id === targetGroupId)?.title;
    const destinationLabel = targetGroupTitle ? `${targetProject.title}／${targetGroupTitle}` : targetProject.title;
    const destinationSheetIds = uniqueSheetIds.filter((sheetId) =>
      targetProject.sheets.some((sheet) => sheet.id === sheetId && sheet.groupId === targetGroupId),
    );

    if (preserveNavigation) {
      if (sidebarMode === "library" && !activeNoteGroupId && projectFilter === "active") {
        setActiveProjectId(targetProject.id);
        setActiveGroupId(targetGroupId);
        setActiveSheetId(firstMove.movedSheet.id);
        setSelectedSheetIds(destinationSheetIds);
        setSheetSelectionAnchorId(firstMove.movedSheet.id);
      }
      setLibraryStatus(`已将「${firstMove.sourceSheet.title}」移动到「${destinationLabel}」`);
      return;
    }

    const stayInSourceList = projectFilter === "inbox" || Boolean(activeNoteGroupId);
    if (stayInSourceList) {
      const nextSourceSheetId = visibleSheetIds.find((sheetId) => !uniqueSheetIds.includes(sheetId)) ?? "";
      const nextSourceProject = nextProjects.find((project) => project.sheets.some((sheet) => sheet.id === nextSourceSheetId));
      setActiveProjectId(nextSourceProject?.id ?? firstMove.sourceProject.id);
      setActiveSheetId(nextSourceSheetId);
      setSelectedSheetIds(nextSourceSheetId ? [nextSourceSheetId] : []);
      setSheetSelectionAnchorId(nextSourceSheetId);
    } else {
      setActiveProjectId(targetProject.id);
      setActiveGroupId(targetGroupId);
      setActiveSheetId(firstMove.movedSheet.id);
      setSelectedSheetIds(destinationSheetIds);
      setSheetSelectionAnchorId(firstMove.movedSheet.id);
      if (sidebarMode === "project" && targetProject.id === activeProjectId && targetGroupId) {
        setActiveGroupIdsByProject((current) => ({ ...current, [targetProject.id]: targetGroupId }));
      }
    }

    const status =
      uniqueSheetIds.length > 1
        ? `已将 ${movedSheets.length} 篇文稿移动到「${destinationLabel}」${alreadyInTargetCount ? `，${alreadyInTargetCount} 篇原本已在此处` : ""}`
        : `已将「${firstMove.sourceSheet.title}」移动到「${destinationLabel}」`;
    setLibraryStatus(status);
    showAppToast({
      variant: "success",
      title: uniqueSheetIds.length > 1 ? `已移动 ${movedSheets.length} 篇文稿` : "文稿已移动",
      description: `已移动到「${destinationLabel}」${alreadyInTargetCount ? `，${alreadyInTargetCount} 篇未变动` : ""}`,
      duration: 6000,
      actionLabel: "撤销",
      onAction: () => undoSheetMoves(movedSheets),
    });
  }

  async function cleanEmptySheetsFromLibrary() {
    if (!persistenceReady || !libraryPath || cleanEmptySheetsBusyRef.current) return;
    cleanEmptySheetsBusyRef.current = true;
    setLibraryStatus("正在清理空白文稿...");
    try {
      await libraryPersistence.persistProjectsImmediately(projects);
      const cleanup = await cleanEmptySheets(libraryPath);
      const nextProjects = normalizeProjects(cleanup.projects);
      const previousSheetIds = new Set(projects.flatMap((project) => project.sheets.map((sheet) => sheet.id)));
      const remainingSheetIds = new Set(nextProjects.flatMap((project) => project.sheets.map((sheet) => sheet.id)));
      const removedSheetIds = [...previousSheetIds].filter((sheetId) => !remainingSheetIds.has(sheetId));
      libraryPersistence.skipNextLibrarySave();
      setProjects(nextProjects);

      const removed = new Set(removedSheetIds);
      const activeProjectAfterCleanup = nextProjects.find((project) => project.id === activeProjectId);
      const fallbackSheet = activeProjectAfterCleanup?.sheets.find((sheet) => !sheet.archivedAt) ?? activeProjectAfterCleanup?.sheets[0];
      const restoredSelection = removed.has(activeSheetId)
        ? { projectId: activeProjectAfterCleanup?.id ?? activeProjectId, sheetId: fallbackSheet?.id ?? "" }
        : resolveSavedProjectSelection(nextProjects, activeProjectId, activeSheetId);
      const restoredProject = nextProjects.find((project) => project.id === restoredSelection.projectId);
      const restoredSheet = restoredProject?.sheets.find((sheet) => sheet.id === restoredSelection.sheetId);
      if (removed.has(activeSheetId)) {
        setActiveProjectId(restoredSelection.projectId);
        setActiveSheetId(restoredSelection.sheetId);
        setActiveGroupId(restoredSheet?.groupId ?? "");
      }
      setSelectedSheetIds((current) => {
        const remaining = current.filter((sheetId) => !removed.has(sheetId));
        return remaining.length > 0 || !restoredSelection.sheetId ? remaining : [restoredSelection.sheetId];
      });
      setSheetSelectionAnchorId((current) => (removed.has(current) ? restoredSelection.sheetId : current));
      libraryTrash.refresh();
      setLibraryStatus(cleanup.removedCount > 0 ? `已将 ${cleanup.removedCount} 篇空白文稿移入废纸篓` : "没有发现需要清理的空白文稿");
      showAppToast({
        variant: "success",
        title: "删除成功",
        description: cleanup.removedCount > 0 ? `已将 ${cleanup.removedCount} 篇空白文稿移入废纸篓` : "没有发现需要清理的空白文稿",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLibraryStatus(`清理空白文稿失败：${message}`);
      showAppToast({
        variant: "error",
        title: "删除失败",
        description: "请稍后重试",
      });
    } finally {
      cleanEmptySheetsBusyRef.current = false;
    }
  }

  useEffect(() => {
    cleanEmptySheetsRef.current = () => void cleanEmptySheetsFromLibrary();
  });

  useEffect(() => {
    cleanUnusedImagesRef.current = () => void unusedImageCleanup.startScan();
  });

  function moveSheetToTarget(sheetId: string, target: SheetMoveTarget, preserveNavigation = false) {
    moveSheetsToTarget([sheetId], target, preserveNavigation);
  }

  const blockingDialogOpen =
    projectDialogs.projectDialogOpen ||
    projectDialogs.groupDialogOpen ||
    Boolean(propertyManagerProjectId) ||
    Boolean(sidebarActions.projectPendingTrash) ||
    Boolean(sidebarActions.sheetPendingTrash) ||
    sidebarActions.trashClearPending ||
    unusedImageCleanup.dialogOpen ||
    quickCaptureOpen ||
    moveSheetIds.length > 0;

  function openSettings() {
    setShortcutsDialogOpen(false);
    setSettingsDialogInitialTab("writing");
    setSettingsDialogOpen(true);
  }

  function openAiSettings() {
    setShortcutsDialogOpen(false);
    setSettingsDialogInitialTab("ai");
    setSettingsDialogOpen(true);
  }

  function openPublishingSettings() {
    setDirectPublishChannel(null);
    setSettingsDialogInitialTab("publishing");
    setSettingsDialogOpen(true);
  }

  function openImageHostingSettings() {
    setWechatPublishOpen(false);
    setSettingsDialogInitialTab("image-hosting");
    setSettingsDialogOpen(true);
  }

  function openKeyboardShortcuts() {
    setSettingsDialogOpen(false);
    setShortcutsDialogOpen(true);
  }

  function toggleNavigationRails() {
    if (libraryRailOpen || sheetRailOpen) {
      startTransition(() => {
        setLibraryRailOpen(false);
        setSheetRailOpen(false);
        documentRailMode.setRailModeSwitchExpanded(false);
      });
      return;
    }
    expandLibraryRail();
  }

  function openSheetSearch() {
    documentRailMode.showSheetListRail();
    setSheetRailOpen(true);
    setSheetFilterOpen(true);
  }

  function createSheetFromCurrentContext() {
    if (sidebarMode === "library" && !activeNoteGroupId && (projectFilter === "archived" || projectFilter === "trash")) {
      setProjectFilter("inbox");
    }
    sheetActions.createSheet();
  }

  const runAppShortcut = useAppShortcuts({
    newProject: { run: projectDialogs.openNewProjectDialog, enabled: !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen },
    newSheet: {
      run: createSheetFromCurrentContext,
      enabled: Boolean(activeProject) && projectFilter !== "trash" && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    quickCapture: {
      run: () => setQuickCaptureOpen(true),
      enabled: !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    searchSheets: {
      run: openSheetSearch,
      enabled: Boolean(activeProject) && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    previousSheet: {
      run: () => navigateSheet(-1),
      enabled: activeSheetIndex > 0 && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    nextSheet: {
      run: () => navigateSheet(1),
      enabled:
        activeSheetIndex >= 0 &&
        activeSheetIndex < filteredSheets.length - 1 &&
        !blockingDialogOpen &&
        !shortcutsDialogOpen &&
        !settingsDialogOpen,
    },
    toggleNavigation: {
      run: toggleNavigationRails,
      enabled: !focusMode && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    toggleInspector: {
      run: windowChrome.toggleInspectorPanel,
      enabled: Boolean(activeSheet) && !focusMode && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    toggleFocusMode: {
      run: focusModeLayout.toggleFocusMode,
      enabled: Boolean(activeSheet) && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    enterZenMode: {
      run: () => void enterZenMode(),
      enabled: Boolean(activeSheet) && !previewedVersion && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    togglePreview: {
      run: () => setSheetPreviewMode((current) => !current),
      enabled: Boolean(activeSheet) && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    openSettings: { run: openSettings, enabled: !blockingDialogOpen },
    openShortcuts: { run: openKeyboardShortcuts, enabled: !blockingDialogOpen },
  });

  useEffect(() => {
    if (!windowChrome.appWindow) return;
    let disposed = false;
    let unlisten: Array<() => void> = [];
    const menuShortcuts: Array<[string, AppShortcutId]> = [
      ["loby://new-project", "newProject"],
      ["loby://new-sheet", "newSheet"],
      ["loby://quick-capture", "quickCapture"],
      ["loby://open-settings", "openSettings"],
      ["loby://open-shortcuts", "openShortcuts"],
    ];

    Promise.all([
      ...menuShortcuts.map(([eventName, shortcutId]) => listen(eventName, () => runAppShortcut(shortcutId))),
      listen("loby://clean-empty-sheets", () => cleanEmptySheetsRef.current()),
      listen("loby://clean-unused-images", () => cleanUnusedImagesRef.current()),
    ]).then((handlers) => {
      if (disposed) {
        handlers.forEach((handler) => handler());
      } else {
        unlisten = handlers;
      }
    });

    return () => {
      disposed = true;
      unlisten.forEach((handler) => handler());
    };
  }, [runAppShortcut, windowChrome.appWindow]);

  if (libraryPersistence.onboardingRequired) {
    return (
      <div className="loby-window" data-app-theme={resolvedAppTheme}>
        <div
          className="empty-window-toolbar"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        />
        <LibraryOnboarding
          defaultParentPath={libraryPersistence.defaultLibrariesPath}
          onChooseParent={libraryPersistence.chooseLibraryLocation}
          onCreateLibrary={libraryPersistence.createLibrary}
          onOpenExistingLibrary={libraryPersistence.addExistingLibrary}
        />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="loby-window" data-app-theme={resolvedAppTheme}>
        <div
          className="empty-window-toolbar"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        />
        <EmptyLibraryState
          libraryPath={libraryPath}
          onCreateBlankProject={projectDialogs.openNewProjectDialog}
          onImportMarkdown={createProjectFromMarkdownFiles}
          onOpenLibrary={libraryPersistence.openCurrentLibrary}
          onCreateFromTemplate={createProject}
        />
        {projectDraftDialogs}
        {renderSettingsDialog()}
        {shortcutsDialogOpen && (
          <Suspense fallback={null}>
            <KeyboardShortcutsDialog open onClose={() => setShortcutsDialogOpen(false)} />
          </Suspense>
        )}
        {quickCaptureOpen && (
          <Suspense fallback={null}>
            <QuickCaptureDialog
              open
              onClose={() => setQuickCaptureOpen(false)}
              onSave={(body) => {
                sheetActions.createQuickNote(body);
                setLibraryStatus("已发送到“笔记／随手记”");
              }}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="loby-window" data-app-theme={resolvedAppTheme}>
      <div
        className={clsx(
          "app-shell",
          focusMode && "focus-mode",
          !libraryRailOpen && "hide-library-rail",
          !sheetRailOpen && "hide-sheet-rail",
          (!inspectorOpen || !activeSheet || assistantPresentation !== "docked") && "hide-inspector",
          windowChrome.inspectorSnap && "inspector-snap",
        )}
        style={
          {
            "--sheet-expanded-col": `${sheetRailWidth}px`,
            "--inspector-expanded-col": `${inspectorWidth}px`,
          } as CSSProperties
        }
      >
        {!libraryRailOpen && sheetRailOpen && (
          <div
            className="window-toolbar-overlay"
            data-tauri-drag-region
            onMouseDown={windowChrome.startWindowDrag}
            onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
          >
            <LiquidGlassButton onClick={expandLibraryRail} title="展开导航栏">
              <PanelLeftOpen size={17} />
            </LiquidGlassButton>
          </div>
        )}
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
        <ContextMenu
          modal={false}
          open={Boolean(sidebarActions.sidebarContextMenu)}
          onOpenChange={(open) => {
            if (!open) sidebarActions.closeSidebarContextMenu();
          }}
        >
          <ContextMenuTrigger asChild>
            <section className="left-workspace">
              <LibraryRail
                active={activeWorkspaceRegion === "navigation"}
                open={libraryRailOpen}
                sidebarMode={displayedSidebarMode}
                activeProject={displayedSidebarProject}
                projectFilter={projectFilter}
                projectsOpen={libraryProjectsOpen}
                notesOpen={libraryNotesOpen}
                filteredProjects={filteredProjects}
                notesGroups={noteGroups}
                projectGroups={displayedProjectGroups}
                resolvedActiveGroupId={displayedResolvedGroupId}
                activeNoteGroupId={activeNoteGroupId}
                sheetDragActive={Boolean(sheetActions.draggingSheetId)}
                writingCheckIns={writingActivity.activity.checkIns}
                writingProjects={projects}
                resolvedAppTheme={resolvedAppTheme}
                onWindowDragStart={windowChrome.startWindowDrag}
                onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
                onCreateProject={projectDialogs.openNewProjectDialog}
                onCollapse={collapseLibraryRail}
                onProjectFilterChange={selectProjectFilter}
                onProjectsOpenChange={setLibraryProjectsOpen}
                onNotesOpenChange={setLibraryNotesOpen}
                onEnterProject={enterProject}
                onProjectContextMenu={sidebarActions.openProjectContextMenu}
                onSelectNoteGroup={selectNoteGroup}
                onNoteGroupContextMenu={sidebarActions.openNoteGroupContextMenu}
                onCreateNoteGroup={() => projectDialogs.openGroupDialog(NOTES_PROJECT_ID)}
                onReorderProjects={reorderProjects}
                onReorderNoteGroups={(sourceGroupId, targetGroupId, position) =>
                  reorderProjectGroups(NOTES_PROJECT_ID, sourceGroupId, targetGroupId, position)
                }
                onBackToLibrary={() => {
                  documentRailMode.showSheetListRail();
                  setSidebarMode("library");
                }}
                onEditProject={projectDialogs.openEditProjectDialog}
                onCreateProjectGroup={() => projectDialogs.openGroupDialog(displayedSidebarProject.id)}
                onSelectProjectGroup={selectProjectGroup}
                onReorderProjectGroups={(sourceGroupId, targetGroupId, position) =>
                  reorderProjectGroups(displayedSidebarProject.id, sourceGroupId, targetGroupId, position)
                }
                onOpenSettings={openSettings}
                onTemporaryAppThemeChange={changeTemporaryAppTheme}
                onActivate={() => setActiveWorkspaceRegion("navigation")}
              />

              <div className="sheet-rail-slot" aria-hidden={!sheetRailOpen} inert={!sheetRailOpen}>
                {documentRailMode.documentFunctionRailOpen && activeProject && activeSheet ? (
                  <DocumentFunctionRail
                    project={activeProject}
                    sheet={activeSheet}
                    libraryPath={libraryPath}
                    onToggleMode={() => documentRailMode.selectRailMode("list")}
                    railModeSwitchExpanded={documentRailMode.railModeSwitchExpanded}
                    onRailModeSwitchExpandedChange={documentRailMode.setRailModeSwitchExpanded}
                    onWindowDragStart={windowChrome.startWindowDrag}
                    onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
                    onRailWheel={documentRailMode.handleRailWheel}
                    onRevealPosition={revealEditorPosition}
                    onReplaceBody={replaceActiveSheetBody}
                    previewedVersionId={previewedVersion?.id ?? ""}
                    onPreviewVersion={previewActiveSheetVersion}
                    onCloseVersionPreview={closeVersionPreview}
                    onRestoreVersion={restoreActiveSheetVersion}
                  />
                ) : (
                  <SheetRail
                    active={activeWorkspaceRegion === "list"}
                    title={sheetListTitle}
                    search={sheetSearch}
                    filterOpen={sheetFilterOpen}
                    sortMode={sheetSortMode}
                    sortDirection={sheetSortDirection}
                    sheets={projectFilter === "trash" ? libraryTrash.sheets : filteredSheets}
                    sheetProjectTitleById={projectFilter === "trash" ? libraryTrash.projectTitleBySheetId : sheetProjectTitleById}
                    activeSheetId={
                      projectFilter === "trash" && libraryTrash.selectedEntryId ? `trash:${libraryTrash.selectedEntryId}` : activeSheetId
                    }
                    selectedSheetIds={
                      projectFilter === "trash" && libraryTrash.selectedEntryId
                        ? [`trash:${libraryTrash.selectedEntryId}`]
                        : selectedSheetIds
                    }
                    draggingSheetId={sheetActions.draggingSheetId}
                    dropTarget={sheetActions.sheetDropTarget}
                    canReorderSheets={projectFilter === "trash" ? false : canManuallyReorderSheets}
                    canMoveSheets={projectFilter !== "trash"}
                    onWindowDragStart={windowChrome.startWindowDrag}
                    onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
                    onCreateSheet={createSheetFromCurrentContext}
                    onSearchChange={setSheetSearch}
                    onFilterOpenChange={setSheetFilterOpen}
                    onSortModeChange={sheetList.updateSortMode}
                    onSortDirectionChange={sheetList.updateSortDirection}
                    onSelectSheet={(sheetId, modifiers) =>
                      projectFilter === "trash"
                        ? libraryTrash.setSelectedEntryId(sheetId.replace(/^trash:/, ""))
                        : selectSheetFromList(sheetId, modifiers)
                    }
                    onClearSheetSelection={() => (projectFilter === "trash" ? libraryTrash.setSelectedEntryId("") : clearSheetSelection())}
                    onSheetContextMenu={(event, sheetId) => {
                      if (projectFilter === "trash") {
                        event.preventDefault();
                        return;
                      }
                      openSheetContextMenu(event, sheetId);
                    }}
                    onSheetReorderStart={(sheetId) => {
                      setSheetDragNavigationPreview(null);
                      sheetActions.beginSheetReorder(sheetId);
                    }}
                    onSheetReorderPreview={sheetActions.previewSheetReorder}
                    onSheetReorderCommit={commitSheetReorder}
                    onSheetReorderEnd={() => {
                      sheetActions.clearSheetDragState();
                      setSheetDragNavigationPreview(null);
                    }}
                    onSheetMoveCommit={(sheetId, target) => moveSheetToTarget(sheetId, target, true)}
                    onSheetDragPreviewProject={(projectId) => setSheetDragNavigationPreview({ mode: "project", projectId })}
                    onSheetDragPreviewLibrary={() => setSheetDragNavigationPreview({ mode: "library" })}
                    onSheetDragPreviewClear={() => setSheetDragNavigationPreview(null)}
                    trashMode={projectFilter === "trash"}
                    onClearTrash={() => sidebarActions.setTrashClearPending(true)}
                    railModeSwitchExpanded={documentRailMode.railModeSwitchExpanded}
                    onRailModeSwitchExpandedChange={documentRailMode.setRailModeSwitchExpanded}
                    onSelectRailMode={(mode) => {
                      if (projectFilter !== "trash") documentRailMode.selectRailMode(mode);
                    }}
                    onRailWheel={documentRailMode.handleRailWheel}
                    onActivate={() => setActiveWorkspaceRegion("list")}
                  />
                )}
              </div>

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
          </ContextMenuTrigger>

          {sidebarActions.sidebarContextMenu && (
            <ContextMenuContent className="w-48">
              {sidebarActions.sidebarContextMenu.kind === "project" && sidebarActions.sidebarContextMenu.projectId && (
                <>
                  <ContextMenuItem onSelect={sidebarActions.editContextProject}>
                    <ContextMenuItemIcon>
                      <Columns3Cog aria-hidden="true" />
                    </ContextMenuItemIcon>
                    项目设置
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={sidebarActions.manageContextProjectFields}>
                    <ContextMenuItemIcon>
                      <FileSliders aria-hidden="true" />
                    </ContextMenuItemIcon>
                    文稿属性
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              {sidebarActions.sidebarContextMenu.kind === "sheet" && contextSheetCount === 1 && (
                <>
                  <ContextMenuItem onSelect={sidebarActions.formatContextSheet}>
                    <ContextMenuItemIcon>
                      <Text aria-hidden="true" />
                    </ContextMenuItemIcon>
                    中文排版
                  </ContextMenuItem>
                  {sidebarActions.canToggleContextCompletion() && (
                    <ContextMenuItem onSelect={sidebarActions.toggleContextCompletion}>
                      <ContextMenuItemIcon>
                        <CircleCheck aria-hidden="true" />
                      </ContextMenuItemIcon>
                      {sidebarActions.contextCompletionLabel()}
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                </>
              )}
              {(sidebarActions.sidebarContextMenu.kind !== "sheet" || contextSheetCount === 1) && (
                <ContextMenuItem onSelect={() => void sidebarActions.showSidebarContextTargetInFinder()}>
                  {(sidebarActions.sidebarContextMenu.kind === "sheet" || sidebarActions.sidebarContextMenu.kind === "project") && (
                    <ContextMenuItemIcon>
                      <FolderOpen aria-hidden="true" />
                    </ContextMenuItemIcon>
                  )}
                  在访达中显示
                </ContextMenuItem>
              )}
              {(sidebarActions.sidebarContextMenu.kind === "project" ||
                (sidebarActions.sidebarContextMenu.kind === "sheet" && contextSheetCount === 1)) && (
                <ContextMenuItem onSelect={sidebarActions.toggleContextArchive}>
                  {(sidebarActions.sidebarContextMenu.kind === "sheet" || sidebarActions.sidebarContextMenu.kind === "project") && (
                    <ContextMenuItemIcon>
                      <Archive aria-hidden="true" />
                    </ContextMenuItemIcon>
                  )}
                  {sidebarActions.contextArchiveLabel()}
                </ContextMenuItem>
              )}
              {sidebarActions.sidebarContextMenu.kind === "project" && <ContextMenuSeparator />}
              {sidebarActions.sidebarContextMenu.kind === "project" && (
                <ContextMenuItem variant="destructive" onSelect={sidebarActions.requestDeleteProjectFromContextMenu}>
                  <ContextMenuItemIcon>
                    <Trash2 aria-hidden="true" />
                  </ContextMenuItemIcon>
                  删除项目
                </ContextMenuItem>
              )}
              {sidebarActions.sidebarContextMenu.kind === "sheet" && (
                <>
                  <SheetMoveContextMenu
                    projects={projects}
                    sources={contextSheetSources}
                    onMove={(target) => {
                      const sheetIds = contextSheetEntries.map(({ sheet }) => sheet.id);
                      sidebarActions.closeSidebarContextMenu();
                      moveSheetsToTarget(sheetIds, target);
                    }}
                    onOpenMore={() => {
                      const sheetIds = contextSheetEntries.map(({ sheet }) => sheet.id);
                      sidebarActions.closeSidebarContextMenu();
                      setMoveSheetIds(sheetIds);
                    }}
                  />
                  {contextSheetCount === 1 && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={sidebarActions.requestDeleteSheetFromContextMenu}>
                        <ContextMenuItemIcon>
                          <Trash2 aria-hidden="true" />
                        </ContextMenuItemIcon>
                        删除文稿
                      </ContextMenuItem>
                    </>
                  )}
                </>
              )}
            </ContextMenuContent>
          )}
        </ContextMenu>

        <main
          className="editor-zone"
          data-editor-theme={editorThemeId}
          onPointerDownCapture={() => setActiveWorkspaceRegion("editor")}
          onFocusCapture={() => setActiveWorkspaceRegion("editor")}
        >
          <EditorToolbar
            focusMode={focusMode}
            leftSidebarHidden={!focusMode && !sheetRailOpen}
            canNavigateBack={activeSheetIndex > 0}
            canNavigateForward={activeSheetIndex >= 0 && activeSheetIndex < filteredSheets.length - 1}
            canPublish={Boolean(activeSheet) && !libraryTrash.selectedEntry && !previewedVersion}
            documentInformationControl={
              activeSheet ? (
                <DocumentInformationPopover
                  project={activeProject}
                  sheet={activeSheet}
                  libraryPath={libraryPath}
                  onUpdateSheet={(updater) => updateSheet(activeSheet.id, updater)}
                  onManageFields={() => setPropertyManagerProjectId(activeProject.id)}
                />
              ) : null
            }
            onExpandLeftSidebar={expandLibraryRail}
            onToggleFocusMode={focusModeLayout.toggleFocusMode}
            onNavigateBack={() => navigateSheet(-1)}
            onNavigateForward={() => navigateSheet(1)}
            onSelectPublishChannel={selectPublishChannel}
            onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
          />

          {libraryTrash.selectedEntry ? (
            <TrashPreview
              entry={libraryTrash.selectedEntry}
              busy={libraryTrash.actionBusy}
              onRestore={libraryTrash.restoreSelectedEntry}
              onDeletePermanently={libraryTrash.permanentlyDeleteSelectedEntry}
            />
          ) : activeSheet && editorSheet ? (
            <>
              {previewedVersion && (
                <EditorVersionPreviewBar
                  version={previewedVersion}
                  onClose={closeVersionPreview}
                  onRestore={() => restoreActiveSheetVersion(previewedVersion)}
                />
              )}
              <EditorCanvas
                sheet={editorSheet}
                previewMode={sheetPreviewMode && !previewedVersion}
                previewHtml={sheetPreviewHtml}
                previewBusy={sheetPreviewBusy}
                typewriterMode={typewriterMode}
                typography={editorTypography}
                reviewChanges={previewedVersion ? [] : aiChangeSetReview.activeSheetReviewChanges}
                readOnly={Boolean(previewedVersion)}
                versionPreviewActive={Boolean(previewedVersion)}
                onCreateEditor={(view) => {
                  editorRef.current = view;
                }}
                onBodyChange={(value) => {
                  if (previewedVersion || value === activeSheet.body) return;
                  updateSheet(activeSheet.id, (sheet) => {
                    const headingTitle = extractFirstHeadingTitle(value);
                    return {
                      ...sheet,
                      title: headingTitle || sheet.title,
                      body: value,
                      updatedAt: nowTimestamp(),
                    };
                  });
                }}
                onSelectionChange={(text) => {
                  if (previewedVersion) {
                    setEditorSelectionText("");
                    return;
                  }
                  setEditorSelectionText((current) => (current === text ? current : text));
                }}
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
                onRevealPosition={revealEditorPosition}
              />
            </>
          ) : (
            <section className="grid min-h-0 flex-1 place-items-center bg-card pt-14 text-lg font-medium text-foreground/40">
              没有已选的文稿
            </section>
          )}
          <AnimatePresence initial={false}>
            {!inspectorOpen && activeSheet && !focusMode ? (
              <motion.div
                key="assistant-launcher"
                className="assistant-launcher-anchor"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.82, x: 8, y: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82, x: 8, y: 8 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <AiAssistantLauncher
                  sheetId={activeSheet.id}
                  wordCount={activeSheetWordCount}
                  targetWords={activeSheet.targetWords}
                  onOpen={() => setInspectorOpenWithMotion(true)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        <AnimatePresence initial={false}>
          {inspectorOpen && activeSheet ? (
            <InspectorPanel
              key="assistant-surface"
              presentation={assistantPresentation}
              ai={
                <Suspense fallback={<div className="inspector-empty">正在加载 AI 助手…</div>}>
                  <AiAssistantPanel
                    assistant={aiAssistant}
                    quickPrompts={quickPrompts.prompts}
                    quickPromptsReady={quickPrompts.ready}
                    libraryPath={libraryPath}
                    activeProject={activeProject}
                    activeSheet={activeSheet}
                    shownChangeSetIds={aiChangeSetReview.shownChangeSetIds}
                    presentation={assistantPresentation}
                    onTogglePresentation={toggleAssistantPresentation}
                    onClose={() => setInspectorOpenWithMotion(false)}
                    onShowChanges={aiChangeSetReview.showChanges}
                    onHideChanges={aiChangeSetReview.hideChanges}
                    onRollbackChangeSet={aiChangeSetReview.rollbackChangeSet}
                    onRejectChangeSet={aiChangeSetReview.rejectChangeSet}
                    onOpenChangeSetTarget={selectSheetById}
                    onApplyAction={aiActionExecutor.applyAiAction}
                    onRejectAction={aiActionExecutor.rejectAiAction}
                    onRevertAction={aiActionExecutor.revertAiAction}
                    onOpenActionTarget={openAiActionTarget}
                    onOpenQuickPromptSettings={openAiSettings}
                  />
                </Suspense>
              }
              onResizeStart={windowChrome.beginInspectorResize}
              onActivate={() => setActiveWorkspaceRegion("assistant")}
            />
          ) : null}
        </AnimatePresence>
      </div>
      {projectDraftDialogs}
      {renderSettingsDialog()}
      {activeSheet && (
        <Suspense fallback={null}>
          <WechatPublishDialog
            open={wechatPublishOpen}
            project={activeProject}
            sheet={activeSheet}
            libraryPath={libraryPath}
            onClose={() => setWechatPublishOpen(false)}
            onOpenImageHostingSettings={openImageHostingSettings}
          />
          {directPublishChannel && (
            <DirectPublishDialog
              open
              channel={directPublishChannel}
              project={activeProject}
              sheet={activeSheet}
              libraryPath={libraryPath}
              onClose={() => setDirectPublishChannel(null)}
              onOpenSettings={openPublishingSettings}
            />
          )}
        </Suspense>
      )}
      {shortcutsDialogOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsDialog open onClose={() => setShortcutsDialogOpen(false)} />
        </Suspense>
      )}
      {quickCaptureOpen && (
        <Suspense fallback={null}>
          <QuickCaptureDialog
            open
            onClose={() => setQuickCaptureOpen(false)}
            onSave={(body) => {
              sheetActions.createQuickNote(body);
              setLibraryStatus("已发送到“笔记／随手记”");
            }}
          />
        </Suspense>
      )}
      {moveSheetEntries.length > 0 && (
        <Suspense fallback={null}>
          <MoveSheetDialog
            open
            projects={projects}
            entries={moveSheetEntries}
            onClose={() => setMoveSheetIds([])}
            onMove={(target) =>
              moveSheetsToTarget(
                moveSheetEntries.map(({ sheet }) => sheet.id),
                target,
              )
            }
          />
        </Suspense>
      )}
      {unusedImageCleanup.dialogOpen && (
        <Suspense fallback={null}>
          <UnusedImageCleanupDialog
            open
            candidates={unusedImageCleanup.candidates}
            selectedPaths={unusedImageCleanup.selectedPaths}
            busy={unusedImageCleanup.busy}
            onClose={unusedImageCleanup.closeDialog}
            onTogglePath={unusedImageCleanup.togglePath}
            onSelectAll={unusedImageCleanup.selectAll}
            onPreview={unusedImageCleanup.previewCandidate}
            onSaveAs={unusedImageCleanup.saveCandidateAs}
            onConfirm={() => void unusedImageCleanup.confirmCleanup()}
          />
        </Suspense>
      )}
      {sidebarActions.projectPendingTrash && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="删除项目"
            message={`项目「${sidebarActions.projectPendingTrash.title}」会被移入废纸篓，项目下的所有文件也会一起移动。`}
            confirmLabel="移入废纸篓"
            destructive
            onCancel={() => sidebarActions.setProjectPendingTrash(null)}
            onConfirm={sidebarActions.confirmMoveProjectToTrash}
          />
        </Suspense>
      )}
      {sidebarActions.sheetPendingTrash && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="删除文稿"
            message={`文稿「${sidebarActions.sheetPendingTrash.sheet.title}」会被移入废纸篓，可以稍后恢复。`}
            confirmLabel="移入废纸篓"
            destructive
            onCancel={() => sidebarActions.setSheetPendingTrash(null)}
            onConfirm={sidebarActions.confirmMoveSheetToTrash}
          />
        </Suspense>
      )}
      {sidebarActions.trashClearPending && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="清空废纸篓"
            message="废纸篓中的项目、文稿和图片会被移入系统废纸篓，之后仍可通过 Finder 恢复。"
            confirmLabel="清空"
            destructive
            onCancel={() => sidebarActions.setTrashClearPending(false)}
            onConfirm={sidebarActions.confirmClearTrash}
          />
        </Suspense>
      )}
      {propertyManagerProjectId && (
        <Suspense fallback={null}>
          <ProjectFieldManagerDialog
            open
            project={projects.find((project) => project.id === propertyManagerProjectId)}
            onClose={() => setPropertyManagerProjectId("")}
            onSave={(project) =>
              setProjects((current) => current.map((item) => (item.id === project.id ? normalizeProject(project) : item)))
            }
          />
        </Suspense>
      )}
      <AppTooltip />
    </div>
  );
}

export default App;
