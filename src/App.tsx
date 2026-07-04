import CodeMirror from "@uiw/react-codemirror";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { markdown } from "@codemirror/lang-markdown";
import LiquidGlass from "liquid-glass-react";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import {
  Archive,
  Bold,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  FilePlus2,
  FileText,
  Focus,
  FolderOpen,
  Heading1,
  Heading2,
  History,
  Image,
  Italic,
  ListCollapse,
  Info,
  LayoutList,
  Library,
  Link,
  List,
  ListTree,
  ListTodo,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PenLine,
  Plus,
  Printer,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  TextQuote,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type {
  AiSuggestion,
  ChatConversation,
  ChatMessage,
  CodexSkill,
  CodexProbeResult,
  DiffLine,
  ExportHistoryItem,
  ImportedMarkdownFile,
  InspectorTab,
  MentionMode,
  ProjectGroup,
  ProjectResourceFile,
  ProjectResourceText,
  ProjectStatus,
  ProjectWritingBrief,
  PublishingChecklistItem,
  SheetType,
  SheetView,
  SheetVersion,
  WritingProject,
  WritingSheet,
} from "./types";
import {
  compileHtml,
  compileMarkdown,
  compilePlainText,
  compileWechatHtml,
  compileXhsDraft,
  copyTextToClipboard,
  downloadText,
  getPublishableSheets,
  openPrintPreview,
  renderMarkdownHtml,
} from "./lib/export";
import { listCodexSkills, listProjectResources, probeCodexCli, readProjectResourceText, runCodexChat, writeSkillTask } from "./lib/codex";
import {
  buildMentionContext,
  buildSkillContext,
  expandSlashCommand,
  resolveMentionModes,
  resolveSkillMentions,
  slashCommands,
} from "./lib/agentCommands";
import { buildLineDiff } from "./lib/diff";
import {
  chooseLibraryFolder,
  importMarkdownFiles,
  importProjectResources,
  loadBrowserConversations,
  loadBrowserProjects,
  loadConversations,
  loadProjects,
  openLocalPath,
  saveConversations,
  saveProjectExport,
  saveProjects,
} from "./lib/persistence";
import { countWords, projectProgress, projectWordCount, sheetProgress, sheetStats, slugifyTitle } from "./lib/text";

const SETTINGS_STORAGE_KEY = "nibva.agentSettings.v1";

interface AgentSettings {
  planMode: boolean;
  codexCliPath: string;
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
}
type ProjectFilter = "active" | "today" | "published" | "archived";
type ProjectSort = "updated" | "title" | "word-count" | "progress";
type SheetTypeFilter = "全部" | SheetType;
type SidebarMode = "library" | "project";
type MarkdownFormat = "h1" | "h2" | "bold" | "italic" | "link" | "code" | "list" | "task" | "quote" | "divider";
interface ProjectTemplateSheet {
  title: string;
  groupId?: string;
  type: SheetType;
  status: ProjectStatus;
  targetWords: number;
  summary: string;
  body: string;
}
interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  projectDescription: string;
  targetPlatform: string;
  targetWords: number;
  tags: string[];
  sheets: ProjectTemplateSheet[];
}
interface SheetHeading {
  id: string;
  level: number;
  text: string;
  line: number;
}
interface SheetDropTarget {
  sheetId: string;
  position: "before" | "after";
}
interface ProjectResourcePaths {
  project: string;
  assets: string;
  references: string;
  exports: string;
}
const SHEET_TYPE_FILTERS: SheetTypeFilter[] = ["全部", "正文", "章节", "提纲", "素材", "发布版本"];
const PROJECT_STATUS_FLOW: ProjectStatus[] = ["构思", "初稿", "修改中", "待配图", "待发布", "已发布", "已归档"];
const DEFAULT_CONTENT_GROUP_ID = "group-content";
const DEFAULT_MATERIAL_GROUP_ID = "group-materials";
const MAX_EXPORT_HISTORY_ITEMS = 30;
const DEFAULT_WRITING_BRIEF: ProjectWritingBrief = {
  audience: "",
  thesis: "",
  tone: "",
  publishingNotes: "",
};
const DEFAULT_PUBLISHING_CHECKLIST: PublishingChecklistItem[] = [
  { id: "title", label: "标题已确认", done: false },
  { id: "cover", label: "封面已准备", done: false },
  { id: "summary", label: "摘要已准备", done: false },
  { id: "body-images", label: "正文配图已检查", done: false },
  { id: "platform-format", label: "平台格式已适配", done: false },
];
const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    title: "空白写作项目",
    description: "从一张正文卡片开始。",
    projectDescription: "从一个清晰的写作目标开始。",
    targetPlatform: "未指定",
    targetWords: 3000,
    tags: ["草稿"],
    sheets: [
      {
        title: "第一张稿件卡片",
        type: "正文",
        status: "构思",
        targetWords: 1200,
        summary: "记录这张卡片要完成的内容。",
        body: "# 第一张稿件卡片\n\n从这里开始写。",
      },
    ],
  },
  {
    id: "wechat-longform",
    title: "公众号长文",
    description: "观点、案例、收束和发布版本。",
    projectDescription: "围绕一个明确观点写成可发布的公众号长文。",
    targetPlatform: "公众号",
    targetWords: 3600,
    tags: ["公众号", "长文"],
    sheets: [
      {
        title: "开篇：问题和钩子",
        type: "正文",
        status: "构思",
        targetWords: 700,
        summary: "用具体场景引出文章问题。",
        body: "# 开篇：问题和钩子\n\n先写一个真实场景，再提出这篇文章要解决的问题。",
      },
      {
        title: "核心论点",
        type: "章节",
        status: "构思",
        targetWords: 1400,
        summary: "展开最重要的判断和理由。",
        body: "# 核心论点\n\n## 不是表层原因\n\n\n## 真正关键的是\n\n",
      },
      {
        title: "素材：案例与金句",
        type: "素材",
        status: "构思",
        targetWords: 600,
        summary: "记录案例、引用、数据和配图方向。",
        body: "# 素材：案例与金句\n\n- 案例：\n- 引用：\n- 数据：\n- 配图方向：\n",
      },
      {
        title: "结尾与发布版",
        type: "发布版本",
        status: "构思",
        targetWords: 900,
        summary: "收束观点，并准备最终发布稿。",
        body: "# 结尾与发布版\n\n用一句更清楚的话收束全文，并给读者留下可执行的判断。",
      },
    ],
  },
  {
    id: "series",
    title: "系列文章",
    description: "总纲、多篇正文和素材库。",
    projectDescription: "为一个主题规划多篇文章，分阶段写作和发布。",
    targetPlatform: "公众号 / 网站",
    targetWords: 8000,
    tags: ["系列", "选题"],
    sheets: [
      {
        title: "系列总纲",
        type: "提纲",
        status: "构思",
        targetWords: 800,
        summary: "定义系列目标、读者和每篇文章边界。",
        body: "# 系列总纲\n\n- 系列目标：\n- 目标读者：\n- 文章清单：\n  - 第一篇：\n  - 第二篇：\n  - 第三篇：\n",
      },
      {
        title: "第一篇：建立问题",
        type: "正文",
        status: "构思",
        targetWords: 1800,
        summary: "系列第一篇，用来建立问题和背景。",
        body: "# 第一篇：建立问题\n\n",
      },
      {
        title: "第二篇：方法和路径",
        type: "正文",
        status: "构思",
        targetWords: 1800,
        summary: "系列第二篇，展开方法或解决路径。",
        body: "# 第二篇：方法和路径\n\n",
      },
      {
        title: "素材库",
        type: "素材",
        status: "构思",
        targetWords: 1000,
        summary: "集中记录系列素材、参考链接和待验证事实。",
        body: "# 素材库\n\n- 参考链接：\n- 可用案例：\n- 待验证事实：\n",
      },
    ],
  },
  {
    id: "tutorial",
    title: "教程 / 指南",
    description: "目标读者、步骤、FAQ 和发布稿。",
    projectDescription: "把一个操作流程写成清晰、可执行的教程或指南。",
    targetPlatform: "教程 / 网站",
    targetWords: 5000,
    tags: ["教程", "指南"],
    sheets: [
      {
        title: "读者与准备",
        type: "提纲",
        status: "构思",
        targetWords: 600,
        summary: "说明适合谁、需要准备什么、完成后得到什么。",
        body: "# 读者与准备\n\n- 适合谁：\n- 前置条件：\n- 完成结果：\n",
      },
      {
        title: "步骤一：搭建基础环境",
        type: "正文",
        status: "构思",
        targetWords: 1300,
        summary: "教程第一步。",
        body: "# 步骤一：搭建基础环境\n\n",
      },
      {
        title: "步骤二：完成核心操作",
        type: "正文",
        status: "构思",
        targetWords: 1600,
        summary: "教程核心步骤。",
        body: "# 步骤二：完成核心操作\n\n",
      },
      {
        title: "常见问题",
        type: "章节",
        status: "构思",
        targetWords: 900,
        summary: "补充常见错误和处理办法。",
        body: "# 常见问题\n\n## 问题一\n\n\n## 问题二\n\n",
      },
    ],
  },
  {
    id: "visual-article",
    title: "图文稿",
    description: "正文、封面、正文配图和发布检查。",
    projectDescription: "为需要配图、封面和平台排版的图文内容建立项目。",
    targetPlatform: "公众号 / 小红书",
    targetWords: 3000,
    tags: ["图文", "配图"],
    sheets: [
      {
        title: "正文主稿",
        type: "正文",
        status: "构思",
        targetWords: 1800,
        summary: "文章主体内容。",
        body: "# 正文主稿\n\n",
      },
      {
        title: "封面方向",
        type: "素材",
        status: "构思",
        targetWords: 400,
        summary: "封面图视觉方向和生图提示词。",
        body: "# 封面方向\n\n- 主题：\n- 风格：白色、干净、Apple 风格、专业写作感\n- 画面元素：\n- 避免：深色仪表盘、杂乱科技感、过度装饰\n",
      },
      {
        title: "正文配图清单",
        type: "素材",
        status: "构思",
        targetWords: 500,
        summary: "记录正文中需要插图的位置。",
        body: "# 正文配图清单\n\n- 开头后：\n- 结构转折处：\n- 结尾前：\n",
      },
      {
        title: "发布检查",
        type: "发布版本",
        status: "构思",
        targetWords: 300,
        summary: "发布前检查标题、封面、摘要和平台格式。",
        body: "# 发布检查\n\n- [ ] 标题\n- [ ] 封面\n- [ ] 摘要\n- [ ] 正文配图\n- [ ] 平台格式\n",
      },
    ],
  },
];

