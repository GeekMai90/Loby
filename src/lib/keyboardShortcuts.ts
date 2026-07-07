export type AppShortcutId = "openSettings";

export interface AppShortcut {
  id: AppShortcutId;
  label: string;
  key: string;
  modifier: "mod";
}

export const APP_SHORTCUTS: Record<AppShortcutId, AppShortcut> = {
  openSettings: {
    id: "openSettings",
    label: "⌘,",
    key: ",",
    modifier: "mod",
  },
};

export function matchesAppShortcut(event: KeyboardEvent, shortcut: AppShortcut) {
  const modifierMatched = shortcut.modifier === "mod" && (event.metaKey || event.ctrlKey);
  return modifierMatched && !event.altKey && !event.shiftKey && event.key === shortcut.key;
}
