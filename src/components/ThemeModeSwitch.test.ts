// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ThemeModeSwitch } from "./ThemeModeSwitch";

describe("ThemeModeSwitch", () => {
  it("cycles one button through light, dark, and automatic themes", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ThemeModeSwitch, { theme: "light", onChange }));
    });

    let button = container.querySelector<HTMLButtonElement>("button");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(button?.getAttribute("aria-label")).toBe("当前为亮色主题，点击切换到暗色");
    expect(button?.querySelector(".lucide-sun")).not.toBeNull();
    await act(async () => button?.click());
    expect(onChange).toHaveBeenLastCalledWith("dark");

    await act(async () => {
      root.render(createElement(ThemeModeSwitch, { theme: "dark", onChange }));
    });
    button = container.querySelector<HTMLButtonElement>("button");
    expect(button?.querySelector(".lucide-moon")).not.toBeNull();
    await act(async () => button?.click());
    expect(onChange).toHaveBeenLastCalledWith("system");

    await act(async () => {
      root.render(createElement(ThemeModeSwitch, { theme: "system", onChange }));
    });
    button = container.querySelector<HTMLButtonElement>("button");
    expect(button?.querySelector(".lucide-sun-moon")).not.toBeNull();
    await act(async () => button?.click());
    expect(onChange).toHaveBeenLastCalledWith("light");

    await act(async () => root.unmount());
  });
});
