/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约、写作库模块、AI 助手模块
 * [OUTPUT]: 对外提供写作库选择/校验/空目录初始化/加载、Tantivy 全文搜索索引适配、整库与单文稿 revision 保存、重建报告、惰性对话草稿过滤、活动/偏好/回收站、批量文稿回收、项目资源与本地或远程图片预览等 native 适配能力
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  ChatConversation,
  AiQuickPrompt,
  LibraryPreferences,
  LibraryImageCentralizationResult,
  ProjectResourceFile,
  TrashEntry,
  UnusedImageCandidate,
  WritingActivityStore,
  ProjectGroup,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import { rewriteProjectsForCentralImageLibrary } from "@/features/library/model/imageAssets";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import { normalizeQuickPromptStore } from "@/features/assistant/model/quickPrompts";

export interface ProjectExportBundleFile {
  relativePath: string;
  content: string;
}

export interface ProjectExportBundleAsset {
  sourcePath: string;
  relativePath: string;
}

export interface SheetIdChange {
  projectId: string;
  oldId: string;
  newId: string;
}

export interface LibraryRebuildResult {
  projects: WritingProject[];
  indexedSheetCount: number;
  migratedSheetCount: number;
  idChanges: SheetIdChange[];
}

export interface LibraryRebuildProgress {
  value: number;
  label: string;
}

export interface LibraryRebuildSummary {
  indexedSheetCount: number;
  migratedSheetCount: number;
}

export interface DocumentProjectContext {
  id: string;
  title: string;
  groups: ProjectGroup[];
}

export interface DocumentSaveReceipt {
  path: string;
  revision: number;
  written: boolean;
}

export interface SheetTrashTarget {
  projectId: string;
  projectTitle: string;
  sheetId: string;
  sheetTitle: string;
  groupId: string;
}

export interface SearchHit {
  sheetId: string;
  title: string;
  score: number;
}

export type MarkdownImportSourceType = "markdown" | "obsidian";
export type MarkdownImportImageStatus = "resolved" | "external" | "missing" | "ambiguous";

export interface MarkdownImportImageReference {
  target: string;
  format: "markdown" | "obsidian";
  status: MarkdownImportImageStatus;
  sourcePath: string;
  candidatePaths: string[];
}

export interface MarkdownImportDocument {
  name: string;
  path: string;
  relativePath: string;
  body: string;
  metadata: Record<string, unknown>;
  sizeBytes: number;
  createdTimeMs?: number;
  modifiedTimeMs?: number;
  imageReferences: MarkdownImportImageReference[];
}

export interface MarkdownImportScan {
  sourcePaths: string[];
  sourceType: MarkdownImportSourceType;
  vaultRoot: string;
  attachmentRoot: string;
  documents: MarkdownImportDocument[];
  skippedFileCount: number;
  resolvedImageCount: number;
  externalImageCount: number;
  missingImageCount: number;
  ambiguousImageCount: number;
  warnings: string[];
}

export interface MarkdownImportImageTransfer {
  sourcePath: string;
  destinationPath: string;
}
const STORAGE_KEY = "loby.projects.v1";
const CHAT_STORAGE_KEY = "loby.chatConversations.v1";
const QUICK_PROMPT_STORAGE_KEY = "loby.quickPrompts.v1";
const WRITING_ACTIVITY_STORAGE_KEY = "loby.writingActivity.v1";
const LIBRARY_PREFERENCES_STORAGE_KEY = "loby.libraryPreferences.v1";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function loadBrowserProjects(path = ""): WritingProject[] {
  try {
    const saved = localStorage.getItem(browserStorageKey(STORAGE_KEY, path));
    if (!saved) return [];
    return JSON.parse(saved) as WritingProject[];
  } catch {
    return [];
  }
}

export async function loadProjects(
  path?: string,
): Promise<{ projects: WritingProject[]; libraryPath: string; source: "tauri" | "browser" }> {
  if (!isTauriRuntime()) {
    const libraryPath = path || "browser://libraries/default";
    return { projects: loadBrowserProjects(path), libraryPath, source: "browser" };
  }

  const libraryPath = path ?? (await invoke<string>("default_library_path"));
  const projects = path ? await invoke<WritingProject[]>("load_library_at", { path }) : await invoke<WritingProject[]>("load_library");
  const centralizedProjects = await centralizeExistingLibraryImages(libraryPath, projects);
  return {
    projects: centralizedProjects,
    libraryPath,
    source: "tauri",
  };
}

