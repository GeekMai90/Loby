// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 SettingsSectionHeader
 * [OUTPUT]: 验证设置内容页分组标题的主次文字层级与可选说明布局
 * [POS]: settings 基础组合单元的视觉语义回归测试，防止内容页标题退回弱化小字
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsSectionHeader } from "@/features/settings/components/SettingsRows";

describe("SettingsSectionHeader", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses primary text for a larger title and secondary text for an optional description", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(SettingsSectionHeader, { title: "连接", description: "选择默认使用的模型服务。" }));
    });

    const title = container.querySelector("h4");
    const description = container.querySelector("p");
    expect(title?.className).toContain("text-sm");
    expect(title?.className).toContain("text-foreground");
    expect(description?.className).toContain("text-xs");
    expect(description?.className).toContain("text-muted-foreground");

    await act(async () => root.unmount());
  });

  it("does not reserve a description row when none is provided", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(SettingsSectionHeader, { title: "默认" }));
    });

    expect(container.querySelector("p")).toBeNull();
    await act(async () => root.unmount());
  });
});
