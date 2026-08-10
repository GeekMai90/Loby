// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 Vitest、Tauri invoke mock 与 persistence 图片预览 API
 * [OUTPUT]: 验证网络图片先落到临时本地路径，再调用编辑器同款 preview_local_image
 * [POS]: 写作库原生图片预览适配层的命令编排回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { previewImage, saveDocument } from "@/features/library/model/persistence";
import type { WritingSheet } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

describe("previewImage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(invoke).mockReset();
  });

  it("prepares a network image before opening it with the local Quick Look command", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/loby-image-previews/cover.png").mockResolvedValueOnce(undefined);

    await previewImage("https://example.com/cover.png");

    expect(invoke).toHaveBeenNthCalledWith(1, "prepare_image_preview", { source: "https://example.com/cover.png" });
    expect(invoke).toHaveBeenNthCalledWith(2, "preview_local_image", { path: "/tmp/loby-image-previews/cover.png" });
  });

  it("uses native document persistence for Windows library paths", async () => {
    const libraryPath = "C:\\Users\\test\\LobyLibrary";
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "测试文稿",
      groupId: "group-1",
      tags: [],
      targetWords: 0,
      description: "",
      body: "Windows 正文",
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:01.000Z",
      properties: {},
    };
    const project = { id: "project-1", title: "测试项目", groups: [{ id: "group-1", title: "正文" }] };
    vi.mocked(invoke).mockResolvedValueOnce({
      path: `${libraryPath}\\projects\\测试项目\\正文\\测试文稿.md`,
      revision: 1,
      written: true,
    });

    await saveDocument({ libraryPath, project, sheet, revision: 1 });

    expect(invoke).toHaveBeenCalledWith("save_document_at", { path: libraryPath, project, sheet, revision: 1 });
  });
});
