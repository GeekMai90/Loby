// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 ThemeModeSwitch
 * [OUTPUT]: 验证主题切换行为、完整无障碍名称与简短 Tooltip 文案
 * [POS]: shared 主题控件的聚焦回归测试，保护状态表达与视觉提示的职责分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ThemeModeSwitch } from "@/shared/components/ThemeModeSwitch";

describe("ThemeModeSwitch", () => {
  it("toggles one button between temporary light and dark themes", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ThemeModeSwitch, { theme: "light", onChange }));
    });

    let button = container.querySelector<HTMLButtonElement>("button");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(button?.getAttribute("aria-label")).toBe("当前为亮色主题，点击临时切换到暗色");
    expect(button?.dataset.tooltip).toBe("主题切换");
    expect(button?.hasAttribute("title")).toBe(false);
    expect(button?.querySelector(".lucide-sun")).not.toBeNull();
    await act(async () => button?.click());
    expect(onChange).toHaveBeenLastCalledWith("dark");

    await act(async () => {
      root.render(createElement(ThemeModeSwitch, { theme: "dark", onChange }));
    });
    button = container.querySelector<HTMLButtonElement>("button");
    expect(button?.getAttribute("aria-label")).toBe("当前为暗色主题，点击临时切换到亮色");
    expect(button?.querySelector(".lucide-moon")).not.toBeNull();
    await act(async () => button?.click());
    expect(onChange).toHaveBeenLastCalledWith("light");

    await act(async () => root.unmount());
  });
});
