/**
 * [INPUT]: 依赖 Tauri invoke/listen、App 快捷键执行器、原生菜单可用态与 App 注入的菜单动作
 * [OUTPUT]: 对外提供 useNativeMenuBindings，维护打字机菜单勾选、10 个原生菜单事件映射及异步 listener 安全卸载
 * [POS]: app 组合层的桌面菜单适配边界；只把稳定原生事件路由到最新业务回调，不拥有快捷键启用规则或任何产品状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import type { AppShortcutId } from "@/shared/lib/keyboardShortcuts";

const MENU_SHORTCUT_EVENTS: ReadonlyArray<readonly [eventName: string, shortcutId: AppShortcutId]> = [
  ["loby://new-sheet", "newSheet"],
  ["loby://quick-capture", "quickCapture"],
  ["loby://open-settings", "openSettings"],
  ["loby://open-shortcuts", "openShortcuts"],
];

interface NativeMenuActions {
  runAppShortcut: (id: AppShortcutId) => boolean;
  onNewProject: () => void;
  onOpenWelcome: () => void;
  onCleanEmptySheets: () => void;
  onCleanUnusedImages: () => void;
  onImportMarkdown: () => void;
  onToggleTypewriterMode: () => void;
}

interface UseNativeMenuBindingsOptions extends NativeMenuActions {
  enabled: boolean;
  typewriterMode: boolean;
}

export function useNativeMenuBindings({ enabled, typewriterMode, ...actions }: UseNativeMenuBindingsOptions) {
  const actionsRef = useRef<NativeMenuActions>(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    if (!enabled) return;
    void invoke("set_typewriter_mode_menu_checked", { checked: typewriterMode }).catch(() => undefined);
  }, [enabled, typewriterMode]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let unlistenHandlers: UnlistenFn[] = [];
    const registrations = [
      ...MENU_SHORTCUT_EVENTS.map(([eventName, shortcutId]) => listen(eventName, () => actionsRef.current.runAppShortcut(shortcutId))),
      listen("loby://new-project", () => actionsRef.current.onNewProject()),
      listen("loby://open-welcome", () => actionsRef.current.onOpenWelcome()),
      listen("loby://clean-empty-sheets", () => actionsRef.current.onCleanEmptySheets()),
      listen("loby://clean-unused-images", () => actionsRef.current.onCleanUnusedImages()),
      listen("loby://import-markdown", () => actionsRef.current.onImportMarkdown()),
      listen("loby://toggle-typewriter-mode", () => actionsRef.current.onToggleTypewriterMode()),
    ];

    void Promise.all(
      registrations.map(async (registration) => {
        try {
          return await registration;
        } catch {
          return undefined;
        }
      }),
    ).then((handlers) => {
      const registeredHandlers = handlers.filter((handler): handler is UnlistenFn => Boolean(handler));
      if (disposed) registeredHandlers.forEach((handler) => handler());
      else unlistenHandlers = registeredHandlers;
    });

    return () => {
      disposed = true;
      unlistenHandlers.forEach((handler) => handler());
    };
  }, [enabled]);
}