function App() {
  const initialSettings = useMemo(() => loadAgentSettings(), []);
  const initialProjects = useMemo(() => normalizeProjects(loadBrowserProjects()), []);
  const [projects, setProjects] = useState<WritingProject[]>(initialProjects);
  const initialSelection = resolveSavedProjectSelection(initialProjects, initialSettings.activeProjectId, initialSettings.activeSheetId);
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.projectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.sheetId);
  const [sheetView, setSheetView] = useState<SheetView>("列表");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("信息");
  const [libraryRailOpen, setLibraryRailOpen] = useState(initialSettings.libraryRailOpen);
  const [sheetRailOpen, setSheetRailOpen] = useState(initialSettings.sheetRailOpen);
  const [inspectorOpen, setInspectorOpen] = useState(initialSettings.inspectorOpen);
  const [focusMode, setFocusMode] = useState(initialSettings.focusMode);
  const [typewriterMode, setTypewriterMode] = useState(initialSettings.typewriterMode);
  const [sheetPreviewMode, setSheetPreviewMode] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("library");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [sheetPreviewHtml, setSheetPreviewHtml] = useState("");
  const [sheetPreviewBusy, setSheetPreviewBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [libraryPath, setLibraryPath] = useState("Loading library");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>(() =>
    loadBrowserConversations([createWelcomeConversation()]),
  );
  const [activeConversationId, setActiveConversationId] = useState(() =>
    loadBrowserConversations([createWelcomeConversation()])[0]?.id ?? "default",
  );
  const [chatInput, setChatInput] = useState("");
  const [codexBusy, setCodexBusy] = useState(false);
  const [planMode, setPlanMode] = useState(initialSettings.planMode);
  const [mentionModes, setMentionModes] = useState<MentionMode[]>(["current-sheet"]);
  const [selectedContextSheetIds, setSelectedContextSheetIds] = useState<string[]>([]);
  const [projectResources, setProjectResources] = useState<ProjectResourceFile[]>([]);
  const [selectedResourcePaths, setSelectedResourcePaths] = useState<string[]>([]);
  const [resourceImportStatus, setResourceImportStatus] = useState("");
  const [resourcePreview, setResourcePreview] = useState<ProjectResourceText | null>(null);
  const [resourcePreviewBusy, setResourcePreviewBusy] = useState(false);
  const [codexSkills, setCodexSkills] = useState<CodexSkill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [skillTaskStatus, setSkillTaskStatus] = useState("");
  const [codexCliPath, setCodexCliPath] = useState(initialSettings.codexCliPath);
  const [codexProviderMode, setCodexProviderMode] = useState<"exec" | "app-server">("exec");
  const [codexProbe, setCodexProbe] = useState<CodexProbeResult | null>(null);
  const [codexProbeBusy, setCodexProbeBusy] = useState(false);
  const [selectedExportSheetIds, setSelectedExportSheetIds] = useState<string[]>([]);
  const [exportSelectionProjectId, setExportSelectionProjectId] = useState("");
  const [exportSaveStatus, setExportSaveStatus] = useState("");
  const [resourceRefreshKey, setResourceRefreshKey] = useState(0);
  const [compiledHtml, setCompiledHtml] = useState("");
  const [htmlExportBusy, setHtmlExportBusy] = useState(false);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("active");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectTag, setSelectedProjectTag] = useState("");
  const [projectSort, setProjectSort] = useState<ProjectSort>("updated");
  const [sheetTypeFilter, setSheetTypeFilter] = useState<SheetTypeFilter>("全部");
  const [sheetSearch, setSheetSearch] = useState("");
  const [draggingSheetId, setDraggingSheetId] = useState("");
  const [sheetDropTarget, setSheetDropTarget] = useState<SheetDropTarget | null>(null);
  const [writingSessionStarts, setWritingSessionStarts] = useState<Record<string, number>>({});
  const editorRef = useRef<EditorView | null>(null);
  const appWindow = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );

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
        setChatConversations(conversations);
        setActiveConversationId(conversations[0]?.id ?? "default");
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
    if (!persistenceReady) return;
    saveConversations(chatConversations, libraryPath.startsWith("/") ? libraryPath : undefined).catch(() => {
      localStorage.setItem("nibva.chatConversations.v1", JSON.stringify(chatConversations));
    });
  }, [chatConversations, persistenceReady, libraryPath]);

  useEffect(() => {
    saveAgentSettings({ planMode, codexCliPath });
  }, [planMode, codexCliPath]);

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
    listCodexSkills()
      .then((skills) => setCodexSkills(skills))
      .catch(() => setCodexSkills([]));
  }, []);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === activeSheetId) ?? activeProject?.sheets[0];
  const activeConversation =
    chatConversations.find((conversation) => conversation.id === activeConversationId) ?? chatConversations[0];
  const chatMessages = activeConversation?.messages ?? [];
  const projectGroups = useMemo(() => (activeProject ? getProjectGroups(activeProject) : []), [activeProject]);
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const activeGroup = projectGroups.find((group) => group.id === resolvedActiveGroupId) ?? projectGroups[0];
  const activeGroupSheets = useMemo(
    () => (activeProject ? getSheetsInGroup(activeProject, resolvedActiveGroupId) : []),
    [activeProject, resolvedActiveGroupId],
  );
  const groupCounts = useMemo(() => (activeProject ? getProjectGroupCounts(activeProject) : new Map<string, number>()), [activeProject]);
  const groupWordCounts = useMemo(() => (activeProject ? getProjectGroupWordCounts(activeProject) : new Map<string, number>()), [activeProject]);
  const projectCounts = useMemo(() => getProjectFilterCounts(projects), [projects]);
  const projectTagCounts = useMemo(() => getProjectTagCounts(projects, projectFilter), [projects, projectFilter]);
  const filteredProjects = useMemo(
    () => sortProjects(filterProjects(projects, projectFilter, projectSearch, selectedProjectTag), projectSort),
    [projects, projectFilter, projectSearch, selectedProjectTag, projectSort],
  );
  const filteredProjectIds = filteredProjects.map((project) => project.id).join("|");
  const filteredSheets = useMemo(
    () => filterSheets(activeGroupSheets, sheetTypeFilter, sheetSearch),
    [activeGroupSheets, sheetSearch, sheetTypeFilter],
  );
  const filteredSheetIds = filteredSheets.map((sheet) => sheet.id).join("|");
  const sheetTypeCounts = useMemo(
    () => getSheetTypeCounts(activeGroupSheets),
    [activeGroupSheets],
  );
  const projectResourcePaths = useMemo(
    () => (activeProject ? buildProjectResourcePaths(libraryPath, activeProject.id) : null),
    [activeProject, libraryPath],
  );

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
    let cancelled = false;
    if (!activeProject || !libraryPath.startsWith("/")) {
      setProjectResources([]);
      setSelectedResourcePaths([]);
      return;
    }

    listProjectResources(libraryPath, activeProject.id)
      .then((resources) => {
        if (cancelled) return;
        setProjectResources(resources);
        setSelectedResourcePaths((current) => current.filter((path) => resources.some((resource) => resource.path === path)));
        setResourcePreview((current) => (current && resources.some((resource) => resource.path === current.path) ? current : null));
      })
      .catch(() => {
        if (cancelled) return;
        setProjectResources([]);
        setSelectedResourcePaths([]);
        setResourcePreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, libraryPath, resourceRefreshKey]);

  useEffect(() => {
    if (!activeProject) return;
    if (!activeProject.sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(activeProject.sheets[0]?.id ?? "");
    }
    setSelectedContextSheetIds((current) => current.filter((sheetId) => activeProject.sheets.some((sheet) => sheet.id === sheetId)));
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
    setSheetTypeFilter("全部");
    setSheetSearch("");
  }

  function selectProjectGroup(groupId: string) {
    if (!activeProject) return;
    setActiveGroupId(groupId);
    const nextSheet = getSheetsInGroup(activeProject, groupId)[0];
    if (nextSheet) setActiveSheetId(nextSheet.id);
    setSheetTypeFilter("全部");
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

  function updateActiveConversation(updater: (conversation: ChatConversation) => ChatConversation) {
    setChatConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversationId ? updater(conversation) : conversation)),
    );
  }

  function appendChatMessage(message: ChatMessage) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
      title:
        message.role === "user" && (conversation.title === "默认对话" || conversation.title === "新对话")
          ? deriveConversationTitle(message.content)
          : conversation.title,
      updatedAt: new Date().toISOString(),
    }));
  }

  function createConversation() {
    const conversation = createWelcomeConversation(`chat-${Date.now()}`, "新对话");
    setChatConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
  }

  function forkConversation() {
    const source = activeConversation;
    if (!source) return;
    const forked: ChatConversation = {
      ...source,
      id: `chat-${Date.now()}`,
      title: `${source.title} 副本`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: source.messages.map((message) => ({ ...message, id: `${message.id}-fork-${Date.now()}` })),
    };
    setChatConversations((current) => [forked, ...current]);
    setActiveConversationId(forked.id);
  }

  function compactConversation() {
    const source = activeConversation;
    if (!source || source.messages.length <= 6) return;
    const preserved = source.messages.slice(-5);
    const summary: ChatMessage = {
      id: `compact-${Date.now()}`,
      role: "system",
      content: [
        "本地 compact 摘要：",
        ...source.messages.slice(0, -5).map((message) => `${message.role}: ${message.content.slice(0, 180)}`),
      ].join("\n"),
    };
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: [summary, ...preserved],
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteConversation() {
    setChatConversations((current) => {
      if (current.length <= 1) {
        const fallback = createWelcomeConversation(`chat-${Date.now()}`, "新对话");
        setActiveConversationId(fallback.id);
        return [fallback];
      }
      const next = current.filter((conversation) => conversation.id !== activeConversationId);
      setActiveConversationId(next[0]?.id ?? "default");
      return next;
    });
  }

  function createProject(templateId = "blank") {
    const template = PROJECT_TEMPLATES.find((item) => item.id === templateId) ?? PROJECT_TEMPLATES[0];
    const id = `project-${Date.now()}`;
    const project: WritingProject = {
      id,
      title: `新的${template.title}`,
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
    setSelectedProjectTag("");
    setProjectFilter("active");
    setSheetTypeFilter("全部");
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
    setSelectedProjectTag("");
    setSheetTypeFilter("全部");
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
      setChatConversations(conversations);
      setActiveConversationId(conversations[0]?.id ?? "default");
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

  function createSheet() {
    if (!activeProject) return;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的稿件卡片",
      groupId: resolvedActiveGroupId || DEFAULT_CONTENT_GROUP_ID,
      type: "正文",
      status: "构思",
      targetWords: 1000,
      summary: "这张卡片的写作目标。",
      body: "# 新的稿件卡片\n\n",
      updatedAt: today(),
    };
    updateProject(activeProject.id, (project) => ({ ...project, updatedAt: today(), sheets: [...project.sheets, sheet] }));
    setActiveSheetId(sheet.id);
  }

  function createMaterialSheet() {
    if (!activeProject) return;
    const materialGroupId = ensureMaterialGroup(activeProject).id;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的素材卡片",
      groupId: materialGroupId,
      type: "素材",
      status: "构思",
      targetWords: 500,
      summary: "记录事实、摘录、案例、图片方向或参考资料。",
      body: "# 新的素材卡片\n\n- 来源：\n- 关键事实：\n- 可用观点：\n",
      updatedAt: today(),
    };
    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: ensureGroupExists(project.groups ?? createDefaultProjectGroups(), materialGroupId, "素材"),
      updatedAt: today(),
      sheets: [...project.sheets, sheet],
    }));
    setActiveGroupId(materialGroupId);
    setActiveSheetId(sheet.id);
  }

  async function importMarkdownSheets() {
    if (!activeProject) return;
    try {
      const files = await importMarkdownFiles();
      if (files.length === 0) return;
      const importedSheets = buildImportedMarkdownSheets(files, resolvedActiveGroupId || DEFAULT_CONTENT_GROUP_ID);
      updateProject(activeProject.id, (project) => ({
        ...project,
        updatedAt: today(),
        sheets: [...project.sheets, ...importedSheets],
      }));
      setActiveSheetId(importedSheets[0]?.id ?? activeSheetId);
      setSheetTypeFilter("全部");
      setSheetSearch("");
    } catch (error) {
      window.alert(`导入 Markdown 失败：${error instanceof Error ? error.message : String(error)}`);
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
      setSelectedProjectTag("");
      setProjectSearch("");
      setSheetTypeFilter("全部");
      setSheetSearch("");
    } catch (error) {
      window.alert(`导入 Markdown 新建项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function saveSuggestionAsMaterialSheet() {
    if (!activeProject || !activeSheet || !suggestion || suggestion.reviewMode !== "note") return;
    const materialGroupId = ensureMaterialGroup(activeProject).id;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: `${suggestion.title}｜${activeSheet.title}`,
      groupId: materialGroupId,
      type: "素材",
      status: "构思",
      targetWords: Math.max(300, countWords(suggestion.result)),
      summary: `AI 辅助生成，来源：${activeSheet.title}`,
      body: [
        `# ${suggestion.title}｜${activeSheet.title}`,
        "",
        `- 来源稿件：${activeSheet.title}`,
        `- 生成日期：${today()}`,
        `- 用途：${suggestion.title === "配图构思" ? "配图 / 生图提示词 / 视觉素材" : "稿件理解 / 结构复盘 / 写作规划"}`,
        "",
        suggestion.result,
      ].join("\n"),
      updatedAt: today(),
    };

    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: ensureGroupExists(project.groups ?? createDefaultProjectGroups(), materialGroupId, "素材"),
      updatedAt: today(),
      sheets: [...project.sheets, sheet],
    }));
    setActiveGroupId(materialGroupId);
    setActiveSheetId(sheet.id);
    setSheetTypeFilter("全部");
    setSheetSearch("");
    setInspectorTab("信息");
    setSuggestion(null);
  }

  function duplicateActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const sheet: WritingSheet = {
      ...activeSheet,
      id: `sheet-${Date.now()}`,
      title: `${activeSheet.title} 副本`,
      status: activeSheet.status === "已发布" || activeSheet.status === "已归档" ? "修改中" : activeSheet.status,
      updatedAt: today(),
      versions: [],
    };
    updateProject(activeProject.id, (project) => {
      const sheets = [...project.sheets];
      sheets.splice(sourceIndex >= 0 ? sourceIndex + 1 : sheets.length, 0, sheet);
      return { ...project, updatedAt: today(), sheets };
    });
    setActiveSheetId(sheet.id);
  }

  function deleteActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const confirmed = window.confirm(`删除稿件卡片「${activeSheet.title}」？这个操作会从当前项目中移除它。`);
    if (!confirmed) return;

    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const remaining = activeProject.sheets.filter((sheet) => sheet.id !== activeSheet.id);
    const fallbackSheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的稿件卡片",
      groupId: activeSheet.groupId ?? resolvedActiveGroupId ?? DEFAULT_CONTENT_GROUP_ID,
      type: "正文",
      status: "构思",
      targetWords: 1000,
      summary: "这张卡片的写作目标。",
      body: "# 新的稿件卡片\n\n",
      updatedAt: today(),
    };
    const nextSheets = remaining.length > 0 ? remaining : [fallbackSheet];
    const nextActiveSheet = nextSheets[Math.min(Math.max(sourceIndex, 0), nextSheets.length - 1)];

    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: today(),
      sheets: project.sheets.length > 1 ? project.sheets.filter((sheet) => sheet.id !== activeSheet.id) : [fallbackSheet],
    }));
    setSelectedExportSheetIds((current) => current.filter((id) => id !== activeSheet.id));
    setActiveSheetId(nextActiveSheet.id);
  }

  function moveSheet(sheetId: string, direction: -1 | 1) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => {
      const index = project.sheets.findIndex((sheet) => sheet.id === sheetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= project.sheets.length) return project;
      const sheets = [...project.sheets];
      const [sheet] = sheets.splice(index, 1);
      sheets.splice(nextIndex, 0, sheet);
      return { ...project, updatedAt: today(), sheets };
    });
  }

  function setSheetStatus(sheetId: string, status: ProjectStatus) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: today(),
      sheets: project.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, status, updatedAt: today() } : sheet)),
    }));
  }

  function reorderSheetByDrop(sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) {
    if (!activeProject || sourceSheetId === targetSheetId) return;
    updateProject(activeProject.id, (project) => {
      const source = project.sheets.find((sheet) => sheet.id === sourceSheetId);
      if (!source) return project;
      const sheetsWithoutSource = project.sheets.filter((sheet) => sheet.id !== sourceSheetId);
      const targetIndex = sheetsWithoutSource.findIndex((sheet) => sheet.id === targetSheetId);
      if (targetIndex < 0) return project;
      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      const sheets = [...sheetsWithoutSource];
      sheets.splice(insertIndex, 0, source);
      return { ...project, updatedAt: today(), sheets };
    });
  }

  function handleSheetDragStart(event: DragEvent<HTMLElement>, sheetId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sheetId);
    setDraggingSheetId(sheetId);
  }

  function handleSheetDragOver(event: DragEvent<HTMLElement>, sheetId: string) {
    if (!draggingSheetId || draggingSheetId === sheetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setSheetDropTarget({ sheetId, position });
  }

  function handleSheetDrop(event: DragEvent<HTMLElement>, targetSheetId: string) {
    event.preventDefault();
    const sourceSheetId = draggingSheetId || event.dataTransfer.getData("text/plain");
    const position = sheetDropTarget?.sheetId === targetSheetId ? sheetDropTarget.position : "before";
    reorderSheetByDrop(sourceSheetId, targetSheetId, position);
    setDraggingSheetId("");
    setSheetDropTarget(null);
  }

  function clearSheetDragState() {
    setDraggingSheetId("");
    setSheetDropTarget(null);
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

  function generatePolishSuggestion() {
    if (!activeSheet) return;
    const selection = getEditorSelection(editorRef.current);
    const source = selection || activeSheet.body;
    const result = polishText(source);
    setSuggestion({
      id: `suggestion-${Date.now()}`,
      title: selection ? "润色选中文本" : "润色当前稿件",
      source,
      result,
      scope: selection ? "selection" : "sheet",
    });
    setInspectorTab("AI");
    setInspectorOpen(true);
  }

  function generateTitleSuggestion() {
    if (!activeSheet) return;
    const result = [
      `为什么${activeSheet.title.replace(/^#\s*/, "")}值得重新思考`,
      `${activeSheet.title}：从写作流程开始`,
      `不是多一个工具，而是重做写作工作台`,
    ].join("\n");
    setSuggestion({
      id: `suggestion-title-${Date.now()}`,
      title: "标题备选",
      source: activeSheet.title,
      result,
      scope: "sheet",
    });
    setInspectorTab("AI");
    setInspectorOpen(true);
  }

  function generateSummarySuggestion() {
    if (!activeSheet) return;
    const result = buildLocalSheetSummary(activeSheet);
    setSuggestion({
      id: `suggestion-summary-${Date.now()}`,
      title: "稿件总结",
      source: activeSheet.body,
      result,
      scope: "sheet",
      reviewMode: "note",
    });
    setInspectorTab("AI");
    setInspectorOpen(true);
  }

  function generateImageIdeaSuggestion() {
    if (!activeProject || !activeSheet) return;
    const result = buildLocalImageIdeas(activeProject, activeSheet);
    setSuggestion({
      id: `suggestion-image-${Date.now()}`,
      title: "配图构思",
      source: activeSheet.body,
      result,
      scope: "sheet",
      reviewMode: "note",
    });
    setInspectorTab("AI");
    setInspectorOpen(true);
  }

  async function sendCodexMessage(promptOverride?: string) {
    if (!activeProject || !activeSheet || codexBusy) return;
    const rawPrompt = (promptOverride ?? chatInput).trim();
    const prompt = expandSlashCommand(rawPrompt);
    if (!prompt) return;
    const resolvedMentionModes = Array.from(new Set([...mentionModes, ...resolveMentionModes(rawPrompt)]));
    const resolvedSkills = resolveSkillMentions(rawPrompt, codexSkills, selectedSkillIds);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: rawPrompt,
    };

    appendChatMessage(userMessage);
    setChatInput("");
    setInspectorTab("AI");
    setInspectorOpen(true);
    setCodexBusy(true);

    try {
      const selectedResourceTexts = await loadSelectedResourceTexts(libraryPath, selectedResourcePaths);
      const response = await runCodexChat({
        libraryPath,
        prompt,
        context: buildCodexContext(
          activeProject,
          activeSheet,
          getEditorSelection(editorRef.current),
          chatMessages,
          resolvedMentionModes,
          resolvedSkills,
          selectedContextSheetIds,
          projectResourcePaths,
          selectedResourcePaths,
          selectedResourceTexts,
        ),
        planMode,
        codexCliPath,
      });
      const content = response.output || response.error || "Codex CLI 没有返回内容。";
      appendChatMessage({
        id: `assistant-${Date.now()}`,
        role: response.output ? "assistant" : "system",
        content,
        command: response.command,
      });
    } catch (error) {
      appendChatMessage({
        id: `error-${Date.now()}`,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setCodexBusy(false);
    }
  }

  async function createLocalSkillTasks() {
    if (!activeProject || !activeSheet) return;
    if (!libraryPath.startsWith("/")) {
      setSkillTaskStatus("当前没有可写的桌面写作库，请使用 Tauri 桌面应用并选择本地库。");
      return;
    }
    const action = expandSlashCommand(chatInput.trim()) || "请根据当前项目、稿件卡片和选中上下文执行这个 Codex skill。";
    const skills = resolveSkillMentions(chatInput, codexSkills, selectedSkillIds);
    if (skills.length === 0) {
      setSkillTaskStatus("请先选择一个 $skill，或在输入框里写入 $skill-name。");
      return;
    }
    setSkillTaskStatus("正在写入本地 skill 任务...");
    try {
      const selectedText = getEditorSelection(editorRef.current);
      const taskPaths = await Promise.all(
        skills.map((skill) =>
          writeSkillTask({
            libraryPath,
            skill,
            project: activeProject,
            sheet: activeSheet,
            selectedText,
            action,
            selectedContextSheetIds,
            resourcePaths: selectedResourcePaths,
          }),
        ),
      );
      setSkillTaskStatus(`已写入 ${taskPaths.length} 个 skill 任务：${taskPaths.join(" | ")}`);
    } catch (error) {
      setSkillTaskStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function requestCodexInlineEdit() {
    if (!activeProject || !activeSheet || codexBusy) return;
    const selection = getEditorSelection(editorRef.current);
    const source = selection || activeSheet.body;
    const prompt = selection
      ? "请改写当前选区，保留原意和作者语气，只输出改写后的文本，不要解释。"
      : "请给当前稿件卡片做一次轻量改写，保留原意和作者语气，只输出改写后的正文，不要解释。";

    setInspectorTab("AI");
    setInspectorOpen(true);
    setCodexBusy(true);

    try {
      const response = await runCodexChat({
        libraryPath,
        prompt,
        context: buildCodexContext(activeProject, activeSheet, selection, chatMessages, ["current-sheet", "selection"], []),
        planMode: false,
        codexCliPath,
      });
      const result = response.output.trim();
      if (!result) {
        appendChatMessage({
          id: `inline-error-${Date.now()}`,
          role: "system",
          content: response.error || "Codex 没有返回可用于 inline edit 的文本。",
          command: response.command,
        });
        return;
      }

      setSuggestion({
        id: `codex-inline-${Date.now()}`,
        title: selection ? "Codex 改写选区" : "Codex 改写当前稿件",
        source,
        result,
        scope: selection ? "selection" : "sheet",
      });
    } catch (error) {
      appendChatMessage({
        id: `inline-error-${Date.now()}`,
        role: "system",
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setCodexBusy(false);
    }
  }

  async function runCodexProbe() {
    setCodexProbeBusy(true);
    try {
      setCodexProbe(await probeCodexCli(codexCliPath));
    } finally {
      setCodexProbeBusy(false);
    }
  }

  function acceptSuggestion() {
    if (!activeSheet || !suggestion) return;
    if (suggestion.reviewMode === "note" || suggestion.title === "标题备选") {
      return setSuggestion(null);
    }

    const selection = getEditorSelectionRange(editorRef.current);
    updateSheet(activeSheet.id, (sheet) => {
      const body =
        selection && suggestion.scope === "selection"
          ? `${sheet.body.slice(0, selection.from)}${suggestion.result}${sheet.body.slice(selection.to)}`
          : suggestion.result;
      return { ...sheet, body, updatedAt: today() };
    });
    setSuggestion(null);
  }

  const publishableSheets = useMemo(() => (activeProject ? getPublishableSheets(activeProject) : []), [activeProject]);
  const publishableSheetSignature = publishableSheets.map((sheet) => sheet.id).join("|");
  const selectedExportSheets = useMemo(
    () => selectedExportSheetIds.map((id) => publishableSheets.find((sheet) => sheet.id === id)).filter((sheet): sheet is WritingSheet => Boolean(sheet)),
    [publishableSheets, selectedExportSheetIds],
  );
  const compiledMarkdown = useMemo(() => (activeProject ? compileMarkdown(activeProject, selectedExportSheets) : ""), [activeProject, selectedExportSheets]);
  const compiledPlainText = useMemo(() => (activeProject ? compilePlainText(activeProject, selectedExportSheets) : ""), [activeProject, selectedExportSheets]);
  const compiledWechatHtml = useMemo(() => (activeProject ? compileWechatHtml(activeProject, selectedExportSheets) : ""), [activeProject, selectedExportSheets]);
  const compiledXhsDraft = useMemo(() => (activeProject ? compileXhsDraft(activeProject, selectedExportSheets) : ""), [activeProject, selectedExportSheets]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject) {
      setCompiledHtml("");
      setHtmlExportBusy(false);
      return;
    }

    setHtmlExportBusy(true);
    compileHtml(activeProject, selectedExportSheets)
      .then((html) => {
        if (!cancelled) setCompiledHtml(html);
      })
      .catch((error) => {
        if (!cancelled) setCompiledHtml(`<!-- HTML export failed: ${error instanceof Error ? error.message : String(error)} -->`);
      })
      .finally(() => {
        if (!cancelled) setHtmlExportBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, selectedExportSheets]);

  useEffect(() => {
    if (!activeProject) return;
    const ids = publishableSheets.map((sheet) => sheet.id);
    if (exportSelectionProjectId !== activeProject.id) {
      setSelectedExportSheetIds(ids);
      setExportSelectionProjectId(activeProject.id);
      setExportSaveStatus("");
      return;
    }
    setSelectedExportSheetIds((current) => current.filter((id) => ids.includes(id)));
  }, [activeProject, exportSelectionProjectId, publishableSheetSignature, publishableSheets]);

  useEffect(() => {
    setResourceImportStatus("");
  }, [activeProject?.id]);

  function toggleExportSheet(sheetId: string) {
    setSelectedExportSheetIds((current) =>
      current.includes(sheetId) ? current.filter((id) => id !== sheetId) : [...current, sheetId],
    );
  }

  function moveExportSheet(sheetId: string, direction: -1 | 1) {
    setSelectedExportSheetIds((current) => {
      const index = current.indexOf(sheetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
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

  function createPublishVersionSheet() {
    if (!activeProject || selectedExportSheets.length === 0) return;
    const id = `sheet-${Date.now()}`;
    const wordCount = selectedExportSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
    const sheet: WritingSheet = {
      id,
      title: `${activeProject.title}｜发布版本 ${today()}`,
      groupId: resolvedActiveGroupId || DEFAULT_CONTENT_GROUP_ID,
      type: "发布版本",
      status: "待发布",
      targetWords: Math.max(wordCount, 1),
      summary: `由 ${selectedExportSheets.length} 张稿件卡片组合生成：${selectedExportSheets
        .map((item) => item.title)
        .join("、")}`,
      body: compiledMarkdown,
      updatedAt: today(),
    };

    updateProject(activeProject.id, (project) => ({
      ...project,
      status: project.status === "已发布" || project.status === "已归档" ? project.status : "待发布",
      updatedAt: today(),
      sheets: [...project.sheets, sheet],
    }));
    setActiveSheetId(id);
    setInspectorTab("信息");
  }

  function togglePublishingChecklistItem(itemId: string) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => {
      const checklist = getPublishingChecklist(project).map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item,
      );
      return {
        ...project,
        publishingChecklist: checklist,
        updatedAt: today(),
      };
    });
  }

  async function saveCompiledExportFile(
    suffix: string,
    content: string,
    label: string,
    contentReady = true,
  ) {
    if (!activeProject || selectedExportSheets.length === 0) return;
    if (!contentReady) {
      setExportSaveStatus(`${label} 还在生成中，请稍后再保存。`);
      return;
    }

    const baseName = slugifyTitle(activeProject.title) || "nibva-export";
    const filename = `${baseName}${suffix}`;
    setExportSaveStatus(`正在保存 ${label}...`);
    try {
      const savedPath = await saveProjectExport(libraryPath, activeProject.id, filename, content);
      setExportSaveStatus(`已保存：${savedPath}`);
      const exportedAt = new Date().toISOString();
      const wordCount = selectedExportSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
      updateProject(activeProject.id, (project) => ({
        ...project,
        updatedAt: today(),
        exportHistory: [
          {
            id: `export-${Date.now()}`,
            label,
            filename,
            path: savedPath,
            exportedAt,
            sheetCount: selectedExportSheets.length,
            wordCount,
            targetPlatform: project.targetPlatform || "未指定",
          },
          ...(project.exportHistory ?? []),
        ].slice(0, MAX_EXPORT_HISTORY_ITEMS),
      }));
      setResourceRefreshKey((current) => current + 1);
    } catch (error) {
      setExportSaveStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function copyCompiledExport(content: string, label: string, contentReady = true) {
    if (selectedExportSheets.length === 0) return;
    if (!contentReady) {
      setExportSaveStatus(`${label} 还在生成中，请稍后再复制。`);
      return;
    }

    try {
      await copyTextToClipboard(content);
      setExportSaveStatus(`已复制 ${label} 到剪贴板。`);
    } catch (error) {
      setExportSaveStatus(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openCompiledPrintPreview() {
    if (selectedExportSheets.length === 0) return;
    if (htmlExportBusy) {
      setExportSaveStatus("HTML 还在生成中，请稍后再打开打印预览。");
      return;
    }

    const opened = openPrintPreview(activeProject?.title ?? "Nibva Export", compiledHtml);
    setExportSaveStatus(opened ? "已打开打印/PDF 预览窗口。" : "打开失败：浏览器或系统阻止了弹出窗口。");
  }

  async function importProjectResourceTarget(target: "assets" | "references") {
    if (!activeProject) return;
    const label = target === "assets" ? "素材" : "参考文件";
    setResourceImportStatus(`正在导入${label}...`);
    try {
      const imported = await importProjectResources(libraryPath, activeProject.id, target);
      if (imported.length === 0) {
        setResourceImportStatus("没有选择文件。");
        return;
      }
      setSelectedResourcePaths((current) => Array.from(new Set([...current, ...imported.map((resource) => resource.path)])));
      setResourceImportStatus(`已导入 ${imported.length} 个${label}。`);
      setResourceRefreshKey((current) => current + 1);
    } catch (error) {
      setResourceImportStatus(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openLocalResourcePath(path: string, label: string) {
    setResourceImportStatus(`正在打开${label}...`);
    try {
      await openLocalPath(path);
      setResourceImportStatus(`已打开${label}。`);
    } catch (error) {
      setResourceImportStatus(`打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openExportHistoryItem(item: ExportHistoryItem) {
    setExportSaveStatus(`正在打开 ${item.filename}...`);
    try {
      await openLocalPath(item.path);
      setExportSaveStatus(`已打开：${item.filename}`);
    } catch (error) {
      setExportSaveStatus(`打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function previewProjectResource(resource: ProjectResourceFile) {
    setResourcePreviewBusy(true);
    setResourceImportStatus(`正在预览 ${resource.name}...`);
    try {
      const [preview] = await readProjectResourceText(libraryPath, [resource.path]);
      setResourcePreview(
        preview ?? {
          path: resource.path,
          name: resource.name,
          status: "missing",
          content: "",
          sizeBytes: resource.sizeBytes,
          truncated: false,
        },
      );
      setResourceImportStatus(`已加载 ${resource.name} 的预览。`);
    } catch (error) {
      setResourcePreview({
        path: resource.path,
        name: resource.name,
        status: `read-failed: ${error instanceof Error ? error.message : String(error)}`,
        content: "",
        sizeBytes: resource.sizeBytes,
        truncated: false,
      });
      setResourceImportStatus(`预览失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setResourcePreviewBusy(false);
    }
  }

  function renderSheetRow(sheet: WritingSheet, options: { showIndex: boolean; showWorkflowActions?: boolean }) {
    const index = activeProject.sheets.findIndex((item) => item.id === sheet.id);
    const nextStatus = getNextProjectStatus(sheet.status);
    const canRestoreDraft = sheet.status === "已发布" || sheet.status === "已归档";
    function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActiveSheetId(sheet.id);
    }

    return (
      <article
        key={sheet.id}
        role="button"
        tabIndex={0}
        className={clsx(
          "sheet-row",
          activeSheet.id === sheet.id && "selected",
          draggingSheetId === sheet.id && "dragging",
          sheetDropTarget?.sheetId === sheet.id && `drop-${sheetDropTarget.position}`,
        )}
        draggable
        onClick={() => setActiveSheetId(sheet.id)}
        onKeyDown={selectSheetFromKeyboard}
        onDragStart={(event) => handleSheetDragStart(event, sheet.id)}
        onDragOver={(event) => handleSheetDragOver(event, sheet.id)}
        onDrop={(event) => handleSheetDrop(event, sheet.id)}
        onDragEnd={clearSheetDragState}
      >
        <div className="sheet-row-main">
          <strong>{options.showIndex ? `${index + 1}. ${sheet.title}` : sheet.title}</strong>
          {!options.showIndex && <span>{sheet.summary}</span>}
        </div>
        <div className="sheet-row-meta">
          <small>{sheet.status}</small>
          <small>{countWords(sheet.body)} / {sheet.targetWords}</small>
        </div>
        {options.showWorkflowActions && (
          <div className="sheet-row-actions">
            {nextStatus && (
              <button
                className="secondary-button compact-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSheetStatus(sheet.id, nextStatus);
                }}
              >
                推进到{nextStatus}
              </button>
            )}
            {canRestoreDraft && (
              <button
                className="secondary-button compact-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSheetStatus(sheet.id, "修改中");
                }}
              >
                恢复修改
              </button>
            )}
          </div>
        )}
      </article>
    );
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
        <main className="empty-state">
          <section className="empty-state-panel">
            <div className="brand-mark empty-brand-mark">N</div>
            <h1>Nibva</h1>
            <p>当前写作库还没有项目。</p>
            <small>{libraryPath}</small>
            <div className="empty-actions">
              <button className="primary-button" onClick={() => createProject()}>
                <Plus size={16} /> 创建空白项目
              </button>
              <button className="secondary-button" onClick={createProjectFromMarkdownFiles}>
                <Download size={16} /> 导入 Markdown
              </button>
              <button className="secondary-button" onClick={switchLibrary}>
                <FolderOpen size={16} /> 切换写作库
              </button>
              <button className="secondary-button" onClick={openCurrentLibrary} disabled={!libraryPath.startsWith("/")}>
                <Library size={16} /> 打开当前库
              </button>
            </div>
            <div className="empty-template-grid">
              {PROJECT_TEMPLATES.filter((template) => template.id !== "blank").map((template) => (
                <button key={template.id} className="template-row" onClick={() => createProject(template.id)}>
                  <FilePlus2 size={15} />
                  <span>
                    <strong>{template.title}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </main>
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
      <aside className="library-rail" aria-hidden={!libraryRailOpen}>
        <SidebarGlassPanel variant="library">
        <div className="rail-toolbar library-local-toolbar" data-tauri-drag-region onMouseDown={startWindowDrag}>
          <div className="rail-toolbar-actions">
            <button className="icon-button rail-plain-button" onClick={switchLibrary} title="切换写作库">
              <FolderOpen size={16} />
            </button>
            <button className="icon-button rail-plain-button" onClick={collapseLibraryRail} title="折叠导航栏">
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
        {sidebarMode === "library" ? (
          <>
            <nav className="nav-group">
              <button className={clsx("nav-item", projectFilter === "active" && "active")} onClick={() => setProjectFilter("active")}>
                <Library size={16} />
                <span>全部项目</span>
                <small>{projectCounts.active}</small>
              </button>
              <button className={clsx("nav-item", projectFilter === "today" && "active")} onClick={() => setProjectFilter("today")}>
                <Target size={16} />
                <span>今日写作</span>
                <small>{projectCounts.today}</small>
              </button>
              <button className={clsx("nav-item", projectFilter === "archived" && "active")} onClick={() => setProjectFilter("archived")}>
                <Archive size={16} />
                <span>已归档</span>
                <small>{projectCounts.archived}</small>
              </button>
            </nav>

            <label className="project-search">
              <Search size={14} />
              <input
                value={projectSearch}
                placeholder="搜索项目"
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </label>

            <div className="rail-header">
              <span>项目</span>
              <div className="rail-header-actions">
                <select className="compact-select" value={projectSort} onChange={(event) => setProjectSort(event.target.value as ProjectSort)}>
                  <option value="updated">最近</option>
                  <option value="title">标题</option>
                  <option value="word-count">字数</option>
                  <option value="progress">进度</option>
                </select>
                <button className="icon-button" onClick={() => createProject()} title="创建空白项目">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="project-list">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className={clsx("project-row", project.id === activeProject.id && "selected")}
                  onClick={() => enterProject(project)}
                >
                  <span>{project.title}</span>
                  <small>{getProjectGroups(project).length} 个分组 · {projectWordCount(project)} 字</small>
                </button>
              ))}
              {filteredProjects.length === 0 && <p className="empty-list">没有匹配的项目</p>}
            </div>

            <div className="library-footer-actions">
              <button className="secondary-button full-width" onClick={createProjectFromMarkdownFiles}>
                <Download size={16} /> 导入 Markdown
              </button>
              <button className="secondary-button full-width" onClick={switchLibrary}>
                <FolderOpen size={16} /> 切换写作库
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="project-sidebar-header">
              <button className="ghost-button back-button" onClick={() => setSidebarMode("library")} title="返回写作库">
                <ChevronUp size={16} /> 写作库
              </button>
              <input
                value={activeProject.title}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({ ...project, title: event.target.value, updatedAt: today() }))
                }
              />
              <p>{activeProject.description}</p>
              <ProgressBar value={projectProgress(activeProject)} />
            </div>

            <div className="rail-header">
              <span>分组</span>
              <button className="icon-button" onClick={createProjectGroup} title="新建分组">
                <Plus size={16} />
              </button>
            </div>

            <div className="project-list">
              {projectGroups.map((group) => (
                <button
                  key={group.id}
                  className={clsx("project-row group-row", group.id === resolvedActiveGroupId && "selected")}
                  onClick={() => selectProjectGroup(group.id)}
                >
                  <span>{group.title}</span>
                  <small>{groupCounts.get(group.id) ?? 0} 篇 · {groupWordCounts.get(group.id) ?? 0} 字</small>
                </button>
              ))}
            </div>

            <div className="library-footer-actions">
              <button className="secondary-button full-width" onClick={duplicateActiveProject}>
                <Copy size={16} /> 复制项目
              </button>
              <button className="secondary-button danger-outline-button full-width" onClick={removeActiveProjectFromLibrary}>
                <Trash2 size={16} /> 移出列表
              </button>
            </div>
          </>
        )}
        </SidebarGlassPanel>
      </aside>

      {sheetRailOpen && (
      <aside className="sheet-rail">
        <div className="sheet-rail-content">
        <div
          className="rail-toolbar sheet-local-toolbar"
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
        >
          <div className="rail-toolbar-actions">
            <button className="icon-button" onClick={createSheet} title="新建文稿">
              <FilePlus2 size={16} />
            </button>
          </div>
        </div>
        <div className="project-heading group-heading">
          <strong>{activeGroup?.title ?? "分组"}</strong>
          <p>{activeGroup?.description || "当前分组下的文稿。"}</p>
          <small>{activeGroupSheets.length} 篇 · {activeGroupSheets.reduce((total, sheet) => total + countWords(sheet.body), 0)} 字</small>
        </div>

        <div className="view-switch">
          {(["列表", "卡片", "大纲"] as SheetView[]).map((view) => (
            <button key={view} className={clsx(view === sheetView && "active")} onClick={() => setSheetView(view)}>
              {view === "列表" && <LayoutList size={14} />}
              {view === "卡片" && <Library size={14} />}
              {view === "大纲" && <ListTree size={14} />}
              {view}
            </button>
          ))}
        </div>

        <label className="rail-search">
          <Search size={14} />
          <input
            value={sheetSearch}
            placeholder="搜索卡片、正文、摘要"
            onChange={(event) => setSheetSearch(event.target.value)}
          />
        </label>

        <div className="sheet-type-filter">
          {SHEET_TYPE_FILTERS.map((type) => (
            <button
              key={type}
              className={clsx(sheetTypeFilter === type && "active")}
              onClick={() => setSheetTypeFilter(type)}
            >
              {type}
              <small>{sheetTypeCounts.get(type) ?? 0}</small>
            </button>
          ))}
        </div>

        <div className={clsx("sheet-list", `sheet-list-${sheetView}`)}>
          {sheetView === "卡片"
            ? getSheetStatusGroups(filteredSheets).map((group) => (
                <section key={group.status} className="sheet-status-group">
                  <div className="sheet-status-header">
                    <strong>{group.status}</strong>
                    <small>
                      {group.sheets.length} 张 · {group.wordCount} 字
                    </small>
                  </div>
                  <div className="sheet-status-cards">
                    {group.sheets.map((sheet) => renderSheetRow(sheet, { showIndex: false, showWorkflowActions: true }))}
                  </div>
                </section>
              ))
            : filteredSheets.map((sheet) => renderSheetRow(sheet, { showIndex: sheetView === "大纲" }))}
          {filteredSheets.length === 0 && <p className="empty-list">当前分组没有匹配的文稿</p>}
        </div>

        <div className="sheet-management-actions">
          <button className="secondary-button" onClick={duplicateActiveSheet}>
            <Copy size={16} /> 复制
          </button>
          <button className="secondary-button danger-outline-button" onClick={deleteActiveSheet}>
            <Trash2 size={16} /> 删除
          </button>
        </div>

        <button className="secondary-button full-width" onClick={createMaterialSheet}>
          <Archive size={16} /> 新素材
        </button>
        <button className="secondary-button full-width" onClick={importMarkdownSheets}>
          <Download size={16} /> 导入 Markdown
        </button>
        </div>
      </aside>
      )}
      </section>

      <main className="editor-zone">
        <header className="editor-toolbar">
          <div className="toolbar-title">
            <input
              value={activeSheet.title}
              onChange={(event) => updateSheet(activeSheet.id, (sheet) => ({ ...sheet, title: event.target.value, updatedAt: today() }))}
            />
            <span>{countWords(activeSheet.body)} 字 · {activeSheet.status} · {activeProject.targetPlatform}</span>
            <span className="library-path-line">{libraryPath}</span>
            {libraryStatus && <span className="library-status-line">{libraryStatus}</span>}
          </div>

          <div className="toolbar-actions">
            <button
              className={clsx("ghost-button", libraryRailOpen && "active")}
              onClick={() => setLibraryRailOpen((value) => !value)}
              title={libraryRailOpen ? "隐藏项目栏" : "显示项目栏"}
            >
              <Library size={16} /> 项目
            </button>
            <button
              className={clsx("ghost-button", sheetRailOpen && "active")}
              onClick={() => setSheetRailOpen((value) => !value)}
              title={sheetRailOpen ? "隐藏卡片栏" : "显示卡片栏"}
            >
              <ListTree size={16} /> 卡片
            </button>
            {!sheetPreviewMode && (
              <div className="format-toolbar" aria-label="Markdown 快捷格式">
                <button className="icon-button" onClick={() => applyMarkdownFormat("h1")} title="一级标题">
                  <Heading1 size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("h2")} title="二级标题">
                  <Heading2 size={16} />
                </button>
                <span className="toolbar-divider" />
                <button className="icon-button" onClick={() => applyMarkdownFormat("bold")} title="加粗">
                  <Bold size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("italic")} title="斜体">
                  <Italic size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("link")} title="链接">
                  <Link size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("code")} title="行内代码">
                  <Code2 size={16} />
                </button>
                <span className="toolbar-divider" />
                <button className="icon-button" onClick={() => applyMarkdownFormat("list")} title="无序列表">
                  <List size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("task")} title="任务列表">
                  <ListTodo size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("quote")} title="引用">
                  <TextQuote size={16} />
                </button>
                <button className="icon-button" onClick={() => applyMarkdownFormat("divider")} title="分割线">
                  <Minus size={16} />
                </button>
              </div>
            )}
            <button className="ghost-button" onClick={openCurrentSheetMarkdown} title="打开当前稿件 Markdown 文件">
              <FileText size={16} /> 打开 MD
            </button>
            <button className="ghost-button" onClick={openEditorSearch} title="查找/替换当前稿件" disabled={sheetPreviewMode}>
              <Search size={16} /> 查找/替换
            </button>
            <button
              className={clsx("ghost-button", sheetPreviewMode && "active")}
              onClick={() => setSheetPreviewMode((value) => !value)}
              title={sheetPreviewMode ? "返回编辑" : "预览当前稿件"}
            >
              {sheetPreviewMode ? <PenLine size={16} /> : <FileText size={16} />}
              {sheetPreviewMode ? "编辑" : "预览"}
            </button>
            <button className="ghost-button" onClick={() => moveSheet(activeSheet.id, -1)} title="上移">
              <ChevronUp size={16} />
            </button>
            <button className="ghost-button" onClick={() => moveSheet(activeSheet.id, 1)} title="下移">
              <ChevronDown size={16} />
            </button>
            <button className="ghost-button" onClick={() => setFocusMode((value) => !value)} title="专注模式">
              <Focus size={16} /> 专注
            </button>
            <button
              className={clsx("ghost-button", typewriterMode && "active")}
              onClick={() => setTypewriterMode((value) => !value)}
              title="打字机模式"
            >
              <Focus size={16} /> 打字机
            </button>
            <button className="primary-button" onClick={() => sendCodexMessage("请基于当前稿件给出修改建议，重点关注结构、表达和可发布性。")}>
              <Sparkles size={16} /> 询问 Codex
            </button>
            <button className={clsx("ghost-button", inspectorOpen && "active")} onClick={() => setInspectorOpen((value) => !value)} title={inspectorOpen ? "隐藏检查器" : "显示检查器"}>
              <PanelRight size={16} />
            </button>
          </div>
        </header>

        <section className="editor-canvas">
          {sheetPreviewMode ? (
            <article className="sheet-preview">
              {sheetPreviewBusy && <p className="muted-text">正在生成预览...</p>}
              <div dangerouslySetInnerHTML={{ __html: sheetPreviewHtml || "<p></p>" }} />
            </article>
          ) : (
            <CodeMirror
              value={activeSheet.body}
              height="100%"
              theme="light"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
              }}
              extensions={[
                history(),
                search({ top: true }),
                keymap.of([...markdownShortcutKeymap, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
                chineseEditorPhrases,
                markdown(),
                markdownHighlighting,
                EditorView.lineWrapping,
                editorTheme,
                typewriterMode ? typewriterScrollExtension : [],
              ]}
              onCreateEditor={(view) => {
                editorRef.current = view;
              }}
              onChange={(value) => updateSheet(activeSheet.id, (sheet) => ({ ...sheet, body: value, updatedAt: today() }))}
            />
          )}
        </section>
      </main>

      {inspectorOpen && (
        <aside className="inspector">
          <div className="inspector-tabs">
            {(["信息", "AI", "资源", "历史", "导出"] as InspectorTab[]).map((tab) => (
              <button key={tab} className={clsx(tab === inspectorTab && "active")} onClick={() => setInspectorTab(tab)}>
                {tab === "信息" && <Info size={14} />}
                {tab === "AI" && <Bot size={14} />}
                {tab === "资源" && <FolderOpen size={14} />}
                {tab === "历史" && <History size={14} />}
                {tab === "导出" && <Download size={14} />}
                {tab}
              </button>
            ))}
          </div>

          {inspectorTab === "信息" && (
            <InfoPanel
              activeProject={activeProject}
              activeSheet={activeSheet}
              sessionStartWords={writingSessionStarts[activeSheet.id] ?? countWords(activeSheet.body)}
              updateProject={(updater) => updateProject(activeProject.id, updater)}
              updateSheet={(updater) => updateSheet(activeSheet.id, updater)}
              onResetWritingSession={() =>
                setWritingSessionStarts((current) => ({
                  ...current,
                  [activeSheet.id]: countWords(activeSheet.body),
                }))
              }
              onJumpToHeading={jumpToSheetHeading}
            />
          )}

          {inspectorTab === "AI" && (
            <AiPanel
              suggestion={suggestion}
              diffLines={suggestion && suggestion.reviewMode !== "note" ? buildLineDiff(suggestion.source, suggestion.result) : []}
              messages={chatMessages}
              conversations={chatConversations}
              activeConversationId={activeConversationId}
              input={chatInput}
              busy={codexBusy}
              planMode={planMode}
              mentionModes={mentionModes}
              projectSheets={activeProject.sheets}
              selectedContextSheetIds={selectedContextSheetIds}
              resourcePaths={projectResourcePaths}
              projectResources={projectResources}
              selectedResourcePaths={selectedResourcePaths}
              resourceImportStatus={resourceImportStatus}
              resourcePreview={resourcePreview}
              resourcePreviewBusy={resourcePreviewBusy}
              skills={codexSkills}
              selectedSkillIds={selectedSkillIds}
              skillTaskStatus={skillTaskStatus}
              codexCliPath={codexCliPath}
              providerMode={codexProviderMode}
              probe={codexProbe}
              probeBusy={codexProbeBusy}
              onSelectConversation={setActiveConversationId}
              onCreateConversation={createConversation}
              onForkConversation={forkConversation}
              onCompactConversation={compactConversation}
              onDeleteConversation={deleteConversation}
              onInputChange={setChatInput}
              onPlanModeChange={setPlanMode}
              onMentionModesChange={setMentionModes}
              onSelectedContextSheetIdsChange={setSelectedContextSheetIds}
              onSelectedResourcePathsChange={setSelectedResourcePaths}
              onImportAssets={() => importProjectResourceTarget("assets")}
              onImportReferences={() => importProjectResourceTarget("references")}
              onOpenResourcePath={openLocalResourcePath}
              onPreviewResource={previewProjectResource}
              onClearResourcePreview={() => setResourcePreview(null)}
              onSelectedSkillIdsChange={setSelectedSkillIds}
              onCreateSkillTasks={createLocalSkillTasks}
              onCodexCliPathChange={setCodexCliPath}
              onProviderModeChange={setCodexProviderMode}
              onProbeCodex={runCodexProbe}
              onSend={() => sendCodexMessage()}
              onQuickStructure={() => sendCodexMessage("请阅读当前稿件卡片，给出结构诊断和 3 条具体修改建议。")}
              onQuickPolish={() => sendCodexMessage("请润色当前选区；如果没有选区，请给当前稿件卡片给出局部润色建议，不要直接整篇重写。")}
              onCodexInlineEdit={requestCodexInlineEdit}
              onPolish={generatePolishSuggestion}
              onTitle={generateTitleSuggestion}
              onSummary={generateSummarySuggestion}
              onImageIdeas={generateImageIdeaSuggestion}
              onSaveNote={saveSuggestionAsMaterialSheet}
              onAccept={acceptSuggestion}
              onReject={() => setSuggestion(null)}
            />
          )}

          {inspectorTab === "资源" && (
            <ResourcePanel
              resourcePaths={projectResourcePaths}
              projectResources={projectResources}
              selectedResourcePaths={selectedResourcePaths}
              resourceImportStatus={resourceImportStatus}
              resourcePreview={resourcePreview}
              resourcePreviewBusy={resourcePreviewBusy}
              onSelectedResourcePathsChange={setSelectedResourcePaths}
              onImportAssets={() => importProjectResourceTarget("assets")}
              onImportReferences={() => importProjectResourceTarget("references")}
              onOpenResourcePath={openLocalResourcePath}
              onPreviewResource={previewProjectResource}
              onClearResourcePreview={() => setResourcePreview(null)}
            />
          )}

          {inspectorTab === "历史" && (
            <HistoryPanel
              project={activeProject}
              activeSheet={activeSheet}
              onSaveVersion={saveActiveSheetVersion}
              onRestoreVersion={restoreSheetVersion}
              onOpenExportHistoryItem={openExportHistoryItem}
            />
          )}

          {inspectorTab === "导出" && (
            <ExportPanel
              project={activeProject}
              publishableSheets={publishableSheets}
              selectedSheetIds={selectedExportSheetIds}
              markdown={compiledMarkdown}
              html={compiledHtml}
              htmlBusy={htmlExportBusy}
              plainText={compiledPlainText}
              wechatHtml={compiledWechatHtml}
              xhsDraft={compiledXhsDraft}
              saveStatus={exportSaveStatus}
              onToggleSheet={toggleExportSheet}
              onMoveSheet={moveExportSheet}
              onTogglePublishingChecklistItem={togglePublishingChecklistItem}
              onSelectAll={() => setSelectedExportSheetIds(publishableSheets.map((sheet) => sheet.id))}
              onSelectNone={() => setSelectedExportSheetIds([])}
              onCreatePublishVersion={createPublishVersionSheet}
              onDownloadMarkdown={() => downloadText(`${slugifyTitle(activeProject.title) || "nibva-export"}.md`, compiledMarkdown)}
              onDownloadHtml={() => downloadText(`${slugifyTitle(activeProject.title) || "nibva-export"}.html`, compiledHtml, "text/html;charset=utf-8")}
              onDownloadPlainText={() => downloadText(`${slugifyTitle(activeProject.title) || "nibva-export"}.txt`, compiledPlainText)}
              onDownloadWechatHtml={() =>
                downloadText(`${slugifyTitle(activeProject.title) || "nibva-export"}-wechat.html`, compiledWechatHtml, "text/html;charset=utf-8")
              }
              onDownloadXhsDraft={() => downloadText(`${slugifyTitle(activeProject.title) || "nibva-export"}-xhs.md`, compiledXhsDraft)}
              onSaveMarkdown={() => saveCompiledExportFile(".md", compiledMarkdown, "Markdown")}
              onSaveHtml={() => saveCompiledExportFile(".html", compiledHtml, "HTML", !htmlExportBusy)}
              onSavePlainText={() => saveCompiledExportFile(".txt", compiledPlainText, "纯文本")}
              onSaveWechatHtml={() => saveCompiledExportFile("-wechat.html", compiledWechatHtml, "公众号 HTML")}
              onSaveXhsDraft={() => saveCompiledExportFile("-xhs.md", compiledXhsDraft, "小红书草稿")}
              onCopyMarkdown={() => copyCompiledExport(compiledMarkdown, "Markdown")}
              onCopyHtml={() => copyCompiledExport(compiledHtml, "HTML", !htmlExportBusy)}
              onCopyWechatHtml={() => copyCompiledExport(compiledWechatHtml, "公众号 HTML")}
              onCopyXhsDraft={() => copyCompiledExport(compiledXhsDraft, "小红书草稿")}
              onOpenPrintPreview={openCompiledPrintPreview}
            />
          )}
        </aside>
      )}
    </div>
    </div>
  );
}

function SidebarGlassPanel({ children, variant }: { children: ReactNode; variant: "library" | "sheet" }) {
  if (variant === "library") {
    return (
      <div className="sidebar-glass-shell sidebar-glass-shell-library">
        <div className="sidebar-glass-material" aria-hidden="true" />
        <div className="sidebar-glass-content">{children}</div>
      </div>
    );
  }

  return (
    <div className={clsx("sidebar-glass-shell", `sidebar-glass-shell-${variant}`)}>
      <LiquidGlass
        className="sidebar-liquid-glass"
        displacementScale={18}
        blurAmount={0.09}
        saturation={220}
        aberrationIntensity={3.4}
        elasticity={0.1}
        cornerRadius={18}
        padding="0"
        overLight
        mode="standard"
        style={{ position: "relative", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}

function InfoPanel({
  activeProject,
  activeSheet,
  sessionStartWords,
  updateProject,
  updateSheet,
  onResetWritingSession,
  onJumpToHeading,
}: {
  activeProject: WritingProject;
  activeSheet: WritingSheet;
  sessionStartWords: number;
  updateProject: (updater: (project: WritingProject) => WritingProject) => void;
  updateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onResetWritingSession: () => void;
  onJumpToHeading: (line: number) => void;
}) {
  const tagText = activeProject.tags.join(", ");
  const writingBrief = getWritingBrief(activeProject);
  const headings = getSheetHeadings(activeSheet.body);
  const stats = sheetStats(activeSheet);
  const nextProjectStatus = getNextProjectStatus(activeProject.status);
  const nextSheetStatus = getNextProjectStatus(activeSheet.status);
  const currentWords = countWords(activeSheet.body);
  const sessionDelta = currentWords - sessionStartWords;
  const wordsRemaining = Math.max(0, activeSheet.targetWords - currentWords);

  function setProjectWorkflowStatus(status: ProjectStatus) {
    updateProject((project) => ({
      ...project,
      status,
      updatedAt: today(),
      sheets: project.sheets.map((sheet) => {
        if (sheet.type === "素材") return sheet;
        if (
          status === "待发布" ||
          status === "已发布" ||
          status === "已归档" ||
          (status === "修改中" && (sheet.status === "已发布" || sheet.status === "已归档"))
        ) {
          return { ...sheet, status, updatedAt: today() };
        }
        return sheet;
      }),
    }));
  }

  function setSheetWorkflowStatus(status: ProjectStatus) {
    updateSheet((sheet) => ({
      ...sheet,
      status,
      updatedAt: today(),
    }));
  }

  function updateWritingBrief(field: keyof ProjectWritingBrief, value: string) {
    updateProject((project) => ({
      ...project,
      writingBrief: {
        ...getWritingBrief(project),
        [field]: value,
      },
      updatedAt: today(),
    }));
  }

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <h2>项目信息</h2>
        <label>
          状态
          <select
            value={activeProject.status}
            onChange={(event) =>
              updateProject((project) => ({ ...project, status: event.target.value as ProjectStatus, updatedAt: today() }))
            }
          >
            {PROJECT_STATUS_FLOW.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          目标平台
          <input
            value={activeProject.targetPlatform}
            placeholder="公众号 / 小红书 / 网站 / 书稿"
            onChange={(event) =>
              updateProject((project) => ({ ...project, targetPlatform: event.target.value, updatedAt: today() }))
            }
          />
        </label>
        <label>
          目标字数
          <input
            type="number"
            value={activeProject.targetWords}
            onChange={(event) =>
              updateProject((project) => ({ ...project, targetWords: Number(event.target.value), updatedAt: today() }))
            }
          />
        </label>
        <label>
          标签
          <input
            value={tagText}
            placeholder="产品, 写作软件, AI Native"
            onChange={(event) =>
              updateProject((project) => ({
                ...project,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                updatedAt: today(),
              }))
            }
          />
        </label>
        <label>
          描述
          <textarea
            value={activeProject.description}
            onChange={(event) =>
              updateProject((project) => ({ ...project, description: event.target.value, updatedAt: today() }))
            }
          />
        </label>
        <div className="workflow-actions">
          {nextProjectStatus && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus(nextProjectStatus)}>
              <ChevronDown size={16} /> 推进到{nextProjectStatus}
            </button>
          )}
          <button className="secondary-button" onClick={() => setProjectWorkflowStatus("待发布")}>
            <Download size={16} /> 待发布
          </button>
          <button className="primary-button" onClick={() => setProjectWorkflowStatus("已发布")}>
            <Check size={16} /> 已发布
          </button>
          {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus("已归档")} disabled={activeProject.status === "已归档"}>
              <Archive size={16} /> 归档
            </button>
          )}
          {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus("修改中")}>
              <PenLine size={16} /> 恢复修改
            </button>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h2>写作简报</h2>
        <label>
          目标读者
          <textarea
            value={writingBrief.audience}
            placeholder="这篇内容写给谁？他们已经知道什么，还卡在哪里？"
            onChange={(event) => updateWritingBrief("audience", event.target.value)}
          />
        </label>
        <label>
          核心观点
          <textarea
            value={writingBrief.thesis}
            placeholder="这篇文章最终要让读者相信什么？"
            onChange={(event) => updateWritingBrief("thesis", event.target.value)}
          />
        </label>
        <label>
          语气风格
          <input
            value={writingBrief.tone}
            placeholder="例如：清楚、克制、具体、有判断，不营销"
            onChange={(event) => updateWritingBrief("tone", event.target.value)}
          />
        </label>
        <label>
          发布备注
          <textarea
            value={writingBrief.publishingNotes}
            placeholder="平台限制、配图要求、标题方向、必须避开的表达。"
            onChange={(event) => updateWritingBrief("publishingNotes", event.target.value)}
          />
        </label>
      </section>

      <section className="panel-section">
        <h2>稿件信息</h2>
        <label>
          类型
          <select
            value={activeSheet.type}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, type: event.target.value as SheetType, updatedAt: today() }))}
          >
            {(["正文", "章节", "提纲", "素材", "发布版本"] as SheetType[]).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          状态
          <select
            value={activeSheet.status}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, status: event.target.value as ProjectStatus, updatedAt: today() }))}
          >
            {PROJECT_STATUS_FLOW.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <div className="workflow-actions">
          {nextSheetStatus && (
            <button className="secondary-button" onClick={() => setSheetWorkflowStatus(nextSheetStatus)}>
              <ChevronDown size={16} /> 推进到{nextSheetStatus}
            </button>
          )}
          <button className="secondary-button" onClick={() => setSheetWorkflowStatus("待发布")} disabled={activeSheet.status === "待发布"}>
            <Download size={16} /> 待发布
          </button>
          <button className="primary-button" onClick={() => setSheetWorkflowStatus("已发布")} disabled={activeSheet.status === "已发布"}>
            <Check size={16} /> 已发布
          </button>
          {(activeSheet.status === "已发布" || activeSheet.status === "已归档") && (
            <button className="secondary-button" onClick={() => setSheetWorkflowStatus("修改中")}>
              <PenLine size={16} /> 恢复修改
            </button>
          )}
        </div>
        <label>
          目标字数
          <input
            type="number"
            value={activeSheet.targetWords}
            onChange={(event) =>
              updateSheet((sheet) => ({ ...sheet, targetWords: Number(event.target.value), updatedAt: today() }))
            }
          />
        </label>
        <label>
          摘要
          <textarea
            value={activeSheet.summary}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, summary: event.target.value, updatedAt: today() }))}
          />
        </label>
      </section>

      <section className="panel-section">
        <h2>项目进度</h2>
        <div className="metric-row">
          <span>项目总字数</span>
          <strong>{projectWordCount(activeProject)}</strong>
        </div>
        <div className="metric-row">
          <span>项目完成度</span>
          <strong>{projectProgress(activeProject)}%</strong>
        </div>
        <div className="metric-row">
          <span>稿件卡片</span>
          <strong>{activeProject.sheets.length}</strong>
        </div>
        <ProgressBar value={projectProgress(activeProject)} />
      </section>

      <section className="panel-section">
        <h2>当前稿件进度</h2>
        <div className="metric-row">
          <span>当前字数</span>
          <strong>{currentWords}</strong>
        </div>
        <div className="metric-row">
          <span>完成度</span>
          <strong>{sheetProgress(activeSheet)}%</strong>
        </div>
        <div className="metric-row">
          <span>距目标</span>
          <strong>{wordsRemaining === 0 ? "已达成" : `${wordsRemaining} 字`}</strong>
        </div>
        <ProgressBar value={sheetProgress(activeSheet)} />
      </section>

      <section className="panel-section">
        <div className="panel-section-title-row">
          <h2>本次写作</h2>
          <button className="text-button" onClick={onResetWritingSession}>
            重置
          </button>
        </div>
        <div className="metric-grid">
          <div>
            <span>起点</span>
            <strong>{sessionStartWords}</strong>
          </div>
          <div>
            <span>净增</span>
            <strong>{sessionDelta >= 0 ? `+${sessionDelta}` : sessionDelta}</strong>
          </div>
          <div>
            <span>当前</span>
            <strong>{currentWords}</strong>
          </div>
          <div>
            <span>目标差距</span>
            <strong>{wordsRemaining}</strong>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <h2>稿件统计</h2>
        <div className="metric-grid">
          <div>
            <span>字符</span>
            <strong>{stats.characters}</strong>
          </div>
          <div>
            <span>段落</span>
            <strong>{stats.paragraphs}</strong>
          </div>
          <div>
            <span>标题</span>
            <strong>{stats.headings}</strong>
          </div>
          <div>
            <span>阅读</span>
            <strong>{stats.readingMinutes} 分钟</strong>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <h2>稿件大纲</h2>
        <div className="heading-list">
          {headings.map((heading) => (
            <button
              key={heading.id}
              className="heading-row"
              style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
              onClick={() => onJumpToHeading(heading.line)}
            >
              <span>H{heading.level}</span>
              <strong>{heading.text}</strong>
            </button>
          ))}
          {headings.length === 0 && <p className="muted-text">当前稿件还没有 Markdown 标题。</p>}
        </div>
      </section>

    </div>
  );
}

function HistoryPanel({
  project,
  activeSheet,
  onSaveVersion,
  onRestoreVersion,
  onOpenExportHistoryItem,
}: {
  project: WritingProject;
  activeSheet: WritingSheet;
  onSaveVersion: () => void;
  onRestoreVersion: (version: SheetVersion) => void;
  onOpenExportHistoryItem: (item: ExportHistoryItem) => void;
}) {
  const versions = activeSheet.versions ?? [];
  const [compareVersionId, setCompareVersionId] = useState("");
  const comparedVersion = versions.find((version) => version.id === compareVersionId) ?? null;
  const versionDiffLines = comparedVersion ? buildLineDiff(comparedVersion.body, activeSheet.body) : [];
  const recentExportHistory = project.exportHistory ?? [];

  useEffect(() => {
    setCompareVersionId("");
  }, [activeSheet.id]);

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <h2>版本快照</h2>
        <button className="primary-button full-width" onClick={onSaveVersion}>
          <Archive size={16} /> 保存当前版本
        </button>
        <div className="version-list">
          {versions.map((version) => (
            <article key={version.id} className="version-row">
              <div>
                <strong>{version.title}</strong>
                <small>{formatSnapshotTime(version.createdAt)} · {version.wordCount} 字</small>
              </div>
              <div className="version-actions">
                <button
                  className={clsx("secondary-button", compareVersionId === version.id && "active")}
                  onClick={() => setCompareVersionId((current) => (current === version.id ? "" : version.id))}
                >
                  对比
                </button>
                <button className="secondary-button" onClick={() => onRestoreVersion(version)}>
                  恢复
                </button>
              </div>
            </article>
          ))}
          {versions.length === 0 && <p className="muted-text">还没有保存过版本快照。</p>}
        </div>
        {comparedVersion && (
          <div className="version-diff-block">
            <div className="version-diff-header">
              <strong>对比：{comparedVersion.title}</strong>
              <button className="text-button" onClick={() => setCompareVersionId("")}>
                关闭
              </button>
            </div>
            <p className="muted-text">绿色为当前稿件新增内容，红色为相对快照删除的内容。</p>
            <div className="diff-view" aria-label="版本差异">
              {versionDiffLines.map((line) => (
                <div key={line.id} className={clsx("diff-line", `diff-${line.kind}`)}>
                  <span>{line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}</span>
                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2>导出历史</h2>
        <div className="export-history-list">
          {recentExportHistory.map((item) => (
            <div key={item.id} className="export-history-row">
              <div>
                <strong>{item.label}</strong>
                <small>
                  {formatDateTime(item.exportedAt)} · {item.sheetCount} 张 · {item.wordCount} 字
                </small>
                <small>{item.filename}</small>
              </div>
              <button className="secondary-button compact-button" onClick={() => onOpenExportHistoryItem(item)}>
                打开
              </button>
            </div>
          ))}
          {recentExportHistory.length === 0 && <p className="muted-text">保存导出文件后，这里会记录历史。</p>}
        </div>
      </section>
    </div>
  );
}

function AiPanel({
  suggestion,
  diffLines,
  messages,
  conversations,
  activeConversationId,
  input,
  busy,
  planMode,
  mentionModes,
  projectSheets,
  selectedContextSheetIds,
  resourcePaths,
  projectResources,
  selectedResourcePaths,
  resourceImportStatus,
  resourcePreview,
  resourcePreviewBusy,
  skills,
  selectedSkillIds,
  skillTaskStatus,
  codexCliPath,
  providerMode,
  probe,
  probeBusy,
  onSelectConversation,
  onCreateConversation,
  onForkConversation,
  onCompactConversation,
  onDeleteConversation,
  onInputChange,
  onPlanModeChange,
  onMentionModesChange,
  onSelectedContextSheetIdsChange,
  onSelectedResourcePathsChange,
  onImportAssets,
  onImportReferences,
  onOpenResourcePath,
  onPreviewResource,
  onClearResourcePreview,
  onSelectedSkillIdsChange,
  onCreateSkillTasks,
  onCodexCliPathChange,
  onProviderModeChange,
  onProbeCodex,
  onSend,
  onQuickStructure,
  onQuickPolish,
  onCodexInlineEdit,
  onPolish,
  onTitle,
  onSummary,
  onImageIdeas,
  onSaveNote,
  onAccept,
  onReject,
}: {
  suggestion: AiSuggestion | null;
  diffLines: DiffLine[];
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeConversationId: string;
  input: string;
  busy: boolean;
  planMode: boolean;
  mentionModes: MentionMode[];
  projectSheets: WritingSheet[];
  selectedContextSheetIds: string[];
  resourcePaths: ProjectResourcePaths | null;
  projectResources: ProjectResourceFile[];
  selectedResourcePaths: string[];
  resourceImportStatus: string;
  resourcePreview: ProjectResourceText | null;
  resourcePreviewBusy: boolean;
  skills: CodexSkill[];
  selectedSkillIds: string[];
  skillTaskStatus: string;
  codexCliPath: string;
  providerMode: "exec" | "app-server";
  probe: CodexProbeResult | null;
  probeBusy: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onForkConversation: () => void;
  onCompactConversation: () => void;
  onDeleteConversation: () => void;
  onInputChange: (value: string) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onMentionModesChange: (modes: MentionMode[]) => void;
  onSelectedContextSheetIdsChange: (sheetIds: string[]) => void;
  onSelectedResourcePathsChange: (paths: string[]) => void;
  onImportAssets: () => void;
  onImportReferences: () => void;
  onOpenResourcePath: (path: string, label: string) => void;
  onPreviewResource: (resource: ProjectResourceFile) => void;
  onClearResourcePreview: () => void;
  onSelectedSkillIdsChange: (skillIds: string[]) => void;
  onCreateSkillTasks: () => void;
  onCodexCliPathChange: (path: string) => void;
  onProviderModeChange: (mode: "exec" | "app-server") => void;
  onProbeCodex: () => void;
  onSend: () => void;
  onQuickStructure: () => void;
  onQuickPolish: () => void;
  onCodexInlineEdit: () => void;
  onPolish: () => void;
  onTitle: () => void;
  onSummary: () => void;
  onImageIdeas: () => void;
  onSaveNote: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isNoteSuggestion = suggestion?.reviewMode === "note";
  const contextSheets = projectSheets.filter((sheet) => sheet.type !== "发布版本");

  return (
    <div className="panel-stack">
      <section className="panel-section chat-panel">
        <div className="chat-header">
          <h2>Codex Chat</h2>
          <div className="chat-header-actions">
            <button className="icon-button" onClick={onCreateConversation} title="新建对话">
              <Plus size={14} />
            </button>
            <button className="icon-button" onClick={onForkConversation} title="分叉当前对话">
              <Copy size={14} />
            </button>
            <button className="icon-button" onClick={onCompactConversation} title="压缩当前对话">
              <ListCollapse size={14} />
            </button>
            <button className="icon-button danger-button" onClick={onDeleteConversation} title="删除当前对话">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="conversation-tabs">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={clsx(conversation.id === activeConversationId && "active")}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {conversation.title}
            </button>
          ))}
        </div>
        <div className="agent-toolbar">
          <label className="toggle-row">
            <input type="checkbox" checked={planMode} onChange={(event) => onPlanModeChange(event.target.checked)} />
            Plan Mode
          </label>
          <details>
            <summary>
              <Settings2 size={14} /> 设置
            </summary>
            <label>
              Codex CLI 路径
              <input
                value={codexCliPath}
                placeholder="留空自动查找；可填 /opt/homebrew/bin/codex"
                onChange={(event) => onCodexCliPathChange(event.target.value)}
              />
            </label>
            <label>
              Provider 模式
              <select value={providerMode} onChange={(event) => onProviderModeChange(event.target.value as "exec" | "app-server")}>
                <option value="exec">exec（当前可用）</option>
                <option value="app-server">app-server（下一阶段）</option>
              </select>
            </label>
            <button className="secondary-button full-width" onClick={onProbeCodex} disabled={probeBusy}>
              {probeBusy ? "测试中..." : "测试 Codex CLI"}
            </button>
            {probe && (
              <div className={clsx("probe-card", probe.ok ? "probe-ok" : "probe-failed")}>
                <strong>{probe.ok ? "Codex CLI 可用" : "Codex CLI 需要处理"}</strong>
                <small>{probe.resolvedPath || "未解析到路径"}</small>
                {probe.steps.map((step) => (
                  <div key={step.name} className="probe-step">
                    <span>{step.ok ? "OK" : "FAIL"} · {step.name}</span>
                    <code>{step.stderr || step.stdout || step.command}</code>
                  </div>
                ))}
              </div>
            )}
          </details>
        </div>
        <div className="mention-row">
          {[
            ["current-sheet", "@sheet"],
            ["selection", "@selection"],
            ["project-outline", "@project"],
            ["materials", "@materials"],
            ["all-sheets", "@all"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              className={clsx(mentionModes.includes(mode as MentionMode) && "active")}
              onClick={() => toggleMentionMode(mode as MentionMode, mentionModes, onMentionModesChange)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="context-sheet-picker">
          <div className="context-sheet-picker-header">
            <span>@cards</span>
            <button className="text-button" onClick={() => onSelectedContextSheetIdsChange([])} disabled={selectedContextSheetIds.length === 0}>
              清空
            </button>
          </div>
          <div className="context-sheet-list">
            {contextSheets.map((sheet) => (
              <label key={sheet.id} className={clsx("context-sheet-row", selectedContextSheetIds.includes(sheet.id) && "selected")}>
                <input
                  type="checkbox"
                  checked={selectedContextSheetIds.includes(sheet.id)}
                  onChange={() =>
                    onSelectedContextSheetIdsChange(
                      selectedContextSheetIds.includes(sheet.id)
                        ? selectedContextSheetIds.filter((id) => id !== sheet.id)
                        : [...selectedContextSheetIds, sheet.id],
                    )
                  }
                />
                <span>
                  <strong>{sheet.title}</strong>
                  <small>{sheet.type} · {sheet.status}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="slash-help">
          {slashCommands.map((command) => (
            <button key={command.name} onClick={() => onInputChange(command.name)}>
              {command.name}
            </button>
          ))}
        </div>
        <div className="skill-strip">
          {skills.slice(0, 12).map((skill) => (
            <button
              key={`${skill.id}-${skill.path}`}
              className={clsx(selectedSkillIds.includes(skill.id) && "active")}
              title={skill.description || skill.path}
              onClick={() => toggleSkill(skill.id, selectedSkillIds, onSelectedSkillIdsChange)}
            >
              ${skill.name}
            </button>
          ))}
          {skills.length === 0 && <span>未发现本机 Codex skills</span>}
        </div>
        <div className="skill-task-actions">
          <button className="secondary-button full-width" onClick={onCreateSkillTasks} disabled={selectedSkillIds.length === 0 && !input.includes("$")}>
            <Save size={16} /> 写入本地 skill 任务
          </button>
          <small>{skillTaskStatus || "任务会保存到当前写作库的 ai-tasks/，供 Codex CLI 或 skill runner 读取。"}</small>
        </div>
        <div className="resource-path-card">
          <div className="resource-card-header">
            <strong>项目资源目录</strong>
            {resourcePaths && (
              <button className="text-button" onClick={() => onOpenResourcePath(resourcePaths.project, "项目目录")}>
                打开项目
              </button>
            )}
          </div>
          {resourcePaths ? (
            <>
              <code>{resourcePaths.project}</code>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.assets, "素材目录")}>
                <small>assets: {resourcePaths.assets}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.references, "参考目录")}>
                <small>references: {resourcePaths.references}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.exports, "导出目录")}>
                <small>exports: {resourcePaths.exports}</small>
              </button>
            </>
          ) : (
            <small>浏览器开发模式没有可写项目目录；请在 Tauri 桌面运行时使用。</small>
          )}
        </div>
        <div className="resource-file-picker">
          <div className="context-sheet-picker-header">
            <span>@resources</span>
            <div className="resource-actions">
              <button className="text-button" onClick={onImportAssets}>
                导入素材
              </button>
              <button className="text-button" onClick={onImportReferences}>
                导入参考
              </button>
              <button className="text-button" onClick={() => onSelectedResourcePathsChange([])} disabled={selectedResourcePaths.length === 0}>
                清空
              </button>
            </div>
          </div>
          {resourceImportStatus && <p className="muted-text resource-import-status">{resourceImportStatus}</p>}
          <p className="muted-text resource-import-status">文本资源会读取内容片段；图片、PDF 等非文本资源只提供路径。</p>
          <div className="resource-file-list">
            {projectResources.map((resource) => (
              <label key={resource.path} className={clsx("resource-file-row", selectedResourcePaths.includes(resource.path) && "selected")}>
                <input
                  type="checkbox"
                  checked={selectedResourcePaths.includes(resource.path)}
                  onChange={() =>
                    onSelectedResourcePathsChange(
                      selectedResourcePaths.includes(resource.path)
                        ? selectedResourcePaths.filter((path) => path !== resource.path)
                        : [...selectedResourcePaths, resource.path],
                    )
                  }
                />
                <span>
                  <strong>{resource.name}</strong>
                  <small>{resource.kind} · {formatBytes(resource.sizeBytes)}</small>
                </span>
                <span className="resource-row-actions">
                  <button
                    className="text-button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onPreviewResource(resource);
                    }}
                    disabled={resourcePreviewBusy}
                  >
                    预览
                  </button>
                  <button
                    className="text-button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenResourcePath(resource.path, resource.name);
                    }}
                  >
                    打开
                  </button>
                </span>
              </label>
            ))}
            {projectResources.length === 0 && <small className="muted-text">assets / references / exports 里还没有文件。</small>}
          </div>
          {resourcePreview && (
            <div className="resource-preview">
              <div className="resource-preview-header">
                <strong>{resourcePreview.name}</strong>
                <button className="text-button" onClick={onClearResourcePreview}>
                  关闭
                </button>
              </div>
              <small>
                {resourcePreview.status} · {formatBytes(resourcePreview.sizeBytes)}
                {resourcePreview.truncated ? " · 已截断" : ""}
              </small>
              {resourcePreview.status === "loaded" ? (
                <pre>{resourcePreview.content.trim() || "(空文件)"}</pre>
              ) : (
                <p className="muted-text">这个资源不能作为文本预览，发送给 Codex 时会保留路径。</p>
              )}
            </div>
          )}
        </div>
        <div className="chat-messages">
          {messages.map((message) => (
            <article key={message.id} className={clsx("chat-message", `chat-${message.role}`)}>
              <div className="chat-role">{message.role === "user" ? "你" : message.role === "assistant" ? "Codex" : "系统"}</div>
              <p>{message.content}</p>
              {message.command && <small>{message.command}</small>}
            </article>
          ))}
          {busy && (
            <article className="chat-message chat-system">
              <div className="chat-role">系统</div>
              <p>Codex CLI 正在处理...</p>
            </article>
          )}
        </div>
        <textarea
          className="chat-input"
          value={input}
          placeholder="问 Codex：帮我看看这段结构、润色当前选区、生成标题方向..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <div className="button-row">
          <button className="secondary-button" onClick={onQuickStructure} disabled={busy}>
            结构建议
          </button>
          <button className="secondary-button" onClick={onQuickPolish} disabled={busy}>
            润色选区
          </button>
          <button className="primary-button" onClick={onSend} disabled={busy || !input.trim()}>
            发送
          </button>
        </div>
      </section>

      <section className="panel-section">
        <h2>本地审阅工具</h2>
        <button className="action-row" onClick={onCodexInlineEdit} disabled={busy}>
          <Bot size={16} />
          <span>
            <strong>Codex 改写选区</strong>
            <small>调用 CLI，返回后进入 diff 审阅</small>
          </span>
        </button>
        <button className="action-row" onClick={onPolish}>
          <Sparkles size={16} />
          <span>
            <strong>生成本地润色 diff</strong>
            <small>不用调用 CLI，验证审阅交互</small>
          </span>
        </button>
        <button className="action-row" onClick={onTitle}>
          <PenLine size={16} />
          <span>
            <strong>生成标题备选</strong>
            <small>基于当前稿件卡片生成 3 个方向</small>
          </span>
        </button>
        <button className="action-row" onClick={onSummary}>
          <FileText size={16} />
          <span>
            <strong>总结当前稿件</strong>
            <small>提取主题、结构和下一步写作缺口</small>
          </span>
        </button>
        <button className="action-row" onClick={onImageIdeas}>
          <Image size={16} />
          <span>
            <strong>生成配图构思</strong>
            <small>生成封面、正文图和素材卡方向</small>
          </span>
        </button>
      </section>

      {suggestion && (
        <section className="panel-section suggestion">
          <h2>{suggestion.title}</h2>
          {isNoteSuggestion ? (
            <pre className="note-suggestion">{suggestion.result}</pre>
          ) : (
            <div className="diff-view" aria-label="AI 建议差异">
              {diffLines.map((line) => (
                <div key={line.id} className={clsx("diff-line", `diff-${line.kind}`)}>
                  <span>{line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}</span>
                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>
          )}
          <div className="button-row">
            {isNoteSuggestion && (
              <button className="primary-button" onClick={onSaveNote}>
                <Save size={16} /> 保存为素材卡片
              </button>
            )}
            {!isNoteSuggestion && (
              <button className="primary-button" onClick={onAccept}>
                <Check size={16} /> 接受
              </button>
            )}
            <button className="secondary-button" onClick={onReject}>
              {isNoteSuggestion ? "关闭" : "拒绝"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ResourcePanel({
  resourcePaths,
  projectResources,
  selectedResourcePaths,
  resourceImportStatus,
  resourcePreview,
  resourcePreviewBusy,
  onSelectedResourcePathsChange,
  onImportAssets,
  onImportReferences,
  onOpenResourcePath,
  onPreviewResource,
  onClearResourcePreview,
}: {
  resourcePaths: ProjectResourcePaths | null;
  projectResources: ProjectResourceFile[];
  selectedResourcePaths: string[];
  resourceImportStatus: string;
  resourcePreview: ProjectResourceText | null;
  resourcePreviewBusy: boolean;
  onSelectedResourcePathsChange: (paths: string[]) => void;
  onImportAssets: () => void;
  onImportReferences: () => void;
  onOpenResourcePath: (path: string, label: string) => void;
  onPreviewResource: (resource: ProjectResourceFile) => void;
  onClearResourcePreview: () => void;
}) {
  return (
    <div className="panel-stack">
      <section className="panel-section">
        <h2>项目资源</h2>
        <div className="resource-path-card">
          <div className="resource-card-header">
            <strong>本地目录</strong>
            {resourcePaths && (
              <button className="text-button" onClick={() => onOpenResourcePath(resourcePaths.project, "项目目录")}>
                打开项目
              </button>
            )}
          </div>
          {resourcePaths ? (
            <>
              <code>{resourcePaths.project}</code>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.assets, "素材目录")}>
                <small>assets: {resourcePaths.assets}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.references, "参考目录")}>
                <small>references: {resourcePaths.references}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.exports, "导出目录")}>
                <small>exports: {resourcePaths.exports}</small>
              </button>
            </>
          ) : (
            <small>浏览器开发模式没有可写项目目录；请在 Tauri 桌面运行时使用。</small>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h2>资源文件</h2>
        <div className="resource-actions standalone-resource-actions">
          <button className="secondary-button" onClick={onImportAssets}>
            导入素材
          </button>
          <button className="secondary-button" onClick={onImportReferences}>
            导入参考
          </button>
          <button className="secondary-button" onClick={() => onSelectedResourcePathsChange([])} disabled={selectedResourcePaths.length === 0}>
            清空 AI 选择
          </button>
        </div>
        {resourceImportStatus && <p className="muted-text resource-import-status">{resourceImportStatus}</p>}
        <p className="muted-text resource-import-status">勾选资源会同步到 AI 面板的 @resources 上下文。</p>
        <div className="resource-file-list">
          {projectResources.map((resource) => (
            <label key={resource.path} className={clsx("resource-file-row", selectedResourcePaths.includes(resource.path) && "selected")}>
              <input
                type="checkbox"
                checked={selectedResourcePaths.includes(resource.path)}
                onChange={() =>
                  onSelectedResourcePathsChange(
                    selectedResourcePaths.includes(resource.path)
                      ? selectedResourcePaths.filter((path) => path !== resource.path)
                      : [...selectedResourcePaths, resource.path],
                  )
                }
              />
              <span>
                <strong>{resource.name}</strong>
                <small>{resource.kind} · {formatBytes(resource.sizeBytes)}</small>
              </span>
              <span className="resource-row-actions">
                <button
                  className="text-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreviewResource(resource);
                  }}
                  disabled={resourcePreviewBusy}
                >
                  预览
                </button>
                <button
                  className="text-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenResourcePath(resource.path, resource.name);
                  }}
                >
                  打开
                </button>
              </span>
            </label>
          ))}
          {projectResources.length === 0 && <small className="muted-text">assets / references / exports 里还没有文件。</small>}
        </div>
        {resourcePreview && (
          <div className="resource-preview">
            <div className="resource-preview-header">
              <strong>{resourcePreview.name}</strong>
              <button className="text-button" onClick={onClearResourcePreview}>
                关闭
              </button>
            </div>
            <small>
              {resourcePreview.status} · {formatBytes(resourcePreview.sizeBytes)}
              {resourcePreview.truncated ? " · 已截断" : ""}
            </small>
            {resourcePreview.status === "loaded" ? (
              <pre>{resourcePreview.content.trim() || "(空文件)"}</pre>
            ) : (
              <p className="muted-text">这个资源不能作为文本预览；图片、PDF 等文件可用系统查看器打开。</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ExportPanel({
  project,
  publishableSheets,
  selectedSheetIds,
  markdown,
  html,
  htmlBusy,
  plainText,
  wechatHtml,
  xhsDraft,
  saveStatus,
  onToggleSheet,
  onMoveSheet,
  onTogglePublishingChecklistItem,
  onSelectAll,
  onSelectNone,
  onCreatePublishVersion,
  onDownloadMarkdown,
  onDownloadHtml,
  onDownloadPlainText,
  onDownloadWechatHtml,
  onDownloadXhsDraft,
  onSaveMarkdown,
  onSaveHtml,
  onSavePlainText,
  onSaveWechatHtml,
  onSaveXhsDraft,
  onCopyMarkdown,
  onCopyHtml,
  onCopyWechatHtml,
  onCopyXhsDraft,
  onOpenPrintPreview,
}: {
  project: WritingProject;
  publishableSheets: WritingSheet[];
  selectedSheetIds: string[];
  markdown: string;
  html: string;
  htmlBusy: boolean;
  plainText: string;
  wechatHtml: string;
  xhsDraft: string;
  saveStatus: string;
  onToggleSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onTogglePublishingChecklistItem: (itemId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onCreatePublishVersion: () => void;
  onDownloadMarkdown: () => void;
  onDownloadHtml: () => void;
  onDownloadPlainText: () => void;
  onDownloadWechatHtml: () => void;
  onDownloadXhsDraft: () => void;
  onSaveMarkdown: () => void;
  onSaveHtml: () => void;
  onSavePlainText: () => void;
  onSaveWechatHtml: () => void;
  onSaveXhsDraft: () => void;
  onCopyMarkdown: () => void;
  onCopyHtml: () => void;
  onCopyWechatHtml: () => void;
  onCopyXhsDraft: () => void;
  onOpenPrintPreview: () => void;
}) {
  const selectedSheets = selectedSheetIds.map((id) => publishableSheets.find((sheet) => sheet.id === id)).filter((sheet): sheet is WritingSheet => Boolean(sheet));
  const unselectedSheets = publishableSheets.filter((sheet) => !selectedSheetIds.includes(sheet.id));
  const selectedWordCount = selectedSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
  const hasHeading = selectedSheets.some((sheet) => /^#\s+.+/m.test(sheet.body));
  const readinessChecklist = [
    { label: "已选择发布卡片", ok: selectedSheets.length > 0 },
    { label: "正文有标题结构", ok: hasHeading },
    { label: "合并字数不为空", ok: selectedWordCount > 0 },
    { label: "目标平台已设置", ok: project.targetPlatform.trim() !== "" && project.targetPlatform !== "未指定" },
  ];
  const publishingChecklist = getPublishingChecklist(project);
  const finishedPublishingTasks = publishingChecklist.filter((item) => item.done).length;

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <h2>组合输出</h2>
        <div className="metric-row">
          <span>已选卡片</span>
          <strong>{selectedSheets.length} / {publishableSheets.length}</strong>
        </div>
        <div className="metric-row">
          <span>合并字数</span>
          <strong>{selectedWordCount}</strong>
        </div>
        <div className="metric-row">
          <span>素材卡片</span>
          <strong>{project.sheets.length - publishableSheets.length}</strong>
        </div>
        <div className="button-row export-actions">
          <button className="secondary-button" onClick={onSelectAll}>
            全选
          </button>
          <button className="secondary-button" onClick={onSelectNone}>
            清空
          </button>
        </div>
        <div className="export-sheet-list" aria-label="选择并排序要导出的稿件卡片">
          {selectedSheets.map((sheet, index) => (
            <div key={sheet.id} className="export-sheet-row selected">
              <label>
                <input
                  type="checkbox"
                  checked
                  onChange={() => onToggleSheet(sheet.id)}
                />
                <span>
                  <strong>{index + 1}. {sheet.title}</strong>
                  <small>{sheet.type} · {sheet.status} · {countWords(sheet.body)} 字</small>
                </span>
              </label>
              <div className="export-order-actions">
                <button className="icon-button" onClick={() => onMoveSheet(sheet.id, -1)} disabled={index === 0} title="上移导出顺序">
                  <ChevronUp size={14} />
                </button>
                <button className="icon-button" onClick={() => onMoveSheet(sheet.id, 1)} disabled={index === selectedSheets.length - 1} title="下移导出顺序">
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          ))}
          {unselectedSheets.length > 0 && <p className="export-list-label">未选择</p>}
          {unselectedSheets.map((sheet) => (
            <div key={sheet.id} className="export-sheet-row">
              <label>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onToggleSheet(sheet.id)}
                />
                <span>
                  <strong>{sheet.title}</strong>
                  <small>{sheet.type} · {sheet.status} · {countWords(sheet.body)} 字</small>
                </span>
              </label>
            </div>
          ))}
          {publishableSheets.length === 0 && <p className="muted-text">当前项目没有可发布卡片。</p>}
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={onDownloadMarkdown} disabled={selectedSheets.length === 0}>
            <Download size={16} /> Markdown
          </button>
          <button className="secondary-button" onClick={onDownloadHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
            {htmlBusy ? "HTML 生成中" : "HTML"}
          </button>
        </div>
        <div className="button-row export-actions">
          <button className="secondary-button" onClick={onDownloadPlainText} disabled={selectedSheets.length === 0}>
            纯文本
          </button>
          <button className="secondary-button" onClick={onDownloadWechatHtml} disabled={selectedSheets.length === 0}>
            公众号 HTML
          </button>
          <button className="secondary-button" onClick={onDownloadXhsDraft} disabled={selectedSheets.length === 0}>
            小红书草稿
          </button>
        </div>
        <div className="export-save-block">
          <p className="muted-text">复制 / 打印</p>
          <div className="button-row export-actions">
            <button className="secondary-button" onClick={onCopyMarkdown} disabled={selectedSheets.length === 0}>
              <Copy size={16} /> MD
            </button>
            <button className="secondary-button" onClick={onCopyHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
              HTML
            </button>
            <button className="secondary-button" onClick={onCopyWechatHtml} disabled={selectedSheets.length === 0}>
              公众号
            </button>
            <button className="secondary-button" onClick={onCopyXhsDraft} disabled={selectedSheets.length === 0}>
              小红书
            </button>
            <button className="secondary-button" onClick={onOpenPrintPreview} disabled={selectedSheets.length === 0 || htmlBusy}>
              <Printer size={16} /> PDF
            </button>
          </div>
        </div>
        <div className="export-save-block">
          <p className="muted-text">保存到项目 exports</p>
          <div className="button-row export-actions">
            <button className="secondary-button" onClick={onSaveMarkdown} disabled={selectedSheets.length === 0}>
              <Save size={16} /> MD
            </button>
            <button className="secondary-button" onClick={onSaveHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
              HTML
            </button>
            <button className="secondary-button" onClick={onSavePlainText} disabled={selectedSheets.length === 0}>
              TXT
            </button>
            <button className="secondary-button" onClick={onSaveWechatHtml} disabled={selectedSheets.length === 0}>
              公众号
            </button>
            <button className="secondary-button" onClick={onSaveXhsDraft} disabled={selectedSheets.length === 0}>
              小红书
            </button>
          </div>
          {saveStatus && <p className="muted-text export-save-status">{saveStatus}</p>}
        </div>
      </section>

      <section className="panel-section">
        <h2>发布检查</h2>
        <div className="publish-checklist">
          {readinessChecklist.map((item) => (
            <div key={item.label} className={clsx("checklist-row", item.ok && "checked")}>
              <span>{item.ok ? "✓" : "!"}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
        <div className="publishing-task-header">
          <strong>发布任务</strong>
          <small>{finishedPublishingTasks} / {publishingChecklist.length}</small>
        </div>
        <div className="publish-task-list">
          {publishingChecklist.map((item) => (
            <label key={item.id} className={clsx("publish-task-row", item.done && "checked")}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onTogglePublishingChecklistItem(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <button className="primary-button full-width" onClick={onCreatePublishVersion} disabled={selectedSheets.length === 0}>
          <FilePlus2 size={16} /> 保存为发布版本
        </button>
      </section>

      <section className="panel-section export-preview">
        <h2>Markdown 预览</h2>
        <pre>{markdown.slice(0, 1600)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>HTML 预览</h2>
        <pre>{htmlBusy ? "HTML 正在生成..." : html.slice(0, 1000)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>公众号 HTML</h2>
        <pre>{wechatHtml.slice(0, 1200)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>小红书拆条</h2>
        <pre>{xhsDraft.slice(0, 1200)}</pre>
      </section>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function createDefaultProjectGroups(): ProjectGroup[] {
  return [
    {
      id: DEFAULT_CONTENT_GROUP_ID,
      title: "正文",
      description: "正式文章、章节和可组合文稿。",
    },
    {
      id: DEFAULT_MATERIAL_GROUP_ID,
      title: "素材",
      description: "参考资料、灵感、AI 笔记和不参与正文的内容。",
    },
  ];
}

function getDefaultGroupIdForSheetType(type: SheetType): string {
  return type === "素材" ? DEFAULT_MATERIAL_GROUP_ID : DEFAULT_CONTENT_GROUP_ID;
}

function normalizeProjects(projects: WritingProject[]): WritingProject[] {
  return projects.map(normalizeProject);
}

function normalizeProject(project: WritingProject): WritingProject {
  const groups = ensureProjectGroups(project);
  return {
    ...project,
    groups,
    sheets: project.sheets.map((sheet) => ({
      ...sheet,
      groupId: sheet.groupId || getDefaultGroupIdForSheetType(sheet.type),
    })),
  };
}

function ensureProjectGroups(project: WritingProject): ProjectGroup[] {
  const defaults = createDefaultProjectGroups();
  const byId = new Map(defaults.map((group) => [group.id, group]));
  for (const group of project.groups ?? []) {
    byId.set(group.id, {
      ...group,
      title: group.title.trim() || "未命名分组",
    });
  }
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId || getDefaultGroupIdForSheetType(sheet.type);
    if (!byId.has(groupId)) {
      byId.set(groupId, {
        id: groupId,
        title: sheet.type === "素材" ? "素材" : "正文",
      });
    }
  }
  return Array.from(byId.values());
}

function getProjectGroups(project: WritingProject): ProjectGroup[] {
  return ensureProjectGroups(project);
}

function resolveProjectGroupId(project: WritingProject, preferredGroupId: string, sheetId = ""): string {
  const groups = getProjectGroups(project);
  if (preferredGroupId && groups.some((group) => group.id === preferredGroupId)) return preferredGroupId;
  const sheet = project.sheets.find((item) => item.id === sheetId);
  if (sheet?.groupId && groups.some((group) => group.id === sheet.groupId)) return sheet.groupId;
  const firstSheetGroupId = project.sheets[0]?.groupId;
  if (firstSheetGroupId && groups.some((group) => group.id === firstSheetGroupId)) return firstSheetGroupId;
  return groups[0]?.id ?? DEFAULT_CONTENT_GROUP_ID;
}

function getSheetsInGroup(project: WritingProject, groupId: string): WritingSheet[] {
  return project.sheets.filter((sheet) => (sheet.groupId || getDefaultGroupIdForSheetType(sheet.type)) === groupId);
}

function getProjectGroupCounts(project: WritingProject): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of getProjectGroups(project)) counts.set(group.id, 0);
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId || getDefaultGroupIdForSheetType(sheet.type);
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  return counts;
}

function getProjectGroupWordCounts(project: WritingProject): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of getProjectGroups(project)) counts.set(group.id, 0);
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId || getDefaultGroupIdForSheetType(sheet.type);
    counts.set(groupId, (counts.get(groupId) ?? 0) + countWords(sheet.body));
  }
  return counts;
}

function ensureGroupExists(groups: ProjectGroup[], groupId: string, title: string): ProjectGroup[] {
  if (groups.some((group) => group.id === groupId)) return groups;
  return [...groups, { id: groupId, title }];
}

function ensureMaterialGroup(project: WritingProject): ProjectGroup {
  return getProjectGroups(project).find((group) => group.id === DEFAULT_MATERIAL_GROUP_ID) ?? createDefaultProjectGroups()[1];
}

function getPublishingChecklist(project: WritingProject): PublishingChecklistItem[] {
  const existing = project.publishingChecklist ?? [];
  const byId = new Map(existing.map((item) => [item.id, item]));
  const mergedDefaults = DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({
    ...item,
    done: byId.get(item.id)?.done ?? item.done,
  }));
  const customItems = existing.filter((item) => !DEFAULT_PUBLISHING_CHECKLIST.some((defaultItem) => defaultItem.id === item.id));
  return [...mergedDefaults, ...customItems];
}

function getWritingBrief(project: WritingProject): ProjectWritingBrief {
  return {
    ...DEFAULT_WRITING_BRIEF,
    ...(project.writingBrief ?? {}),
  };
}

function getProjectFilterCounts(projects: WritingProject[]): Record<ProjectFilter, number> {
  return {
    active: projects.filter((project) => matchesProjectFilter(project, "active")).length,
    today: projects.filter((project) => matchesProjectFilter(project, "today")).length,
    published: projects.filter((project) => matchesProjectFilter(project, "published")).length,
    archived: projects.filter((project) => matchesProjectFilter(project, "archived")).length,
  };
}

function resolveSavedProjectSelection(
  projects: WritingProject[],
  savedProjectId: string,
  savedSheetId: string,
): { projectId: string; sheetId: string } {
  const project = projects.find((item) => item.id === savedProjectId) ?? projects[0];
  const sheet = project?.sheets.find((item) => item.id === savedSheetId) ?? project?.sheets[0];
  return {
    projectId: project?.id ?? "",
    sheetId: sheet?.id ?? "",
  };
}

function getProjectTagCounts(projects: WritingProject[], filter: ProjectFilter): [string, number][] {
  const counts = new Map<string, number>();
  projects
    .filter((project) => matchesProjectFilter(project, filter))
    .forEach((project) => {
      project.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
}

function filterProjects(projects: WritingProject[], filter: ProjectFilter, search: string, selectedTag: string): WritingProject[] {
  const normalizedSearch = search.trim().toLowerCase();
  return projects.filter((project) => {
    if (!matchesProjectFilter(project, filter)) return false;
    if (selectedTag && !project.tags.includes(selectedTag)) return false;
    if (!normalizedSearch) return true;
    const writingBrief = getWritingBrief(project);
    const searchable = [
      project.title,
      project.description,
      project.status,
      project.targetPlatform,
      writingBrief.audience,
      writingBrief.thesis,
      writingBrief.tone,
      writingBrief.publishingNotes,
      project.tags.join(" "),
      ...project.sheets.map((sheet) => `${sheet.title} ${sheet.summary} ${sheet.status} ${sheet.type}`),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

function sortProjects(projects: WritingProject[], sort: ProjectSort): WritingProject[] {
  return [...projects].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "zh-CN");
    if (sort === "word-count") return projectWordCount(b) - projectWordCount(a);
    if (sort === "progress") return projectProgress(b) - projectProgress(a) || projectWordCount(b) - projectWordCount(a);
    return projectUpdatedValue(b) - projectUpdatedValue(a);
  });
}

function projectUpdatedValue(project: WritingProject): number {
  const values = [
    Date.parse(project.updatedAt),
    ...project.sheets.map((sheet) => Date.parse(sheet.updatedAt)),
  ].filter((value) => !Number.isNaN(value));
  return values.length > 0 ? Math.max(...values) : 0;
}

function matchesProjectFilter(project: WritingProject, filter: ProjectFilter): boolean {
  if (filter === "published") return project.status === "已发布";
  if (filter === "archived") return project.status === "已归档";
  if (filter === "today") {
    const currentDay = today();
    return project.updatedAt === currentDay || project.sheets.some((sheet) => sheet.updatedAt === currentDay);
  }
  return project.status !== "已归档";
}

function buildProjectResourcePaths(libraryPath: string, projectId: string): ProjectResourcePaths | null {
  if (!libraryPath.startsWith("/")) return null;
  const project = `${libraryPath}/projects/${projectId}`;
  return {
    project,
    assets: `${project}/assets`,
    references: `${project}/references`,
    exports: `${project}/exports`,
  };
}

function buildSheetMarkdownPath(libraryPath: string, projectId: string, sheetId: string): string {
  return `${libraryPath}/projects/${projectId}/sheets/${sheetId}.md`;
}

function getNextProjectStatus(status: ProjectStatus): ProjectStatus | null {
  const index = PROJECT_STATUS_FLOW.indexOf(status);
  if (index < 0 || index >= PROJECT_STATUS_FLOW.length - 1) return null;
  return PROJECT_STATUS_FLOW[index + 1];
}

function getSheetTypeCounts(sheets: WritingSheet[]): Map<SheetTypeFilter, number> {
  const counts = new Map<SheetTypeFilter, number>([["全部", sheets.length]]);
  for (const type of SHEET_TYPE_FILTERS) {
    if (type === "全部") continue;
    counts.set(type, sheets.filter((sheet) => sheet.type === type).length);
  }
  return counts;
}

function filterSheets(sheets: WritingSheet[], typeFilter: SheetTypeFilter, search: string): WritingSheet[] {
  const normalizedSearch = search.trim().toLowerCase();
  return sheets.filter((sheet) => {
    if (typeFilter !== "全部" && sheet.type !== typeFilter) return false;
    if (!normalizedSearch) return true;
    return [sheet.title, sheet.summary, sheet.type, sheet.status, sheet.body]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

function getSheetStatusGroups(sheets: WritingSheet[]): { status: ProjectStatus; sheets: WritingSheet[]; wordCount: number }[] {
  return PROJECT_STATUS_FLOW.map((status) => {
    const groupSheets = sheets.filter((sheet) => sheet.status === status);
    return {
      status,
      sheets: groupSheets,
      wordCount: groupSheets.reduce((total, sheet) => total + countWords(sheet.body), 0),
    };
  }).filter((group) => group.sheets.length > 0);
}

function getSheetHeadings(markdownSource: string): SheetHeading[] {
  return markdownSource
    .split("\n")
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      return {
        id: `${index + 1}-${match[2]}`,
        level: match[1].length,
        text: match[2].replace(/\s+#+$/, "").trim(),
        line: index + 1,
      };
    })
    .filter((heading): heading is SheetHeading => heading !== null);
}

function deriveImportedSheetTitle(filename: string, body: string): string {
  const withoutFrontmatter = body.replace(/^---\n[\s\S]*?\n---\n+/, "");
  const heading = withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s+#+$/, "").trim();
  if (heading) return heading;
  const basename = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return basename || "导入稿件";
}

function buildImportedMarkdownSheets(files: ImportedMarkdownFile[], groupId = DEFAULT_CONTENT_GROUP_ID): WritingSheet[] {
  const timestamp = Date.now();
  return files.map((file, index) => {
    const body = file.content.trimStart();
    const title = deriveImportedSheetTitle(file.name, body);
    return {
      id: `sheet-import-${timestamp}-${index}`,
      title,
      groupId,
      type: "正文",
      status: "构思",
      targetWords: Math.max(800, countWords(body)),
      summary: `从 ${file.name} 导入。`,
      body: body || `# ${title}\n\n`,
      updatedAt: today(),
    };
  });
}

function formatSnapshotTime(value: string): string {
  return formatDateTime(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getEditorSelection(view: EditorView | null): string {
  if (!view) return "";
  const range = view.state.selection.main;
  if (range.empty) return "";
  return view.state.sliceDoc(range.from, range.to);
}

function getEditorSelectionRange(view: EditorView | null): { from: number; to: number } | null {
  if (!view) return null;
  const range = view.state.selection.main;
  if (range.empty) return null;
  return { from: range.from, to: range.to };
}

function buildLocalSheetSummary(sheet: WritingSheet): string {
  const headings = getSheetHeadings(sheet.body).slice(0, 6);
  const plainParagraphs = getPlainParagraphs(sheet.body);
  const stats = sheetStats(sheet);
  const opening = plainParagraphs[0] ?? sheet.summary;
  const nextGap = headings.length === 0 ? "补出清晰的 Markdown 标题结构" : "检查各标题之间的转场和论证顺序";

  return [
    "## 稿件摘要",
    "",
    `- 标题：${sheet.title}`,
    `- 类型：${sheet.type}`,
    `- 状态：${sheet.status}`,
    `- 字数：${countWords(sheet.body)} / ${sheet.targetWords}`,
    `- 段落：${stats.paragraphs}，标题：${stats.headings}，预计阅读：${stats.readingMinutes} 分钟`,
    "",
    "## 一句话概括",
    "",
    opening ? `这张卡片目前主要在表达：${opening.slice(0, 120)}${opening.length > 120 ? "..." : ""}` : "这张卡片还没有足够正文，需要先补充核心观点。",
    "",
    "## 当前结构",
    "",
    headings.length > 0
      ? headings.map((heading) => `${"  ".repeat(Math.max(0, heading.level - 1))}- H${heading.level} ${heading.text}`).join("\n")
      : "- 暂无标题结构",
    "",
    "## 下一步",
    "",
    `- ${nextGap}`,
    "- 检查每一段是否服务于同一个写作目标",
    "- 如果准备发布，补充结尾的行动或观点收束",
  ].join("\n");
}

function buildLocalImageIdeas(project: WritingProject, sheet: WritingSheet): string {
  const keywords = Array.from(new Set([...project.tags, sheet.type, project.targetPlatform].filter(Boolean))).slice(0, 5);
  const title = sheet.title.replace(/^#+\s*/, "");
  const summary = sheet.summary || getPlainParagraphs(sheet.body)[0] || project.description;

  return [
    "## 配图构思",
    "",
    `- 项目：${project.title}`,
    `- 当前稿件：${title}`,
    `- 发布平台：${project.targetPlatform || "未指定"}`,
    `- 关键词：${keywords.join(" / ") || "写作 / 观点 / 结构"}`,
    "",
    "## 封面方向",
    "",
    `1. 干净白底编辑感封面：以「${title}」为核心视觉，使用简洁桌面、纸张、光标或写作工具元素，保留大量留白。`,
    `2. 概念型封面：把主题抽象成一个清晰物件或场景，例如从碎片笔记整理成完整稿件的过程。`,
    "3. 专业工具感封面：突出本地文件、Markdown、AI 辅助和发布流程，但不要做成科技感仪表盘。",
    "",
    "## 正文配图位置",
    "",
    "- 开头后：放一张主题概念图，帮助读者进入语境。",
    "- 结构转折处：放流程图或步骤图，承接论证层次。",
    "- 发布准备前：放清单式图像，强化可执行感。",
    "",
    "## 可交给生图技能的提示词",
    "",
    [
      "clean white Apple-style editorial cover image",
      `topic: ${title}`,
      summary ? `context: ${summary.slice(0, 140)}` : "",
      "minimal, fresh, professional writing software aesthetic",
      "white and light gray surfaces, subtle blue accent, no clutter, no dark dashboard",
    ]
      .filter(Boolean)
      .join(", "),
  ].join("\n");
}

function getPlainParagraphs(markdownSource: string): string[] {
  return markdownSource
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim(),
    )
    .filter(Boolean);
}

function applyEditorMarkdownFormat(view: EditorView | null, format: MarkdownFormat) {
  if (!view) return;
  if (format === "bold") {
    wrapEditorSelection(view, "**", "加粗文本");
    return;
  }
  if (format === "italic") {
    wrapEditorSelection(view, "*", "斜体文本");
    return;
  }
  if (format === "link") {
    insertMarkdownLink(view);
    return;
  }
  if (format === "code") {
    wrapEditorSelection(view, "`", "code");
    return;
  }
  if (format === "divider") {
    insertMarkdownDivider(view);
    return;
  }
  formatEditorLines(view, format);
}

function wrapEditorSelection(view: EditorView, marker: string, placeholder: string) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const content = selected || placeholder;
  const replacement = `${marker}${content}${marker}`;
  const contentFrom = range.from + marker.length;
  const contentTo = contentFrom + content.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    selection: selected ? EditorSelection.cursor(range.from + replacement.length) : EditorSelection.range(contentFrom, contentTo),
  });
  view.focus();
}

function insertMarkdownLink(view: EditorView) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const label = selected || "链接文字";
  const url = "https://";
  const replacement = `[${label}](${url})`;
  const labelFrom = range.from + 1;
  const labelTo = labelFrom + label.length;
  const urlFrom = range.from + replacement.length - url.length - 1;
  const urlTo = urlFrom + url.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    selection: selected ? EditorSelection.range(urlFrom, urlTo) : EditorSelection.range(labelFrom, labelTo),
  });
  view.focus();
}

function insertMarkdownDivider(view: EditorView) {
  const range = view.state.selection.main;
  const line = view.state.doc.lineAt(range.from);
  const lineIsBlank = line.text.trim() === "";
  const insertion = lineIsBlank ? "---" : "\n\n---\n\n";
  const from = lineIsBlank ? line.from : line.to;
  const to = lineIsBlank ? line.to : line.to;

  view.dispatch({
    changes: { from, to, insert: insertion },
    selection: EditorSelection.cursor(from + insertion.length),
  });
  view.focus();
}

async function loadSelectedResourceTexts(libraryPath: string, selectedResourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (selectedResourcePaths.length === 0) return [];
  try {
    return await readProjectResourceText(libraryPath, selectedResourcePaths);
  } catch (error) {
    return [
      {
        path: "resource-read",
        name: "resource-read",
        status: `read-failed: ${error instanceof Error ? error.message : String(error)}`,
        content: "",
        sizeBytes: 0,
        truncated: false,
      },
    ];
  }
}

function formatEditorLines(view: EditorView, format: Exclude<MarkdownFormat, "bold" | "italic" | "link" | "code" | "divider">) {
  const range = view.state.selection.main;
  const startLine = view.state.doc.lineAt(range.from);
  const rawEndLine = view.state.doc.lineAt(range.to);
  const endLine = range.to > range.from && range.to === rawEndLine.from ? view.state.doc.line(rawEndLine.number - 1) : rawEndLine;
  const lines: string[] = [];

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    lines.push(transformMarkdownLine(view.state.doc.line(lineNumber).text, format));
  }

  const replacement = lines.join("\n");
  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: replacement },
    selection: EditorSelection.range(startLine.from, startLine.from + replacement.length),
  });
  view.focus();
}

function transformMarkdownLine(line: string, format: Exclude<MarkdownFormat, "bold" | "italic" | "link" | "code" | "divider">): string {
  if (!line.trim()) return line;
  const trimmedLeft = line.trimStart();
  const leading = line.slice(0, line.length - trimmedLeft.length);

  if (format === "h1") return `${leading}# ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "h2") return `${leading}## ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "list") {
    return /^[-*+]\s+/.test(trimmedLeft)
      ? `${leading}${trimmedLeft.replace(/^[-*+]\s+/, "")}`
      : `${leading}- ${trimmedLeft.replace(/^>\s?/, "")}`;
  }
  if (format === "task") {
    return /^[-*+]\s+\[[ xX]\]\s+/.test(trimmedLeft)
      ? `${leading}${trimmedLeft.replace(/^[-*+]\s+\[[ xX]\]\s+/, "")}`
      : `${leading}- [ ] ${trimmedLeft.replace(/^>\s?/, "").replace(/^[-*+]\s+/, "")}`;
  }
  return /^>\s?/.test(trimmedLeft)
    ? `${leading}${trimmedLeft.replace(/^>\s?/, "")}`
    : `${leading}> ${trimmedLeft.replace(/^[-*+]\s+/, "")}`;
}

const markdownShortcutKeymap = [
  { key: "Mod-b", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "bold") },
  { key: "Mod-i", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "italic") },
  { key: "Mod-k", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "link") },
  { key: "Mod-e", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "code") },
  { key: "Mod-Alt-1", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "h1") },
  { key: "Mod-Alt-2", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "h2") },
  { key: "Mod-Shift-8", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "list") },
  { key: "Mod-Shift-9", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "quote") },
  { key: "Mod-Alt-t", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "task") },
];

