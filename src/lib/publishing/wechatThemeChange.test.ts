import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { isWechatThemeChangeRequestCurrent, parseWechatThemeAgentResult, parseWechatThemeChange } from "./wechatThemeChange";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme change protocol", () => {
  it("returns a message without mutating the theme for conversational questions", () => {
    const current = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const result = parseWechatThemeAgentResult('```loby-wechat-theme-result\n{"message":"这轮只解释兼容性，主题没有修改。"}\n```', current);

    expect(result).toEqual({ message: "这轮只解释兼容性，主题没有修改。" });
  });

  it("merges a partial theme patch locally and preserves omitted and immutable fields", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    const result = parseWechatThemeAgentResult(
      `\`\`\`loby-wechat-theme-result\n${JSON.stringify({
        message: "已调整标题颜色和段落间距。",
        themePatch: {
          baseStyle: {
            colors: { accent: "#24513B" },
            typography: { paragraphSpacing: 22 },
          },
        },
      })}\n\`\`\``,
      current,
      new Date("2026-07-21T18:00:00.000Z"),
    );

    expect(result.theme?.baseStyle.colors.accent).toBe("#24513B");
    expect(result.theme?.baseStyle.typography.paragraphSpacing).toBe(22);
    expect(result.theme?.baseStyle.colors.bodyText).toBe(current.baseStyle.colors.bodyText);
    expect(result.theme?.id).toBe(current.id);
    expect(result.theme?.createdAt).toBe(current.createdAt);
    expect(result.theme?.updatedAt).toBe("2026-07-21T18:00:00.000Z");
  });

  it("rejects immutable or unknown fields in a partial theme patch", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    const output = `\`\`\`loby-wechat-theme-result\n${JSON.stringify({
      message: "完成",
      themePatch: { id: "another-theme" },
    })}\n\`\`\``;

    expect(() => parseWechatThemeAgentResult(output, current)).toThrow("包含不支持的字段：id");
  });

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

  it("normalizes legacy Nibva namespace values returned by the theme assistant", () => {
    const current = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    const changed = {
      ...current,
      custom: {
        css: '[data-nibva-role="article-body"] h2{color:var(--nibva-accent)}',
        htmlTransforms: [
          {
            selector: '[data-nibva-publish="wechat"]',
            operation: "append",
            html: '<p class="nibva-signature">落款</p>',
          },
        ],
      },
    };

    const result = parseWechatThemeChange(
      `\`\`\`loby-wechat-theme-change\n${JSON.stringify({ message: "已恢复旧主题装饰。", theme: changed })}\n\`\`\``,
      current,
      new Date("2026-07-21T16:00:00.000Z"),
    );

    expect(JSON.stringify(result.theme.custom)).not.toContain("nibva-");
    expect(result.theme.custom?.css).toContain("data-loby-role");
    expect(result.theme.custom?.htmlTransforms[0].selector).toContain("data-loby-publish");
  });

  it("does not guess when malformed JSON cannot be recovered as one complete valid theme", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    const payload = JSON.stringify({ message: "完成", theme: current });

    expect(() => parseWechatThemeChange(`\`\`\`loby-wechat-theme-change\n${payload}}}\n\`\`\``, current)).toThrow(
      "AI 返回的主题 JSON 无法解析。",
    );
  });

  it("rejects prose, incomplete legacy themes, and changed legacy identity fields", () => {
    const current = createPersonalWechatTheme(getWechatTheme("grace"));
    expect(() => parseWechatThemeChange("我已经修改好了。", current)).toThrow("AI 没有返回有效的公众号主题结果协议。");
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
