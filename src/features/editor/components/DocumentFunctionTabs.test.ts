/**
 * [INPUT]: 依赖 React 服务端渲染、Vitest 与 DocumentFunctionTabs
 * [OUTPUT]: 验证编辑器功能栏只暴露媒体、查找替换和历史版本三个 Animate UI Tabs
 * [POS]: editor 的功能栏切换回归测试，防止文稿信息重新进入 rail
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentFunctionTabs } from "@/features/editor/components/DocumentFunctionTabs";

describe("DocumentFunctionTabs", () => {
  it("keeps document information in the editor toolbar instead of duplicating it in the function rail", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentFunctionTabs, {
        activeTab: "media",
        onActiveTabChange: vi.fn(),
      }),
    );

    expect(html).toContain('aria-label="媒体"');
    expect(html).toContain('aria-label="查找替换"');
    expect(html).toContain('aria-label="历史版本"');
    expect(html).not.toContain('aria-label="目录"');
    expect(html).not.toContain('aria-label="信息"');
  });
});
