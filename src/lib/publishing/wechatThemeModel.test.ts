import { describe, expect, it } from "vitest";
import {
  cloneWechatThemeManifest,
  getWechatThemeValidationIssues,
  isWechatThemeManifest,
  normalizeWechatThemeManifest,
  wechatThemeColorToPickerValue,
} from "./wechatThemeModel";
import { getWechatTheme, WECHAT_THEMES } from "./wechatThemes";

describe("wechat theme model", () => {
  it("accepts every bundled open theme", () => {
    for (const theme of WECHAT_THEMES) {
      expect(getWechatThemeValidationIssues(theme)).toEqual([]);
      expect(isWechatThemeManifest(theme)).toBe(true);
    }
  });

  it("reports malformed base controls before a theme can be persisted", () => {
    const source = getWechatTheme("loby-basic");
    const invalidTheme = {
      ...source,
      id: "包含 空格",
      baseStyle: {
        ...source.baseStyle,
        typography: { ...source.baseStyle.typography, bodySize: 1000 },
        colors: { ...source.baseStyle.colors, accent: "red;position:fixed" },
      },
    };

    expect(getWechatThemeValidationIssues(invalidTheme)).toEqual(
      expect.arrayContaining(["主题 ID 无效。", "主题字体参数 bodySize 无效。", "主题颜色参数 accent 无效。"]),
    );
  });

  it("accepts free presentation CSS and reusable HTML transforms", () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.custom = {
      css: 'h2::before{content:"✦";display:inline-block;margin-right:8px} .custom{background:linear-gradient(90deg,#fff,#000)}',
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="custom">{{content}}</span>',
        },
      ],
    };

    expect(getWechatThemeValidationIssues(theme)).toEqual([]);
  });

  it("shows translucent colors with their actual RGB channels in the native picker", () => {
    expect(wechatThemeColorToPickerValue("rgba(79,111,255,0.14)")).toBe("#4F6FFF");
    expect(wechatThemeColorToPickerValue("#abc8")).toBe("#AABBCC");
  });

  it("clones all nested base values and open theme source", () => {
    const source = getWechatTheme("grace");
    const copy = cloneWechatThemeManifest(source);

    copy.baseStyle.colors.accent = "#000000";
    copy.baseStyle.typography.bodySize = 20;
    copy.custom?.htmlTransforms.push({ selector: "h2", operation: "prepend", html: "<i></i>" });
    copy.swatches[0] = "#000000";

    expect(source.baseStyle.colors.accent).not.toBe("#000000");
    expect(source.baseStyle.typography.bodySize).not.toBe(20);
    expect(source.custom?.htmlTransforms).toHaveLength(0);
    expect(source.source).toEqual(getWechatTheme("grace").source);
    expect(source.swatches[0]).not.toBe("#000000");
  });

  it("migrates persisted v1 themes to the open v2 model", () => {
    const migrated = normalizeWechatThemeManifest({
      schemaVersion: 1,
      id: "legacy-theme",
      kind: "personal",
      name: "旧主题",
      description: "旧主题",
      baseThemeId: "loby-basic",
      swatches: ["#24513B", "#111111", "#FFFFFF"],
      tokens: {
        accent: "#24513B",
        pageBackground: "#FFFFFF",
        headingTitle: "#111111",
        paragraphText: "#333333",
        emphasisText: "#24513B",
        linkText: "#24513B",
        markBackground: "#EEEEEE",
        markText: "#111111",
        radius: "18px",
      },
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.baseStyle.colors.accent).toBe("#24513B");
    expect(migrated?.baseStyle.colors.markColor).toBe("#EEEEEE");
    expect(migrated?.baseStyle.layout.radius).toBe(18);
    expect(migrated?.custom?.css).toContain("article-title");
  });

  it("migrates early v2 drafts that used two mark colors", () => {
    const draft = cloneWechatThemeManifest(getWechatTheme("loby-basic")) as unknown as Record<string, unknown>;
    const baseStyle = draft.baseStyle as Record<string, Record<string, unknown>>;
    delete baseStyle.colors.markColor;
    baseStyle.colors.markBackground = "#FFF2A8";
    baseStyle.colors.markText = "#111111";

    const migrated = normalizeWechatThemeManifest(draft);

    expect(migrated?.baseStyle.colors.markColor).toBe("#FFF2A8");
    expect(migrated?.baseStyle.colors).not.toHaveProperty("markBackground");
    expect(migrated?.baseStyle.colors).not.toHaveProperty("markText");
  });
});
