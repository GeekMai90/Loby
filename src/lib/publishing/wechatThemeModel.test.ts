import { describe, expect, it } from "vitest";
import { cloneWechatThemeManifest, getWechatThemeValidationIssues, isWechatThemeManifest } from "./wechatThemeModel";
import { getWechatTheme, WECHAT_THEMES } from "./wechatThemes";

describe("wechat theme model", () => {
  it("accepts every bundled theme", () => {
    for (const theme of WECHAT_THEMES) {
      expect(getWechatThemeValidationIssues(theme)).toEqual([]);
      expect(isWechatThemeManifest(theme)).toBe(true);
    }
  });

  it("reports malformed AI theme output before it can be persisted", () => {
    const invalidTheme = {
      ...getWechatTheme("deep-blue-study"),
      id: "包含 空格",
      tokens: { accent: "" },
      brand: { author: "" },
    };

    expect(getWechatThemeValidationIssues(invalidTheme)).toEqual(
      expect.arrayContaining(["主题 ID 无效。", "主题样式变量 accent 无效。", "主题作者署名无效。"]),
    );
    expect(isWechatThemeManifest(invalidTheme)).toBe(false);
  });

  it("clones nested theme values before applying AI changes", () => {
    const source = getWechatTheme("cream-paper");
    const copy = cloneWechatThemeManifest(source);

    copy.tokens.accent = "#000000";
    copy.brand.footerText = "新的结尾";
    copy.swatches[0] = "#000000";

    expect(source.tokens.accent).not.toBe("#000000");
    expect(source.brand.footerText).not.toBe("新的结尾");
    expect(source.swatches[0]).not.toBe("#000000");
  });
});
