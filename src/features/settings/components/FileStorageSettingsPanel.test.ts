// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileStorageSettingsPanel } from "@/features/settings/components/FileStorageSettingsPanel";

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

    await act(async () =>
      root.render(
        createElement(FileStorageSettingsPanel, {
          libraryPath: "/Users/test/Documents/LobyLibrary",
          libraryStatus: "已恢复上次写作位置",
          projectCount: 4,
          onOpenLibrary,
          onMoveLibrary,
        }),
      ),
    );

    expect(container.textContent).toContain("本地文件");
    expect(container.textContent).toContain("写作文件夹");
    expect(container.textContent).toContain("LobyLibrary");
    expect(container.textContent).toContain("4 个");
    expect(container.textContent).not.toContain("写作库数量");
    expect(container.textContent).not.toContain("管理写作库");

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => buttons.find((button) => button.textContent === "打开")?.click());
    await act(async () => buttons.find((button) => button.textContent === "移动…")?.click());

    expect(onOpenLibrary).toHaveBeenCalledOnce();
    expect(onMoveLibrary).toHaveBeenCalledOnce();
  });
});
