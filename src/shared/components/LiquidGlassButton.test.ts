// @vitest-environment happy-dom

import React, { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";

describe("LiquidGlassButton", () => {
  it("keeps native button semantics over an open-source liquid-glass surface", () => {
    const html = renderToStaticMarkup(React.createElement(LiquidGlassButton, { title: "新建" }, "+"));

    expect(html).toContain("<button");
    expect(html).toContain("liquid-glass-button-surface-effect");
    expect(html).toContain("glass__warp");
  });

  it("gives adjacent controls independent glass surfaces", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        { "aria-label": "前后导航" },
        React.createElement(LiquidGlassButton, null, "上一页"),
        React.createElement(LiquidGlassButton, null, "下一页"),
      ),
    );

    expect(html.match(/class="liquid-glass-button-surface"/g)).toHaveLength(2);
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  it("forwards the trigger ref while retaining its liquid-glass surface ref", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ref = vi.fn<(node: HTMLButtonElement | null) => void>();

    await act(async () => {
      root.render(createElement(LiquidGlassButton, { ref, title: "打开菜单" }, "菜单"));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(ref).toHaveBeenCalledWith(button);

    await act(async () => root.unmount());
    expect(ref).toHaveBeenLastCalledWith(null);
    container.remove();
  });
});