function runMarkdownShortcut(view: EditorView, format: MarkdownFormat): boolean {
  applyEditorMarkdownFormat(view, format);
  return true;
}

function polishText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      if (line.startsWith("#")) return line;
      return line
        .replace(/很好的/g, "成熟的")
        .replace(/真正重要的/g, "更关键的")
        .replace(/应该/g, "需要")
        .replace(/这里写/g, "这里可以展开");
    })
    .join("\n");
}

function buildCodexContext(
  project: WritingProject,
  sheet: WritingSheet,
  selectedText: string,
  messages: ChatMessage[],
  mentionModes: MentionMode[],
  skills: CodexSkill[],
  selectedSheetIds: string[] = [],
  resourcePaths: ProjectResourcePaths | null = null,
  selectedResourcePaths: string[] = [],
  selectedResourceTexts: ProjectResourceText[] = [],
): string {
  const recentMessages = messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const writingBrief = getWritingBrief(project);

  return [
    `项目：${project.title}`,
    `项目状态：${project.status}`,
    `目标平台：${project.targetPlatform}`,
    `项目描述：${project.description}`,
    "写作简报：",
    `- 目标读者：${writingBrief.audience || "未填写"}`,
    `- 核心观点：${writingBrief.thesis || "未填写"}`,
    `- 语气风格：${writingBrief.tone || "未填写"}`,
    `- 发布备注：${writingBrief.publishingNotes || "未填写"}`,
    `当前稿件：${sheet.title}`,
    `稿件状态：${sheet.status}`,
    `稿件摘要：${sheet.summary}`,
    resourcePaths
      ? [
          "项目资源目录：",
          `project: ${resourcePaths.project}`,
          `assets: ${resourcePaths.assets}`,
          `references: ${resourcePaths.references}`,
          `exports: ${resourcePaths.exports}`,
        ].join("\n")
      : "",
    selectedResourcePaths.length > 0 ? `已选择资源文件：\n${selectedResourcePaths.map((path) => `- ${path}`).join("\n")}` : "",
    formatResourceTextContext(selectedResourceTexts),
    selectedText ? `当前选区：\n${selectedText}` : "当前没有选区。",
    buildMentionContext({ project, sheet, selectedText, modes: mentionModes, selectedSheetIds }),
    buildSkillContext(skills),
    recentMessages ? `最近对话：\n${recentMessages}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatResourceTextContext(resources: ProjectResourceText[]): string {
  if (resources.length === 0) return "";
  const loaded = resources.filter((resource) => resource.status === "loaded");
  const pathOnly = resources.filter((resource) => resource.status !== "loaded");
  const sections = [
    loaded.length > 0
      ? [
          "已读取文本资源内容：",
          ...loaded.map((resource) =>
            [
              `## ${resource.name}`,
              `path: ${resource.path}`,
              `size: ${formatBytes(resource.sizeBytes)}${resource.truncated ? "，内容已截断" : ""}`,
              "",
              "```text",
              resource.content.trim() || "(空文件)",
              "```",
            ].join("\n"),
          ),
        ].join("\n\n")
      : "",
    pathOnly.length > 0
      ? [
          "以下资源仅作为路径提供：",
          ...pathOnly.map((resource) => `- ${resource.name} · ${resource.status} · ${resource.path}`),
        ].join("\n")
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}

