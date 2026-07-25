// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 React DOM、Vitest 与 useAppShortcuts
 * [OUTPUT]: 验证已绑定应用快捷键在捕获阶段阻断局部控件，未绑定动作继续下发
 * [POS]: shared 快捷键 hook 的事件所有权回归，保护应用命令与 CodeMirror 的优先级边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShortcuts } from "@/shared/hooks/useAppShortcuts";

function ShortcutHarness({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  useAppShortcuts({ openShortcuts: { run: onOpenShortcuts } });
  return createElement("textarea", { "data-testid": "editor" });
}

describe("useAppShortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("takes Command slash before an editor surface can consume it", async () => {
    const onOpenShortcuts = vi.fn();
    await act(async () => root.render(createElement(ShortcutHarness, { onOpenShortcuts })));
    const editor = container.querySelector<HTMLTextAreaElement>('[data-testid="editor"]')!;
    const editorKeyDown = vi.fn();
    editor.addEventListener("keydown", editorKeyDown);
    const event = new KeyboardEvent("keydown", {
      key: "/",
      code: "Slash",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    await act(async () => editor.dispatchEvent(event));

    expect(onOpenShortcuts).toHaveBeenCalledOnce();
    expect(editorKeyDown).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves registered shortcuts without an application binding to the editor", async () => {
    await act(async () => root.render(createElement(ShortcutHarness, { onOpenShortcuts: vi.fn() })));
    const editor = container.querySelector<HTMLTextAreaElement>('[data-testid="editor"]')!;
    const editorKeyDown = vi.fn();
    editor.addEventListener("keydown", editorKeyDown);
    const event = new KeyboardEvent("keydown", {
      key: "b",
      code: "KeyB",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    await act(async () => editor.dispatchEvent(event));

    expect(editorKeyDown).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});
