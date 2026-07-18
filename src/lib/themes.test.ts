import { describe, expect, it } from "vitest";
import { normalizeAppThemePreference, normalizeEditorThemeId, resolveAppTheme } from "./themes";

describe("themes", () => {
  it("normalizes persisted application themes", () => {
    expect(normalizeAppThemePreference("light")).toBe("light");
    expect(normalizeAppThemePreference("dark")).toBe("dark");
    expect(normalizeAppThemePreference("unknown")).toBe("system");
  });

  it("normalizes persisted editor themes", () => {
    expect(normalizeEditorThemeId("graphite")).toBe("graphite");
    expect(normalizeEditorThemeId("vue")).toBe("vue");
    expect(normalizeEditorThemeId("lapis")).toBe("lapis");
    expect(normalizeEditorThemeId("unknown")).toBe("loby");
  });

  it("resolves system, light, and dark preferences", () => {
    expect(resolveAppTheme("system", true)).toBe("dark");
    expect(resolveAppTheme("system", false)).toBe("light");
    expect(resolveAppTheme("light", true)).toBe("light");
    expect(resolveAppTheme("dark", false)).toBe("dark");
  });
});