function toggleSkill(skillId: string, selectedSkillIds: string[], onChange: (skillIds: string[]) => void) {
  onChange(selectedSkillIds.includes(skillId) ? selectedSkillIds.filter((id) => id !== skillId) : [...selectedSkillIds, skillId]);
}

function toggleMentionMode(
  mode: MentionMode,
  mentionModes: MentionMode[],
  onChange: (modes: MentionMode[]) => void,
) {
  if (mode === "current-sheet") {
    onChange(["current-sheet"]);
    return;
  }

  const next = mentionModes.includes(mode)
    ? mentionModes.filter((item) => item !== mode)
    : [...mentionModes, mode];
  onChange(next.length > 0 ? next : ["current-sheet"]);
}

function createWelcomeConversation(id = "default", title = "默认对话"): ChatConversation {
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `${id}-welcome`,
        role: "assistant",
        content: "我是 Nibva 里的 Codex 写作助手。你可以让我基于当前稿件做结构建议、局部润色、标题方向、配图构思或发布准备。",
      },
    ],
  };
}

function deriveConversationTitle(content: string): string {
  const normalized = content
    .replace(/\s+/g, " ")
    .replace(/^\/\w+\s*/, "")
    .trim();
  if (!normalized) return "新对话";
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function loadAgentSettings(): AgentSettings {
  const fallback = defaultAgentSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      ...fallback,
      codexCliPath: parsed.codexCliPath ?? "",
      libraryPath: parsed.libraryPath ?? "",
      activeProjectId: parsed.activeProjectId ?? "",
      activeSheetId: parsed.activeSheetId ?? "",
      planMode: parsed.planMode ?? fallback.planMode,
      libraryRailOpen: parsed.libraryRailOpen ?? fallback.libraryRailOpen,
      sheetRailOpen: parsed.sheetRailOpen ?? fallback.sheetRailOpen,
      inspectorOpen: parsed.inspectorOpen ?? fallback.inspectorOpen,
      focusMode: parsed.focusMode ?? fallback.focusMode,
      typewriterMode: parsed.typewriterMode ?? fallback.typewriterMode,
    };
  } catch {
    return fallback;
  }
}

