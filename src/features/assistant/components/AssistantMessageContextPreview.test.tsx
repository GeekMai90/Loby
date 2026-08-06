// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、ChatContextPreview 与 AssistantMessageContextPreview
 * [OUTPUT]: 验证挂载文稿上下文预览保留响应式最大宽度，长标题不会撑开消息气泡
 * [POS]: assistant/components 的上下文预览视觉回归测试，保护消息流中的文稿标签布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMessageContextPreview } from "@/features/assistant/components/AssistantMessageContextPreview";
import type { ChatContextPreview } from "@/shared/types";

describe("AssistantMessageContextPreview", () => {
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
    vi.unstubAllGlobals();
  });

  it("keeps a mounted document preview within bounded responsive widths", () => {
    const context: ChatContextPreview = {
      id: "document:sheet-1",
      type: "document",
      contentMode: "live",
      title: "用落笔一键发布博客：Hugo、GitHub 与文档站同步",
      subtitle: "当前文稿",
      excerpt: "",
    };

    act(() => {
      root.render(createElement(AssistantMessageContextPreview, { contexts: [context] }));
    });

    const preview = container.firstElementChild as HTMLElement;
    const label = container.querySelector("span") as HTMLSpanElement;
    expect(preview.className).toContain("max-w-[min(240px,calc(100%_-_56px))]");
    expect(label.className).toContain("max-w-[min(180px,calc(100vw_-_200px))]");
  });
});
