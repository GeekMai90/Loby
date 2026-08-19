// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、Tauri invoke/listen mock 与 useNativeMenuBindings
 * [OUTPUT]: 验证菜单勾选、10 个事件路由、最新回调读取以及注册完成前卸载的迟到 handler 回收
 * [POS]: app 原生菜单适配器的聚焦生命周期测试，防止 App 拆分后事件丢失、重复注册或 listener 泄漏
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNativeMenuBindings } from "@/app/useNativeMenuBindings";

const { invokeMock, listenMock } = vi.hoisted(() => ({ invokeMock: vi.fn(), listenMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

type MenuOptions = Parameters<typeof useNativeMenuBindings>[0];

function NativeMenuHarness(props: MenuOptions) {
  useNativeMenuBindings(props);
  return null;
}

describe("useNativeMenuBindings", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue(undefined);
    listenMock.mockReset().mockImplementation(async () => vi.fn());
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
  });

  function createOptions(overrides: Partial<MenuOptions> = {}): MenuOptions {
    return {
      enabled: true,
      typewriterMode: false,
      runAppShortcut: vi.fn(() => true),
      onNewProject: vi.fn(),
      onOpenWelcome: vi.fn(),
      onCleanEmptySheets: vi.fn(),
      onCleanUnusedImages: vi.fn(),
      onImportMarkdown: vi.fn(),
      onToggleTypewriterMode: vi.fn(),
      ...overrides,
    };
  }

  async function renderMenu(options: MenuOptions) {
    await act(async () => {
      root?.render(createElement(NativeMenuHarness, options));
      await Promise.resolve();
    });
  }

  function emit(eventName: string) {
    const registration = listenMock.mock.calls.find(([registeredEvent]) => registeredEvent === eventName);
    expect(registration).toBeDefined();
    registration?.[1]({ event: eventName, id: 1, payload: undefined });
  }

  it("syncs the typewriter checkmark and routes every native menu event to the latest actions", async () => {
    const initial = createOptions();
    await renderMenu(initial);

    expect(invokeMock).toHaveBeenCalledWith("set_typewriter_mode_menu_checked", { checked: false });
    expect(listenMock).toHaveBeenCalledTimes(10);
    emit("loby://new-sheet");
    emit("loby://quick-capture");
    emit("loby://open-settings");
    emit("loby://open-shortcuts");
    expect(initial.runAppShortcut).toHaveBeenNthCalledWith(1, "newSheet");
    expect(initial.runAppShortcut).toHaveBeenNthCalledWith(2, "quickCapture");
    expect(initial.runAppShortcut).toHaveBeenNthCalledWith(3, "openSettings");
    expect(initial.runAppShortcut).toHaveBeenNthCalledWith(4, "openShortcuts");

    const latest = createOptions({ typewriterMode: true });
    await renderMenu(latest);
    emit("loby://new-project");
    emit("loby://open-welcome");
    emit("loby://clean-empty-sheets");
    emit("loby://clean-unused-images");
    emit("loby://import-markdown");
    emit("loby://toggle-typewriter-mode");

    expect(invokeMock).toHaveBeenLastCalledWith("set_typewriter_mode_menu_checked", { checked: true });
    expect(listenMock).toHaveBeenCalledTimes(10);
    expect(latest.onNewProject).toHaveBeenCalledOnce();
    expect(latest.onOpenWelcome).toHaveBeenCalledOnce();
    expect(latest.onCleanEmptySheets).toHaveBeenCalledOnce();
    expect(latest.onCleanUnusedImages).toHaveBeenCalledOnce();
    expect(latest.onImportMarkdown).toHaveBeenCalledOnce();
    expect(latest.onToggleTypewriterMode).toHaveBeenCalledOnce();
  });

  it("releases listeners that finish registering after the component is disposed", async () => {
    const resolveRegistrations: Array<(handler: () => void) => void> = [];
    const unlistenHandlers = Array.from({ length: 10 }, () => vi.fn());
    listenMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegistrations.push(resolve);
        }),
    );

    await renderMenu(createOptions());
    await act(async () => root?.unmount());
    root = null;
    await act(async () => {
      resolveRegistrations.forEach((resolve, index) => resolve(unlistenHandlers[index]));
      await Promise.resolve();
    });

    unlistenHandlers.forEach((handler) => expect(handler).toHaveBeenCalledOnce());
  });
});