export async function ensureSearchIndex(path: string): Promise<void> {
  if (!isTauriRuntime() || !isDesktopLibraryPath(path)) return;
  await invoke("ensure_search_index", { path });
}

export async function searchLibrary(path: string, query: string, limit = 50): Promise<SearchHit[]> {
  if (!isTauriRuntime() || !isDesktopLibraryPath(path)) return [];
  return invoke<SearchHit[]>("search_library", { path, query, limit });
}

export async function saveProjects(projects: WritingProject[], path?: string): Promise<string> {
  if (!isTauriRuntime()) {
    const libraryPath = path || "browser://libraries/default";
    localStorage.setItem(browserStorageKey(STORAGE_KEY, libraryPath), JSON.stringify(projects));
    return libraryPath;
  }

  return path ? invoke<string>("save_library_at", { path, projects }) : invoke<string>("save_library", { projects });
}

export async function saveDocument({
  libraryPath,
  project,
  sheet,
  revision,
}: {
  libraryPath: string;
  project: DocumentProjectContext;
  sheet: WritingSheet;
  revision: number;
}): Promise<DocumentSaveReceipt> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    const projects = loadBrowserProjects(libraryPath).map((currentProject) =>
      currentProject.id === project.id
        ? {
            ...currentProject,
            sheets: currentProject.sheets.map((currentSheet) => (currentSheet.id === sheet.id ? sheet : currentSheet)),
          }
        : currentProject,
    );
    localStorage.setItem(browserStorageKey(STORAGE_KEY, libraryPath), JSON.stringify(projects));
    return { path: `${libraryPath}/${sheet.id}.md`, revision, written: true };
  }

  return invoke<DocumentSaveReceipt>("save_document_at", {
    path: libraryPath,
    project,
    sheet,
    revision,
  });
}

export async function saveProjectMetadata(projects: WritingProject[], libraryPath?: string): Promise<string> {
  const path = libraryPath || "browser://libraries/default";
  if (!isTauriRuntime() || !path.startsWith("/")) {
    localStorage.setItem(browserStorageKey(STORAGE_KEY, path), JSON.stringify(projects));
    return path;
  }

  const metadataProjects = projects.map((project) => ({
    ...project,
    sheets: project.sheets.map((sheet) => ({ ...sheet, body: "" })),
  }));
  return invoke<string>("save_library_metadata_at", { path, projects: metadataProjects });
}

export async function loadWritingActivity(path: string): Promise<unknown> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    try {
      const saved = localStorage.getItem(browserStorageKey(WRITING_ACTIVITY_STORAGE_KEY, path));
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }
  return invoke<unknown>("load_writing_activity", { path });
}

export async function saveWritingActivity(activity: WritingActivityStore, path: string): Promise<string> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    localStorage.setItem(browserStorageKey(WRITING_ACTIVITY_STORAGE_KEY, path), JSON.stringify(activity));
    return path;
  }
  return invoke<string>("save_writing_activity", { path, activity });
}

export async function loadLibraryPreferences(path: string): Promise<unknown> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    try {
      const saved = localStorage.getItem(browserStorageKey(LIBRARY_PREFERENCES_STORAGE_KEY, path));
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }
  return invoke<unknown>("load_library_preferences", { path });
}

export async function saveLibraryPreferences(preferences: LibraryPreferences, path: string): Promise<string> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    localStorage.setItem(browserStorageKey(LIBRARY_PREFERENCES_STORAGE_KEY, path), JSON.stringify(preferences));
    return path;
  }
  return invoke<string>("save_library_preferences", { path, preferences });
}

export async function rebuildProjectIndex(path: string, repairSheetIds = false): Promise<LibraryRebuildResult> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能重建本地写作文件索引。请使用 Tauri 桌面应用。");
  }

  return invoke<LibraryRebuildResult>("rebuild_library_index", { path, repairSheetIds });
}

export async function watchLibrary(path: string): Promise<void> {
  if (!isTauriRuntime() || !path.startsWith("/")) return;
  await invoke("watch_library", { path });
}

