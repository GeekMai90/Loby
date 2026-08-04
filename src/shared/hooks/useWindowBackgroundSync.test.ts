// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、happy-dom 计算样式与 readThemeBackgroundColor
 * [OUTPUT]: 验证只有合法十六进制 --background 才会被送进原生窗口层
 * [POS]: shared 窗口材质适配器的取值回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, describe, expect, it } from "vitest";
import { readThemeBackgroundColor } from "@/shared/hooks/useWindowBackgroundSync";

afterEach(() => {
  document.documentElement.style.removeProperty("--background");
});

describe("readThemeBackgroundColor", () => {
  it("reads the hex background token of the active theme", () => {
    document.documentElement.style.setProperty("--background", "#1d1e1f");
    expect(readThemeBackgroundColor()).toBe("#1d1e1f");
  });

  it("falls back to the native default when the token is not a hex literal", () => {
    document.documentElement.style.setProperty("--background", "oklch(0.98 0 0)");
    expect(readThemeBackgroundColor()).toBeNull();
  });

  it("falls back to the native default when the token is missing", () => {
    expect(readThemeBackgroundColor()).toBeNull();
  });
});
