/**
 * [INPUT]: 依赖 React effect、隐藏 WebView 布局延时与 Tauri mark_main_window_ready command
 * [OUTPUT]: 对外提供 useMainWindowReady
 * [POS]: shared 主窗口启动同步适配器，只协调 renderer ready 信号
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

// 这里不能用 requestAnimationFrame 等"首帧已绘制"：窗口在揭开前是隐藏的，
// 而隐藏窗口不产生 animation frame，绘制信号永远等不到——绘制本身就需要窗口可见。
// 隐藏 WebView 还会被系统挂起长定时器（backgroundThrottling 默认 suspend），
// 只有这种在挂起生效前就烧完的短延时能穿过去，用来给已提交的首屏留出布局时间。
// 真正的失败兜底不在这一层，而在不会被挂起的原生侧（见 window_lifecycle.rs）。
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
