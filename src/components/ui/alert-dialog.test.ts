// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogTitle } from "./alert-dialog";

describe("AlertDialogContent", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("focuses the dialog surface instead of preselecting the cancel action", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          AlertDialog,
          { open: true },
          createElement(
            AlertDialogContent,
            null,
            createElement(AlertDialogTitle, null, "删除主题？"),
            createElement(
              AlertDialogFooter,
              null,
              createElement(AlertDialogCancel, null, "取消"),
              createElement(AlertDialogAction, null, "删除主题"),
            ),
          ),
        ),
      );
      await Promise.resolve();
    });

    const dialog = document.querySelector<HTMLElement>("[data-slot='alert-dialog-content']");
    const overlay = document.querySelector<HTMLElement>("[data-slot='alert-dialog-overlay']");
    const cancel = document.querySelector<HTMLElement>("[data-slot='alert-dialog-cancel']");
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(cancel);
    expect(dialog?.tabIndex).toBe(-1);
    expect(overlay?.className).toContain("bg-scrim-strong");
    expect(overlay?.className).not.toContain("backdrop-blur");

    await act(async () => root.unmount());
  });
});
