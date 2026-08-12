// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./dialog";

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

describe("DialogContent", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("focuses the dialog surface instead of preselecting the close action", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(Dialog, { open: true }, createElement(DialogContent, null, createElement(DialogTitle, null, "文稿属性"))));
      await Promise.resolve();
    });

    const dialog = document.querySelector<HTMLElement>("[data-slot='dialog-content']");
    const overlay = document.querySelector<HTMLElement>("[data-slot='dialog-overlay']");
    const close = document.querySelector<HTMLElement>("[data-slot='dialog-close']");
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(close);
    expect(dialog?.tabIndex).toBe(-1);
    expect(dialog?.dataset.dialogPlacement).toBe("centered");
    expect(dialog?.className).toContain("bg-background");
    expect(dialog?.className).toContain("shadow-[var(--dialog-shadow-ring)]");
    expect(dialog?.className).not.toContain("bg-popover");
    expect(overlay?.className).toContain("bg-scrim");
    expect(overlay?.className).not.toContain("backdrop-blur");

    await act(async () => root.unmount());
  });

  it("marks explicitly positioned surfaces so the window shell does not recenter them", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          Dialog,
          { open: true },
          createElement(DialogContent, { placement: "custom" }, createElement(DialogTitle, null, "键盘快捷键")),
        ),
      );
      await Promise.resolve();
    });

    expect(document.querySelector<HTMLElement>("[data-slot='dialog-content']")?.dataset.dialogPlacement).toBe("custom");

    await act(async () => root.unmount());
  });

  it("preserves an explicitly auto-focused field", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          Dialog,
          { open: true },
          createElement(
            DialogContent,
            { showCloseButton: false },
            createElement(DialogTitle, null, "新增项目"),
            createElement("input", { autoFocus: true, "aria-label": "项目名称" }),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(document.querySelector("[aria-label='项目名称']"));

    await act(async () => root.unmount());
  });
});
