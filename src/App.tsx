import { getCurrentWindow } from "@tauri-apps/api/window";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
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
import { today } from "./lib/dates";
import { applyEditorMarkdownFormat, type MarkdownFormat } from "./lib/editorMarkdown";
import { formatSnapshotTime } from "./lib/formatters";
import { buildImportedMarkdownSheets } from "./lib/importMarkdown";
import {
  buildProjectResourcePaths,
  buildSheetMarkdownPath,
  createDefaultProjectGroups,
  DEFAULT_CONTENT_GROUP_ID,
  DEFAULT_PUBLISHING_CHECKLIST,
  DEFAULT_WRITING_BRIEF,
  filterProjects,
  filterSheets,
  getDefaultGroupIdForSheetType,
  getProjectFilterTitle,
  getProjectGroupCounts,
  getProjectGroups,
  getProjectGroupWordCounts,
  getPublishingChecklist,
  getSheetsForProjectFilter,
  getSheetsInGroup,
  getWritingBrief,
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
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectDraft, setNewProjectDraft] = useState<NewProjectDraft>({
    title: DEFAULT_NEW_PROJECT_TITLE,
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
  const [writingSessionStarts, setWritingSessionStarts] = useState<Record<string, number>>({});
  const editorRef = useRef<EditorView | null>(null);
  const newProjectNameInputRef = useRef<HTMLInputElement | null>(null);
  const appWindow = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const projectGroups = useMemo(() => (activeProject ? getProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const groupCounts = useMemo(() => (activeProject ? getProjectGroupCounts(activeProject) : new Map<string, number>()), [activeProject]);
  const groupWordCounts = useMemo(() => (activeProject ? getProjectGroupWordCounts(activeProject) : new Map<string, number>()), [activeProject]);
  const filteredProjects = useMemo(
    () => sortProjects(filterProjects(projects, projectSearch)),
    [projects, projectSearch],
  );
  const filteredProjectIds = filteredProjects.map((project) => project.id).join("|");
  const sheetListTitle = getProjectFilterTitle(projectFilter);
  const sheetListSource = useMemo(
    () => getSheetsForProjectFilter(activeProject?.sheets ?? [], projectFilter, today()),
    [activeProject, projectFilter],
  );
  const filteredSheets = useMemo(
    () => filterSheets(sheetListSource, sheetSearch),
    [sheetListSource, sheetSearch],
  );
  const filteredSheetIds = filteredSheets.map((sheet) => sheet.id).join("|");
  const projectResourcePaths = useMemo(
    () => (activeProject ? buildProjectResourcePaths(libraryPath, activeProject.id) : null),
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
    });
  }, [libraryRailOpen, sheetRailOpen, inspectorOpen, focusMode, typewriterMode]);

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
    if (!activeProject.sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(activeProject.sheets[0]?.id ?? "");
    }
  }, [activeProject, activeSheetId]);

  useEffect(() => {
    if (!activeProject) return;
    const nextGroupId = resolveProjectGroupId(activeProject, activeGroupId, activeSheetId);
    if (nextGroupId && nextGroupId !== activeGroupId) {
      setActiveGroupId(nextGroupId);
    }
  }, [activeProject, activeGroupId, activeSheetId]);

  useEffect(() => {
    if (filteredProjects.length === 0 || filteredProjects.some((project) => project.id === activeProjectId)) return;
    setActiveProjectId(filteredProjects[0].id);
    setActiveSheetId(filteredProjects[0].sheets[0]?.id ?? "");
    setActiveGroupId(resolveProjectGroupId(filteredProjects[0], "", filteredProjects[0].sheets[0]?.id ?? ""));
  }, [activeProjectId, filteredProjectIds, filteredProjects]);

  useEffect(() => {
    if (filteredSheets.length === 0 || filteredSheets.some((sheet) => sheet.id === activeSheetId)) return;
    setActiveSheetId(filteredSheets[0].id);
  }, [activeSheetId, filteredSheetIds, filteredSheets]);

  function enterProject(project: WritingProject) {
    const groupId = resolveProjectGroupId(project, activeGroupId, project.sheets[0]?.id ?? "");
    setActiveProjectId(project.id);
    setActiveGroupId(groupId);
    setActiveSheetId(getSheetsInGroup(project, groupId)[0]?.id ?? project.sheets[0]?.id ?? "");
    setSidebarMode("project");
    setSheetSearch("");
  }

  function selectProjectGroup(groupId: string) {
    if (!activeProject) return;
    setActiveGroupId(groupId);
    const nextSheet = getSheetsInGroup(activeProject, groupId)[0];
    if (nextSheet) setActiveSheetId(nextSheet.id);
    setSheetSearch("");
  }

  function createProjectGroup() {
    if (!activeProject) return;
    const title = window.prompt("新分组名称", "新分组")?.trim();
    if (!title) return;
    const group: ProjectGroup = {
      id: `group-${Date.now()}`,
      title,
      description: "",
    };
    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: [...getProjectGroups(project), group],
      updatedAt: today(),
    }));
    setActiveGroupId(group.id);
    setSidebarMode("project");
  }

  function updateProject(projectId: string, updater: (project: WritingProject) => WritingProject) {
    setProjects((current) => current.map((project) => (project.id === projectId ? updater(project) : project)));
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
    setProjects((current) => [normalizedProject, ...current]);
    setActiveProjectId(id);
    setActiveGroupId(resolveProjectGroupId(normalizedProject, "", normalizedProject.sheets[0]?.id ?? ""));
    setActiveSheetId(normalizedProject.sheets[0]?.id ?? "");
    setSidebarMode("project");
    setProjectSearch("");
    setProjectFilter("active");
    setSheetSearch("");
  }

  function duplicateActiveProject() {
    if (!activeProject) return;
    const timestamp = Date.now();
    const duplicatedSheets = activeProject.sheets.map((sheet, index) => ({
      ...sheet,
      id: `sheet-${timestamp}-${index}`,
      title: sheet.title,
      updatedAt: today(),
      versions: sheet.versions?.map((version, versionIndex) => ({
        ...version,
        id: `version-${timestamp}-${index}-${versionIndex}`,
      })),
    }));
    const duplicatedProject: WritingProject = {
      ...activeProject,
      id: `project-${timestamp}`,
      title: `${activeProject.title} 副本`,
      status: activeProject.status === "已发布" || activeProject.status === "已归档" ? "修改中" : activeProject.status,
      updatedAt: today(),
      sheets: duplicatedSheets,
      exportHistory: [],
      publishingChecklist: getPublishingChecklist(activeProject).map((item) => ({
        ...item,
        done: false,
      })),
    };

    const normalizedProject = normalizeProject(duplicatedProject);
    setProjects((current) => [normalizedProject, ...current]);
    setActiveProjectId(normalizedProject.id);
    setActiveGroupId(resolveProjectGroupId(normalizedProject, "", duplicatedSheets[0]?.id ?? ""));
    setActiveSheetId(duplicatedSheets[0]?.id ?? "");
    setSidebarMode("project");
    setProjectFilter("active");
    setSheetSearch("");
  }

  function removeActiveProjectFromLibrary() {
    if (!activeProject) return;
    const confirmed = window.confirm(
      `从 Nibva 写作库列表移除「${activeProject.title}」？\n\n本地项目文件夹会保留在磁盘上，不会删除 assets、references、exports 或 Markdown 文件。${projects.length <= 1 ? "\n\n这是当前库的最后一个项目，移出后会显示空写作库。" : ""}`,
    );
    if (!confirmed) return;

    setProjects((current) => {
      const remaining = current.filter((project) => project.id !== activeProject.id);
      const nextProject = remaining[0];
      setActiveProjectId(nextProject?.id ?? "");
      setActiveSheetId(nextProject?.sheets[0]?.id ?? "");
      return remaining;
    });
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

  async function openCurrentSheetMarkdown() {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      setLibraryStatus("当前稿件还没有可打开的本地 Markdown 文件");
      return;
    }
    const markdownPath = buildSheetMarkdownPath(libraryPath, activeProject.id, activeSheet.id);
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
      const importedSheets = buildImportedMarkdownSheets(files, DEFAULT_CONTENT_GROUP_ID);
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
      setProjects((current) => [project, ...current]);
      setActiveProjectId(id);
      setActiveGroupId(DEFAULT_CONTENT_GROUP_ID);
      setActiveSheetId(importedSheets[0]?.id ?? "");
      setSidebarMode("project");
      setProjectFilter("active");
      setProjectSearch("");
      setSheetSearch("");
    } catch (error) {
      window.alert(`导入 Markdown 新建项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function applyMarkdownFormat(format: MarkdownFormat) {
    applyEditorMarkdownFormat(editorRef.current, format);
  }

  function openEditorSearch() {
    const view = editorRef.current;
    if (!view) return;
    openSearchPanel(view);
    view.focus();
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

  if (!activeProject || !activeSheet) {
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
        !inspectorOpen && "hide-inspector",
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
        filteredProjects={filteredProjects}
        projectGroups={projectGroups}
        resolvedActiveGroupId={resolvedActiveGroupId}
        groupCounts={groupCounts}
        groupWordCounts={groupWordCounts}
        onWindowDragStart={startWindowDrag}
        onCreateProject={openNewProjectDialog}
        onCollapse={collapseLibraryRail}
        onProjectFilterChange={setProjectFilter}
        onProjectSearchChange={setProjectSearch}
        onProjectsOpenChange={setLibraryProjectsOpen}
        onEnterProject={enterProject}
        onBackToLibrary={() => setSidebarMode("library")}
        onRenameProject={(title) => updateProject(activeProject.id, (project) => ({ ...project, title, updatedAt: today() }))}
        onCreateProjectGroup={createProjectGroup}
        onSelectProjectGroup={selectProjectGroup}
        onDuplicateProject={duplicateActiveProject}
        onRemoveProject={removeActiveProjectFromLibrary}
      />

      {sheetRailOpen && (
        <SheetRail
          title={sheetListTitle}
          search={sheetSearch}
          sheets={filteredSheets}
          activeSheetId={activeSheet.id}
          draggingSheetId={sheetActions.draggingSheetId}
          dropTarget={sheetActions.sheetDropTarget}
          onWindowDragStart={startWindowDrag}
          onCreateSheet={sheetActions.createSheet}
          onSearchChange={setSheetSearch}
          onSelectSheet={setActiveSheetId}
          onSheetDragStart={sheetActions.handleSheetDragStart}
          onSheetDragOver={sheetActions.handleSheetDragOver}
          onSheetDrop={sheetActions.handleSheetDrop}
          onSheetDragEnd={sheetActions.clearSheetDragState}
        />
      )}
      </section>

      <main className="editor-zone">
        <EditorToolbar
          activeProject={activeProject}
          activeSheet={activeSheet}
          libraryPath={libraryPath}
          libraryStatus={libraryStatus}
          libraryRailOpen={libraryRailOpen}
          sheetRailOpen={sheetRailOpen}
          inspectorOpen={inspectorOpen}
          sheetPreviewMode={sheetPreviewMode}
          typewriterMode={typewriterMode}
          onRenameSheet={(title) => updateSheet(activeSheet.id, (sheet) => ({ ...sheet, title, updatedAt: today() }))}
          onToggleLibraryRail={() => setLibraryRailOpen((value) => !value)}
          onToggleSheetRail={() => setSheetRailOpen((value) => !value)}
          onApplyMarkdownFormat={applyMarkdownFormat}
          onOpenCurrentSheetMarkdown={openCurrentSheetMarkdown}
          onOpenEditorSearch={openEditorSearch}
          onToggleSheetPreview={() => setSheetPreviewMode((value) => !value)}
          onMoveSheet={(direction) => sheetActions.moveSheet(activeSheet.id, direction)}
          onToggleFocusMode={() => setFocusMode((value) => !value)}
          onToggleTypewriterMode={() => setTypewriterMode((value) => !value)}
          onAskCodex={() => aiAssistant.sendMessage("请基于当前稿件给出修改建议，重点关注结构、表达和可发布性。")}
          onToggleInspector={() => setInspectorOpen((value) => !value)}
        />

        <EditorCanvas
          sheet={activeSheet}
          previewMode={sheetPreviewMode}
          previewHtml={sheetPreviewHtml}
          previewBusy={sheetPreviewBusy}
          typewriterMode={typewriterMode}
          onCreateEditor={(view) => {
            editorRef.current = view;
          }}
          onBodyChange={(value) => updateSheet(activeSheet.id, (sheet) => ({ ...sheet, body: value, updatedAt: today() }))}
        />
      </main>

      {inspectorOpen && (
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
    </div>
  );
}

export default App;