function saveAgentSettings(next: Partial<AgentSettings>) {
  const current = loadAgentSettings();
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...next }));
}

function defaultAgentSettings(): AgentSettings {
  return {
    planMode: false,
    codexCliPath: "",
    libraryPath: "",
    activeProjectId: "",
    activeSheetId: "",
    libraryRailOpen: true,
    sheetRailOpen: true,
    inspectorOpen: true,
    focusMode: false,
    typewriterMode: false,
  };
}

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    fontSize: "17px",
  },
  ".cm-scroller": {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    lineHeight: "1.76",
    padding: "34px 0",
  },
  ".cm-content": {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "0 44px 128px",
    caretColor: "#0071e3",
  },
  ".cm-line": {
    padding: "0 2px",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-panels": {
    color: "#1d1d1f",
    backgroundColor: "#fbfbfc",
    borderColor: "#ececf0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: "13px",
  },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
  },
  ".cm-panel.cm-search input": {
    height: "28px",
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  ".cm-panel.cm-search button": {
    minHeight: "28px",
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    font: "inherit",
  },
  ".cm-panel.cm-search button:hover": {
    backgroundColor: "#f2f2f4",
  },
  ".cm-searchMatch": {
    backgroundColor: "#fff3b0",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "#ffd85a",
  },
});