export async function moveProjectToTrash(libraryPath: string, project: WritingProject): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能移动项目到废纸篓。请使用 Tauri 桌面应用。");
  }

  return invoke<WritingProject[]>("move_project_to_trash", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
  });
}

export async function moveSheetToTrash(libraryPath: string, project: WritingProject, sheet: WritingSheet): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能移动文稿到废纸篓。请使用 Tauri 桌面应用。");
  }
  return invoke<WritingProject[]>("move_sheet_to_trash", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    sheetId: sheet.id,
    sheetTitle: sheet.title,
    groupId: sheet.groupId ?? "",
  });
}

export async function moveSheetsToTrash(libraryPath: string, sheets: SheetTrashTarget[]): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能移动文稿到废纸篓。请使用 Tauri 桌面应用。");
  }
  return invoke<WritingProject[]>("move_sheets_to_trash", { path: libraryPath, sheets });
}

export interface EmptySheetCleanupResult {
  projects: WritingProject[];
  removedCount: number;
}

export async function cleanEmptySheets(libraryPath: string): Promise<EmptySheetCleanupResult> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能清理空白文稿。请使用 Tauri 桌面应用。");
  }
  return invoke<EmptySheetCleanupResult>("clean_empty_sheets", { path: libraryPath });
}

export async function scanUnusedLibraryImages(libraryPath: string): Promise<UnusedImageCandidate[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能扫描未使用的图片。请使用 Tauri 桌面应用。");
  }
  return invoke<UnusedImageCandidate[]>("scan_unused_library_images", { path: libraryPath });
}

export interface UnusedImageCleanupResult {
  movedCount: number;
  skippedCount: number;
}

export async function trashUnusedLibraryImages(libraryPath: string, imagePaths: string[]): Promise<UnusedImageCleanupResult> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能清理未使用的图片。请使用 Tauri 桌面应用。");
  }
  return invoke<UnusedImageCleanupResult>("trash_unused_library_images", { path: libraryPath, imagePaths });
}

export async function listLibraryTrash(libraryPath: string): Promise<TrashEntry[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) return [];
  return invoke<TrashEntry[]>("list_library_trash", { path: libraryPath });
}

export async function restoreTrashEntry(libraryPath: string, entryId: string): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能恢复废纸篓内容。请使用 Tauri 桌面应用。");
  }
  return invoke<WritingProject[]>("restore_trash_entry", { path: libraryPath, entryId });
}

export async function deleteTrashEntry(libraryPath: string, entryId: string): Promise<TrashEntry[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能永久删除废纸篓内容。请使用 Tauri 桌面应用。");
  }
  return invoke<TrashEntry[]>("delete_trash_entry", { path: libraryPath, entryId });
}

export async function clearLibraryTrash(libraryPath: string): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能清空废纸篓。请使用 Tauri 桌面应用。");
  }

  return invoke<WritingProject[]>("clear_library_trash", { path: libraryPath });
}

export async function saveProjectExport(libraryPath: string, project: WritingProject, filename: string, content: string): Promise<string> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能写入项目 exports。请使用 Tauri 桌面应用。");
  }

  return invoke<string>("save_project_export", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    filename,
    content,
  });
}

export async function saveProjectExportBundle(
  libraryPath: string,
  project: WritingProject,
  directoryName: string,
  files: ProjectExportBundleFile[],
  assets: ProjectExportBundleAsset[],
): Promise<string> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能写入项目 exports。请使用 Tauri 桌面应用。");
  }

  return invoke<string>("save_project_export_bundle", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    directoryName,
    files,
    assets,
  });
}

export async function saveProjectImage(
  libraryPath: string,
  project: WritingProject,
  filename: string,
  bytes: number[],
): Promise<ProjectResourceFile> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能写入项目图片。请使用 Tauri 桌面应用。");
  }

  return invoke<ProjectResourceFile>("save_project_image", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    filename,
    bytes,
  });
}

export async function importProjectImages(libraryPath: string, project: WritingProject): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能导入项目图片。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: false,
    multiple: true,
    title: "插入图片",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"] }],
  });
  const sourcePaths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  if (sourcePaths.length === 0) return [];

  return importProjectImagePaths(libraryPath, project, sourcePaths);
}

