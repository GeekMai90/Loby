/**
 * [INPUT]: 依赖 Tauri URL opener、app 原生菜单/主动保存/全局搜索与 AI 动作目标导航协调、CodeMirror 6、React、shared 契约、桌面更新、写作库、应用级 GitHub/微信公众号发布目标、项目发布绑定、AI runtime/一次性内容生成协调、媒体来源 Dialog 与开发态设计系统
 * [OUTPUT]: 仅供所属模块内部组合使用，协调主界面、全文搜索模态窗、设置与 rail 折叠模式、快捷键、帮助/开源链接/桌面更新、即时列表选择与可中断文稿切换、项目分组设置/删除与文件夹迁移、文稿收藏/置顶/创建副本/功能栏直达、编辑器实时正文/耐久化与 AI 修改前只读预览、editor 实时投影到预览/公众号排版的组合、编辑器焦点门禁的顶栏图片入口、AI 协作、可选的文章驱动 Unsplash 搜索词生成，以及 GitHub 单篇/项目增量与批量、项目右键菜单的单行发布目标入口和微信公众号草稿发布界面
 * [POS]: app 组合层，负责把写作设置映射到收件箱领域模型，并区分项目浏览上下文与当前编辑文稿，持有首屏到编辑器、更新安装前 flush、列表反馈与 CodeMirror session 切换优先级，以及实时正文投影到排版/替换/持久化和 AI 审阅正文切换的协调所有权；主动保存、全局搜索与 AI 动作目标切换委托给 app 专用 hook
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EditorView } from "@codemirror/view";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileQuestionMark, PanelLeftOpen } from "lucide-react";
import clsx from "clsx";
import {
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
  DocumentRailTab,
  ResolvedAppTheme,
  SidebarCollapseMode,
  SidebarMode,
  SheetManualOrders,
  SheetSortPreference,
  SheetVersion,
  UnsplashSearchTranslationProvider,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import { AiAssistantLauncher } from "@/features/assistant/components/AiAssistantLauncher";
import { AiAssistantPanelHost } from "@/features/assistant/components/AiAssistantPanelHost";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { DocumentFunctionRail } from "@/features/editor/components/DocumentFunctionRail";
import { EditorToolbar } from "@/features/editor/components/EditorToolbar";
import { DocumentInformationPopover } from "@/features/editor/components/DocumentInformationPopover";
import { EditorVersionPreviewBar } from "@/features/editor/components/EditorVersionPreviewBar";
import { DocumentPropertyManagerDialogHost } from "@/features/editor/components/DocumentPropertyManagerDialogHost";
import { ProjectDraftDialogsHost } from "@/features/library/components/ProjectDraftDialogsHost";
import { EmptyLibraryState } from "@/features/library/components/EmptyLibraryState";
import { InspectorPanel } from "@/shared/components/InspectorPanel";
import { LibraryRail } from "@/features/library/components/LibraryRail";
import type { DeveloperGalleryPage } from "@/features/library/components/LibraryRailTypes";
import { LibraryOnboarding } from "@/features/library/components/LibraryOnboarding";
import { TrashPreview } from "@/features/library/components/TrashPreview";
import { SheetRail } from "@/features/library/components/SheetRail";
import { GlobalSearchDialog } from "@/features/library/components/GlobalSearchDialog";
import { SidebarContextMenu } from "@/features/library/components/SidebarContextMenu";
import { LibraryImportDialogs } from "@/features/library/components/LibraryImportDialogs";
import { LibraryMaintenanceDialogs } from "@/features/library/components/LibraryMaintenanceDialogs";
import { ImageSourceDialogHost } from "@/features/media/components/ImageSourceDialogHost";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import type { SettingsTabId } from "@/features/settings/constants/settingsDialog";
import { SettingsDialogHost } from "@/features/settings/components/SettingsDialogHost";
import { KeyboardShortcutsDialogHost } from "@/features/settings/components/KeyboardShortcutsDialogHost";
import { useAiAssistant } from "@/features/assistant/hooks/useAiAssistant";
import { useAiContentGenerators } from "@/features/assistant/hooks/useAiContentGenerators";
import { useAppUpdater } from "@/features/app-update/hooks/useAppUpdater";
import { useAiActionExecutor } from "@/features/assistant/hooks/useAiActionExecutor";
import { useAiChangeSetReview } from "@/features/assistant/hooks/useAiChangeSetReview";
import { useAppShortcuts } from "@/shared/hooks/useAppShortcuts";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { useAppThemeTransition } from "@/shared/hooks/useAppThemeTransition";
import { useWindowBackgroundSync } from "@/shared/hooks/useWindowBackgroundSync";
import { useArticleGoalCelebration } from "@/features/writing-activity/hooks/useArticleGoalCelebration";
import { useDocumentRailMode } from "@/features/editor/hooks/useDocumentRailMode";
import { useEditorImages } from "@/features/editor/hooks/useEditorImages";
import { useFocusModeLayout } from "@/features/editor/hooks/useFocusModeLayout";
import { useLiveDocumentProjection } from "@/features/editor/hooks/useLiveDocumentProjection";
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
import { showAppToast } from "@/shared/lib/appToast";
import { resolveAssistantPresentation } from "@/features/assistant/model/assistantPresentation";
import { libraryPreferencesFromAgentSettings } from "@/features/library/model/libraryPreferences";
import { renderMarkdownHtml } from "@/features/publishing/model/export";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { resolveUnsplashSearchQuery } from "@/features/media/model/searchTranslation";
import { translateBaiduSearchQuery } from "@/features/media/model/translation";
import { nowTimestamp, today } from "@/shared/lib/dates";
import type { PublishChannelId } from "@/features/publishing/model/types";
import { normalizeProjectPublishingBinding } from "@/features/publishing/model/helpCenter";
import { isPublishingTargetReady, publishingTargetById } from "@/features/publishing/model/publishingTargets";
import { DocumentPublishingDialogs } from "@/features/publishing/components/DocumentPublishingDialogs";
import { ProjectPublishingSettingsHost } from "@/features/publishing/components/ProjectPublishingSettingsHost";
import { PublishingTargetDialog } from "@/features/publishing/components/PublishingTargetDialog";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import { rewriteSheetImageReferencesForLocationChange } from "@/features/library/model/imageAssets";
import { createSheetVersionSnapshot, restoreSheetVersion } from "@/features/library/model/sheetVersions";
import { MAX_SHEET_RAIL_WIDTH, MIN_SHEET_RAIL_WIDTH, resolveSheetRailDrag } from "@/features/library/model/sheetRailResize";
import { resolveSidebarCollapse, synchronizeSidebarRailsForMode } from "@/features/library/model/sidebarCollapse";
import { sheetWordCount } from "@/shared/lib/text";
import { resolveCurrentAppTheme } from "@/shared/lib/themes";
import { getFileManagerName } from "@/shared/lib/platform";
import { getProjectTargetWordsDefault, setProjectTargetWordsDefault } from "@/features/editor/model/documentProperties";
import {
  addProjectGroup,
  createWritingProject,
  createProjectGroupDraft,
  duplicateSheetInProject,
  getInitialProjectSelection,
  reorderProjectGroupsForRail,
  resolveSheetMoveGroupId,
  updateProjectGroup as updateProjectGroupModel,
  type SheetMoveTarget,
} from "@/features/library/model/projectCreation";
import {
  getVisibleProjectGroups,
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
import { cleanEmptySheets, loadBrowserProjects, renameProjectGroupFolder } from "@/features/library/model/persistence";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import type { InlineAiPendingEdit } from "@/features/assistant/model/inlineAi";
import { moveItemById, type RailDropPosition } from "@/features/library/model/sheetSorting";
import { applySheetMoveBatch, type MovedSheetRecord, type PrepareSheetMoveContext } from "@/features/library/model/sheetMoveBatch";
import { resolveContextSheetSelection } from "@/features/library/model/sheetSelection";
import type { WorkspaceSelectionSnapshot } from "@/features/library/model/workspaceSelection";
import { useSheetSelection } from "@/features/library/hooks/useSheetSelection";
import { ColorSystemGallery, DesignGallery, EditorCanvas, loadEditorCanvas } from "@/app/lazySurfaces";
import { useAiActionTargetNavigation } from "@/app/useAiActionTargetNavigation";
import { useGlobalSearchNavigation } from "@/app/useGlobalSearchNavigation";
import { useManualDocumentSave } from "@/app/useManualDocumentSave";
import { useNativeMenuBindings } from "@/app/useNativeMenuBindings";

const LEFT_SIDEBAR_REVEAL_DRAG_DISTANCE = 36;
const LOBY_NEW_FEATURES_URL = "https://loby-help.geekmailab.com/b20wag9h0qtkzvnncpaderevd8/";
const LOBY_HELP_CENTER_URL = "https://loby-help.geekmailab.com/";
const LOBY_GITHUB_URL = "https://github.com/GeekMai90/Loby";
const LOBY_GITEE_URL = "https://gitee.com/geekmai/Loby-Releases";
type ActiveWorkspaceRegion = "navigation" | "list" | "editor" | "assistant";
type SheetDragNavigationPreview = { mode: "library" } | { mode: "project"; projectId: string };
function App() {
  const fileManagerName = getFileManagerName();
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
  const [sidebarCollapseMode, setSidebarCollapseMode] = useState<SidebarCollapseMode>(initialSettings.sidebarCollapseMode);
  const [sheetRailWidth, setSheetRailWidth] = useState(initialSettings.sheetRailWidth);
  const [inspectorOpen, setInspectorOpen] = useState(initialSettings.inspectorOpen);
  const [inspectorWidth, setInspectorWidth] = useState(initialSettings.inspectorWidth);
  const [assistantDockedByDefault, setAssistantDockedByDefault] = useState(initialSettings.assistantDockedByDefault);
  const [assistantPresentationOverride, setAssistantPresentationOverride] = useState<AssistantPresentation | null>(null);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
  const [goalCelebrationEnabled, setGoalCelebrationEnabled] = useState(initialSettings.goalCelebrationEnabled);
  const [unsplashAiRecommendationEnabled, setUnsplashAiRecommendationEnabled] = useState(initialSettings.unsplashAiRecommendationEnabled);
  const [unsplashSearchTranslationEnabled, setUnsplashSearchTranslationEnabled] = useState(
    initialSettings.unsplashSearchTranslationEnabled,
  );
  const [unsplashSearchTranslationProvider, setUnsplashSearchTranslationProvider] = useState<UnsplashSearchTranslationProvider>(
    initialSettings.unsplashSearchTranslationProvider,
  );
  const [appTheme, setAppTheme] = useState(initialSettings.appTheme);
  const [appThemeOverride, setAppThemeOverride] = useState<ResolvedAppTheme | null>(null);
  const [editorThemeId, setEditorThemeId] = useState(initialSettings.editorTheme);
  const [editorTypography, setEditorTypography] = useState(initialSettings.editorTypography);
  const [markdownFormatting, setMarkdownFormatting] = useState(initialSettings.markdownFormatting);
  const [sheetPreviewMode, setSheetPreviewMode] = useState(initialSettings.sheetPreviewMode);
  const [documentFunctionTab, setDocumentFunctionTab] = useState<DocumentRailTab>("media");
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
  const [imageSourceDialogOpen, setImageSourceDialogOpen] = useState(false);
  const [welcomeScreenOpen, setWelcomeScreenOpen] = useState(false);
  const [developerGalleryPage, setDeveloperGalleryPage] = useState<DeveloperGalleryPage>(null);
  const ActiveDeveloperGallery =
    developerGalleryPage === "design-system" ? DesignGallery : developerGalleryPage === "color-system" ? ColorSystemGallery : null;
  const [wechatPublishOpen, setWechatPublishOpen] = useState(false);
  const [directPublishChannel, setDirectPublishChannel] = useState<"wordpress" | "mowen" | null>(null);
  const [blogPublishTargetId, setBlogPublishTargetId] = useState("");
  const [helpCenterSyncTarget, setHelpCenterSyncTarget] = useState<{ projectId: string; targetId?: string; sheetId?: string } | null>(null);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [moveSheetIds, setMoveSheetIds] = useState<string[]>([]);
  const [documentPropertyManagerProjectId, setDocumentPropertyManagerProjectId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [, setImageInsertStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [sheetSearch, setSheetSearch] = useState("");
  const [editorSelectionText, setEditorSelectionText] = useState("");
  const [editorFocused, setEditorFocused] = useState(false);
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
  useWindowBackgroundSync(resolvedAppTheme);
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
  const pendingEditorFocusSheetIdRef = useRef("");
  const libraryRailRef = useRef<HTMLElement | null>(null);
  const cleanEmptySheetsRef = useRef<() => void>(() => {});
  const cleanUnusedImagesRef = useRef<() => void>(() => {});
  const openMarkdownImportRef = useRef<(targetProjectId?: string) => void>(() => {});
  const openNewProjectDialogRef = useRef<() => void>(() => {});
  const selectSheetFromNavigationRef = useRef<(sheetId: string) => void>(() => {});
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

  function openProjectHugoBatchPublish(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const target = publishingTargetById(publishingTargetState.store, project.publishingBinding?.targetId);
    if (target?.kind !== "githubHugoBlog" || !isPublishingTargetReady(target)) return;
    setHelpCenterSyncTarget({ projectId, targetId: target.id });
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
    setEditorFocused(false);
    setVersionPreviewTarget(null);
  }, [activeSheetId]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheetProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === activeSheetId));
  const activeSheet = activeSheetProject?.sheets.find((sheet) => sheet.id === activeSheetId);
  const editorProject = activeSheetProject ?? activeProject;
  const editorProjectPublishingTarget = publishingTargetById(publishingTargetState.store, editorProject?.publishingBinding?.targetId);
  const editorProjectReadyTarget =
    editorProjectPublishingTarget && isPublishingTargetReady(editorProjectPublishingTarget) ? editorProjectPublishingTarget : undefined;
  const editorProjectBlogTarget = editorProjectReadyTarget?.kind === "githubHugoBlog" ? editorProjectReadyTarget : undefined;
  const editorProjectDocsTarget = editorProjectReadyTarget?.kind === "githubDocsSite" ? editorProjectReadyTarget : undefined;
  const activeEditorBlogPublishingTarget = editorProjectBlogTarget?.id === blogPublishTargetId ? editorProjectBlogTarget : undefined;
  const activeSheetWordCount = useMemo(() => (activeSheet ? sheetWordCount(activeSheet) : 0), [activeSheet]);
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
    visibleProjectGroups,
    resolvedActiveGroupId,
    projectGroupFilterId,
    filteredProjects,
    selectedVisibleGroup,
    filteredSheets,
    sheetMetaLabelById,
    sheetProjectById,
    activeSheetIndex,
    canManuallyReorderSheets,
    sheetActionProject,
    sheetActionGroupId,
    sheetActionActiveSheet,
  } = sheetList;
  const visibleSheetIds = useMemo(() => filteredSheets.map((sheet) => sheet.id), [filteredSheets]);
  const editorGroupId = activeSheet?.groupId ?? (editorProject?.id === activeProject?.id ? resolvedActiveGroupId : "");
  // 选择裁剪必须先于 useWorkspaceNavigation 的 repair effect 运行；
  // 前向依赖 workspaceNavigation.selectSheet 通过 ref 解开，避免多一帧选中态闪烁。
  const { selectedSheetIds, setSelectedSheetIds, setSheetSelectionAnchorId, selectSheetFromList, clearSheetSelection } = useSheetSelection({
    initialSheetId: initialSelection.sheetId,
    activeSheetId,
    projectFilter,
    visibleSheetIds,
    onActiveSheetChange: setActiveSheetId,
    onSelectSheet: (sheetId) => selectSheetFromNavigationRef.current(sheetId),
  });

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
  const displayedProjectHugoTarget =
    displayedProjectPublishingTarget?.kind === "githubHugoBlog" && isPublishingTargetReady(displayedProjectPublishingTarget)
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
    noteGroups,
    visibleProjectGroups,
    selectedVisibleGroup,
    filteredProjects,
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
  useEffect(() => {
    selectSheetFromNavigationRef.current = workspaceNavigation.selectSheet;
  }, [workspaceNavigation.selectSheet]);
  const { openGlobalSearchResult, sheetScrollRequest } = useGlobalSearchNavigation({
    projects,
    onSearchClose: () => setGlobalSearchOpen(false),
    onSheetFiltersReset: resetSheetFilters,
    onSheetListRailShow: documentRailMode.showSheetListRail,
    onSingleSheetSelect: (sheetId) => {
      setSelectedSheetIds([sheetId]);
      setSheetSelectionAnchorId(sheetId);
    },
    onSheetListActivate: () => setActiveWorkspaceRegion("list"),
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onProjectFilterChange: setProjectFilter,
    onSidebarModeChange: setSidebarMode,
    onActiveGroupChange: setActiveGroupId,
    onRememberProjectGroup: (projectId, groupId) => {
      setActiveGroupIdsByProject((current) => ({ ...current, [projectId]: groupId }));
    },
  });

  function resetSheetFilters() {
    setSheetSearch("");
    setSheetFilterOpen(false);
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
    onUpdateGroup: saveProjectGroupSettings,
  });
  const sidebarActions = useSidebarContextMenu({
    libraryPath,
    projects,
    activeProjectId,
    activeGroupId,
    onProjectsChange: setProjects,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onSidebarModeChange: setSidebarMode,
    onProjectFilterChange: setProjectFilter,
    onLibraryStatusChange: setLibraryStatus,
    onSkipNextLibrarySave: libraryPersistence.skipNextLibrarySave,
    onTrashChanged: libraryTrash.refresh,
    onSheetTrashCompleted: (_, deletedSheetIds) => {
      const deleted = new Set(deletedSheetIds);
      if (deleted.has(activeSheetId)) setActiveSheetId("");
      setSelectedSheetIds((current) => current.filter((sheetId) => !deleted.has(sheetId)));
      setSheetSelectionAnchorId((current) => (deleted.has(current) ? "" : current));
    },
    onEditProject: projectDialogs.openEditProjectDialog,
    onEditProjectGroup: (project, group) => projectDialogs.openEditGroupDialog(project, group.id),
    onManageDocumentProperties: (project) => setDocumentPropertyManagerProjectId(project.id),
    onFormatSheet: formatSheet,
    onDuplicateSheet: duplicateSheetFromContextMenu,
    onOpenSheetFunctionRail: openSheetFunctionRail,
    flushPendingSave: libraryPersistence.flushPendingSave,
    persistProjectsImmediately: libraryPersistence.persistProjectsImmediately,
  });
  const sidebarContextProject = projects.find((project) => project.id === sidebarActions.sidebarContextMenu?.projectId);
  const sidebarContextTarget = publishingTargetById(publishingTargetState.store, sidebarContextProject?.publishingBinding?.targetId);
  const sidebarContextDocsTarget =
    sidebarContextTarget?.kind === "githubDocsSite" && isPublishingTargetReady(sidebarContextTarget) ? sidebarContextTarget : undefined;
  const sidebarContextHugoTarget =
    sidebarContextTarget?.kind === "githubHugoBlog" && isPublishingTargetReady(sidebarContextTarget) ? sidebarContextTarget : undefined;
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
  const projectResources = useProjectResources(editorProject, libraryPath, windowChrome.appWindow);
  const editorImages = useEditorImages({
    projects,
    activeProject: editorProject,
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
    activeProject: editorProject,
    activeSheet,
    selectedText: editorSelectionText,
    onOpenAiPanel: () => {
      setInspectorOpenWithMotion(true);
    },
    onCreateChangeSet: handleCreateAiChangeSet,
    loadedConversations: libraryPersistence.loadedConversations,
  });
  const readActiveEditorBody = useCallback(() => editorRef.current?.state.doc.toString(), []);
  const {
    documentSummaryGenerator,
    imageSearchQueryGenerator,
    imageSearchQueryTranslator: aiImageSearchQueryTranslator,
  } = useAiContentGenerators({
    libraryPath,
    provider: aiAssistant.defaultAgentProvider,
    model: aiAssistant.defaultAgentModel,
    reasoningEffort: aiAssistant.defaultAgentReasoningEffort,
    quickMode: aiAssistant.defaultAgentQuickMode,
    providerBaseUrl: aiAssistant.providerBaseUrl,
    credentialStatus: aiAssistant.credentialStatus,
    activeSheetId: activeSheet?.id ?? "",
    readActiveEditorBody,
  });
  const resolveImageSearchQuery = useCallback(
    (query: string) =>
      resolveUnsplashSearchQuery({
        query,
        enabled: unsplashSearchTranslationEnabled,
        provider: unsplashSearchTranslationProvider,
        translateWithAi: aiImageSearchQueryTranslator,
        translateWithBaidu: translateBaiduSearchQuery,
      }),
    [aiImageSearchQueryTranslator, unsplashSearchTranslationEnabled, unsplashSearchTranslationProvider],
  );
  const imageSearchQueryTranslator = unsplashSearchTranslationEnabled ? resolveImageSearchQuery : undefined;
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
  const aiReviewPreviewBody = aiChangeSetReview.reviewPreviewBody;
  const aiReviewPreviewActive = !previewedVersion && aiReviewPreviewBody !== null;
  const editorSheet =
    activeSheet && previewedVersion
      ? { ...activeSheet, body: previewedVersion.body }
      : activeSheet && aiReviewPreviewBody !== null
        ? { ...activeSheet, body: aiReviewPreviewBody }
        : activeSheet;
  const editorDocumentSessionKey = activeSheet
    ? previewedVersion
      ? `version:${activeSheet.id}:${previewedVersion.id}`
      : aiReviewPreviewActive
        ? `ai-review-before:${activeSheet.id}`
        : `live:${activeSheet.id}`
    : "";
  const {
    materializeLatestSheet: materializeLatestEditorSheet,
    latestSheetForPublishing: latestActiveSheetForPublishing,
    previewHtml: sheetPreviewHtml,
    previewBusy: sheetPreviewBusy,
  } = useLiveDocumentProjection({
    activeSheet,
    editorDocumentSessionKey,
    editorRef,
    pendingDocumentsRef: pendingEditorDocumentsRef,
    previewMode: sheetPreviewMode,
    publishingMode: wechatPublishOpen,
    renderPreviewHtml: renderMarkdownHtml,
  });
  const { saveActiveDocument } = useManualDocumentSave({
    persistenceReady,
    libraryPath,
    projects,
    project: editorProject,
    sheet: activeSheet,
    blocked: aiReviewPreviewActive,
    markdownFormatting,
    materializeLatestSheet: materializeLatestEditorSheet,
    onProjectsChange: setProjects,
    flushPendingSave: libraryPersistence.flushPendingSave,
    persistDocumentImmediately: libraryPersistence.persistDocumentImmediately,
    onLibraryStatusChange: setLibraryStatus,
  });
  const aiActions = useMemo(() => aiAssistant.messages.flatMap((message) => message.actions ?? []), [aiAssistant.messages]);
  const aiActionExecutor = useAiActionExecutor({
    aiActions,
    projects,
    activeProject: editorProject,
    activeSheet,
    activeProjectId: editorProject?.id ?? activeProjectId,
    activeSheetId,
    resolvedActiveGroupId: editorGroupId,
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
  const { openAiActionTarget } = useAiActionTargetNavigation({
    actions: aiActions,
    projects,
    onActionChange: aiAssistant.updateAction,
    onSheetSelect: selectSheetById,
    onSheetFiltersReset: resetSheetFilters,
    onInspectorOpenChange: setInspectorOpen,
    onLibraryStatusChange: setLibraryStatus,
    onProjectFilterChange: setProjectFilter,
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onSidebarModeChange: setSidebarMode,
    onRememberProjectGroup: (projectId, groupId) => {
      setActiveGroupIdsByProject((current) => ({ ...current, [projectId]: groupId }));
    },
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
      sidebarCollapseMode,
      sheetRailWidth,
      inspectorOpen,
      inspectorWidth,
      assistantDockedByDefault,
      focusMode,
      typewriterMode,
      sheetPreviewMode,
      goalCelebrationEnabled,
      unsplashAiRecommendationEnabled,
      unsplashSearchTranslationEnabled,
      unsplashSearchTranslationProvider,
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
    sidebarCollapseMode,
    sheetRailWidth,
    inspectorOpen,
    inspectorWidth,
    focusMode,
    typewriterMode,
    sheetPreviewMode,
    goalCelebrationEnabled,
    unsplashAiRecommendationEnabled,
    unsplashSearchTranslationEnabled,
    unsplashSearchTranslationProvider,
    appTheme,
    editorThemeId,
    editorTypography,
    markdownFormatting,
    sheetSortPreferences,
    sheetManualOrders,
  ]);

  function selectSheetById(sheetId: string, preserveMultiSelection = false) {
    workspaceNavigation.selectSheet(sheetId);
    if (!preserveMultiSelection) {
      setSelectedSheetIds(sheetId ? [sheetId] : []);
      setSheetSelectionAnchorId(sheetId);
    }
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

  function openSheetFunctionRail(sheetId: string, tab: DocumentRailTab) {
    setDeveloperGalleryPage(null);
    setDocumentFunctionTab(tab);
    if (tab !== "history") closeVersionPreview();
    selectSheetById(sheetId);
    setActiveWorkspaceRegion("list");
    documentRailMode.selectRailMode("document");
  }

  function createProjectGroup(draft: NewProjectDraft, targetProjectId: string) {
    const targetProject = projects.find((project) => project.id === targetProjectId) ?? activeProject;
    if (!targetProject) return;
    const title = draft.title.trim() || "无标题";
    if (targetProject.groups?.some((group) => group.title.trim() === title)) {
      setLibraryStatus(`创建分组失败：项目中已经存在「${title}」`);
      return;
    }
    const isNotesGroup = isNotesProject(targetProject);
    const group = createProjectGroupDraft(targetProject, { ...draft, title });
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

  async function saveProjectGroupSettings(projectId: string, groupId: string, draft: NewProjectDraft) {
    const project = projects.find((item) => item.id === projectId);
    const group = project?.groups?.find((item) => item.id === groupId);
    if (!project || !group) return;

    const nextTitle = draft.title.trim() || "无标题";
    if (project.groups?.some((item) => item.id !== group.id && item.title.trim() === nextTitle)) {
      const error = new Error("同一个项目中不能创建同名分组。");
      setLibraryStatus(`保存分组设置失败：${error.message}`);
      throw error;
    }

    const nextProject = updateProjectGroupModel(project, groupId, {
      ...draft,
      title: nextTitle,
    });
    if (nextProject === project) return;
    const nextProjects = normalizeProjects(projects.map((item) => (item.id === project.id ? nextProject : item)));
    const titleChanged = group.title !== nextTitle;
    let folderRenamed = false;

    setLibraryStatus(`正在保存分组设置：${group.title}`);
    try {
      await libraryPersistence.flushPendingSave();
      if (titleChanged) {
        await renameProjectGroupFolder(libraryPath, project, group, nextTitle);
        folderRenamed = true;
      }
      await libraryPersistence.persistProjectsImmediately(nextProjects);
      libraryPersistence.skipNextLibrarySave();
      setProjects(nextProjects);
      setLibraryStatus(`已更新分组「${nextTitle}」`);
    } catch (error) {
      if (folderRenamed) {
        try {
          await renameProjectGroupFolder(libraryPath, project, { ...group, title: nextTitle }, group.title);
        } catch {
          // 保存失败后的目录回滚失败时保留原始错误，避免覆盖可操作的失败原因。
        }
      }
      setLibraryStatus(`保存分组设置失败：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
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

  function duplicateSheetFromContextMenu(projectId: string, sheetId: string) {
    const project = projects.find((item) => item.id === projectId);
    const sourceSheet = project?.sheets.find((sheet) => sheet.id === sheetId);
    if (!project || !sourceSheet) return;

    const result = duplicateSheetInProject(project, sheetId, {
      sourceSheet: materializeLatestEditorSheet(sourceSheet),
    });
    if (!result) return;

    setProjects((current) => current.map((item) => (item.id === project.id ? result.project : item)));
    setActiveProjectId(project.id);
    setActiveSheetId(result.sheet.id);
    setSelectedSheetIds([result.sheet.id]);
    setSheetSelectionAnchorId(result.sheet.id);
    setSheetSearch("");
    setActiveGroupId(result.sheet.groupId ?? "");
    if (isNotesProject(project)) {
      setActiveNoteGroupId(result.sheet.groupId ?? "");
    }
    pendingEditorFocusSheetIdRef.current = result.sheet.id;
    setSheetPreviewMode(false);
    setLibraryStatus(`已创建文稿副本「${result.sheet.title}」`);
    showAppToast({
      variant: "success",
      title: "已创建副本",
      description: `「${result.sheet.title}」已创建在「${project.title}」中`,
    });
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
      <SettingsDialogHost
        open={settingsDialogOpen}
        initialTab={settingsDialogInitialTab}
        libraryPath={libraryPath}
        inboxTargetWords={getProjectTargetWordsDefault(inboxProject)}
        goalCelebrationEnabled={goalCelebrationEnabled}
        unsplashAiRecommendationEnabled={unsplashAiRecommendationEnabled}
        unsplashSearchTranslationEnabled={unsplashSearchTranslationEnabled}
        unsplashSearchTranslationProvider={unsplashSearchTranslationProvider}
        appTheme={appTheme}
        editorTheme={editorThemeId}
        sidebarCollapseMode={sidebarCollapseMode}
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
        onUnsplashAiRecommendationEnabledChange={setUnsplashAiRecommendationEnabled}
        onUnsplashSearchTranslationEnabledChange={setUnsplashSearchTranslationEnabled}
        onUnsplashSearchTranslationProviderChange={setUnsplashSearchTranslationProvider}
        onAppThemeChange={changeAppThemePreference}
        onEditorThemeChange={setEditorThemeId}
        onSidebarCollapseModeChange={changeSidebarCollapseMode}
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
    );
  }

  const projectDraftDialogs = (
    <ProjectDraftDialogsHost
      projectDialogOpen={projectDialogs.projectDialogOpen}
      groupDialogOpen={projectDialogs.groupDialogOpen}
      editingProjectId={projectDialogs.editingProjectId}
      editingGroupId={projectDialogs.editingGroupId}
      projectDraft={projectDialogs.projectDraft}
      groupDraft={projectDialogs.groupDraft}
      projectAdditionalSettings={(() => {
        const project = projects.find((item) => item.id === projectDialogs.editingProjectId);
        if (!project) return null;
        return (
          <ProjectPublishingSettingsHost
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
  );

  // 引导页只挂录入弹窗；移动/清理/删除确认需要已有写作库内容，不进入 onboarding 分支。
  function renderLibraryImportDialogs() {
    return (
      <LibraryImportDialogs
        markdownImport={markdownImport}
        quickCaptureOpen={quickCaptureOpen}
        onCloseQuickCapture={() => setQuickCaptureOpen(false)}
        onSaveQuickCapture={(body) => {
          sheetActions.createQuickNote(body);
          setLibraryStatus("已发送到“笔记／随手记”");
        }}
      />
    );
  }

  function renderLibraryMaintenanceDialogs() {
    return (
      <LibraryMaintenanceDialogs
        projects={projects}
        moveEntries={moveSheetEntries}
        onCloseMove={() => setMoveSheetIds([])}
        onMoveSheets={moveSheetsToTarget}
        unusedImageCleanup={{
          candidates: unusedImageCleanup.candidates,
          selectedPaths: unusedImageCleanup.selectedPaths,
          dialogOpen: unusedImageCleanup.dialogOpen,
          busy: unusedImageCleanup.busy,
          onClose: unusedImageCleanup.closeDialog,
          onTogglePath: unusedImageCleanup.togglePath,
          onSelectAll: unusedImageCleanup.selectAll,
          onPreview: unusedImageCleanup.previewCandidate,
          onSaveAs: unusedImageCleanup.saveCandidateAs,
          onConfirm: unusedImageCleanup.confirmCleanup,
        }}
        projectPendingTrash={sidebarActions.projectPendingTrash}
        onCancelProjectTrash={() => sidebarActions.setProjectPendingTrash(null)}
        onConfirmProjectTrash={sidebarActions.confirmMoveProjectToTrash}
        projectGroupPendingDelete={sidebarActions.projectGroupPendingDelete}
        onCancelProjectGroupDelete={() => sidebarActions.setProjectGroupPendingDelete(null)}
        onConfirmProjectGroupDelete={sidebarActions.confirmMoveProjectGroupToDefault}
        sheetPendingTrash={sidebarActions.sheetPendingTrash}
        onCancelSheetTrash={() => sidebarActions.setSheetPendingTrash(null)}
        onConfirmSheetTrash={sidebarActions.confirmMoveSheetToTrash}
        trashClearPending={sidebarActions.trashClearPending}
        onCancelTrashClear={() => sidebarActions.setTrashClearPending(false)}
        onConfirmTrashClear={sidebarActions.confirmClearTrash}
      />
    );
  }

  function collapseLibraryRail() {
    const nextVisibility = resolveSidebarCollapse(sidebarCollapseMode);
    startTransition(() => {
      setLibraryRailOpen(nextVisibility.libraryRailOpen);
      setSheetRailOpen(nextVisibility.sheetRailOpen);
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

  function expandCollapsedRails() {
    if (sidebarCollapseMode === "navigation-and-list") {
      expandLibraryRail();
      return;
    }
    expandSheetRailOnly();
  }

  function changeSidebarCollapseMode(mode: SidebarCollapseMode) {
    const nextVisibility = synchronizeSidebarRailsForMode(mode, { libraryRailOpen, sheetRailOpen });
    setSidebarCollapseMode(mode);
    if (nextVisibility.sheetRailOpen !== sheetRailOpen) {
      setSheetRailOpen(nextVisibility.sheetRailOpen);
    }
  }

  function selectPublishChannel(channelId: PublishChannelId, targetId?: string) {
    if (channelId === "wechat") {
      setWechatPublishOpen(true);
      return;
    }
    if (channelId === "blog") {
      setBlogPublishTargetId(targetId || editorProjectBlogTarget?.id || "");
      return;
    }
    if (channelId === "docs") {
      if (editorProjectDocsTarget && editorProject && activeSheet && (!targetId || targetId === editorProjectDocsTarget.id)) {
        setHelpCenterSyncTarget({ projectId: editorProject.id, sheetId: activeSheet.id });
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
      expandCollapsedRails();
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
    if (!isDesktopLibraryPath(libraryPath)) return targetSheet;
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
      if (removed.has(activeSheetId)) {
        setActiveSheetId("");
      }
      setSelectedSheetIds((current) => {
        const remaining = current.filter((sheetId) => !removed.has(sheetId));
        return remaining;
      });
      setSheetSelectionAnchorId((current) => (removed.has(current) ? "" : current));
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

  const blockingDialogOpen =
    projectDialogs.projectDialogOpen ||
    projectDialogs.groupDialogOpen ||
    Boolean(documentPropertyManagerProjectId) ||
    Boolean(sidebarActions.projectPendingTrash) ||
    Boolean(sidebarActions.projectGroupPendingDelete) ||
    Boolean(sidebarActions.sheetPendingTrash?.length) ||
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

  function openWritingSettings() {
    setImageSourceDialogOpen(false);
    setWelcomeScreenOpen(false);
    setShortcutsDialogOpen(false);
    setSettingsDialogInitialTab("writing");
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

  const runAppShortcut = useAppShortcuts({
    saveDocument: {
      run: () => void saveActiveDocument(),
      enabled: Boolean(activeSheet) && !previewedVersion && !aiReviewPreviewActive && persistenceReady && !blockingDialogOpen,
    },
    newSheet: {
      run: createSheetFromCurrentContext,
      enabled: Boolean(activeProject) && projectFilter !== "trash" && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    quickCapture: {
      run: () => setQuickCaptureOpen(true),
      enabled: !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    globalSearch: {
      run: () => setGlobalSearchOpen(true),
      enabled: Boolean(activeProject) && !blockingDialogOpen && !shortcutsDialogOpen && !settingsDialogOpen,
    },
    searchSheetList: {
      run: () => setSheetFilterOpen(true),
      enabled:
        Boolean(activeProject) &&
        sheetRailOpen &&
        !documentRailMode.documentFunctionRailOpen &&
        !blockingDialogOpen &&
        !shortcutsDialogOpen &&
        !settingsDialogOpen,
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

  useNativeMenuBindings({
    enabled: Boolean(windowChrome.appWindow),
    typewriterMode,
    runAppShortcut,
    onNewProject: () => openNewProjectDialogRef.current(),
    onOpenWelcome: openHelpWelcome,
    onCleanEmptySheets: () => cleanEmptySheetsRef.current(),
    onCleanUnusedImages: () => cleanUnusedImagesRef.current(),
    onImportMarkdown: () => openMarkdownImportRef.current(),
    onToggleTypewriterMode: () => setTypewriterMode((current) => !current),
  });

  if (libraryPersistence.onboardingRequired) {
    return (
      <div className="loby-window" data-app-theme={resolvedAppTheme}>
        <div
          className="empty-window-toolbar"
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
        {renderLibraryImportDialogs()}
        {renderSettingsDialog()}
        <KeyboardShortcutsDialogHost open={shortcutsDialogOpen} onClose={() => setShortcutsDialogOpen(false)} />
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
            onClick={expandCollapsedRails}
            aria-label={sidebarCollapseMode === "navigation-and-list" ? "展开导航栏和列表栏" : "展开列表栏"}
            title={sidebarCollapseMode === "navigation-and-list" ? "向右拖动展开导航栏和列表栏" : "向右拖动展开列表栏"}
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
                onProjectGroupContextMenu={sidebarActions.openProjectGroupContextMenu}
                onPublishProject={
                  (displayedProjectDocsTarget || displayedProjectHugoTarget) && !sheetDragPreviewProject
                    ? () =>
                        displayedProjectHugoTarget
                          ? openProjectHugoBatchPublish(displayedSidebarProject.id)
                          : openProjectHelpCenterSync(displayedSidebarProject.id)
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
                onOpenGitHub={() => void openUrl(LOBY_GITHUB_URL)}
                onOpenGitee={() => void openUrl(LOBY_GITEE_URL)}
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
                {documentRailMode.documentFunctionRailOpen && editorProject && activeSheet ? (
                  <DocumentFunctionRail
                    project={editorProject}
                    sheet={activeSheet}
                    libraryPath={libraryPath}
                    activeTab={documentFunctionTab}
                    onActiveTabChange={setDocumentFunctionTab}
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
                    sheetMetaLabelById={projectFilter === "trash" ? libraryTrash.projectTitleBySheetId : sheetMetaLabelById}
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
                    onSheetMoveCommit={(sheetIds, target) => moveSheetsToTarget(sheetIds, target, true)}
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
            <SidebarContextMenu
              context={sidebarActions.sidebarContextMenu}
              actions={sidebarActions}
              projects={projects}
              fileManagerName={fileManagerName}
              contextSheetEntries={contextSheetEntries}
              contextSheetSources={contextSheetSources}
              contextSheetHugoTarget={sidebarContextHugoTarget}
              contextSheetDocsTarget={sidebarContextDocsTarget}
              onOpenProjectHugoBatchPublish={openProjectHugoBatchPublish}
              onOpenProjectHelpCenterSync={openProjectHelpCenterSync}
              onImportMarkdown={markdownImport.openImport}
              onMoveSheets={moveSheetsToTarget}
              onOpenMoveSheetDialog={setMoveSheetIds}
              onOpenSheetHelpCenterSync={(projectId, sheetId) => setHelpCenterSyncTarget({ projectId, sheetId })}
            />
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
                canPublish={Boolean(activeSheet) && !libraryTrash.selectedEntry && !previewedVersion && !aiReviewPreviewActive}
                canInsertImage={Boolean(
                  editorFocused &&
                  activeSheet &&
                  editorSheet &&
                  !libraryTrash.selectedEntry &&
                  !sheetPreviewMode &&
                  !previewedVersion &&
                  !aiReviewPreviewActive,
                )}
                githubPublishingTarget={editorProjectReadyTarget}
                documentInformationControl={
                  activeSheet ? (
                    <DocumentInformationPopover
                      project={editorProject ?? activeProject}
                      sheet={activeSheet}
                      libraryPath={libraryPath}
                      onUpdateSheet={(updater) => updateSheet(activeSheet.id, updater)}
                      onManageFields={() => editorProject && setDocumentPropertyManagerProjectId(editorProject.id)}
                      onGenerateSummary={documentSummaryGenerator}
                    />
                  ) : null
                }
                onExpandLeftSidebar={expandLibraryRail}
                onToggleFocusMode={focusModeLayout.toggleFocusMode}
                onNavigateBack={() => navigateSheet(-1)}
                onNavigateForward={() => navigateSheet(1)}
                onInsertImage={() => setImageSourceDialogOpen(true)}
                onSelectPublishChannel={selectPublishChannel}
                onWindowDragStart={windowChrome.startWindowDrag}
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
                      previewMode={sheetPreviewMode && !previewedVersion && !aiReviewPreviewActive}
                      previewHtml={sheetPreviewHtml}
                      previewBusy={sheetPreviewBusy}
                      typewriterMode={typewriterMode}
                      typography={editorTypography}
                      reviewChanges={previewedVersion || aiReviewPreviewActive ? [] : aiChangeSetReview.activeSheetReviewChanges}
                      readOnly={Boolean(previewedVersion) || aiReviewPreviewActive}
                      versionPreviewActive={Boolean(previewedVersion)}
                      onCreateEditor={(view) => {
                        editorRef.current = view;
                        if (pendingEditorFocusSheetIdRef.current === activeSheet.id && !previewedVersion && !aiReviewPreviewActive) {
                          window.requestAnimationFrame(() => {
                            if (editorRef.current !== view || pendingEditorFocusSheetIdRef.current !== activeSheet.id) return;
                            view.focus();
                            pendingEditorFocusSheetIdRef.current = "";
                          });
                        }
                      }}
                      onEditorFocusChange={setEditorFocused}
                      onBodyInput={(sheetId, readBody) => {
                        if (previewedVersion || aiReviewPreviewActive || sheetId !== activeSheet.id || !editorProject) return;
                        const updatedAt = nowTimestamp();
                        pendingEditorDocumentsRef.current.set(sheetId, { readBody, updatedAt });
                        libraryPersistence.scheduleDocumentSave(editorProject, activeSheet, readBody, updatedAt);
                      }}
                      onBodyChange={(sheetId, value, committedReader) => {
                        if (previewedVersion || aiReviewPreviewActive) return;
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
                        if (previewedVersion || aiReviewPreviewActive) {
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
                      onInsertImage={() => setImageSourceDialogOpen(true)}
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
                  <AiAssistantPanelHost
                    assistant={aiAssistant}
                    quickPrompts={quickPrompts.prompts}
                    quickPromptsReady={quickPrompts.ready}
                    libraryPath={libraryPath}
                    projects={projects}
                    activeProject={editorProject}
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
                    onWindowDragStart={windowChrome.startWindowDrag}
                    onWindowToolbarDoubleClick={windowChrome.handleWindowToolbarDoubleClick}
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
      {renderSettingsDialog()}
      {imageSourceDialogOpen && activeSheet && editorProject ? (
        <ImageSourceDialogHost
          open
          sheet={activeSheet}
          onOpenChange={setImageSourceDialogOpen}
          onInsertLocal={editorImages.insertImagesFromPicker}
          onInsertUnsplash={editorImages.insertUnsplashImage}
          aiRecommendationEnabled={unsplashAiRecommendationEnabled}
          onGenerateQuery={imageSearchQueryGenerator}
          onTranslateQuery={imageSearchQueryTranslator}
          onOpenSettings={openWritingSettings}
        />
      ) : null}
      <PublishingTargetDialog
        request={helpCenterSyncTarget}
        projects={projects}
        publishingTargets={publishingTargetState.store}
        libraryPath={libraryPath}
        onClose={() => setHelpCenterSyncTarget(null)}
        onOpenSettings={openPublishingSettings}
        onGenerateSummary={documentSummaryGenerator}
        onProjectChange={(nextProject) =>
          setProjects((current) =>
            current.map((item) => (item.id === nextProject.id ? normalizeProject({ ...nextProject, updatedAt: nowTimestamp() }) : item)),
          )
        }
      />
      <DocumentPublishingDialogs
        project={editorProject}
        activeSheet={activeSheet}
        publishingSheet={latestActiveSheetForPublishing}
        libraryPath={libraryPath}
        wechatPublishOpen={wechatPublishOpen}
        directPublishChannel={directPublishChannel}
        blogTarget={activeEditorBlogPublishingTarget}
        onCloseWechat={() => setWechatPublishOpen(false)}
        onCloseDirect={() => setDirectPublishChannel(null)}
        onCloseBlog={() => setBlogPublishTargetId("")}
        onOpenImageHostingSettings={openImageHostingSettings}
        onOpenSettings={openPublishingSettings}
        onGenerateSummary={documentSummaryGenerator}
        onUpdateSheet={(updater) => {
          if (activeSheet) updateSheet(activeSheet.id, updater);
        }}
        onPublished={(targetId, publication) => {
          if (!activeSheet) return;
          updateSheet(activeSheet.id, (current) => ({
            ...current,
            publications: { ...current.publications, [targetId]: publication },
          }));
        }}
      />
      <KeyboardShortcutsDialogHost open={shortcutsDialogOpen} onClose={() => setShortcutsDialogOpen(false)} />
      {globalSearchOpen && (
        <GlobalSearchDialog
          open
          libraryPath={libraryPath}
          projects={projects}
          onClose={() => setGlobalSearchOpen(false)}
          onOpenSheet={openGlobalSearchResult}
        />
      )}
      {renderLibraryImportDialogs()}
      {renderLibraryMaintenanceDialogs()}
      {documentPropertyManagerProjectId && (
        <DocumentPropertyManagerDialogHost
          open
          project={projects.find((project) => project.id === documentPropertyManagerProjectId)}
          onClose={() => setDocumentPropertyManagerProjectId("")}
          onSave={(project) => setProjects((current) => current.map((item) => (item.id === project.id ? normalizeProject(project) : item)))}
        />
      )}
    </div>
  );
}

export default App;
