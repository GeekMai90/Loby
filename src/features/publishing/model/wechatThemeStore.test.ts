// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";
import { createPersonalWechatTheme, loadWechatThemeStore, normalizeWechatThemeStore } from "@/features/publishing/model/wechatThemeStore";

describe("wechat theme store", () => {
  beforeEach(() => localStorage.clear());

  it("creates an independent personal copy of a bundled theme", () => {
    const builtIn = getWechatTheme("loby-basic");
    const personal = createPersonalWechatTheme(builtIn, "我的公众号主题");

    expect(personal.kind).toBe("personal");
    expect(personal.name).toBe("我的公众号主题");
    expect(personal.baseThemeId).toBe(builtIn.id);
    expect(personal.id).not.toBe(builtIn.id);
    personal.baseStyle.colors.accent = "#000000";
    personal.custom?.htmlTransforms.push({ selector: "h2", operation: "append", html: "<span></span>" });

    expect(builtIn.baseStyle.colors.accent).not.toBe("#000000");
    expect(builtIn.custom?.htmlTransforms).toHaveLength(0);
  });

  it("rejects invalid saved data instead of silently applying it", () => {
    expect(() => normalizeWechatThemeStore({ schemaVersion: 1, themes: [{ id: "broken" }], revisions: {} })).toThrow(
      "个人主题数据包含无效主题。",
    );
    expect(() => normalizeWechatThemeStore({ schemaVersion: 3, themes: [], revisions: {} })).toThrow("个人主题数据格式无效。");
  });

  it("migrates version one stores with default theme preferences", () => {
    const normalized = normalizeWechatThemeStore({ schemaVersion: 1, themes: [], revisions: {} });

    expect(normalized.schemaVersion).toBe(2);
    expect(normalized.preferences).toEqual({ defaultThemeId: "loby-basic", favoriteThemeIds: [] });
  });

  it("normalizes legacy theme namespaces across current, revision, and redo snapshots", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    theme.custom = {
      css: '[data-nibva-role="article-body"] h2{color:var(--nibva-accent)}',
      htmlTransforms: [{ selector: '[data-nibva-publish="wechat"]', operation: "append", html: "<p>落款</p>" }],
    };

    const normalized = normalizeWechatThemeStore({
      schemaVersion: 2,
      themes: [theme],
      revisions: { [theme.id]: [theme] },
      redos: { [theme.id]: [theme] },
    });

    expect(JSON.stringify(normalized.themes)).not.toContain("nibva-");
    expect(JSON.stringify(normalized.revisions)).not.toContain("nibva-");
    expect(JSON.stringify(normalized.redos)).not.toContain("nibva-");
    expect(JSON.stringify(normalized)).toContain("loby-");
  });

  it("persists a browser-store namespace migration after loading", async () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    theme.custom = {
      css: '[data-nibva-role="article-body"] h2{color:var(--nibva-accent)}',
      htmlTransforms: [],
    };
    localStorage.setItem("loby.publish.wechat.personal-themes.v1", JSON.stringify({ schemaVersion: 2, themes: [theme], revisions: {} }));

    const loaded = await loadWechatThemeStore("/tmp/library");
    const persisted = localStorage.getItem("loby.publish.wechat.personal-themes.v1") ?? "";

    expect(loaded.themes[0].custom?.css).toContain("data-loby-role");
    expect(persisted).toContain("data-loby-role");
    expect(persisted).not.toContain("nibva-");
  });

  it("normalizes default and favorite theme preferences", () => {
    const normalized = normalizeWechatThemeStore({
      schemaVersion: 2,
      themes: [],
      revisions: {},
      preferences: {
        defaultThemeId: "grace",
        favoriteThemeIds: ["grace", "classic", "grace", "INVALID THEME"],
      },
    });

    expect(normalized.preferences).toEqual({ defaultThemeId: "grace", favoriteThemeIds: ["grace", "classic"] });
  });

  it("clones normalized theme source, histories, and conversation data", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("grace"));
    const raw = {
      schemaVersion: 1,
      themes: [theme],
      revisions: { [theme.id]: [theme] },
      redos: { [theme.id]: [theme] },
      conversations: {
        [theme.id]: [
          {
            id: "1",
            role: "user",
            content: "更简洁",
            images: [
              {
                id: "/tmp/loby/image.png",
                name: "image.png",
                path: "/tmp/loby/image.png",
                mimeType: "image/png",
                sizeBytes: 128,
              },
            ],
          },
        ],
      },
    };
    const normalized = normalizeWechatThemeStore(raw);

    normalized.themes[0].baseStyle.colors.accent = "#000000";
    normalized.revisions[theme.id][0].baseStyle.typography.bodySize = 22;
    normalized.redos[theme.id][0].custom!.css = "h2{color:red}";
    normalized.conversations[theme.id][0].messages[0].content = "已修改";

    expect(theme.baseStyle.colors.accent).not.toBe("#000000");
    expect(theme.baseStyle.typography.bodySize).not.toBe(22);
    expect(theme.custom?.css).not.toBe("h2{color:red}");
    expect(raw.conversations[theme.id][0].content).toBe("更简洁");
    expect(normalized.conversations[theme.id][0].messages[0].images).toBeUndefined();
    expect(normalized.conversations[theme.id][0].title).toBe("更简洁");
  });

  it("keeps an anonymous marker when stripping an image-only theme message", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const normalized = normalizeWechatThemeStore({
      schemaVersion: 1,
      themes: [theme],
      revisions: {},
      conversations: {
        [theme.id]: [
          {
            id: "1",
            role: "user",
            content: "",
            images: [
              {
                id: "/tmp/loby/reference.png",
                name: "reference.png",
                path: "/tmp/loby/reference.png",
                mimeType: "image/png",
                sizeBytes: 128,
              },
            ],
          },
        ],
      },
    });

    expect(normalized.conversations[theme.id][0].messages[0]).toEqual({ id: "1", role: "user", content: "[图片附件]" });
    expect(JSON.stringify(normalized)).not.toContain("reference.png");
  });

  it("rejects malformed persisted assistant messages", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    expect(() =>
      normalizeWechatThemeStore({
        schemaVersion: 1,
        themes: [theme],
        revisions: {},
        conversations: { [theme.id]: [{ role: "tool", content: 42 }] },
      }),
    ).toThrow("个人主题对话记录包含无效消息。");
  });

  it("preserves validated assistant run steps and rejects malformed run data", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const run = {
      status: "completed",
      activities: [
        {
          id: "reasoning-1",
          rawType: "item/reasoning/textDelta",
          title: "思考过程",
          status: "completed",
          command: "",
          output: "检查标题层级",
          text: "",
          exitCode: null,
        },
      ],
      usage: {
        inputTokens: 100,
        cachedInputTokens: 50,
        outputTokens: 20,
        reasoningOutputTokens: 10,
      },
    };
    const normalized = normalizeWechatThemeStore({
      schemaVersion: 1,
      themes: [theme],
      revisions: {},
      conversations: {
        [theme.id]: [{ id: "assistant-1", role: "assistant", content: "已经调整主题。", run }],
      },
    });

    expect(normalized.conversations[theme.id][0].messages[0].run).toEqual(run);
    expect(() =>
      normalizeWechatThemeStore({
        schemaVersion: 1,
        themes: [theme],
        revisions: {},
        conversations: {
          [theme.id]: [
            {
              id: "assistant-2",
              role: "assistant",
              content: "无效运行记录",
              run: { status: "completed", activities: "broken", usage: null },
            },
          ],
        },
      }),
    ).toThrow("个人主题对话记录包含无效消息。");
  });

  it("preserves multiple theme conversations and their active selection", () => {
    const theme = createPersonalWechatTheme(getWechatTheme("loby-basic"));
    const conversation = (id: string, title: string) => ({
      id,
      title,
      messages: [{ id: `${id}-message`, role: "user", content: title }],
      agentThreadId: `${id}-thread`,
      themeContextUpdatedAt: "2026-07-21T18:00:00.000Z",
      themeContextVersion: 2,
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
    const normalized = normalizeWechatThemeStore({
      schemaVersion: 1,
      themes: [theme],
      revisions: {},
      conversations: { [theme.id]: [conversation("chat-1", "调整标题"), conversation("chat-2", "调整配色")] },
      activeConversationIds: { [theme.id]: "chat-2" },
    });

    expect(normalized.conversations[theme.id].map((item) => item.title)).toEqual(["调整标题", "调整配色"]);
    expect(normalized.activeConversationIds[theme.id]).toBe("chat-2");
    expect(normalized.conversations[theme.id][1].agentThreadId).toBe("chat-2-thread");
    expect(normalized.conversations[theme.id][1].themeContextUpdatedAt).toBe("2026-07-21T18:00:00.000Z");
    expect(normalized.conversations[theme.id][1].themeContextVersion).toBe(2);
  });
});
