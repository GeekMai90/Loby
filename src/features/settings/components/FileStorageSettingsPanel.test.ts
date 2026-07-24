// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileStorageSettingsPanel } from "@/features/settings/components/FileStorageSettingsPanel";
import { showAppToast } from "@/shared/lib/appToast";

vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));

describe("FileStorageSettingsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("presents one writing folder without exposing multi-library management", async () => {
    const onOpenLibrary = vi.fn();
    const onMoveLibrary = vi.fn().mockResolvedValue(undefined);
    const onRebuildLibraryIndex = vi.fn().mockResolvedValue({ indexedSheetCount: 12, migratedSheetCount: 2 });

    await act(async () =>
      root.render(
        createElement(FileStorageSettingsPanel, {
          libraryPath: "/Users/test/Documents/LobyLibrary",
          libraryStatus: "已恢复上次写作位置",
          projectCount: 4,
          onOpenLibrary,
          onMoveLibrary,
          onRebuildLibraryIndex,
        }),
      ),
    );

    expect(container.textContent).toContain("本地文件");
    expect(container.textContent).toContain("写作文件夹");
    expect(container.textContent).toContain("LobyLibrary");
    expect(container.textContent).toContain("4 个");
    expect(container.textContent).not.toContain("写作库数量");
    expect(container.textContent).not.toContain("管理写作库");
    expect(container.textContent).toContain("重建索引…");

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => buttons.find((button) => button.textContent === "打开")?.click());
    await act(async () => buttons.find((button) => button.textContent === "移动…")?.click());
    await act(async () => buttons.find((button) => button.textContent === "重建索引…")?.click());
    await act(async () =>
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent === "开始重建")
        ?.click(),
    );

    expect(onOpenLibrary).toHaveBeenCalledOnce();
    expect(onMoveLibrary).toHaveBeenCalledOnce();
    expect(onRebuildLibraryIndex).toHaveBeenCalledOnce();
    expect(showAppToast).toHaveBeenCalledWith({
      variant: "success",
      title: "索引重建完成",
      description: "已索引 12 篇文稿，并统一 2 篇文稿 ID",
    });
  });

  it("shows live rebuild progress until the operation completes", async () => {
    let finishRebuild: ((summary: { indexedSheetCount: number; migratedSheetCount: number }) => void) | undefined;
    const onRebuildLibraryIndex = vi.fn(
      (onProgress?: (progress: { value: number; label: string }) => void) =>
        new Promise<{ indexedSheetCount: number; migratedSheetCount: number }>((resolve) => {
          finishRebuild = resolve;
          onProgress?.({ value: 35, label: "正在扫描写作文件夹并检查文稿 ID…" });
        }),
    );

    await act(async () =>
      root.render(
        createElement(FileStorageSettingsPanel, {
          libraryPath: "/Users/test/Documents/LobyLibrary",
          libraryStatus: "",
          projectCount: 4,
          onOpenLibrary: vi.fn(),
          onMoveLibrary: vi.fn().mockResolvedValue(undefined),
          onRebuildLibraryIndex,
        }),
      ),
    );

    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "重建索引…")
        ?.click(),
    );
    await act(async () =>
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent === "开始重建")
        ?.click(),
    );

    expect(document.body.textContent).toContain("正在重建文稿索引");
    expect(document.body.textContent).toContain("正在扫描写作文件夹并检查文稿 ID…");
    expect(document.body.textContent).toContain("35%");

    await act(async () => finishRebuild?.({ indexedSheetCount: 4, migratedSheetCount: 0 }));

    expect(document.body.textContent).not.toContain("正在重建文稿索引");
    expect(showAppToast).toHaveBeenCalledWith({
      variant: "success",
      title: "索引重建完成",
      description: "已完成 4 篇文稿的索引检查",
    });
  });
});
