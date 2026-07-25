import { describe, expect, it } from "vitest";
import {
  APP_SHORTCUT_LIST,
  APP_SHORTCUTS,
  appShortcutAriaKeys,
  codeMirrorShortcutKey,
  findMatchingAppShortcut,
  formatAppShortcut,
  formatAppShortcutKeys,
  isPlatformModKeyPressed,
  matchesAppShortcut,
  platformModKeyLabel,
  type ShortcutKeyboardEvent,
} from "@/shared/lib/keyboardShortcuts";

function keyboardEvent(overrides: Partial<ShortcutKeyboardEvent> = {}): ShortcutKeyboardEvent {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

describe("app keyboard shortcuts", () => {
  it("keeps shortcut ids and key combinations unique", () => {
    const ids = APP_SHORTCUT_LIST.map((shortcut) => shortcut.id);
    const combinations = APP_SHORTCUT_LIST.map(
      (shortcut) => `${[...shortcut.modifiers].sort().join("+")}:${shortcut.key.toLocaleLowerCase()}`,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(combinations).size).toBe(combinations.length);
  });

  it("matches the platform modifier through Command or Control", () => {
    expect(matchesAppShortcut(keyboardEvent({ key: ",", metaKey: true }), APP_SHORTCUTS.openSettings)).toBe(true);
    expect(matchesAppShortcut(keyboardEvent({ key: ",", ctrlKey: true }), APP_SHORTCUTS.openSettings)).toBe(true);
    expect(matchesAppShortcut(keyboardEvent({ key: "d", metaKey: true }), APP_SHORTCUTS.quickCapture)).toBe(true);
  });

  it("requires an exact modifier set", () => {
    expect(matchesAppShortcut(keyboardEvent({ key: "/", metaKey: true }), APP_SHORTCUTS.openShortcuts)).toBe(true);
    expect(matchesAppShortcut(keyboardEvent({ key: "/", metaKey: true, shiftKey: true }), APP_SHORTCUTS.openShortcuts)).toBe(false);
    expect(matchesAppShortcut(keyboardEvent({ key: "/", metaKey: true, altKey: true }), APP_SHORTCUTS.openShortcuts)).toBe(false);
  });

  it("matches shifted backslash by its physical key code", () => {
    expect(
      matchesAppShortcut(keyboardEvent({ key: "|", code: "Backslash", metaKey: true, shiftKey: true }), APP_SHORTCUTS.toggleLibraryRail),
    ).toBe(true);
    expect(matchesAppShortcut(keyboardEvent({ key: "\\", code: "Backslash", metaKey: true }), APP_SHORTCUTS.toggleNavigation)).toBe(true);
    expect(
      matchesAppShortcut(keyboardEvent({ key: "|", code: "Backslash", metaKey: true, shiftKey: true }), APP_SHORTCUTS.toggleNavigation),
    ).toBe(false);
    expect(formatAppShortcut(APP_SHORTCUTS.toggleLibraryRail, "mac")).toBe("⌘⇧\\");
  });

  it("ignores composing, repeated, and already consumed events", () => {
    expect(findMatchingAppShortcut(keyboardEvent({ key: "j", metaKey: true, isComposing: true }))).toBeUndefined();
    expect(findMatchingAppShortcut(keyboardEvent({ key: "j", metaKey: true, repeat: true }))).toBeUndefined();
    expect(findMatchingAppShortcut(keyboardEvent({ key: "/", metaKey: true, defaultPrevented: true }))).toBeUndefined();
  });

  it("keeps removed shortcuts out of the registry and assigns search to Command P", () => {
    const shortcutIds = new Set(APP_SHORTCUT_LIST.map((shortcut) => shortcut.id));
    const removedShortcutIds = [
      "newProject",
      "heading1",
      "heading2",
      "bulletList",
      "quote",
      "task",
      "previousSheet",
      "nextSheet",
      "togglePreview",
    ];

    expect(removedShortcutIds.every((id) => !shortcutIds.has(id))).toBe(true);
    expect(formatAppShortcut(APP_SHORTCUTS.searchSheets, "mac")).toBe("⌘P");
  });

  it("formats shortcuts for macOS and other platforms", () => {
    expect(formatAppShortcut(APP_SHORTCUTS.searchSheets, "mac")).toBe("⌘P");
    expect(formatAppShortcut(APP_SHORTCUTS.searchSheets, "other")).toBe("Ctrl+P");
    expect(formatAppShortcutKeys(APP_SHORTCUTS.toggleFocusMode, "mac")).toEqual(["⌘", "⇧", "F"]);
    expect(formatAppShortcutKeys(APP_SHORTCUTS.toggleFocusMode, "other")).toEqual(["Ctrl", "Shift", "F"]);
    expect(appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode, "mac")).toBe("Meta+Shift+f");
    expect(appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode, "other")).toBe("Control+Shift+f");
    expect(codeMirrorShortcutKey(APP_SHORTCUTS.inlineCode)).toBe("Mod-e");
  });

  it("uses the platform-specific primary modifier", () => {
    expect(platformModKeyLabel("mac")).toBe("⌘");
    expect(platformModKeyLabel("other")).toBe("Ctrl");
    expect(isPlatformModKeyPressed({ metaKey: true, ctrlKey: false }, "mac")).toBe(true);
    expect(isPlatformModKeyPressed({ metaKey: false, ctrlKey: true }, "mac")).toBe(false);
    expect(isPlatformModKeyPressed({ metaKey: false, ctrlKey: true }, "other")).toBe(true);
    expect(isPlatformModKeyPressed({ metaKey: true, ctrlKey: false }, "other")).toBe(false);
  });
});
