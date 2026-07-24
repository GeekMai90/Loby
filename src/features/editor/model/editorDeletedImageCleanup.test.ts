/**
 * [INPUT]: 依赖 Vitest、shared 写作库契约与 editorDeletedImageCleanup
 * [OUTPUT]: 验证图片引用保存先于孤儿资源复核
 * [POS]: 编辑器图片资源联动删除的时序回归边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import { cleanupDeletedImagePathsAfterSave } from "@/features/editor/model/editorDeletedImageCleanup";

describe("editorDeletedImageCleanup", () => {
  it("persists the removed reference before asking the native layer to revalidate the image", async () => {
    const projects = [{ id: "project-1", sheets: [] }] as unknown as WritingProject[];
    const persistProjectsImmediately = vi.fn(async () => undefined);
    const trashImages = vi.fn(async () => ({ movedCount: 1, skippedCount: 0 }));

    const result = await cleanupDeletedImagePathsAfterSave({
      libraryPath: "/library",
      imagePaths: ["/library/assets/images/test.png"],
      projects,
      persistProjectsImmediately,
      trashImages,
    });

    expect(persistProjectsImmediately).toHaveBeenCalledWith(projects);
    expect(trashImages).toHaveBeenCalledWith("/library", ["/library/assets/images/test.png"]);
    expect(persistProjectsImmediately.mock.invocationCallOrder[0]).toBeLessThan(trashImages.mock.invocationCallOrder[0]);
    expect(result).toEqual({ movedCount: 1, skippedCount: 0 });
  });
});
