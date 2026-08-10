/**
 * [INPUT]: 依赖浏览器 Window、navigator 与 Tauri 注入的 __TAURI_INTERNALS__ 标记
 * [OUTPUT]: 对外提供 Windows Tauri 桌面运行时检测
 * [POS]: shared/lib 的平台边界；只描述运行环境，不承载窗口操作或业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function isWindowsDesktopRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window && /Windows/i.test(navigator.userAgent);
}
