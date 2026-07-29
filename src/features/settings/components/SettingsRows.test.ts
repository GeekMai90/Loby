// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与设置分组/行基础组件
 * [OUTPUT]: 验证设置内容页分组标题层级、可选说明布局，以及浅色内缩行分隔契约
 * [POS]: settings 基础组合单元的视觉语义回归测试，防止分组标题或卡片内部层级退化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsRow, SettingsSection, SettingsSectionHeader } from "@/features/settings/components/SettingsRows";

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

  it("uses an inset divider lighter than the section outline between setting rows", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(SettingsSection, {
          title: "通用",
          children: [
            createElement(SettingsRow, { key: "first", label: "第一项", children: createElement("span", null, "值") }),
            createElement(SettingsRow, { key: "second", label: "第二项", children: createElement("span", null, "值") }),
          ],
        }),
      );
    });

    const rows = container.querySelectorAll<HTMLElement>("[data-settings-row]");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.className).toContain("after:left-3");
    expect(rows[0]?.className).toContain("after:right-3");
    expect(rows[0]?.className).toContain("after:bg-[var(--settings-dialog-row-divider)]");
    expect(rows[0]?.className).not.toContain("border-b");
    expect(rows[1]?.className).toContain("last:after:hidden");

    await act(async () => root.unmount());
  });
});
