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
    personal.baseStyle.colors.accent = "#000000";
    personal.custom?.htmlTransforms.push({ selector: "h2", operation: "append", html: "<span></span>" });

    expect(builtIn.baseStyle.colors.accent).not.toBe("#000000");
    expect(builtIn.custom?.htmlTransforms).toHaveLength(4);
  });

  it("rejects invalid saved data instead of silently applying it", () => {
    expect(() => normalizeWechatThemeStore({ schemaVersion: 1, themes: [{ id: "broken" }], revisions: {} })).toThrow(
      "个人主题数据包含无效主题。",
    );
    expect(() => normalizeWechatThemeStore({ schemaVersion: 2, themes: [], revisions: {} })).toThrow("个人主题数据格式无效。");
  });

  it("clones normalized theme source, histories, and conversation data", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("cream-paper"));
    const raw = {
      schemaVersion: 1,
      themes: [theme],
      revisions: { [theme.id]: [theme] },
      redos: { [theme.id]: [theme] },
      conversations: { [theme.id]: [{ id: "1", role: "user", content: "更简洁" }] },
    };
    const normalized = normalizeWechatThemeStore(raw);

    normalized.themes[0].baseStyle.colors.accent = "#000000";
    normalized.revisions[theme.id][0].baseStyle.typography.bodySize = 22;
    normalized.redos[theme.id][0].custom!.css = "h2{color:red}";
    normalized.conversations[theme.id][0].content = "已修改";

    expect(theme.baseStyle.colors.accent).not.toBe("#000000");
    expect(theme.baseStyle.typography.bodySize).not.toBe(22);
    expect(theme.custom?.css).not.toBe("h2{color:red}");
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
