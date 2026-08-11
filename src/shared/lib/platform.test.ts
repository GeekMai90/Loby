// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖平台 user agent 字符串与 shared/lib/platform 的纯规则
 * [OUTPUT]: 验证 Windows/macOS/Linux 文件管理器名称和桌面运行时边界
 * [POS]: shared/lib 平台适配的回归边界，不启动 Tauri 窗口或依赖真实操作系统
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, describe, expect, it } from "vitest";
import { fileManagerNameForUserAgent, isMacDesktopRuntime, isTauriDesktopRuntime, isWindowsDesktopRuntime } from "@/shared/lib/platform";

const originalUserAgent = navigator.userAgent;

afterEach(() => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("fileManagerNameForUserAgent", () => {
  it("uses the native file manager name for Windows", () => {
    expect(fileManagerNameForUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("文件资源管理器");
  });

  it("keeps Finder for macOS and uses a generic name on Linux", () => {
    expect(fileManagerNameForUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("访达");
    expect(fileManagerNameForUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe("文件管理器");
  });
});

describe("desktop runtime detection", () => {
  it("detects Tauri macOS and Windows runtimes without confusing their window strategies", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });

    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" });
    expect(isTauriDesktopRuntime()).toBe(true);
    expect(isMacDesktopRuntime()).toBe(true);
    expect(isWindowsDesktopRuntime()).toBe(false);

    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(isMacDesktopRuntime()).toBe(false);
    expect(isWindowsDesktopRuntime()).toBe(true);
  });
});
