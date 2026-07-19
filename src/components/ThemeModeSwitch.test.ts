import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThemeModeSwitch } from "./ThemeModeSwitch";

describe("ThemeModeSwitch", () => {
  it("offers dark mode while the app is light", () => {
    const html = renderToStaticMarkup(React.createElement(ThemeModeSwitch, { theme: "light", onChange: vi.fn() }));

    expect(html).toContain('aria-label="切换到暗色模式"');
    expect(html).not.toContain('checked=""');
  });

  it("shows the moon position and offers light mode while the app is dark", () => {
    const html = renderToStaticMarkup(React.createElement(ThemeModeSwitch, { theme: "dark", onChange: vi.fn() }));

    expect(html).toContain('aria-label="切换到浅色模式"');
    expect(html).toContain('checked=""');
  });
});
