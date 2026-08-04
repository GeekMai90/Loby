/**
 * [INPUT]: 依赖 React effect、CSS --background token 的计算值与 Tauri window setBackgroundColor
 * [OUTPUT]: 对外提供 useWindowBackgroundSync、readThemeBackgroundColor
 * [POS]: shared 窗口材质适配器，让原生窗口层跟随当前主题底色，不拥有 palette 值
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import type { ResolvedAppTheme } from "@/shared/types";

// 原生 Color 只接受十六进制字面量；--background 若改成 oklch()/rgb() 就交回 Tauri 兜底色，
// 宁可颜色略有偏差，也不要把非法值送进原生层。
const HEX_COLOR_PATTERN = /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

export function readThemeBackgroundColor(element: Element = document.documentElement): string | null {
  const value = getComputedStyle(element).getPropertyValue("--background").trim();
  return HEX_COLOR_PATTERN.test(value) ? value : null;
}

/**
 * 窗口层不再透明后，resize 期间 WebView 落后的那几帧会露出原生窗口底色。
 * 把它同步到当前主题的 --background，就用一个不透明窗口换回了 transparent 的全部观感收益。
 */
export function useWindowBackgroundSync(resolvedTheme: ResolvedAppTheme) {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const color = readThemeBackgroundColor();
    if (!color) return;
    void getCurrentWindow()
      .setBackgroundColor(color)
      .catch(() => undefined);
  }, [resolvedTheme]);
}
