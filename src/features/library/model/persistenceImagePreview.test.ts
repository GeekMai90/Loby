// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 Vitest、Tauri invoke mock 与 persistence 图片预览 API
 * [OUTPUT]: 验证网络图片先落到临时本地路径，再调用编辑器同款 preview_local_image
 * [POS]: 写作库原生图片预览适配层的命令编排回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { previewImage } from "@/features/library/model/persistence";

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
});
