import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  ChatConversation,
  ImportedMarkdownFile,
  LibraryImageCentralizationResult,
  ProjectResourceFile,
  TrashEntry,
  WritingProject,
  WritingSheet,
} from "../types";
import { rewriteProjectsForCentralImageLibrary } from "./imageAssets";

export interface ProjectExportBundleFile {
  relativePath: string;
  content: string;
}

export interface ProjectExportBundleAsset {
  sourcePath: string;
  relativePath: string;
}
import { seedProjects } from "../seed";

const STORAGE_KEY = "loby.projects.v1";
const CHAT_STORAGE_KEY = "loby.chatConversations.v1";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function loadBrowserProjects(path = ""): WritingProject[] {
  try {
    const saved = localStorage.getItem(browserStorageKey(STORAGE_KEY, path));
    if (!saved) return path ? [] : seedProjects;
    return JSON.parse(saved) as WritingProject[];
  } catch {
    return seedProjects;
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

export async function saveProjects(projects: WritingProject[], path?: string): Promise<string> {
  if (!isTauriRuntime()) {
    const libraryPath = path || "browser://libraries/default";
    localStorage.setItem(browserStorageKey(STORAGE_KEY, libraryPath), JSON.stringify(projects));
    return libraryPath;
  }

  return path ? invoke<string>("save_library_at", { path, projects }) : invoke<string>("save_library", { projects });
}

export async function rebuildProjectIndex(path: string): Promise<WritingProject[]> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能重建本地写作库索引。请使用 Tauri 桌面应用。");
  }

  return invoke<WritingProject[]>("rebuild_library_index", { path });
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

export async function importMarkdownFiles(): Promise<ImportedMarkdownFile[]> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器开发模式不能导入 Markdown 文件。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: false,
    multiple: true,
    title: "导入 Markdown 为稿件卡片",
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
  });
  const sourcePaths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  if (sourcePaths.length === 0) return [];

  return invoke<ImportedMarkdownFile[]>("read_markdown_import_files", { sourcePaths });
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能打开本地文件。请使用 Tauri 桌面应用。");
  }

  return invoke<void>("open_local_path", { path });
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

export function prepareConversationsForPersistence(conversations: ChatConversation[]): ChatConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => {
      const { images: _transientImages, ...persistedMessage } = message;
      return _transientImages?.length && !persistedMessage.content.trim()
        ? { ...persistedMessage, content: "[图片附件]" }
        : persistedMessage;
    }),
  }));
}

export async function chooseLibraryFolder(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return window.prompt("输入本地写作库路径", "") || null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择落笔写作库",
  });

  return typeof selected === "string" ? selected : null;
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
    throw new Error("浏览器开发模式不能移动本地写作库。请使用 Tauri 桌面应用。");
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择写作库的新位置",
  });
  return typeof selected === "string" ? selected : null;
}

export async function moveLibraryDirectory(path: string, destinationParent: string): Promise<string> {
  if (!isTauriRuntime() || !path.startsWith("/")) {
    throw new Error("浏览器开发模式不能移动本地写作库。请使用 Tauri 桌面应用。");
  }
  return invoke<string>("move_library_directory", { path, destinationParent });
}

function browserStorageKey(baseKey: string, path: string): string {
  return path ? `${baseKey}:${path}` : baseKey;
}
