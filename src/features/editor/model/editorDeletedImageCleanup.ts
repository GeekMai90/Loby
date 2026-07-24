/**
 * [INPUT]: 依赖 shared 写作库契约与 library 图片清理持久化能力
 * [OUTPUT]: 对外提供 cleanupDeletedImagePathsAfterSave
 * [POS]: 编辑器图片删除与资源清理之间的安全协调边界，确保先保存正文、再由原生层复核孤儿图片
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject } from "@/shared/types";
import { trashUnusedLibraryImages, type UnusedImageCleanupResult } from "@/features/library/model/persistence";

interface DeletedImageCleanupOptions {
  libraryPath: string;
  imagePaths: string[];
  projects: WritingProject[];
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
  trashImages?: (libraryPath: string, imagePaths: string[]) => Promise<UnusedImageCleanupResult>;
}

export async function cleanupDeletedImagePathsAfterSave({
  libraryPath,
  imagePaths,
  projects,
  persistProjectsImmediately,
  trashImages = trashUnusedLibraryImages,
}: DeletedImageCleanupOptions): Promise<UnusedImageCleanupResult> {
  await persistProjectsImmediately(projects);
  return trashImages(libraryPath, imagePaths);
}