export async function importProjectImagePaths(
  libraryPath: string,
  project: WritingProject,
  sourcePaths: string[],
): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能导入项目图片。请使用 Tauri 桌面应用。");
  }

  return invoke<ProjectResourceFile[]>("import_project_images", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    sourcePaths,
  });
}

export async function importProjectResources(
  libraryPath: string,
  project: WritingProject,
  target: "assets" | "references",
): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能导入项目资源。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: false,
    multiple: true,
    title: target === "assets" ? "导入项目素材" : "导入项目参考文件",
  });
  const sourcePaths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  if (sourcePaths.length === 0) return [];

  return invoke<ProjectResourceFile[]>("import_project_resources", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    target,
    sourcePaths,
  });
}

async function centralizeExistingLibraryImages(libraryPath: string, projects: WritingProject[]): Promise<WritingProject[]> {
  let migration: ReturnType<typeof rewriteProjectsForCentralImageLibrary>;
  try {
    const transfers = await invoke<LibraryImageCentralizationResult[]>("centralize_library_images", { path: libraryPath });
    migration = rewriteProjectsForCentralImageLibrary(libraryPath, projects, transfers);
    if (migration.changed) {
      await invoke<string>("save_library_at", { path: libraryPath, projects: migration.projects });
    }
  } catch {
    return projects;
  }
  invoke<void>("remove_centralized_image_sources", {
    path: libraryPath,
    sourcePaths: migration.removableSourcePaths,
  }).catch(() => undefined);
  return migration.projects;
}

export async function chooseMarkdownImportFiles(): Promise<string[]> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能导入 Markdown 文件。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: false,
    multiple: true,
    title: "选择要导入的 Markdown 文件",
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
  });
  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

export async function chooseMarkdownImportFolder(title = "选择包含 Markdown 文稿的文件夹"): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能导入 Markdown 文件夹。请使用 Tauri 桌面应用。");
  }
  const selected = await open({ directory: true, multiple: false, title });
  return typeof selected === "string" ? selected : "";
}

export async function scanMarkdownImport(sourcePaths: string[], attachmentPath?: string): Promise<MarkdownImportScan> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能扫描本地 Markdown。请使用 Tauri 桌面应用。");
  }
  return invoke<MarkdownImportScan>("scan_markdown_import", {
    sourcePaths,
    attachmentPath: attachmentPath || null,
  });
}

export async function importMarkdownImages(libraryPath: string, sourcePaths: string[]): Promise<MarkdownImportImageTransfer[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    throw new Error("浏览器开发模式不能导入本地图片。请使用 Tauri 桌面应用。");
  }
  const images = Array.from(new Set(sourcePaths.filter(Boolean))).map((sourcePath) => ({ sourcePath }));
  if (images.length === 0) return [];

  return invoke<MarkdownImportImageTransfer[]>("import_markdown_images", { path: libraryPath, images });
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能打开本地文件。请使用 Tauri 桌面应用。");
  }

  return invoke<void>("open_local_path", { path });
}

export async function previewLocalImage(path: string): Promise<void> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能预览本地图片。请使用 Tauri 桌面应用。");
  }

  return invoke<void>("preview_local_image", { path });
}

export async function previewImage(source: string): Promise<void> {
  const localPath = await prepareImagePreview(source);
  return previewLocalImage(localPath);
}

export async function prepareImagePreview(source: string): Promise<string> {
  if (!isTauriRuntime() || (!source.startsWith("/") && !/^https?:\/\//i.test(source))) {
    throw new Error("浏览器开发模式不能预览图片。请使用 Tauri 桌面应用。");
  }

  return invoke<string>("prepare_image_preview", { source });
}

export async function saveLocalImageAs(sourcePath: string, defaultName: string): Promise<string> {
  if (!isTauriRuntime() || !sourcePath.startsWith("/")) {
    throw new Error("浏览器开发模式不能另存本地图片。请使用 Tauri 桌面应用。");
  }

  const destinationPath = await save({
    title: "图片另存为",
    defaultPath: getFallbackFilename(defaultName || sourcePath),
  });
  if (!destinationPath) return "";

  await invoke<void>("copy_local_file", {
    sourcePath,
    destinationPath,
  });
  return destinationPath;
}

export async function revealLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能在访达中显示本地文件。请使用 Tauri 桌面应用。");
  }

  return invoke<void>("reveal_local_path", { path });
}

