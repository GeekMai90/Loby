// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React、Vitest、发布目标 API mock 与 usePublishingTargets
 * [OUTPUT]: 验证启动占位路径不会触发发布目标读取，写作库恢复后只按真实路径加载
 * [POS]: publishing hooks 的启动时序回归测试，保护非首屏原生读取不回流冷启动热路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPublishingTargets } from "@/features/publishing/model/api";
import { usePublishingTargets } from "@/features/publishing/hooks/usePublishingTargets";

vi.mock("@/features/publishing/model/api", () => ({
  loadPublishingTargets: vi.fn().mockResolvedValue({ version: 1, targets: [] }),
  savePublishingTargets: vi.fn(),
}));

function Harness({ libraryPath, ready }: { libraryPath: string; ready: boolean }) {
  usePublishingTargets(libraryPath, ready);
  return null;
}

describe("usePublishingTargets", () => {
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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("waits for the authoritative writing-library path before loading targets", async () => {
    await act(async () => root.render(createElement(Harness, { libraryPath: "Loading library", ready: false })));
    expect(loadPublishingTargets).not.toHaveBeenCalled();

    await act(async () => root.render(createElement(Harness, { libraryPath: "/writing-library", ready: true })));
    expect(loadPublishingTargets).toHaveBeenCalledTimes(1);
    expect(loadPublishingTargets).toHaveBeenCalledWith("/writing-library");
  });
});
