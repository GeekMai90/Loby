import { describe, expect, it } from "vitest";
import { isImeCompositionKey } from "./assistantComposer";

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
