import { describe, expect, it } from "vitest";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import { getWechatThemeMenuActions } from "./wechatThemeMenu";
import { getWechatTheme } from "./wechatThemes";

describe("wechat theme menu actions", () => {
  it("allows duplicating and exporting a built-in theme", () => {
    expect(getWechatThemeMenuActions(getWechatTheme("nibva-basic"))).toEqual(["duplicate", "export"]);
  });

  it("allows the complete action set for a personal theme", () => {
    const personalTheme = createPersonalWechatTheme(getWechatTheme("nibva-basic"));
    expect(getWechatThemeMenuActions(personalTheme)).toEqual(["duplicate", "export", "rename", "delete"]);
  });
});
