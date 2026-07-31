/**
 * [INPUT]: 依赖 Tauri API/原生菜单与 URL opener、CodeMirror 6、React、shared 契约、桌面更新、写作库、应用级 GitHub/微信公众号发布目标、项目发布绑定、AI 偏好与开发态设计系统
 * [OUTPUT]: 仅供所属模块内部组合使用，协调主界面、全文搜索模态窗、设置、快捷键、帮助/桌面更新、即时列表选择与可中断文稿切换、编辑器实时正文/耐久化、AI，以及 GitHub 单篇/项目增量与微信公众号草稿发布界面
 * [POS]: app 组合层，负责把写作设置映射到收件箱领域模型，并持有首屏到编辑器、更新安装前 flush、列表反馈与 CodeMirror session 切换优先级、实时正文到排版/替换/手动版本/持久化的协调所有权
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EditorView } from "@codemirror/view";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  CloudUpload,
  Columns3Cog,
  ExternalLink,
  FileQuestionMark,
  FileSliders,
  FolderOpen,
  Import as ImportIcon,
  PanelLeftOpen,
  Star,
  Text,
  Trash2,
} from "lucide-react";
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
} from "@/shared/types";
import { AiAssistantLauncher } from "@/features/assistant/components/AiAssistantLauncher";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { DocumentFunctionRail } from "@/features/editor/components/DocumentFunctionRail";
import { EditorToolbar } from "@/features/editor/components/EditorToolbar";
import { DocumentInformationPopover } from "@/features/editor/components/DocumentInformationPopover";
import { EditorVersionPreviewBar } from "@/features/editor/components/EditorVersionPreviewBar";
import { EmptyLibraryState } from "@/features/library/components/EmptyLibraryState";
import { InspectorPanel } from "@/shared/components/InspectorPanel";
import { LibraryRail } from "@/features/library/components/LibraryRail";
import type { DeveloperGalleryPage } from "@/features/library/components/LibraryRailTypes";
import { LibraryOnboarding } from "@/features/library/components/LibraryOnboarding";
import { TrashPreview } from "@/features/library/components/TrashPreview";
import { SheetRail } from "@/features/library/components/SheetRail";
import { GlobalSearchDialog } from "@/features/library/components/GlobalSearchDialog";
import { SheetMoveContextMenu } from "@/features/library/components/SheetMoveContextMenu";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import type { SettingsTabId } from "@/features/settings/constants/settingsDialog";
import { useAiAssistant } from "@/features/assistant/hooks/useAiAssistant";
import { useAppUpdater } from "@/features/app-update/hooks/useAppUpdater";
import { useAiActionExecutor } from "@/features/assistant/hooks/useAiActionExecutor";
import { useAiChangeSetReview } from "@/features/assistant/hooks/useAiChangeSetReview";
import { useAppShortcuts } from "@/shared/hooks/useAppShortcuts";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { useAppThemeTransition } from "@/shared/hooks/useAppThemeTransition";
import { useArticleGoalCelebration } from "@/features/writing-activity/hooks/useArticleGoalCelebration";
import { useDocumentRailMode } from "@/features/editor/hooks/useDocumentRailMode";
import { useEditorImages } from "@/features/editor/hooks/useEditorImages";
import { useFocusModeLayout } from "@/features/editor/hooks/useFocusModeLayout";
import { useLibraryPersistence } from "@/features/library/hooks/useLibraryPersistence";
import { useLibraryPreferences } from "@/features/library/hooks/useLibraryPreferences";
import { useLibraryRailPeek } from "@/features/library/hooks/useLibraryRailPeek";
import { useMarkdownImport } from "@/features/library/hooks/useMarkdownImport";
import { useLibraryTrash } from "@/features/library/hooks/useLibraryTrash";
import { useProjectResources } from "@/features/library/hooks/useProjectResources";
import { usePublishingTargets } from "@/features/publishing/hooks/usePublishingTargets";
import { useProjectDraftDialogs } from "@/features/library/hooks/useProjectDraftDialogs";
import { useQuickPrompts } from "@/features/assistant/hooks/useQuickPrompts";
import { useSheetActions } from "@/features/library/hooks/useSheetActions";
import { useSheetList } from "@/features/library/hooks/useSheetList";
import { useSidebarContextMenu } from "@/features/library/hooks/useSidebarContextMenu";
import { useUnusedImageCleanup } from "@/features/library/hooks/useUnusedImageCleanup";
import { useWindowChrome } from "@/shared/hooks/useWindowChrome";
import { useViewportWidth } from "@/shared/hooks/useViewportWidth";
import { useWorkspaceNavigation } from "@/features/library/hooks/useWorkspaceNavigation";
import { useWritingActivity } from "@/features/writing-activity/hooks/useWritingActivity";
import { resolveAiActionNavigationTarget } from "@/features/assistant/model/aiActionNavigation";
import { showAppToast } from "@/shared/lib/appToast";
import { resolveAssistantPresentation } from "@/features/assistant/model/assistantPresentation";
import { libraryPreferencesFromAgentSettings } from "@/features/library/model/libraryPreferences";
import { renderMarkdownHtml } from "@/features/publishing/model/export";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { nowTimestamp, today } from "@/shared/lib/dates";
import type { AppShortcutId } from "@/shared/lib/keyboardShortcuts";
import type { PublishChannelId } from "@/features/publishing/model/types";
import { normalizeProjectPublishingBinding } from "@/features/publishing/model/helpCenter";
import { isPublishingTargetReady, publishingTargetById } from "@/features/publishing/model/publishingTargets";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import { rewriteSheetImageReferencesForLocationChange } from "@/features/library/model/imageAssets";
import {
  createManualSaveVersion,
  createSheetVersionSnapshot,
  manualSaveNeedsVersion,
  resolveManualSaveBaseline,
  restoreSheetVersion,
} from "@/features/library/model/sheetVersions";
import { MAX_SHEET_RAIL_WIDTH, MIN_SHEET_RAIL_WIDTH, resolveSheetRailDrag } from "@/features/library/model/sheetRailResize";
import { countWords } from "@/shared/lib/text";
import { resolveCurrentAppTheme } from "@/shared/lib/themes";
import { getProjectTargetWordsDefault, setProjectTargetWordsDefault } from "@/features/editor/model/documentProperties";
import {
  addProjectGroup,
  createWritingProject,
  createProjectGroupDraft,
  getInitialProjectSelection,
  reorderProjectGroupsForRail,
  resolveSheetMoveGroupId,
  type SheetMoveTarget,
} from "@/features/library/model/projectCreation";
import {
  getVisibleProjectGroups,
  INBOX_PROJECT_ID,
  isNotesProject,
  NOTES_QUICK_GROUP_ID,
  NOTES_PROJECT_ID,
  normalizeProject,
  normalizeProjects,
  PROJECT_ALL_GROUP_ID,
  resolveProjectGroupId,
  resolveNewSheetTarget,
  resolveSavedProjectSelection,
  type ProjectFilter,
} from "@/features/library/model/projectModel";
import { cleanEmptySheets, loadBrowserProjects } from "@/features/library/model/persistence";
import type { InlineAiPendingEdit } from "@/features/assistant/model/inlineAi";
import { moveItemById, type RailDropPosition } from "@/features/library/model/sheetSorting";
import { applySheetMoveBatch, type MovedSheetRecord, type PrepareSheetMoveContext } from "@/features/library/model/sheetMoveBatch";
import {
  pruneSheetSelection,
  resolveContextSheetSelection,
  resolveSheetSelection,
  type SheetSelectionModifiers,
} from "@/features/library/model/sheetSelection";
import type { WorkspaceSelectionSnapshot } from "@/features/library/model/workspaceSelection";

const LEFT_SIDEBAR_REVEAL_DRAG_DISTANCE = 36;
const MANUAL_SAVE_TOAST_ID = "manual-document-save";
const LOBY_NEW_FEATURES_URL = "https://loby-help.geekmailab.com/b20wag9h0qtkzvnncpaderevd8/";
const LOBY_HELP_CENTER_URL = "https://loby-help.geekmailab.com/";
type ActiveWorkspaceRegion = "navigation" | "list" | "editor" | "assistant";
type SheetDragNavigationPreview = { mode: "library" } | { mode: "project"; projectId: string };
const loadEditorCanvas = () => import("@/features/editor/components/EditorCanvas").then((module) => ({ default: module.EditorCanvas }));
const EditorCanvas = lazy(loadEditorCanvas);
const AiAssistantPanel = lazy(() =>
  import("@/features/assistant/components/AiAssistantPanel").then((module) => ({ default: module.AiAssistantPanel })),
);
const DocumentPropertyManagerDialog = lazy(() =>
  import("@/features/editor/components/DocumentPropertyManagerDialog").then((module) => ({
    default: module.DocumentPropertyManagerDialog,
  })),
);
const SettingsDialog = lazy(() =>
  import("@/features/settings/components/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);
const ConfirmDialog = lazy(() => import("@/shared/components/ConfirmDialog").then((module) => ({ default: module.ConfirmDialog })));
const KeyboardShortcutsDialog = lazy(() =>
  import("@/features/settings/components/KeyboardShortcutsDialog").then((module) => ({ default: module.KeyboardShortcutsDialog })),
);
const QuickCaptureDialog = lazy(() =>
  import("@/features/library/components/QuickCaptureDialog").then((module) => ({ default: module.QuickCaptureDialog })),
);
const MoveSheetDialog = lazy(() =>
  import("@/features/library/components/MoveSheetDialog").then((module) => ({ default: module.MoveSheetDialog })),
);
const UnusedImageCleanupDialog = lazy(() =>
  import("@/features/library/components/UnusedImageCleanupDialog").then((module) => ({ default: module.UnusedImageCleanupDialog })),
);
const MarkdownImportDialog = lazy(() =>
  import("@/features/library/components/MarkdownImportDialog").then((module) => ({ default: module.MarkdownImportDialog })),
);
const ProjectDraftDialogs = lazy(() =>
  import("@/features/library/components/ProjectDraftDialogs").then((module) => ({ default: module.ProjectDraftDialogs })),
);
const WechatPublishDialog = lazy(() =>
  import("@/features/publishing/components/WechatPublishDialog").then((module) => ({ default: module.WechatPublishDialog })),
);
const DirectPublishDialog = lazy(() =>
  import("@/features/publishing/components/DirectPublishDialog").then((module) => ({ default: module.DirectPublishDialog })),
);
const BlogPublishDialog = lazy(() =>
  import("@/features/publishing/components/BlogPublishDialog").then((module) => ({ default: module.BlogPublishDialog })),
);
const HelpCenterSyncDialog = lazy(() =>
  import("@/features/publishing/components/HelpCenterSyncDialog").then((module) => ({ default: module.HelpCenterSyncDialog })),
);
const ProjectPublishingSettings = lazy(() =>
  import("@/features/publishing/components/ProjectPublishingSettings").then((module) => ({
    default: module.ProjectPublishingSettings,
  })),
);
const DesignGallery = import.meta.env.DEV
  ? lazy(() => import("@/features/design-gallery/components/DesignGallery").then((module) => ({ default: module.DesignGallery })))
  : null;
const ColorSystemGallery = import.meta.env.DEV
  ? lazy(() => import("@/features/design-gallery/components/ColorSystemGallery").then((module) => ({ default: module.ColorSystemGallery })))
  : null;

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  useEffect(() => {
    if (initialSettings.activeSheetId) void loadEditorCanvas();
  }, [initialSettings.activeSheetId]);
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
  const [assistantDockedByDefault, setAssistantDockedByDefault] = useState(initialSettings.assistantDockedByDefault);
  const [assistantPresentationOverride, setAssistantPresentationOverride] = useState<AssistantPresentation | null>(null);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
  const [goalCelebrationEnabled, setGoalCelebrationEnabled] = useState(initialSettings.goalCelebrationEnabled);
  const [appTheme, setAppTheme] = useState(initialSettings.appTheme);
  const [appThemeOverride, setAppThemeOverride] = useState<ResolvedAppTheme | null>(null);
  const [editorThemeId, setEditorThemeId] = useState(initialSettings.editorTheme);
  const [editorTypography, setEditorTypography] = useState(initialSettings.editorTypography);
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
  const [settingsDialogInitialTab, setSettingsDialogInitialTab] = useState<SettingsTabId>("appearance");
  const [welcomeScreenOpen, setWelcomeScreenOpen] = useState(false);
  const [developerGalleryPage, setDeveloperGalleryPage] = useState<DeveloperGalleryPage>(null);
  const ActiveDeveloperGallery =
    developerGalleryPage === "design-system" ? DesignGallery : developerGalleryPage === "color-system" ? ColorSystemGallery : null;
  const [wechatPublishOpen, setWechatPublishOpen] = useState(false);
  const [directPublishChannel, setDirectPublishChannel] = useState<"wordpress" | "mowen" | null>(null);
  const [blogPublishTargetId, setBlogPublishTargetId] = useState("");
  const [helpCenterSyncTarget, setHelpCenterSyncTarget] = useState<{ projectId: string; sheetId?: string } | null>(null);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [sheetScrollRequest, setSheetScrollRequest] = useState<{ sheetId: string; requestId: number } | null>(null);
  const sheetScrollRequestIdRef = useRef(0);
  const [moveSheetIds, setMoveSheetIds] = useState<string[]>([]);
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>(initialSelection.sheetId ? [initialSelection.sheetId] : []);
  const [sheetSelectionAnchorId, setSheetSelectionAnchorId] = useState(initialSelection.sheetId);
  const [documentPropertyManagerProjectId, setDocumentPropertyManagerProjectId] = useState("");
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
  const pendingEditorDocumentsRef = useRef(new Map<string, { readBody: () => string; updatedAt: string }>());
  const manualSaveBaselinesRef = useRef(new Map<string, string>());
  const manualSaveLibraryPathRef = useRef("");
  const manualSaveInFlightRef = useRef(false);
  const pendingEditorFocusSheetIdRef = useRef("");
  const libraryRailRef = useRef<HTMLElement | null>(null);
  const cleanEmptySheetsRef = useRef<() => void>(() => {});
  const cleanUnusedImagesRef = useRef<() => void>(() => {});
  const openMarkdownImportRef = useRef<(targetProjectId?: string) => void>(() => {});
  const openNewProjectDialogRef = useRef<() => void>(() => {});
  const cleanEmptySheetsBusyRef = useRef(false);
  const windowChrome = useWindowChrome({
    inspectorWidth,
    onInspectorWidthChange: setInspectorWidth,
    onInspectorOpenChange: setInspectorOpen,
  });
  const assistantPresentation = resolveAssistantPresentation({
    dockedByDefault: assistantDockedByDefault,
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

  function openProjectHelpCenterSync(projectId: string) {
    setHelpCenterSyncTarget({ projectId });
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
  const { libraryPath, persistenceReady, setLibraryStatus } = libraryPersistence;
  const appUpdater = useAppUpdater({ beforeInstall: libraryPersistence.flushPendingSave });
  const updatePhase = appUpdater.phase;
  const downloadAndInstall = appUpdater.downloadAndInstall;
  const relaunchAndInstall = appUpdater.relaunchAndInstall;
  const updateChecking = updatePhase === "checking";
  const updateAvailable = !updateChecking && Boolean(appUpdater.availableVersion);
  const updateBusy = updateChecking || updatePhase === "downloading" || updatePhase === "installing";
  const updateInstalling = updatePhase === "installing";
  const updateProgress = appUpdater.progress;
  const availableVersion = appUpdater.availableVersion;
  const handleUpdateAction = useCallback(() => {
    if (updatePhase === "installing") {
      void relaunchAndInstall();
      return;
    }
    void downloadAndInstall();
  }, [downloadAndInstall, relaunchAndInstall, updatePhase]);
  const markdownImport = useMarkdownImport({
    libraryPath,
    projects,
    onProjectsChange: setProjects,
    onSkipNextLibrarySave: libraryPersistence.skipNextLibrarySave,
    persistProjectsImmediately: libraryPersistence.persistProjectsImmediately,
    onActiveProjectChange: setActiveProjectId,
    onActiveGroupChange: setActiveGroupId,
    onActiveSheetChange: setActiveSheetId,
    onLibraryStatusChange: setLibraryStatus,
  });
  useEffect(() => {
    openMarkdownImportRef.current = markdownImport.openImport;
  }, [markdownImport.openImport]);
  const publishingTargetState = usePublishingTargets(libraryPath, persistenceReady);
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
  const activeProjectPublishingTarget = publishingTargetById(publishingTargetState.store, activeProject?.publishingBinding?.targetId);
  const activeProjectReadyTarget =
    activeProjectPublishingTarget && isPublishingTargetReady(activeProjectPublishingTarget) ? activeProjectPublishingTarget : undefined;
  const activeProjectBlogTarget = activeProjectReadyTarget?.kind === "githubHugoBlog" ? activeProjectReadyTarget : undefined;
  const activeProjectDocsTarget = activeProjectReadyTarget?.kind === "githubDocsSite" ? activeProjectReadyTarget : undefined;
  const activeBlogPublishingTarget = activeProjectBlogTarget?.id === blogPublishTargetId ? activeProjectBlogTarget : undefined;
  const activeSheetWordCount = useMemo(() => (activeSheet ? countWords(activeSheet.body) : 0), [activeSheet]);
  useArticleGoalCelebration({
    sheet: activeSheet,
    wordCount: activeSheetWordCount,
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
  const editorDocumentSessionKey = activeSheet
    ? previewedVersion
      ? `version:${activeSheet.id}:${previewedVersion.id}`
      : `live:${activeSheet.id}`
    : "";
  useEffect(() => {
    if (!persistenceReady || !libraryPath || !activeSheet) return;
    if (manualSaveLibraryPathRef.current !== libraryPath) {
      manualSaveLibraryPathRef.current = libraryPath;
      manualSaveBaselinesRef.current.clear();
    }
    if (!manualSaveBaselinesRef.current.has(activeSheet.id)) {
      manualSaveBaselinesRef.current.set(activeSheet.id, resolveManualSaveBaseline(activeSheet));
    }
  }, [activeSheet, libraryPath, persistenceReady]);
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
    projectGroupFilterId,
    filteredProjects,
    selectedVisibleGroup,
    sourceSheets: sheetListSource,
    filteredSheets,
    sheetProjectTitleById,
    sheetProjectById,
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
  const displayedProjectPublishingTarget = publishingTargetById(
    publishingTargetState.store,
    displayedSidebarProject.publishingBinding?.targetId,
  );
  const displayedProjectDocsTarget =
    displayedProjectPublishingTarget?.kind === "githubDocsSite" && isPublishingTargetReady(displayedProjectPublishingTarget)
      ? displayedProjectPublishingTarget
      : undefined;
  const displayedProjectGroups = getVisibleProjectGroups(displayedSidebarProject);
  const displayedPreferredGroupId = sheetDragPreviewProject
    ? (activeGroupIdsByProject[displayedSidebarProject.id] ?? PROJECT_ALL_GROUP_ID)
    : projectGroupFilterId;
  const displayedResolvedGroupId =
    displayedPreferredGroupId === PROJECT_ALL_GROUP_ID
      ? PROJECT_ALL_GROUP_ID
      : resolveProjectGroupId(displayedSidebarProject, displayedPreferredGroupId, displayedSidebarProject.sheets[0]?.id ?? "");
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

  function openGlobalSearchResult(sheetId: string, mode: "all" | "project") {
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = ownerProject?.sheets.find((item) => item.id === sheetId);
    if (!ownerProject || !sheet) return;

    setGlobalSearchOpen(false);
    resetSheetFilters();
    documentRailMode.showSheetListRail();
    setSelectedSheetIds([sheet.id]);
    setSheetSelectionAnchorId(sheet.id);
    setActiveWorkspaceRegion("list");
    if (mode === "all") {
      sheetScrollRequestIdRef.current += 1;
      setSheetScrollRequest({ sheetId: sheet.id, requestId: sheetScrollRequestIdRef.current });
    }

    startTransition(() => {
      setActiveProjectId(ownerProject.id);
      setActiveSheetId(sheet.id);
      setActiveNoteGroupId("");
      setProjectFilter("active");
      if (mode === "project" && !isNotesProject(ownerProject) && ownerProject.id !== INBOX_PROJECT_ID) {
        const groupId = sheet.groupId || PROJECT_ALL_GROUP_ID;
        setSidebarMode("project");
        setActiveGroupId(groupId);
        setActiveGroupIdsByProject((current) => ({ ...current, [ownerProject.id]: groupId }));
      } else {
        setSidebarMode("library");
        setActiveGroupId(resolveProjectGroupId(ownerProject, "", sheet.id));
      }
    });
  }
  const projectDialogs = useProjectDraftDialogs({
    activeProjectId: activeProject?.id ?? "",
    onCreateProject: createProject,
    onUpdateProject: (projectId, draft) =>
      updateProject(projectId, (project) => ({
        ...project,
        title: draft.title,
        icon: draft.icon,
        iconColor: draft.iconColor,
        projectGoal: {
          enabled: Boolean(draft.goalEnabled) && (draft.goalTarget ?? 0) > 0,
          unit: draft.goalUnit ?? "words",
          target: Math.max(0, Math.round(draft.goalTarget ?? 0)),
        },
        publishingBinding: draft.publishingTargetId
          ? {
              targetId: draft.publishingTargetId,
              groupMappings: draft.publishingGroupMappings ?? [],
            }
          : undefined,
        updatedAt: today(),
      })),
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
    onManageDocumentProperties: (project) => setDocumentPropertyManagerProjectId(project.id),
    onFormatSheet: formatSheet,
    flushPendingSave: libraryPersistence.flushPendingSave,
  });
  const sidebarContextProject = projects.find((project) => project.id === sidebarActions.sidebarContextMenu?.projectId);
  const sidebarContextTarget = publishingTargetById(publishingTargetState.store, sidebarContextProject?.publishingBinding?.targetId);
  const sidebarContextDocsTarget =
    sidebarContextTarget?.kind === "githubDocsSite" && isPublishingTargetReady(sidebarContextTarget) ? sidebarContextTarget : undefined;
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
    projects,
    activeProject,
    activeSheet,
    libraryPath,
    editorRef,
    onResourcesChanged: projectResources.refresh,
    persistProjectsImmediately: libraryPersistence.persistProjectsImmediately,
    onTrashChanged: libraryTrash.refresh,
    onImageStatusChange: setImageInsertStatus,
    onLibraryStatusChange: setLibraryStatus,
  });
  const sheetActions = useSheetActions({
    activeProject: sheetActionProject,
    activeSheet: sheetActionActiveSheet,
    activeGroupId: sheetActionGroupId,
    projectGroupFilterId: sidebarMode === "project" ? projectGroupFilterId : "",
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
  useEffect(() => {
    const targetSheetId = pendingEditorFocusSheetIdRef.current;
    if (!targetSheetId || activeSheetId !== targetSheetId || sheetPreviewMode || previewedVersion) return;
    let focusFrame = 0;
    const renderFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        if (pendingEditorFocusSheetIdRef.current !== targetSheetId) return;
        const view = editorRef.current;
        if (!view) return;
        view.focus();
        pendingEditorFocusSheetIdRef.current = "";
      });
    });
    return () => {
      window.cancelAnimationFrame(renderFrame);
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
    };
  }, [activeSheetId, previewedVersion, sheetPreviewMode]);
  const aiAssistant = useAiAssistant({
    persistenceReady,
    libraryPath,
    initialAgentProvider: initialSettings.agentProvider,
    initialProviderBaseUrl: initialSettings.providerBaseUrl,
    initialAgentModel: initialSettings.agentModel,
    initialAgentReasoningEffort: initialSettings.agentReasoningEffort,
    initialAgentQuickMode: initialSettings.agentQuickMode,
    initialAssistantSendMode: initialSettings.assistantSendMode,
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
  const prewarmAiRuntime = aiAssistant.prewarmRuntime;
  const aiChangeSetReview = useAiChangeSetReview({
    aiChangeSets,
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
    editorRef,
    updateProject,
    updateSheet,
    getSheetById: findSheetById,
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

  useEffect(() => {
    if (!inspectorOpen) setAssistantPresentationOverride(null);
  }, [inspectorOpen]);

  useEffect(() => {
    if (!inspectorOpen) return;
    void prewarmAiRuntime().catch(() => undefined);
  }, [inspectorOpen, prewarmAiRuntime]);

  useEffect(() => {
    saveAgentSettings({
      libraryRailOpen,
      sheetRailOpen,
      sheetRailWidth,
      inspectorOpen,
      inspectorWidth,
      assistantDockedByDefault,
      focusMode,
      typewriterMode,
      sheetPreviewMode,
      goalCelebrationEnabled,
      appTheme,
      editorTheme: editorThemeId,
      editorTypography,
      markdownFormatting,
      activeGroupIdsByProject,
      sheetSortPreferences,
      sheetManualOrders,
    });
  }, [
    activeGroupIdsByProject,
    assistantDockedByDefault,
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
    if (nextActiveSheetId) {
      startTransition(() => selectSheetById(nextActiveSheetId, true));
    } else setActiveSheetId("");
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
    updateProject(targetProject.id, (project) => {
      const nextProject = addProjectGroup(project, group);
      const target = publishingTargetById(publishingTargetState.store, nextProject.publishingBinding?.targetId);
      if (target?.kind !== "githubDocsSite") return nextProject;
      return {
        ...nextProject,
        publishingBinding: normalizeProjectPublishingBinding(nextProject, target),
      };
    });
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
        const sheetIndex = project.sheets.findIndex((sheet) => sheet.id === sheetId);
        if (sheetIndex < 0) return project;
        const nextSheet = updater(project.sheets[sheetIndex]);
        if (nextSheet === project.sheets[sheetIndex]) return project;
        const sheets = project.sheets.slice();
        sheets[sheetIndex] = nextSheet;
        return {
          ...project,
          updatedAt: today(),
          sheets,
        };
      }),
    );
  }

  function materializeLatestEditorSheet(sheet: WritingSheet): WritingSheet {
    const pending = pendingEditorDocumentsRef.current.get(sheet.id);
    const liveBody =
      editorDocumentSessionKey === `live:${sheet.id}`
        ? (editorRef.current?.state.doc.toString() ?? pending?.readBody() ?? sheet.body)
        : (pending?.readBody() ?? sheet.body);
    if (liveBody === sheet.body) return sheet;
    return {
      ...sheet,
      title: extractFirstHeadingTitle(liveBody) || sheet.title,
      body: liveBody,
      updatedAt: pending?.updatedAt ?? sheet.updatedAt,
    };
  }

  async function formatSheet(projectId: string, sheetId: string) {
    const project = projects.find((item) => item.id === projectId);
    const modelSheet = project?.sheets.find((item) => item.id === sheetId);
    if (!project || !modelSheet) return;
    setLibraryStatus(`正在排版「${modelSheet.title}」...`);
    try {
      const { formatMarkdownDocument } = await import("@/features/editor/model/markdownFormatting");
      const sheet = materializeLatestEditorSheet(modelSheet);
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
        ...materializeLatestEditorSheet(current),
        title: extractFirstHeadingTitle(formattedBody) || current.title,
        body: formattedBody,
        versions: [createSheetVersionSnapshot(sheet, "manual", "Markdown 排版前自动保存"), ...(current.versions ?? [])].slice(0, 20),
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
      setLibraryStatus(`排版「${modelSheet.title}」失败：${message}`);
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

  function replaceActiveSheetBody(replace: (body: string) => string) {
    if (!activeSheet) return;
    const latestSheet = materializeLatestEditorSheet(activeSheet);
    const body = replace(latestSheet.body);
    if (body === latestSheet.body) return;
    updateSheet(activeSheet.id, (sheet) => {
      const current = materializeLatestEditorSheet(sheet);
      return {
        ...current,
        versions: [createSheetVersionSnapshot(current, "manual", "查找替换前自动保存"), ...(current.versions ?? [])].slice(0, 20),
        title: extractFirstHeadingTitle(body) || current.title,
        body,
        updatedAt: nowTimestamp(),
      };
    });
  }

  function applyInlineAiEdit(edit: InlineAiPendingEdit): boolean {
    const targetSheet = findSheetById(edit.sheetId);
    if (!targetSheet || targetSheet.body !== edit.baseBody || targetSheet.body.slice(edit.from, edit.to) !== edit.text) return false;
    updateSheet(edit.sheetId, (sheet) => {
      const current = materializeLatestEditorSheet(sheet);
      return {
        ...current,
        versions: [createSheetVersionSnapshot(current, "ai", `AI 修改「${edit.summary}」前自动保存`), ...(current.versions ?? [])].slice(
          0,
          20,
        ),
        title: extractFirstHeadingTitle(edit.proposedBody) || current.title,
        body: edit.proposedBody,
        updatedAt: nowTimestamp(),
      };
    });
    return true;
  }

  function rejectInlineAiEdit(edit: InlineAiPendingEdit): boolean {
    const targetSheet = findSheetById(edit.sheetId);
    if (!targetSheet || targetSheet.body !== edit.proposedBody) return false;
    updateSheet(edit.sheetId, (sheet) => {
      const current = materializeLatestEditorSheet(sheet);
      return {
        ...current,
        versions: [
          createSheetVersionSnapshot(current, "restore", `撤销 AI 修改「${edit.summary}」前自动保存`),
          ...(current.versions ?? []),
        ].slice(0, 20),
        title: extractFirstHeadingTitle(edit.baseBody) || current.title,
        body: edit.baseBody,
        updatedAt: nowTimestamp(),
      };
    });
    return true;
  }

  function restoreActiveSheetVersion(version: SheetVersion) {
    if (!activeSheet) return;
    setVersionPreviewTarget(null);
    updateSheet(activeSheet.id, (sheet) => ({
      ...restoreSheetVersion(materializeLatestEditorSheet(sheet), version),
      updatedAt: nowTimestamp(),
    }));
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
    const sheet = projects.flatMap((project) => project.sheets).find((item) => item.id === sheetId);
    return sheet ? materializeLatestEditorSheet(sheet) : undefined;
  }

  function createProject(draft: NewProjectDraft) {
    const normalizedProject = createWritingProject(draft);
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

  function renderSettingsDialog() {
    if (!settingsDialogOpen) return null;
    return (
      <Suspense fallback={null}>
        <SettingsDialog
          open={settingsDialogOpen}
          initialTab={settingsDialogInitialTab}
          libraryPath={libraryPath}
          inboxTargetWords={getProjectTargetWordsDefault(inboxProject)}
          goalCelebrationEnabled={goalCelebrationEnabled}
          appTheme={appTheme}
          editorTheme={editorThemeId}
          editorTypography={editorTypography}
          markdownFormatting={markdownFormatting}
          assistantSendMode={aiAssistant.assistantSendMode}
          agentProvider={aiAssistant.defaultAgentProvider}
          providerBaseUrl={aiAssistant.providerBaseUrl}
          agentModel={aiAssistant.defaultAgentModel}
          agentReasoningEffort={aiAssistant.defaultAgentReasoningEffort}
          modelCatalog={aiAssistant.defaultModelCatalog}
          quickPrompts={quickPrompts.prompts}
          quickPromptsReady={quickPrompts.ready}
          publishingTargets={publishingTargetState.store}
          publishingTargetsReady={publishingTargetState.ready}
          publishingTargetsError={publishingTargetState.error}
          onClose={() => setSettingsDialogOpen(false)}
          onInboxTargetWordsChange={(targetWords) =>
            updateProject(inboxProject.id, (project) => ({
              ...setProjectTargetWordsDefault(project, targetWords),
              updatedAt: nowTimestamp(),
            }))
          }
          onGoalCelebrationEnabledChange={setGoalCelebrationEnabled}
          onAppThemeChange={changeAppThemePreference}
          onEditorThemeChange={setEditorThemeId}
          onEditorTypographyChange={setEditorTypography}
          onMarkdownFormattingChange={setMarkdownFormatting}
          onAssistantSendModeChange={aiAssistant.setAssistantSendMode}
          onAgentProviderChange={aiAssistant.setDefaultAgentProvider}
          onProviderBaseUrlChange={aiAssistant.setProviderBaseUrl}
          onAgentModelChange={aiAssistant.setDefaultAgentModel}
          onAgentReasoningEffortChange={aiAssistant.setDefaultAgentReasoningEffort}
          onAddQuickPrompt={quickPrompts.addPrompt}
          onEditQuickPrompt={quickPrompts.editPrompt}
          onDeleteQuickPrompt={quickPrompts.deletePrompt}
          onMoveQuickPrompt={quickPrompts.movePrompt}
          onSavePublishingTarget={publishingTargetState.saveTarget}
          onRevealLibrary={libraryPersistence.openCurrentLibrary}
          onOpenExistingLibrary={libraryPersistence.addExistingLibrary}
          onMoveLibrary={libraryPersistence.moveCurrentLibrary}
          onRebuildLibraryIndex={libraryPersistence.rebuildLibraryIndex}
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
          projectAdditionalSettings={(() => {
            const project = projects.find((item) => item.id === projectDialogs.editingProjectId);
            if (!project) return null;
            return (
              <ProjectPublishingSettings
                project={project}
                projects={projects}
                targets={publishingTargetState.store}
                targetsReady={publishingTargetState.ready}
                draft={projectDialogs.projectDraft}
                onDraftChange={projectDialogs.setProjectDraft}
              />
            );
          })()}
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

  function selectPublishChannel(channelId: PublishChannelId, targetId?: string) {
    if (channelId === "wechat") {
      setWechatPublishOpen(true);
      return;
    }
    if (channelId === "blog") {
      setBlogPublishTargetId(targetId || activeProjectBlogTarget?.id || "");
      return;
    }
    if (channelId === "docs") {
      if (activeProjectDocsTarget && activeProject && activeSheet && (!targetId || targetId === activeProjectDocsTarget.id)) {
        setHelpCenterSyncTarget({ projectId: activeProject.id, sheetId: activeSheet.id });
      }
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
    const pendingSource = pendingEditorDocumentsRef.current.get(sourceSheet.id);
    const pendingSourceBody = pendingSource?.readBody() ?? sourceSheet.body;
    return {
      ...targetSheet,
      body: rewriteSheetImageReferencesForLocationChange(
        pendingSourceBody,
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
    const propertyTypeConflictCount = movedSheets.reduce((total, move) => total + move.propertyTypeConflicts.length, 0);
    const propertyConflictNotice = propertyTypeConflictCount
      ? `${propertyTypeConflictCount} 个同名属性的类型与目标项目不同，已保留原值，请在文稿属性中确认`
      : "";
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
      if (propertyConflictNotice) {
        showAppToast({
          variant: "warning",
          title: "文稿已移动，属性需确认",
          description: propertyConflictNotice,
          duration: 6000,
        });
      }
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
      variant: propertyConflictNotice ? "warning" : "success",
      title: propertyConflictNotice
        ? "文稿已移动，属性需确认"
        : uniqueSheetIds.length > 1
          ? `已移动 ${movedSheets.length} 篇文稿`
          : "文稿已移动",
      description: `已移动到「${destinationLabel}」${alreadyInTargetCount ? `，${alreadyInTargetCount} 篇未变动` : ""}${propertyConflictNotice ? `；${propertyConflictNotice}` : ""}`,
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
    Boolean(documentPropertyManagerProjectId) ||
    Boolean(sidebarActions.projectPendingTrash) ||
    Boolean(sidebarActions.sheetPendingTrash) ||
    sidebarActions.trashClearPending ||
    unusedImageCleanup.dialogOpen ||
    markdownImport.open ||
    quickCaptureOpen ||
    moveSheetIds.length > 0 ||
    welcomeScreenOpen ||
    globalSearchOpen;
  useEffect(() => {
    openNewProjectDialogRef.current = () => {
      if (blockingDialogOpen || shortcutsDialogOpen || settingsDialogOpen) return;
      projectDialogs.openNewProjectDialog();
    };
  }, [blockingDialogOpen, projectDialogs, settingsDialogOpen, shortcutsDialogOpen]);
  const libraryRailPeekEnabled =
    !focusMode &&
    !libraryRailOpen &&
    !blockingDialogOpen &&
    !settingsDialogOpen &&
    !shortcutsDialogOpen &&
    !wechatPublishOpen &&
    !blogPublishTargetId &&
    !directPublishChannel;
  const hasLibraryRailOpenOverlay = useCallback(
    () =>
      Boolean(
        libraryRailRef.current?.querySelector(
          '[data-slot="popover-trigger"][data-state="open"], [data-slot="dropdown-menu-trigger"][data-state="open"], [data-slot="select-trigger"][data-state="open"]',
        ),
      ),
    [],
  );
  const libraryRailPeek = useLibraryRailPeek({
    enabled: libraryRailPeekEnabled,
    interactionLocked: Boolean(sidebarActions.sidebarContextMenu) || Boolean(sheetActions.draggingSheetId),
    hasOpenOverlay: hasLibraryRailOpenOverlay,
  });

  function openSettings() {
    setWelcomeScreenOpen(false);
    setShortcutsDialogOpen(false);
    setSettingsDialogInitialTab("appearance");
    setSettingsDialogOpen(true);
  }

  const openHelpWelcome = useCallback(() => {
    if (libraryPersistence.onboardingRequired) return;
    setSettingsDialogOpen(false);
    setShortcutsDialogOpen(false);
    setWelcomeScreenOpen(true);
  }, [libraryPersistence.onboardingRequired]);

  function openAiSettings() {
    setShortcutsDialogOpen(false);
    setSettingsDialogInitialTab("ai");
    setSettingsDialogOpen(true);
  }

  function openPublishingSettings() {
    setDirectPublishChannel(null);
    setBlogPublishTargetId("");
    setSettingsDialogInitialTab("publishing");
    setSettingsDialogOpen(true);
  }

  function openImageHostingSettings() {
    setWechatPublishOpen(false);
    setSettingsDialogInitialTab("publishing");
    setSettingsDialogOpen(true);
  }

  function toggleKeyboardShortcuts() {
    setWelcomeScreenOpen(false);
    setSettingsDialogOpen(false);
    setShortcutsDialogOpen((current) => !current);
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

  function toggleLibraryRail() {
    startTransition(() => setLibraryRailOpen((current) => !current));
  }

  function createSheetFromCurrentContext() {
    if (
      sidebarMode === "library" &&
      !activeNoteGroupId &&
      (projectFilter === "favorites" || projectFilter === "archived" || projectFilter === "trash")
    ) {
      setProjectFilter("inbox");
    }
    const sheet = sheetActions.createSheet();
    if (!sheet) return;
    pendingEditorFocusSheetIdRef.current = sheet.id;
    setSheetPreviewMode(false);
  }

  async function saveActiveDocument() {
    if (!activeProject || !activeSheet || manualSaveInFlightRef.current) return;
    manualSaveInFlightRef.current = true;
    const project = activeProject;
    const sheet = activeSheet;
    try {
      const formatter = markdownFormatting.formatOnSave
        ? (await import("@/features/editor/model/markdownFormatting")).formatMarkdownDocument
        : null;
      const liveBody =
        editorDocumentSessionKey === `live:${sheet.id}`
          ? (editorRef.current?.state.doc.toString() ?? pendingEditorDocumentsRef.current.get(sheet.id)?.readBody() ?? sheet.body)
          : (pendingEditorDocumentsRef.current.get(sheet.id)?.readBody() ?? sheet.body);
      const baseline = manualSaveBaselinesRef.current.get(sheet.id) ?? resolveManualSaveBaseline(sheet);
      const savedBody = formatter ? formatter(liveBody, markdownFormatting) : liveBody;
      if (!manualSaveNeedsVersion(baseline, liveBody, savedBody)) {
        await libraryPersistence.flushPendingSave();
        setLibraryStatus("当前文稿没有需要保存的修改");
        showAppToast({
          variant: "info",
          title: "无需保存",
          description: "当前文稿没有修改",
          id: MANUAL_SAVE_TOAST_ID,
        });
        return;
      }

      const savedSheet = createManualSaveVersion(sheet, savedBody, nowTimestamp());
      const nextProjects = projects.map((currentProject) =>
        currentProject.id === project.id
          ? {
              ...currentProject,
              updatedAt: today(),
              sheets: currentProject.sheets.map((currentSheet) => (currentSheet.id === sheet.id ? savedSheet : currentSheet)),
            }
          : currentProject,
      );

      setProjects(nextProjects);
      await libraryPersistence.persistDocumentImmediately(project, savedSheet, nextProjects);
      manualSaveBaselinesRef.current.set(sheet.id, savedBody);
      const formattedOnSave = formatter !== null && savedBody !== liveBody;
      setLibraryStatus(formattedOnSave ? "已优化中文排版、保存文稿并生成历史版本" : "已保存文稿并生成历史版本");
      showAppToast({
        variant: "success",
        title: formattedOnSave ? "排版并保存完成" : "保存完成",
        description: formattedOnSave ? "已优化中文排版并生成历史版本" : "已生成历史版本",
        id: MANUAL_SAVE_TOAST_ID,
      });
    } catch {
      setLibraryStatus("当前文稿保存失败");
      showAppToast({
        variant: "error",
        title: "保存失败",
        description: "请稍后重试",
        id: MANUAL_SAVE_TOAST_ID,
      });
    } finally {
      manualSaveInFlightRef.current = false;
    }
  }

  const runAppShortcut = useAppShortcuts({
    saveDocument: {
      run: () => void saveActiveDocument(),
      enabled: Boolean(activeSheet) && !previewedVersion && persistenceReady && !blockingDialogOpen,
    },
    newSheet: {
      run: createSheetFromCurrentContext,
      enabled: Boolean(activeProject) && projectFilter !== "trash" && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    quickCapture: {
      run: () => setQuickCaptureOpen(true),
      enabled: !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    searchSheets: {
      run: () => setGlobalSearchOpen(true),
      enabled: Boolean(activeProject) && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    toggleNavigation: {
      run: toggleNavigationRails,
      enabled: !focusMode && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    toggleLibraryRail: {
      run: toggleLibraryRail,
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
    openSettings: { run: openSettings, enabled: !blockingDialogOpen },
    openShortcuts: { run: toggleKeyboardShortcuts, enabled: !blockingDialogOpen },
  });

  useEffect(() => {
    if (!windowChrome.appWindow) return;
    void invoke("set_typewriter_mode_menu_checked", { checked: typewriterMode }).catch(() => undefined);
  }, [typewriterMode, windowChrome.appWindow]);

  useEffect(() => {
    if (!windowChrome.appWindow) return;
    let disposed = false;
    let unlisten: Array<() => void> = [];
    const menuShortcuts: Array<[string, AppShortcutId]> = [
      ["loby://new-sheet", "newSheet"],
      ["loby://quick-capture", "quickCapture"],
      ["loby://open-settings", "openSettings"],
      ["loby://open-shortcuts", "openShortcuts"],
    ];

    Promise.all([
      ...menuShortcuts.map(([eventName, shortcutId]) => listen(eventName, () => runAppShortcut(shortcutId))),
      listen("loby://new-project", () => openNewProjectDialogRef.current()),
      listen("loby://open-welcome", openHelpWelcome),
      listen("loby://clean-empty-sheets", () => cleanEmptySheetsRef.current()),
      listen("loby://clean-unused-images", () => cleanUnusedImagesRef.current()),
      listen("loby://import-markdown", () => openMarkdownImportRef.current()),
      listen("loby://toggle-typewriter-mode", () => setTypewriterMode((current) => !current)),
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
  }, [openHelpWelcome, runAppShortcut, windowChrome.appWindow]);

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

  if (welcomeScreenOpen) {
    return (
      <div className="loby-window" data-app-theme={resolvedAppTheme}>
        <div
          className="empty-window-toolbar"
          data-tauri-drag-region
          onMouseDown={windowChrome.startWindowDrag}
          onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
        />
        <LibraryOnboarding mode="welcome" onDismiss={() => setWelcomeScreenOpen(false)} />
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
          onCreateProject={projectDialogs.openNewProjectDialog}
          onImportMarkdown={() => markdownImport.openImport()}
          onOpenLibrary={libraryPersistence.openCurrentLibrary}
        />
        {projectDraftDialogs}
        {markdownImport.open && (
          <Suspense fallback={null}>
            <MarkdownImportDialog controller={markdownImport} />
          </Suspense>
        )}
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
          libraryRailPeekEnabled && "library-rail-peek-capable",
          libraryRailPeek.open && "library-rail-peek-open",
          (!inspectorOpen || !activeSheet || assistantPresentation !== "docked" || developerGalleryPage !== null) && "hide-inspector",
          windowChrome.inspectorSnap && "inspector-snap",
        )}
        style={
          {
            "--sheet-expanded-col": `${sheetRailWidth}px`,
            "--inspector-expanded-col": `${inspectorWidth}px`,
          } as CSSProperties
        }
      >
        {libraryRailPeekEnabled && (
          <div
            className="library-rail-peek-trigger"
            aria-hidden="true"
            onPointerEnter={libraryRailPeek.onTriggerPointerEnter}
            onPointerLeave={libraryRailPeek.onTriggerPointerLeave}
          />
        )}
        {!libraryRailOpen && sheetRailOpen && !libraryRailPeek.open && (
          <div
            className="window-toolbar-overlay"
            data-tauri-drag-region
            onMouseDown={windowChrome.startWindowDrag}
            onDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
          >
            <Button variant="ghost" size="icon-sm" onClick={expandLibraryRail} title="展开导航栏">
              <PanelLeftOpen className="size-3.5" />
            </Button>
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
                railRef={libraryRailRef}
                active={activeWorkspaceRegion === "navigation"}
                open={libraryRailOpen || libraryRailPeek.open}
                temporary={!libraryRailOpen && libraryRailPeek.open}
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
                developerGalleryPage={developerGalleryPage}
                onWindowDragStart={windowChrome.startWindowDrag}
                onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
                onCreateProject={projectDialogs.openNewProjectDialog}
                onCollapse={collapseLibraryRail}
                onPin={() => {
                  libraryRailPeek.closeNow();
                  expandLibraryRail();
                }}
                onTemporaryPointerEnter={libraryRailPeek.onRailPointerEnter}
                onTemporaryPointerLeave={libraryRailPeek.onRailPointerLeave}
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
                onPublishProject={
                  displayedProjectDocsTarget && !sheetDragPreviewProject
                    ? () => openProjectHelpCenterSync(displayedSidebarProject.id)
                    : undefined
                }
                onSelectProjectGroup={selectProjectGroup}
                onReorderProjectGroups={(sourceGroupId, targetGroupId, position) =>
                  reorderProjectGroups(displayedSidebarProject.id, sourceGroupId, targetGroupId, position)
                }
                onOpenSettings={openSettings}
                updateAvailable={updateAvailable}
                updateBusy={updateBusy}
                updateInstalling={updateInstalling}
                updateProgress={updateProgress}
                availableVersion={availableVersion}
                onOpenNewFeatures={() => void openUrl(LOBY_NEW_FEATURES_URL)}
                onOpenKeyboardShortcuts={() => setShortcutsDialogOpen(true)}
                onOpenHelp={() => void openUrl(LOBY_HELP_CENTER_URL)}
                onCheckForUpdates={() => void appUpdater.checkForUpdates(true)}
                onInstallUpdate={handleUpdateAction}
                onDeveloperGalleryPageChange={(page) => {
                  setDeveloperGalleryPage(page);
                  if (page) setActiveWorkspaceRegion("navigation");
                }}
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
                    sheetProjectById={projectFilter === "trash" ? {} : sheetProjectById}
                    libraryPath={libraryPath}
                    activeSheetId={
                      projectFilter === "trash" && libraryTrash.selectedEntryId ? `trash:${libraryTrash.selectedEntryId}` : activeSheetId
                    }
                    scrollToTopRequest={sheetScrollRequest}
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
                    onSelectSheet={(sheetId, modifiers) => {
                      if (projectFilter === "trash") {
                        libraryTrash.setSelectedEntryId(sheetId.replace(/^trash:/, ""));
                        return;
                      }
                      setDeveloperGalleryPage(null);
                      selectSheetFromList(sheetId, modifiers);
                    }}
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
                  <ContextMenuItem onSelect={sidebarActions.manageContextDocumentProperties}>
                    <ContextMenuItemIcon>
                      <FileSliders aria-hidden="true" />
                    </ContextMenuItemIcon>
                    文稿属性
                  </ContextMenuItem>
                  {sidebarContextDocsTarget ? (
                    <ContextMenuItem
                      onSelect={() => {
                        const projectId = sidebarActions.sidebarContextMenu?.projectId;
                        sidebarActions.closeSidebarContextMenu();
                        if (projectId) openProjectHelpCenterSync(projectId);
                      }}
                    >
                      <ContextMenuItemIcon>
                        <CloudUpload aria-hidden="true" />
                      </ContextMenuItemIcon>
                      发布到{sidebarContextDocsTarget.siteName}…
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem
                    onSelect={() => {
                      const projectId = sidebarActions.sidebarContextMenu?.projectId;
                      sidebarActions.closeSidebarContextMenu();
                      if (projectId) markdownImport.openImport(projectId);
                    }}
                  >
                    <ContextMenuItemIcon>
                      <ImportIcon aria-hidden="true" />
                    </ContextMenuItemIcon>
                    导入 Markdown…
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
                    中文排版优化
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              {sidebarActions.sidebarContextMenu.kind !== "sheet" && (
                <>
                  <ContextMenuItem onSelect={() => void sidebarActions.showSidebarContextTargetInFinder()}>
                    {sidebarActions.sidebarContextMenu.kind === "project" && (
                      <ContextMenuItemIcon>
                        <FolderOpen aria-hidden="true" />
                      </ContextMenuItemIcon>
                    )}
                    在访达中显示
                  </ContextMenuItem>
                  {sidebarActions.sidebarContextMenu.kind === "project" && (
                    <ContextMenuItem onSelect={sidebarActions.toggleContextArchive}>
                      <ContextMenuItemIcon>
                        <Archive aria-hidden="true" />
                      </ContextMenuItemIcon>
                      {sidebarActions.contextArchiveLabel()}
                    </ContextMenuItem>
                  )}
                </>
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
                  {contextSheetCount === 1 && (
                    <ContextMenuItem onSelect={sidebarActions.toggleContextFavorite}>
                      <ContextMenuItemIcon>
                        <Star aria-hidden="true" />
                      </ContextMenuItemIcon>
                      {sidebarActions.contextFavoriteLabel()}
                    </ContextMenuItem>
                  )}
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
                      <ContextMenuItem onSelect={sidebarActions.toggleContextArchive}>
                        <ContextMenuItemIcon>
                          <Archive aria-hidden="true" />
                        </ContextMenuItemIcon>
                        {sidebarActions.contextArchiveLabel()}
                      </ContextMenuItem>
                      {sidebarContextDocsTarget ? (
                        <ContextMenuItem
                          onSelect={() => {
                            const projectId = sidebarActions.sidebarContextMenu?.projectId;
                            const sheetId = sidebarActions.sidebarContextMenu?.sheetId;
                            sidebarActions.closeSidebarContextMenu();
                            if (projectId && sheetId) setHelpCenterSyncTarget({ projectId, sheetId });
                          }}
                        >
                          <ContextMenuItemIcon>
                            <CloudUpload aria-hidden="true" />
                          </ContextMenuItemIcon>
                          同步到{sidebarContextDocsTarget.siteName}…
                        </ContextMenuItem>
                      ) : null}
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => void sidebarActions.openContextSheetWithDefaultApplication()}>
                        <ContextMenuItemIcon>
                          <ExternalLink aria-hidden="true" />
                        </ContextMenuItemIcon>
                        使用默认应用打开
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => void sidebarActions.showSidebarContextTargetInFinder()}>
                        <ContextMenuItemIcon>
                          <FolderOpen aria-hidden="true" />
                        </ContextMenuItemIcon>
                        在访达中显示
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onSelect={sidebarActions.requestDeleteSheetFromContextMenu}>
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
          {ActiveDeveloperGallery ? (
            <Suspense
              fallback={
                <div className="grid min-h-0 flex-1 place-items-center bg-background text-sm text-muted-foreground">
                  正在加载{developerGalleryPage === "color-system" ? "颜色系统" : "设计系统"}…
                </div>
              }
            >
              <ActiveDeveloperGallery onClose={() => setDeveloperGalleryPage(null)} />
            </Suspense>
          ) : (
            <>
              <EditorToolbar
                focusMode={focusMode}
                leftSidebarHidden={!focusMode && !sheetRailOpen}
                canNavigateBack={activeSheetIndex > 0}
                canNavigateForward={activeSheetIndex >= 0 && activeSheetIndex < filteredSheets.length - 1}
                canPublish={Boolean(activeSheet) && !libraryTrash.selectedEntry && !previewedVersion}
                githubPublishingTarget={activeProjectReadyTarget}
                documentInformationControl={
                  activeSheet ? (
                    <DocumentInformationPopover
                      project={activeProject}
                      sheet={activeSheet}
                      libraryPath={libraryPath}
                      onUpdateSheet={(updater) => updateSheet(activeSheet.id, updater)}
                      onManageFields={() => setDocumentPropertyManagerProjectId(activeProject.id)}
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
                  <Suspense
                    fallback={
                      <div className="grid min-h-0 flex-1 place-items-center bg-background text-sm text-muted-foreground" role="status">
                        正在打开文稿…
                      </div>
                    }
                  >
                    <EditorCanvas
                      sheet={editorSheet}
                      documentSessionKey={editorDocumentSessionKey}
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
                        if (pendingEditorFocusSheetIdRef.current === activeSheet.id && !previewedVersion) {
                          window.requestAnimationFrame(() => {
                            if (editorRef.current !== view || pendingEditorFocusSheetIdRef.current !== activeSheet.id) return;
                            view.focus();
                            pendingEditorFocusSheetIdRef.current = "";
                          });
                        }
                      }}
                      onBodyInput={(sheetId, readBody) => {
                        if (previewedVersion || sheetId !== activeSheet.id || !activeProject) return;
                        const updatedAt = nowTimestamp();
                        pendingEditorDocumentsRef.current.set(sheetId, { readBody, updatedAt });
                        libraryPersistence.scheduleDocumentSave(activeProject, activeSheet, readBody, updatedAt);
                      }}
                      onBodyChange={(sheetId, value, committedReader) => {
                        if (previewedVersion) return;
                        startTransition(() => {
                          updateSheet(sheetId, (sheet) => {
                            const pending = pendingEditorDocumentsRef.current.get(sheetId);
                            const acknowledgesLatestPending = pending?.readBody === committedReader;
                            if (acknowledgesLatestPending) pendingEditorDocumentsRef.current.delete(sheetId);
                            const snapshot: WritingSheet = {
                              ...sheet,
                              title: extractFirstHeadingTitle(value) || sheet.title,
                              body: value,
                              updatedAt: acknowledgesLatestPending ? pending.updatedAt : nowTimestamp(),
                            };
                            return snapshot;
                          });
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
                      onDeleteImage={editorImages.scheduleDeletedImageCleanup}
                      onInsertImage={editorImages.insertImagesFromPicker}
                    />
                  </Suspense>
                </>
              ) : (
                <section className="grid min-h-0 flex-1 place-items-center bg-[var(--editor-bg)] pt-14 text-foreground/25">
                  <div className="flex flex-col items-center gap-3">
                    <FileQuestionMark aria-hidden="true" className="size-12" strokeWidth={1.2} />
                    <p className="text-lg font-medium">没有已选的文稿</p>
                  </div>
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
            </>
          )}
        </main>

        <Suspense fallback={null}>
          <AnimatePresence initial={false}>
            {inspectorOpen && activeSheet ? (
              <InspectorPanel
                key="assistant-surface"
                presentation={assistantPresentation}
                ai={
                  <AiAssistantPanel
                    assistant={aiAssistant}
                    quickPrompts={quickPrompts.prompts}
                    quickPromptsReady={quickPrompts.ready}
                    libraryPath={libraryPath}
                    projects={projects}
                    activeProject={activeProject}
                    activeSheet={activeSheet}
                    shownChangeSetIds={aiChangeSetReview.shownChangeSetIds}
                    presentation={assistantPresentation}
                    onTogglePresentation={toggleAssistantPresentation}
                    dockedByDefault={assistantDockedByDefault}
                    onDockedByDefaultChange={setAssistantDockedByDefault}
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
                }
                onResizeStart={windowChrome.beginInspectorResize}
                onActivate={() => setActiveWorkspaceRegion("assistant")}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>
      </div>
      {projectDraftDialogs}
      {markdownImport.open && (
        <Suspense fallback={null}>
          <MarkdownImportDialog controller={markdownImport} />
        </Suspense>
      )}
      {renderSettingsDialog()}
      {helpCenterSyncTarget &&
        (() => {
          const project = projects.find((item) => item.id === helpCenterSyncTarget.projectId);
          const target = publishingTargetById(publishingTargetState.store, project?.publishingBinding?.targetId);
          if (!project || target?.kind !== "githubDocsSite") return null;
          return (
            <Suspense fallback={null}>
              <HelpCenterSyncDialog
                open
                libraryPath={libraryPath}
                project={project}
                target={target}
                sheetId={helpCenterSyncTarget.sheetId}
                onOpenChange={(open) => !open && setHelpCenterSyncTarget(null)}
                onOpenSettings={openPublishingSettings}
                onProjectChange={(nextProject) =>
                  setProjects((current) =>
                    current.map((item) =>
                      item.id === nextProject.id ? normalizeProject({ ...nextProject, updatedAt: nowTimestamp() }) : item,
                    ),
                  )
                }
              />
            </Suspense>
          );
        })()}
      {activeSheet && (
        <Suspense fallback={null}>
          {wechatPublishOpen && (
            <WechatPublishDialog
              open
              project={activeProject}
              sheet={activeSheet}
              libraryPath={libraryPath}
              onClose={() => setWechatPublishOpen(false)}
              onOpenImageHostingSettings={openImageHostingSettings}
              onOpenSettings={openPublishingSettings}
              onPublished={(targetId, publication) =>
                updateSheet(activeSheet.id, (current) => ({
                  ...current,
                  publications: { ...current.publications, [targetId]: publication },
                  updatedAt: nowTimestamp(),
                }))
              }
            />
          )}
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
          {activeBlogPublishingTarget && (
            <BlogPublishDialog
              open
              project={activeProject}
              sheet={activeSheet}
              target={activeBlogPublishingTarget}
              libraryPath={libraryPath}
              onClose={() => setBlogPublishTargetId("")}
              onOpenSettings={openPublishingSettings}
              onPublished={(targetId, publication) =>
                updateSheet(activeSheet.id, (current) => ({
                  ...current,
                  publications: { ...current.publications, [targetId]: publication },
                  updatedAt: nowTimestamp(),
                }))
              }
            />
          )}
        </Suspense>
      )}
      {shortcutsDialogOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsDialog open onClose={() => setShortcutsDialogOpen(false)} />
        </Suspense>
      )}
      {globalSearchOpen && (
        <GlobalSearchDialog
          open
          libraryPath={libraryPath}
          projects={projects}
          onClose={() => setGlobalSearchOpen(false)}
          onOpenSheet={openGlobalSearchResult}
        />
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
      {documentPropertyManagerProjectId && (
        <Suspense fallback={null}>
          <DocumentPropertyManagerDialog
            open
            project={projects.find((project) => project.id === documentPropertyManagerProjectId)}
            onClose={() => setDocumentPropertyManagerProjectId("")}
            onSave={(project) =>
              setProjects((current) => current.map((item) => (item.id === project.id ? normalizeProject(project) : item)))
            }
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
