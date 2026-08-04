// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React、Vitest、Tauri invoke mock 与 useMainWindowReady
 * [OUTPUT]: 验证主窗口只在 React 提交首屏并留出隐藏 WebView 布局时间后通知原生层显示
 * [POS]: shared 主窗口启动同步适配器的时序回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useMainWindowReady } from "@/shared/hooks/useMainWindowReady";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

function Harness() {
  useMainWindowReady();
  return createElement("main", null, "ready");
}

describe("useMainWindowReady", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(invoke).mockClear();
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("waits for the hidden WebView layout window before revealing the native window", async () => {
    await act(async () => root.render(createElement(Harness)));
    expect(invoke).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(24));
    expect(invoke).toHaveBeenCalledWith("mark_main_window_ready");
  });

  it("does not depend on animation frames, which a hidden window never produces", async () => {
    const scheduleFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", scheduleFrame);

    await act(async () => root.render(createElement(Harness)));
    await act(async () => vi.advanceTimersByTimeAsync(24));

    expect(scheduleFrame).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("mark_main_window_ready");
  });
});
