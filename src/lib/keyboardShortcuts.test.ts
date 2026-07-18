import { describe, expect, it } from "vitest";
import {
  APP_SHORTCUT_LIST,
  APP_SHORTCUTS,
  appShortcutAriaKeys,
  codeMirrorShortcutKey,
  findMatchingAppShortcut,
  formatAppShortcut,
  isPlatformModKeyPressed,
  matchesAppShortcut,
  platformModKeyLabel,
  type ShortcutKeyboardEvent,
} from "./keyboardShortcuts";

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
    expect(matchesAppShortcut(keyboardEvent({ key: "n", metaKey: true }), APP_SHORTCUTS.newProject)).toBe(false);
    expect(matchesAppShortcut(keyboardEvent({ key: "N", metaKey: true, shiftKey: true }), APP_SHORTCUTS.newProject)).toBe(true);
    expect(matchesAppShortcut(keyboardEvent({ key: "n", metaKey: true, shiftKey: true, altKey: true }), APP_SHORTCUTS.newProject)).toBe(
      false,
    );
  });

  it("uses the physical letter key when Option changes the produced character", () => {
    expect(matchesAppShortcut(keyboardEvent({ key: "ƒ", code: "KeyF", metaKey: true, altKey: true }), APP_SHORTCUTS.enterZenMode)).toBe(
      true,
    );
  });

  it("ignores composing and repeated events", () => {
    expect(findMatchingAppShortcut(keyboardEvent({ key: "j", metaKey: true, isComposing: true }))).toBeUndefined();
    expect(findMatchingAppShortcut(keyboardEvent({ key: "j", metaKey: true, repeat: true }))).toBeUndefined();
  });

  it("formats shortcuts for macOS and other platforms", () => {
    expect(formatAppShortcut(APP_SHORTCUTS.nextSheet, "mac")).toBe("⌘⌥↓");
    expect(formatAppShortcut(APP_SHORTCUTS.nextSheet, "other")).toBe("Ctrl+Alt+↓");
    expect(appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode, "mac")).toBe("Meta+Shift+f");
    expect(appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode, "other")).toBe("Control+Shift+f");
    expect(codeMirrorShortcutKey(APP_SHORTCUTS.heading1)).toBe("Mod-Alt-1");
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
