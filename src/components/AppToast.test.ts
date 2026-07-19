import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppToast } from "./AppToast";

describe("AppToast", () => {
  it("renders an optional action without changing ordinary toasts", () => {
    const ordinary = renderToStaticMarkup(
      createElement(AppToast, {
        variant: "success",
        title: "完成",
        description: "已保存",
        onClose: vi.fn(),
      }),
    );
    expect(ordinary).not.toContain("撤销");

    const actionable = renderToStaticMarkup(
      createElement(AppToast, {
        variant: "success",
        title: "文稿已移动",
        description: "已移动到目标分类",
        actionLabel: "撤销",
        onAction: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(actionable).toContain("撤销");
  });
});
