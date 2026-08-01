// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、应用主题类型与 GeneralSettingsPanel
 * [OUTPUT]: 验证系统/浅色/深色主题预览卡的数量、选中态和切换回调
 * [POS]: settings 通用面板的外观选择回归边界，保护主题视觉入口不退回为普通 Select
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneralSettingsPanel } from "@/features/settings/components/GeneralSettingsPanel";

describe("GeneralSettingsPanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders the three theme previews and reports the selected preference", async () => {
    const onAppThemeChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(GeneralSettingsPanel, {
          appTheme: "light",
          editorTheme: "loby",
          onAppThemeChange,
          onEditorThemeChange: vi.fn(),
        }),
      );
    });

    const themeOptions = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(themeOptions).toHaveLength(3);
    expect(container.querySelector("h4")?.textContent).toBe("主题");
    expect([...themeOptions].map((option) => option.textContent?.trim())).toEqual(["系统", "浅色", "深色"]);
    expect(container.querySelector('[data-preview-theme="system"]')).not.toBeNull();
    expect(container.querySelector('[data-preview-theme="light"]')).not.toBeNull();
    expect(container.querySelector('[data-preview-theme="dark"]')).not.toBeNull();
    expect(themeOptions[0]?.getAttribute("aria-checked")).toBe("false");
    expect(themeOptions[1]?.getAttribute("aria-checked")).toBe("true");

    await act(async () => themeOptions[0]?.click());
    expect(onAppThemeChange).toHaveBeenCalledWith("system");

    await act(async () => root.unmount());
  });
});
