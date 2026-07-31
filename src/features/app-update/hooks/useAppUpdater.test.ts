// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、mocked Tauri updater/process 与 useAppUpdater
 * [OUTPUT]: 验证自动发现更新、安装前保存、下载进度和用户确认后的重启安装顺序
 * [POS]: app-update 状态协调器的聚焦回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdater, type AppUpdatePhase } from "@/features/app-update/hooks/useAppUpdater";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  isTauri: vi.fn(() => true),
  relaunch: vi.fn(),
  showAppToast: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: mocks.isTauri }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: mocks.showAppToast }));

describe("useAppUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
  });

  it("auto-detects an update, persists local work, downloads with progress, then relaunches on user action", async () => {
    const calls: string[] = [];
    const update = {
      version: "0.2.0",
      close: vi.fn(async () => undefined),
      downloadAndInstall: vi.fn(async (onEvent: (event: unknown) => void) => {
        calls.push("download");
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Progress", data: { chunkLength: 40 } });
        onEvent({ event: "Progress", data: { chunkLength: 60 } });
        onEvent({ event: "Finished" });
      }),
    };
    mocks.check.mockResolvedValue(update);
    mocks.relaunch.mockImplementation(async () => {
      calls.push("relaunch");
    });

    let state!: {
      phase: AppUpdatePhase;
      availableVersion: string;
      progress: number | null;
      downloadAndInstall: () => Promise<void>;
      relaunchAndInstall: () => Promise<void>;
    };
    const beforeInstall = vi.fn(async () => {
      calls.push("persist");
    });

    function Harness() {
      state = useAppUpdater({ beforeInstall });
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });

    expect(mocks.check).toHaveBeenCalledOnce();
    expect(state.phase).toBe("available");
    expect(state.availableVersion).toBe("0.2.0");

    await act(async () => {
      await state.downloadAndInstall();
    });

    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(update.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(calls).toEqual(["persist", "download"]);
    expect(state.phase).toBe("installing");
    expect(state.progress).toBe(100);

    await act(async () => {
      await state.relaunchAndInstall();
    });

    expect(mocks.relaunch).toHaveBeenCalledOnce();
    expect(calls).toEqual(["persist", "download", "relaunch"]);

    await act(async () => root.unmount());
    expect(update.close).toHaveBeenCalledOnce();
  });
});
