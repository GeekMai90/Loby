import { describe, expect, it } from "vitest";
import { getWechatTheme } from "./wechatThemes";
import { createPersonalWechatTheme, normalizeWechatThemeStore } from "./wechatThemeStore";

describe("wechat theme store", () => {
  it("creates an independent personal copy of a bundled theme", () => {
    const builtIn = getWechatTheme("deep-blue-study");
    const personal = createPersonalWechatTheme(builtIn, "我的公众号主题");

    expect(personal.kind).toBe("personal");
    expect(personal.name).toBe("我的公众号主题");
    expect(personal.baseThemeId).toBe(builtIn.id);
    expect(personal.id).not.toBe(builtIn.id);

    personal.tokens.accent = "#000000";
    expect(builtIn.tokens.accent).not.toBe("#000000");
  });

  it("rejects invalid saved data instead of silently applying it", () => {
    expect(() => normalizeWechatThemeStore({ schemaVersion: 1, themes: [{ id: "broken" }], revisions: {} })).toThrow(
      "个人主题数据包含无效主题。",
    );
    expect(() => normalizeWechatThemeStore({ schemaVersion: 2, themes: [], revisions: {} })).toThrow("个人主题数据格式无效。");
  });

  it("clones normalized store data", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("cream-paper"));
    const raw = { schemaVersion: 1, themes: [theme], revisions: { [theme.id]: [theme] } };
    const normalized = normalizeWechatThemeStore(raw);

    normalized.themes[0].tokens.accent = "#000000";
    normalized.revisions[theme.id][0].brand.author = "另一位作者";

    expect(theme.tokens.accent).not.toBe("#000000");
    expect(theme.brand.author).not.toBe("另一位作者");
  });
});
