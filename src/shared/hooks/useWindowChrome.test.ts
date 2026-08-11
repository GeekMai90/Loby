// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React、Vitest、Tauri Window mock 与 useWindowChrome
 * [OUTPUT]: 验证窗口顶栏双击回退与 Portal 交互内容的窗口拖拽隔离
 * [POS]: shared 窗口 chrome 适配器的交互回归边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWindowChrome } from "@/shared/hooks/useWindowChrome";

vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

type WindowChrome = ReturnType<typeof useWindowChrome>;

function WindowChromeHarness({ onReady }: { onReady: (chrome: WindowChrome) => void }) {
  onReady(
    useWindowChrome({
      inspectorWidth: 400,
      onInspectorWidthChange: () => undefined,
      onInspectorOpenChange: () => undefined,
    }),
  );
  return null;
}

function asReactMouseEvent(event: globalThis.MouseEvent) {
  return event as unknown as ReactMouseEvent<HTMLElement>;
}

describe("useWindowChrome", () => {
  let container: HTMLDivElement;
  let root: Root;
  let chrome: WindowChrome;
  let startDragging: ReturnType<typeof vi.fn>;
  let toggleMaximize: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    startDragging = vi.fn().mockResolvedValue(undefined);
    toggleMaximize = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentWindow).mockReturnValue({ startDragging, toggleMaximize } as never);
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("toggles maximize from the second mousedown without double toggling", async () => {
    await act(async () => {
      root.render(createElement(WindowChromeHarness, { onReady: (value) => (chrome = value) }));
    });

    await act(async () => chrome.startWindowDrag(asReactMouseEvent(new MouseEvent("mousedown", { button: 0, detail: 1 }))));
    expect(startDragging).toHaveBeenCalledOnce();

    await act(async () => chrome.startWindowDrag(asReactMouseEvent(new MouseEvent("mousedown", { button: 0, detail: 2 }))));
    expect(toggleMaximize).toHaveBeenCalledOnce();

    await act(async () => chrome.handleWindowToolbarDoubleClick(asReactMouseEvent(new MouseEvent("dblclick", { button: 0, detail: 2 }))));
    expect(toggleMaximize).toHaveBeenCalledOnce();
  });

  it("keeps the explicit double-click fallback when no second mousedown was handled", async () => {
    await act(async () => {
      root.render(createElement(WindowChromeHarness, { onReady: (value) => (chrome = value) }));
    });

    await act(async () => chrome.handleWindowToolbarDoubleClick(asReactMouseEvent(new MouseEvent("dblclick", { button: 0, detail: 2 }))));
    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(startDragging).not.toHaveBeenCalled();
  });

  it("does not start window dragging from portaled interactive content", async () => {
    await act(async () => {
      root.render(createElement(WindowChromeHarness, { onReady: (value) => (chrome = value) }));
    });

    const menuContent = document.createElement("div");
    menuContent.dataset.noWindowDrag = "true";
    const menuItem = document.createElement("div");
    menuContent.append(menuItem);
    document.body.append(menuContent);

    let pointerEvent: globalThis.MouseEvent | null = null;
    menuItem.addEventListener("mousedown", (event) => {
      pointerEvent = event;
    });
    menuItem.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));

    expect(pointerEvent).not.toBeNull();
    await act(async () => chrome.startWindowDrag(asReactMouseEvent(pointerEvent!)));
    expect(startDragging).not.toHaveBeenCalled();

    menuContent.remove();
  });
});
