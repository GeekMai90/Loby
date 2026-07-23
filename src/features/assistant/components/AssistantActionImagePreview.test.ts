// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 React 测试运行时、AssistantActionImagePreview、原生图片预览与全局反馈 mock
 * [OUTPUT]: 验证消息流本地图片只调用 Quick Look，失败时反馈且不回退网页 lightbox
 * [POS]: AI 助手图片成果查看链路的组件回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";
import { previewImage } from "@/features/library/model/persistence";
import { showAppToast } from "@/shared/lib/appToast";

vi.mock("@/features/library/model/persistence", () => ({ previewImage: vi.fn() }));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));

describe("AssistantActionImagePreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(previewImage).mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the same native Quick Look command as editor images", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantActionImagePreview, {
          preview: {
            src: "asset:/Users/example/Loby/assets/images/cover.png",
            alt: "封面",
            label: "assets/images/cover.png",
            sourcePath: "/Users/example/Loby/assets/images/cover.png",
          },
        }),
      );
    });

    const image = container.querySelector("img")!;
    expect(image.title).toBe("双击快速查看");
    await act(async () => image.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));

    expect(previewImage).toHaveBeenCalledWith("/Users/example/Loby/assets/images/cover.png");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("reports native preview failures without falling back to a web lightbox", async () => {
    vi.mocked(previewImage).mockRejectedValueOnce(new Error("Quick Look unavailable"));
    await act(async () => {
      root.render(
        createElement(AssistantActionImagePreview, {
          preview: {
            src: "asset:/Users/example/Loby/assets/images/cover.png",
            alt: "封面",
            label: "assets/images/cover.png",
            sourcePath: "/Users/example/Loby/assets/images/cover.png",
          },
        }),
      );
    });

    await act(async () => container.querySelector("img")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await act(async () => Promise.resolve());

    expect(showAppToast).toHaveBeenCalledWith({ variant: "error", title: "预览失败", description: "暂时无法打开这张图片" });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("sends network images through the native preview preparation command", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantActionImagePreview, {
          preview: {
            src: "https://example.com/cover.png",
            alt: "网络封面",
            label: "https://example.com/cover.png",
            sourcePath: "https://example.com/cover.png",
          },
        }),
      );
    });

    const image = container.querySelector("img")!;
    expect(image.title).toBe("双击快速查看");
    await act(async () => image.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(previewImage).toHaveBeenCalledWith("https://example.com/cover.png");
  });
});
