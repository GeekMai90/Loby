import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { applyWechatThemeBaseStyleChange } from "./wechatThemeBaseStyle";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme base style changes", () => {
  it("merges one manual field into the latest personal theme without mutating it", () => {
    const current = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    const next = applyWechatThemeBaseStyleChange(current, { group: "typography", key: "bodySize", value: 17 }, "2026-07-17T01:00:00.000Z");

    expect(next.baseStyle.typography.bodySize).toBe(17);
    expect(current.baseStyle.typography.bodySize).toBe(15);
    expect(next.updatedAt).toBe("2026-07-17T01:00:00.000Z");
  });

  it("updates representative swatches when a manual color changes", () => {
    const current = createPersonalWechatTheme(getWechatTheme("cream-paper"));
    const next = applyWechatThemeBaseStyleChange(current, { group: "colors", key: "accent", value: "#24513B" });

    expect(next.baseStyle.colors.accent).toBe("#24513B");
    expect(next.swatches).toEqual(["#24513B", current.baseStyle.colors.titleText, current.baseStyle.colors.pageBackground]);
  });

  it("keeps changes to separate controls when they are applied in sequence", () => {
    const current = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    const withPadding = applyWechatThemeBaseStyleChange(current, { group: "layout", key: "contentPadding", value: 20 });
    const withColor = applyWechatThemeBaseStyleChange(withPadding, { group: "colors", key: "bodyText", value: "#222222" });

    expect(withColor.baseStyle.layout.contentPadding).toBe(20);
    expect(withColor.baseStyle.colors.bodyText).toBe("#222222");
  });
});
