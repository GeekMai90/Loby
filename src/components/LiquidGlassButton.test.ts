import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiquidGlassButton } from "./LiquidGlassButton";

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
});
