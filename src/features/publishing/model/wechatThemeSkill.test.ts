import { describe, expect, it } from "vitest";
import { WECHAT_THEME_SAMPLE_PROJECT } from "@/features/publishing/model/wechatThemeSampleArticle";
import {
  buildWechatThemeSkillContext,
  resolveWechatThemeContextMode,
  sanitizeWechatThemeMarkdownPreview,
  shouldIncludePreviousWechatTheme,
} from "@/features/publishing/model/wechatThemeSkill";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";

describe("wechat theme skill context", () => {
  it("allows read-only inspection of user-provided local references", () => {
    const context = buildWechatThemeSkillContext({
      theme: getWechatTheme("loby-basic"),
      project: WECHAT_THEME_SAMPLE_PROJECT,
      sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0],
      messages: [{ role: "user", content: "参考 /Users/example/design-system 的样式" }],
    });

    expect(context).toContain("可以使用已注册的只读工具检查当前写作库和用户明确提供的参考资料");
    expect(context).toContain("不要直接创建、覆盖、移动或删除用户文件");
    expect(context).not.toContain("不要调用工具");
  });

  it("asks the theme assistant for a natural explanatory reply instead of a terse change log", () => {
    const context = buildWechatThemeSkillContext({
      theme: getWechatTheme("loby-basic"),
      project: WECHAT_THEME_SAMPLE_PROJECT,
      sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0],
      messages: [{ role: "user", content: "让二级标题在手机端更容易阅读" }],
    });

    expect(context).toContain("2–3 short, natural Chinese sentences");
    expect(context).toContain("what visibly changed");
    expect(context).toContain("what the user should check");
    expect(context).toContain("rather than sounding like a changelog");
  });

  it("removes inline image data before bounding the article preview", () => {
    const preview = sanitizeWechatThemeMarkdownPreview(`# 标题\n\n![图片](data:image/jpeg;base64,${"A".repeat(8000)})\n\n正文`);

    expect(preview).not.toContain("base64");
    expect(preview).toContain("loby-inline-image://preview");
    expect(preview).toContain("正文");
    expect(preview.length).toBeLessThanOrEqual(2000);
  });

  it("uses a compact continuation context for a synchronized resumed thread", () => {
    const theme = getWechatTheme("loby-basic");
    const context = buildWechatThemeSkillContext({
      theme,
      project: WECHAT_THEME_SAMPLE_PROJECT,
      sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0],
      messages: [
        { role: "user", content: "把标题改成蓝色" },
        { role: "assistant", content: "已经调整。" },
      ],
      mode: "resume",
    });

    expect(context).toContain(`当前主题版本：${theme.updatedAt}`);
    expect(context).not.toContain("<skill>");
    expect(context).not.toContain("当前主题清单");
    expect(context).not.toContain("把标题改成蓝色");
    expect(context.length).toBeLessThan(400);
  });

  it("resends the current theme but not the full skill after an out-of-thread theme change", () => {
    const context = buildWechatThemeSkillContext({
      theme: getWechatTheme("loby-basic"),
      project: WECHAT_THEME_SAMPLE_PROJECT,
      sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0],
      messages: [],
      mode: "resync",
    });

    expect(context).toContain("当前主题已在线程外发生变化");
    expect(context).toContain("当前主题清单");
    expect(context).not.toContain("<skill>");
    expect(context).not.toContain("预览文章摘要");
  });

  it("includes a previous revision only for an explicit restore request", () => {
    expect(shouldIncludePreviousWechatTheme("帮我改回上一版主题")).toBe(true);
    expect(shouldIncludePreviousWechatTheme("解释一下为什么回复慢")).toBe(false);
  });

  it("bootstraps, resumes, or resynchronizes context from the theme conversation marker", () => {
    const theme = getWechatTheme("loby-basic");

    expect(resolveWechatThemeContextMode({}, theme)).toBe("bootstrap");
    expect(resolveWechatThemeContextMode({ themeContextVersion: 2 }, theme)).toBe("resync");
    expect(resolveWechatThemeContextMode({ themeContextUpdatedAt: theme.updatedAt, themeContextVersion: 2 }, theme)).toBe("resume");
  });
});
