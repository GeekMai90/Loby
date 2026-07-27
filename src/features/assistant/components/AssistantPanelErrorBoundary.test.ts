/**
 * [INPUT]: 依赖 React DOM 测试运行时、Vitest 与 AssistantPanelErrorBoundary
 * [OUTPUT]: 验证助手渲染异常被局部收敛，并可由用户重新加载子树
 * [POS]: AI 助手渲染故障隔离的组件回归测试，防止异常继续卸载应用外壳
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantPanelErrorBoundary } from "@/features/assistant/components/AssistantPanelErrorBoundary";

describe("AssistantPanelErrorBoundary", () => {
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

  it("keeps a renderer failure inside the assistant surface and supports retry", async () => {
    let shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function AssistantContent() {
      if (shouldThrow) throw new Error("message part index is stale");
      return createElement("div", { "data-slot": "assistant-recovered" }, "助手已恢复");
    }

    await act(async () => {
      root.render(
        createElement(
          "main",
          null,
          createElement("div", { "data-slot": "editor-shell" }, "编辑器仍在"),
          createElement(AssistantPanelErrorBoundary, { children: createElement(AssistantContent) }),
        ),
      );
    });

    expect(container.querySelector('[data-slot="editor-shell"]')?.textContent).toBe("编辑器仍在");
    expect(container.querySelector('[data-slot="assistant-error-fallback"]')?.textContent).toContain("AI 助手显示遇到问题");
    expect(consoleError).toHaveBeenCalledWith("AI assistant render failed.", expect.any(Error), expect.any(String));

    shouldThrow = false;
    const retryButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "重新加载助手");
    await act(async () => retryButton?.click());

    expect(container.querySelector('[data-slot="assistant-error-fallback"]')).toBeNull();
    expect(container.querySelector('[data-slot="assistant-recovered"]')?.textContent).toBe("助手已恢复");
  });
});
