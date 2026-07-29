/**
 * [INPUT]: 依赖 Vitest 与 editorTypewriter 纯几何计算
 * [OUTPUT]: 验证打字机模式在常规、短视口与无效几何下的首尾居中空间
 * [POS]: editor model 的打字机滚动回归测试，防止模式退化为无可滚动空间的单次 scrollIntoView
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { typewriterContentPadding } from "@/features/editor/model/editorTypewriter";

describe("typewriterContentPadding", () => {
  it("centers the first and last line within a regular editor viewport", () => {
    expect(typewriterContentPadding(700, 80, 32)).toEqual({ top: 254, bottom: 334 });
  });

  it("keeps the normal bottom safety area in a short viewport", () => {
    expect(typewriterContentPadding(220, 80, 32)).toEqual({ top: 14, bottom: 128 });
  });

  it("never returns negative padding for unavailable geometry", () => {
    expect(typewriterContentPadding(0, 80, 32)).toEqual({ top: 0, bottom: 128 });
  });
});
