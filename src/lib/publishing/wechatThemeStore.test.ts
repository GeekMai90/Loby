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
    const raw = {
      schemaVersion: 1,
      themes: [theme],
      revisions: { [theme.id]: [theme] },
      redos: { [theme.id]: [theme] },
      conversations: { [theme.id]: [{ id: "1", role: "user", content: "更简洁" }] },
    };
    const normalized = normalizeWechatThemeStore(raw);

    normalized.themes[0].tokens.accent = "#000000";
    normalized.revisions[theme.id][0].brand.author = "另一位作者";
    normalized.redos[theme.id][0].tokens.accent = "#FFFFFF";
    normalized.conversations[theme.id][0].content = "已修改";

    expect(theme.tokens.accent).not.toBe("#000000");
    expect(theme.brand.author).not.toBe("另一位作者");
    expect(theme.tokens.accent).not.toBe("#FFFFFF");
    expect(raw.conversations[theme.id][0].content).toBe("更简洁");
  });

  it("rejects malformed persisted assistant messages", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    expect(() =>
      normalizeWechatThemeStore({
        schemaVersion: 1,
        themes: [theme],
        revisions: {},
        conversations: { [theme.id]: [{ role: "tool", content: 42 }] },
      }),
    ).toThrow("个人主题对话记录包含无效消息。");
  });
});
