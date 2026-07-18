import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { isWechatThemeChangeRequestCurrent, parseWechatThemeChange } from "./wechatThemeChange";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme change protocol", () => {
  it("accepts a complete open theme with free CSS and HTML transforms", () => {
    const current = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const changed = {
      ...current,
      baseStyle: {
        ...current.baseStyle,
        colors: { ...current.baseStyle.colors, accent: "#24513B" },
      },
      custom: {
        css: 'h2::before{content:"✦";color:var(--loby-accent)}',
        htmlTransforms: [{ selector: "h2", operation: "append" as const, html: "<span>{{index2}}</span>" }],
      },
    };
    const result = parseWechatThemeChange(
      `\`\`\`loby-wechat-theme-change\n${JSON.stringify({ message: "已加入新的标题装饰。", theme: changed })}\n\`\`\``,
      current,
      new Date("2026-07-16T08:00:00.000Z"),
    );

    expect(result.theme.baseStyle.colors.accent).toBe("#24513B");
    expect(result.theme.custom?.css).toContain("::before");
    expect(result.theme.updatedAt).toBe("2026-07-16T08:00:00.000Z");
  });

  it("recovers one misplaced structural closing brace when the complete theme remains unambiguous", () => {
    const current = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const reorderedTheme = {
      baseStyle: current.baseStyle,
      baseThemeId: current.baseThemeId,
      createdAt: current.createdAt,
      custom: current.custom,
      description: current.description,
      id: current.id,
      kind: current.kind,
      name: current.name,
      schemaVersion: current.schemaVersion,
      swatches: current.swatches,
      updatedAt: current.updatedAt,
    };
    const validPayload = JSON.stringify({ message: "已修复标题序号。", theme: reorderedTheme });
    const misplacedBraceIndex = validPayload.indexOf(',"description":');
    const malformedPayload = validPayload.slice(0, misplacedBraceIndex) + "}" + validPayload.slice(misplacedBraceIndex);

    const result = parseWechatThemeChange(
      `\`\`\`loby-wechat-theme-change\n${malformedPayload}\n\`\`\``,
      current,
      new Date("2026-07-17T07:30:00.000Z"),
    );

    expect(result.message).toBe("已修复标题序号。");
    expect(result.theme.id).toBe(current.id);
    expect(result.theme.custom).toEqual(current.custom);
    expect(result.theme.updatedAt).toBe("2026-07-17T07:30:00.000Z");
  });

  it("does not guess when malformed JSON cannot be recovered as one complete valid theme", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    const payload = JSON.stringify({ message: "完成", theme: current });

    expect(() => parseWechatThemeChange(`\`\`\`loby-wechat-theme-change\n${payload}}}\n\`\`\``, current)).toThrow(
      "AI 返回的主题 JSON 无法解析。",
    );
  });

  it("rejects prose, partial patches, and changed identity fields", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    expect(() => parseWechatThemeChange("我已经修改好了。", current)).toThrow("AI 没有返回有效的公众号主题修改协议。");
    expect(() => parseWechatThemeChange('```loby-wechat-theme-change\n{"message":"完成","theme":{"baseStyle":{}}}\n```', current)).toThrow(
      "AI 返回的主题未通过校验",
    );

    const changedId = { ...current, id: "another-theme" };
    expect(() =>
      parseWechatThemeChange(`\`\`\`loby-wechat-theme-change\n${JSON.stringify({ message: "完成", theme: changedId })}\n\`\`\``, current),
    ).toThrow("AI 修改了主题的只读身份字段");
  });

  it("detects a response made stale by switching or editing the active theme", () => {
    const requestTheme = { id: "theme-one", updatedAt: "2026-07-16T08:00:00.000Z" };
    expect(isWechatThemeChangeRequestCurrent(requestTheme, requestTheme)).toBe(true);
    expect(isWechatThemeChangeRequestCurrent(requestTheme, { ...requestTheme, id: "theme-two" })).toBe(false);
    expect(isWechatThemeChangeRequestCurrent(requestTheme, { ...requestTheme, updatedAt: "2026-07-16T08:01:00.000Z" })).toBe(false);
  });
});
