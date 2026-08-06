/**
 * [INPUT]: 依赖 React 服务端渲染、Vitest 与编辑器功能栏视图
 * [OUTPUT]: 验证媒体空状态与查找标题的视觉契约
 * [POS]: editor 功能栏的样式回归测试，防止空状态文案和标题行几何再次偏离列表栏及其他功能视图
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentMediaSection } from "@/features/editor/components/DocumentFunctionSections";
import { DocumentSearchSection } from "@/features/editor/components/DocumentSearchSection";

describe("DocumentFunctionSections", () => {
  it("uses a centered icon empty state when the document has no images", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentMediaSection, {
        images: [],
        onRevealPosition: vi.fn(),
      }),
    );

    expect(html).toContain("lucide-image");
    expect(html).not.toContain("lucide-image-off");
    expect(html).toContain("size-10");
    expect(html).toContain("text-foreground/25");
    expect(html).toContain("没有图片");
    expect(html).not.toContain("当前文稿还没有插入图片");
  });

  it("keeps the search title on the same heading geometry as the other sections", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentSearchSection, {
        searchMode: "find",
        findText: "",
        replaceText: "",
        searchResults: [],
        activeSearchResultIndex: 0,
        onSelectSearchMode: vi.fn(),
        onFindTextChange: vi.fn(),
        onReplaceTextChange: vi.fn(),
        onReplaceOne: vi.fn(),
        onReplaceAll: vi.fn(),
        onRevealRelativeSearchResult: vi.fn(),
        onRevealSearchResult: vi.fn(),
      }),
    );

    expect(html).toContain("mb-3");
    expect(html).toContain('data-surface="transparent"');
    expect(html).toContain("h-auto");
    expect(html).toContain("leading-tight");
    expect(html).not.toContain("mb-3.5");
  });
});
