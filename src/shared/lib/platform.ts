/**
 * [INPUT]: 依赖浏览器 Window、navigator 与 Tauri 注入的 __TAURI_INTERNALS__ 标记
 * [OUTPUT]: 对外提供 Tauri、Windows 与 macOS 桌面运行时检测，以及按运行平台生成文件管理器名称
 * [POS]: shared/lib 的平台边界；只描述运行环境和平台文案，不承载窗口操作或业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function isTauriDesktopRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isWindowsDesktopRuntime() {
  return isTauriDesktopRuntime() && typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
}

export function isMacDesktopRuntime() {
  return isTauriDesktopRuntime() && typeof navigator !== "undefined" && /Macintosh|Mac OS X/i.test(navigator.userAgent);
}

export function fileManagerNameForUserAgent(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return "文件资源管理器";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "访达";
  return "文件管理器";
}

export function getFileManagerName(): string {
  return fileManagerNameForUserAgent(typeof navigator !== "undefined" ? navigator.userAgent : "");
}