const chineseEditorPhrases = EditorState.phrases.of({
  Find: "查找",
  Replace: "替换",
  next: "下一个",
  previous: "上一个",
  all: "全选",
  "match case": "区分大小写",
  regexp: "正则",
  "by word": "整词",
  replace: "替换",
  "replace all": "全部替换",
  close: "关闭",
  "current match": "当前匹配",
  "on line": "位于行",
  "replaced match on line $": "已替换第 $ 行的匹配",
  "replaced $ matches": "已替换 $ 个匹配",
});

const markdownHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: tags.heading1,
      color: "#1d1d1f",
      fontSize: "1.46em",
      fontWeight: "750",
    },
    {
      tag: tags.heading2,
      color: "#1d1d1f",
      fontSize: "1.28em",
      fontWeight: "720",
    },
    {
      tag: tags.heading3,
      color: "#1d1d1f",
      fontSize: "1.14em",
      fontWeight: "700",
    },
    {
      tag: [tags.heading4, tags.heading5, tags.heading6],
      color: "#1d1d1f",
      fontWeight: "680",
    },
    {
      tag: tags.strong,
      fontWeight: "720",
    },
    {
      tag: tags.emphasis,
      fontStyle: "italic",
    },
    {
      tag: tags.quote,
      color: "#515154",
      fontStyle: "italic",
    },
    {
      tag: [tags.link, tags.url],
      color: "#0057d9",
      textDecoration: "none",
    },
    {
      tag: tags.monospace,
      color: "#3a3a3c",
      backgroundColor: "#f2f2f7",
      fontFamily: "'SF Mono', 'SFMono-Regular', Consolas, monospace",
    },
  ]),
);

const typewriterScrollExtension = EditorView.updateListener.of((update) => {
  if ((!update.docChanged && !update.selectionSet) || !update.view.hasFocus) return;
  const head = update.state.selection.main.head;
  window.requestAnimationFrame(() => {
    update.view.dispatch({
      effects: EditorView.scrollIntoView(head, { y: "center" }),
    });
  });
});

export default App;
