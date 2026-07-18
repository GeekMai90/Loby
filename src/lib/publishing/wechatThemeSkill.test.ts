import { describe, expect, it } from "vitest";
import { WECHAT_THEME_SAMPLE_PROJECT } from "./wechatThemeSampleArticle";
import { buildWechatThemeSkillContext } from "./wechatThemeSkill";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme skill context", () => {
  it("allows read-only inspection of user-provided local references", () => {
    const context = buildWechatThemeSkillContext({
      theme: getWechatTheme("loby-basic"),
      project: WECHAT_THEME_SAMPLE_PROJECT,
      sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0],
      messages: [{ role: "user", content: "参考 /Users/example/design-system 的样式" }],
    });

    expect(context).toContain("可以使用只读工具检查用户明确提供的本地路径");
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
});
