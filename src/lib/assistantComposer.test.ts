import { describe, expect, it } from "vitest";
import { isImeCompositionKey, shouldSubmitAssistantComposer } from "./assistantComposer";

describe("assistant composer IME handling", () => {
  it("ignores keys while the composer is tracking an active composition", () => {
    expect(isImeCompositionKey({ isComposing: false }, true)).toBe(true);
  });

  it("ignores keys marked as composing by the browser", () => {
    expect(isImeCompositionKey({ isComposing: true })).toBe(true);
  });

  it("recognizes the WebKit IME fallback key code", () => {
    expect(isImeCompositionKey({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it("allows an ordinary Enter key to continue to the send handler", () => {
    expect(isImeCompositionKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });
});

describe("assistant composer send shortcut", () => {
  it("uses Enter by default while keeping Shift+Enter for a newline", () => {
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, shiftKey: false }, "enter")).toBe(true);
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, shiftKey: true }, "enter")).toBe(false);
  });

  it("requires Command+Enter in mod-enter mode", () => {
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, shiftKey: false }, "mod-enter")).toBe(false);
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: true, shiftKey: false }, "mod-enter")).toBe(true);
  });

  it("does not submit for other keys", () => {
    expect(shouldSubmitAssistantComposer({ key: "Tab", metaKey: true, shiftKey: false }, "mod-enter")).toBe(false);
  });
});
