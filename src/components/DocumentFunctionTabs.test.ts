import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentFunctionTabs } from "./DocumentFunctionTabs";

describe("DocumentFunctionTabs", () => {
  it("keeps document information in the editor toolbar instead of duplicating it in the function rail", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentFunctionTabs, {
        activeTab: "outline",
        onActiveTabChange: vi.fn(),
      }),
    );

    expect(html).toContain('aria-label="目录"');
    expect(html).toContain('aria-label="媒体"');
    expect(html).toContain('aria-label="查找替换"');
    expect(html).toContain('aria-label="历史版本"');
    expect(html).not.toContain('aria-label="信息"');
  });
});
