import { useCallback, useEffect, useRef } from "react";
import { findMatchingAppShortcut, type AppShortcutId } from "../lib/keyboardShortcuts";

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
