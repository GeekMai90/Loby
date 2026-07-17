import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { isWechatThemeChangeRequestCurrent, parseWechatThemeChange } from "./wechatThemeChange";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme change protocol", () => {
  it("accepts a complete open theme with free CSS and HTML transforms", () => {
    const current = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    const changed = {
      ...current,
      baseStyle: {
        ...current.baseStyle,
        colors: { ...current.baseStyle.colors, accent: "#24513B" },
      },
      custom: {
        css: 'h2::before{content:"✦";color:var(--nibva-accent)}',
        htmlTransforms: [{ selector: "h2", operation: "append" as const, html: "<span>{{index2}}</span>" }],
      },
    };
    const result = parseWechatThemeChange(
      `\`\`\`nibva-wechat-theme-change\n${JSON.stringify({ message: "已加入新的标题装饰。", theme: changed })}\n\`\`\``,
      current,
      new Date("2026-07-16T08:00:00.000Z"),
    );

    expect(result.theme.baseStyle.colors.accent).toBe("#24513B");
    expect(result.theme.custom?.css).toContain("::before");
    expect(result.theme.updatedAt).toBe("2026-07-16T08:00:00.000Z");
  });

  it("rejects prose, partial patches, and changed identity fields", () => {
    const current = createPersonalWechatTheme(getWechatTheme("cream-paper"));
    expect(() => parseWechatThemeChange("我已经修改好了。", current)).toThrow("AI 没有返回有效的公众号主题修改协议。");
    expect(() => parseWechatThemeChange('```nibva-wechat-theme-change\n{"message":"完成","theme":{"baseStyle":{}}}\n```', current)).toThrow(
      "AI 返回的主题未通过校验",
    );

    const changedId = { ...current, id: "another-theme" };
    expect(() =>
      parseWechatThemeChange(`\`\`\`nibva-wechat-theme-change\n${JSON.stringify({ message: "完成", theme: changedId })}\n\`\`\``, current),
    ).toThrow("AI 修改了主题的只读身份字段");
  });

  it("detects a response made stale by switching or editing the active theme", () => {
    const requestTheme = { id: "theme-one", updatedAt: "2026-07-16T08:00:00.000Z" };
    expect(isWechatThemeChangeRequestCurrent(requestTheme, requestTheme)).toBe(true);
    expect(isWechatThemeChangeRequestCurrent(requestTheme, { ...requestTheme, id: "theme-two" })).toBe(false);
    expect(isWechatThemeChangeRequestCurrent(requestTheme, { ...requestTheme, updatedAt: "2026-07-16T08:01:00.000Z" })).toBe(false);
  });
});