function getFallbackFilename(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? "image";
}

export function loadBrowserConversations(fallback: ChatConversation[], path = ""): ChatConversation[] {
  try {
    const saved = localStorage.getItem(browserStorageKey(CHAT_STORAGE_KEY, path));
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as ChatConversation[];
    return parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function loadConversations(path: string, fallback: ChatConversation[]): Promise<ChatConversation[]> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    return loadBrowserConversations(fallback, path);
  }

  const conversations = await invoke<ChatConversation[]>("load_conversations", { path });
  return conversations.length > 0 ? conversations : fallback;
}

export async function saveConversations(conversations: ChatConversation[], path?: string): Promise<string> {
  const persistedConversations = prepareConversationsForPersistence(conversations);
  if (!isTauriRuntime() || !path?.startsWith("/")) {
    const libraryPath = path || "browser://libraries/default";
    localStorage.setItem(browserStorageKey(CHAT_STORAGE_KEY, libraryPath), JSON.stringify(persistedConversations));
    return libraryPath;
  }

  return invoke<string>("save_conversations", { path, conversations: persistedConversations });
}

export async function loadQuickPrompts(path: string): Promise<AiQuickPrompt[]> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    try {
      const saved = localStorage.getItem(browserStorageKey(QUICK_PROMPT_STORAGE_KEY, path));
      return normalizeQuickPromptStore(saved ? JSON.parse(saved) : null).prompts;
    } catch {
      return [];
    }
  }

  const store = normalizeQuickPromptStore(await invoke<unknown>("load_quick_prompts", { path }));
  return store.prompts;
}

export async function saveQuickPrompts(prompts: AiQuickPrompt[], path: string): Promise<string> {
  const store = normalizeQuickPromptStore({ version: 1, prompts });
  if (!isTauriRuntime() || !path.startsWith("/")) {
    localStorage.setItem(browserStorageKey(QUICK_PROMPT_STORAGE_KEY, path), JSON.stringify(store));
    return path;
  }

  return invoke<string>("save_quick_prompts", { path, store });
}

export function prepareConversationsForPersistence(conversations: ChatConversation[]): ChatConversation[] {
  return conversations
    .filter((conversation) => conversation.messages.length > 0)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => {
        const attachments = message.attachments?.map(({ previewUrl: _previewUrl, ...attachment }) => attachment);
        const { images: _legacyTransientImages, ...persistedMessage } = message as typeof message & {
          images?: unknown[];
        };
        return attachments?.length ? { ...persistedMessage, attachments } : persistedMessage;
      }),
    }));
}

export async function chooseLibraryFolder(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return window.prompt("输入本地写作文件夹路径", "") || null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择落笔写作文件夹",
  });

  return typeof selected === "string" ? selected : null;
}

export async function validateExistingLibraryDirectory(path: string): Promise<string> {
  if (!isTauriRuntime()) return path;
  return invoke<string>("validate_existing_library_directory", { path });
}

export async function prepareLibraryDirectory(path: string): Promise<string> {
  if (!isTauriRuntime()) return path;
  return invoke<string>("prepare_library_directory", { path });
}

export async function getDefaultLibrariesPath(): Promise<string> {
  if (!isTauriRuntime()) return "Browser localStorage";
  return invoke<string>("default_libraries_path");
}

export async function createLibraryDirectory(name: string, parentPath?: string): Promise<string> {
  if (!isTauriRuntime()) {
    const safeName = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "library";
    return `browser://libraries/${safeName}-${Date.now().toString(36)}`;
  }
  return invoke<string>("create_library_directory", { name, parentPath: parentPath || null });
}

export async function chooseLibraryMoveDestination(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能移动本地写作文件夹。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择写作文件夹的新位置",
  });
  return typeof selected === "string" ? selected : null;
}

export async function moveLibraryDirectory(path: string, destinationParent: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能移动本地写作文件夹。请使用 Tauri 桌面应用。");
  }
  return invoke<string>("move_library_directory", { path, destinationParent });
}

function browserStorageKey(baseKey: string, path: string): string {
  return path ? `${baseKey}:${path}` : baseKey;
}
