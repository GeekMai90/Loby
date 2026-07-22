import { describe, expect, it } from "vitest";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";
import {
  createImportedWechatTheme,
  parseWechatThemeFile,
  safeThemeFilename,
  serializeWechatThemeFile,
  WECHAT_THEME_FILE_FORMAT,
} from "@/features/publishing/model/wechatThemeFile";

describe("standalone WeChat theme files", () => {
  it("round-trips a complete theme manifest inside a versioned envelope", () => {
    const source = getWechatTheme("grace");
    const content = serializeWechatThemeFile(source);
    const payload = JSON.parse(content) as Record<string, unknown>;

    expect(payload).toMatchObject({ format: WECHAT_THEME_FILE_FORMAT, formatVersion: 1 });
    expect(parseWechatThemeFile(content)).toEqual(source);
  });

  it("imports every file as a new editable personal theme", () => {
    const source = getWechatTheme("classic");
    const imported = createImportedWechatTheme(source);

    expect(imported).toMatchObject({ kind: "personal", name: source.name, baseThemeId: source.id });
    expect(imported.id).not.toBe(source.id);
    expect(imported.baseStyle).toEqual(source.baseStyle);
    expect(imported.custom).toEqual(source.custom);
  });

  it("rejects invalid JSON, unrelated files and unsupported file versions", () => {
    expect(() => parseWechatThemeFile("broken")).toThrow("主题文件不是有效的 JSON。");
    expect(() => parseWechatThemeFile('{"format":"other","formatVersion":1,"theme":{}}')).toThrow("这不是落笔公众号主题文件。");
    expect(() => parseWechatThemeFile('{"format":"loby-wechat-theme","formatVersion":2,"theme":{}}')).toThrow("主题文件版本不受支持。");
  });

  it("creates a safe default filename for the save dialog", () => {
    expect(safeThemeFilename(" 柔雅/紫调:「测试」? ")).toBe("柔雅-紫调-「测试」-");
    expect(safeThemeFilename("...   ")).toBe("公众号主题");
  });
});
