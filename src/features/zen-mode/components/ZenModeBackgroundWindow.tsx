/**
 * [INPUT]: 依赖 Tauri API、React 运行时、禅模式模块
 * [OUTPUT]: 对外提供 ZenModeBackgroundWindow
 * [POS]: 禅模式 feature 的界面组合单元，连接 禅模式 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import {
  ZEN_MODE_PREFERENCES_CHANGED_EVENT,
  loadZenModePreferences,
  markZenModeWindowReady,
  resolveZenBackgroundUrl,
  type ZenModePreferences,
} from "@/features/zen-mode/model/zenMode";

export function ZenModeBackgroundWindow() {
  const [preferences, setPreferences] = useState<ZenModePreferences>(() => loadZenModePreferences());
  const backgroundUrl = resolveZenBackgroundUrl(preferences.backgroundImagePath);
  const initialBackgroundUrlRef = useRef(backgroundUrl);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<ZenModePreferences>(ZEN_MODE_PREFERENCES_CHANGED_EVENT, (event) => {
      const nextPreferences = event.payload;
      void preloadBackground(resolveZenBackgroundUrl(nextPreferences.backgroundImagePath)).then(() => {
        if (!disposed) setPreferences(nextPreferences);
      });
    }).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void preloadBackground(initialBackgroundUrlRef.current).then(() => {
      if (!cancelled) void markZenModeWindowReady();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="zen-background-root" style={{ backgroundImage: `url(${JSON.stringify(backgroundUrl)})` }}>
      <div className="zen-mode-backdrop" />
    </main>
  );
}

async function preloadBackground(url: string): Promise<void> {
  const backgroundImage = new window.Image();
  backgroundImage.src = url;
  await Promise.race([backgroundImage.decode().catch(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, 800))]);
}
