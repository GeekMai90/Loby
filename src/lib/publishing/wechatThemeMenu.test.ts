import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { getWechatThemeMenuActions } from "./wechatThemeMenu";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme menu actions", () => {
  it("only allows duplicating a built-in theme", () => {
    expect(getWechatThemeMenuActions(getWechatTheme("deep-blue-study"))).toEqual(["duplicate"]);
  });

  it("allows the complete action set for a personal theme", () => {
    const personalTheme = createPersonalWechatTheme(getWechatTheme("deep-blue-study"));
    expect(getWechatThemeMenuActions(personalTheme)).toEqual(["duplicate", "rename", "delete"]);
  });
});
