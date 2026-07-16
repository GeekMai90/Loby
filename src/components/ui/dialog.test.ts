// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog, DialogFooter } from "./dialog";

describe("DialogFooter", () => {
  it("keeps footer actions on the dialog surface with close before the primary action", () => {
    const html = renderToStaticMarkup(
      createElement(
        Dialog,
        null,
        createElement(DialogFooter, { showCloseButton: true }, createElement("button", { type: "button" }, "保存")),
      ),
    );

    expect(html.indexOf("关闭")).toBeLessThan(html.indexOf("保存"));
    expect(html).not.toContain("border-t");
    expect(html).not.toContain("bg-muted/50");
    expect(html).toContain("items-center justify-end");
  });
});
