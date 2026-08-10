// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React、Vitest、Tauri Window mock 与 WindowsTitlebar
 * [OUTPUT]: 验证 Windows 标题栏的菜单入口、拖拽/双击最大化和窗口控制动作
 * [POS]: app 窗口 Chrome 的交互回归边界，不覆盖业务菜单事件的具体消费者
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WindowsTitlebar } from "@/app/WindowsTitlebar";

vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

describe("WindowsTitlebar", () => {
  let container: HTMLDivElement;
  let root: Root;
  let appWindow: {
    close: ReturnType<typeof vi.fn>;
    isMaximized: ReturnType<typeof vi.fn>;
    minimize: ReturnType<typeof vi.fn>;
    onResized: ReturnType<typeof vi.fn>;
    startDragging: ReturnType<typeof vi.fn>;
    startResizeDragging: ReturnType<typeof vi.fn>;
    toggleMaximize: ReturnType<typeof vi.fn>;
  };
  let originalUserAgent: string;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    appWindow = {
      close: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      minimize: vi.fn().mockResolvedValue(undefined),
      onResized: vi.fn().mockResolvedValue(vi.fn()),
      startDragging: vi.fn().mockResolvedValue(undefined),
      startResizeDragging: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getCurrentWindow).mockReturnValue(appWindow as never);
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Windows NT 10.0; Win64; x64" });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the integrated menu and window controls", async () => {
    await act(async () => root.render(createElement(WindowsTitlebar)));

    expect(container.textContent).toContain("文件");
    expect(container.textContent).toContain("编辑");
    expect(container.textContent).toContain("窗口");
    expect(container.querySelector('button[aria-label="最小化"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="最大化"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="关闭"]')).not.toBeNull();
  });

  it("delegates titlebar drag, maximize and window controls to Tauri", async () => {
    await act(async () => root.render(createElement(WindowsTitlebar)));
    const titlebar = container.querySelector(".windows-titlebar");
    if (!(titlebar instanceof HTMLElement)) throw new Error("Windows titlebar did not render");

    await act(async () => {
      titlebar.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, detail: 1 }));
      titlebar.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, detail: 2 }));
      container.querySelector<HTMLButtonElement>('button[aria-label="最小化"]')?.click();
      container.querySelector<HTMLButtonElement>('button[aria-label="关闭"]')?.click();
    });

    expect(appWindow.startDragging).toHaveBeenCalledOnce();
    expect(appWindow.toggleMaximize).toHaveBeenCalledOnce();
    expect(appWindow.minimize).toHaveBeenCalledOnce();
    expect(appWindow.close).toHaveBeenCalledOnce();
  });
});
