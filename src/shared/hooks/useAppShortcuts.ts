/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 AppShortcutBinding、AppShortcutBindings、useAppShortcuts
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useRef } from "react";
import { findMatchingAppShortcut, type AppShortcutId } from "@/shared/lib/keyboardShortcuts";

export interface AppShortcutBinding {
  run: () => void;
  enabled?: boolean;
}

export type AppShortcutBindings = Partial<Record<AppShortcutId, AppShortcutBinding>>;

export function useAppShortcuts(bindings: AppShortcutBindings): (id: AppShortcutId) => boolean {
  const bindingsRef = useRef(bindings);

  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  const runShortcut = useCallback((id: AppShortcutId) => {
    const binding = bindingsRef.current[id];
    if (!binding || binding.enabled === false) return false;
    binding.run();
    return true;
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = findMatchingAppShortcut(event);
      if (!shortcut) return;
      if (!runShortcut(shortcut.id as AppShortcutId)) return;
      event.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runShortcut]);

  return runShortcut;
}
