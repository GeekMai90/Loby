// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React SSR、Vitest 与本地 Button/Input/Textarea/Toggle primitives
 * [OUTPUT]: 验证共享可操作控件统一消费 13px 的 text-app-base 语义字号 Token，并能与文字颜色安全组合
 * [POS]: components/ui 的控件排版契约测试，阻止 shadcn 默认字号重新覆盖 Loby 桌面 UI 基尺寸
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Toggle } from "./toggle";

describe("shared control typography", () => {
  it("keeps every button size on the 13px base token", () => {
    for (const size of ["default", "xs", "sm", "lg"] as const) {
      const classes = buttonVariants({ size });
      expect(classes).toContain("text-app-base");
      expect(classes).not.toMatch(/(?:^|\s)(?:text-sm|text-base|text-\[0\.8rem\])(?:\s|$)/);
    }
  });

  it("keeps the button font-size token alongside its text color", () => {
    const html = renderToStaticMarkup(createElement(Button, null, "确认"));
    document.body.innerHTML = html;

    const button = document.querySelector<HTMLElement>("[data-slot='button']");
    expect(button?.className).toContain("text-app-base");
    expect(button?.className).toContain("text-primary-foreground");
  });

  it("uses the same base token for input, textarea, and toggle text", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Input, { "aria-label": "名称" }),
        createElement(Textarea, { "aria-label": "说明" }),
        createElement(Toggle, null, "切换"),
      ),
    );
    document.body.innerHTML = html;

    for (const slot of ["input", "textarea", "toggle"]) {
      expect(document.querySelector<HTMLElement>(`[data-slot='${slot}']`)?.className).toContain("text-app-base");
    }
  });
});
