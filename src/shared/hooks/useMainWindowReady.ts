/**
 * [INPUT]: 依赖 React effect、隐藏 WebView 布局延时与 Tauri mark_main_window_ready command
 * [OUTPUT]: 对外提供 useMainWindowReady，在 React 首屏提交并完成布局准备后通知原生层显示主窗口
 * [POS]: shared 主窗口启动同步适配器，只协调 renderer ready 信号
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

const MAIN_WINDOW_LAYOUT_DELAY_MS = 24;

export function useMainWindowReady() {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const timer = window.setTimeout(() => {
      void invoke("mark_main_window_ready").catch(() => undefined);
    }, MAIN_WINDOW_LAYOUT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);
}
