/**
 * [INPUT]: 依赖 React 服务端渲染、Vitest、SheetCard 与 WritingSheet 契约
 * [OUTPUT]: 验证空文稿固定文案、纯文字层级、首图缩略图结构与置顶标记
 * [POS]: library/components 的文稿卡片展示回归边界，不覆盖 SheetRow 的选择与拖拽状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { SheetCard } from "@/features/library/components/SheetCard";

describe("SheetCard", () => {
  it("renders the fixed writing prompt for a blank new sheet", () => {
    const html = renderToStaticMarkup(
      React.createElement(SheetCard, {
        sheet: sheet({ title: "无标题", body: "" }),
        projectTitle: "收件箱",
        image: null,
      }),
    );

    expect(html).toContain("未命名新文稿");
    expect(html).toContain("调整内心，写点东西");
    expect(html).toContain("· 收件箱");
    expect(html).not.toContain("sheet-card-image");
  });

  it("renders one-line text hierarchy and the supplied first image", () => {
    const html = renderToStaticMarkup(
      React.createElement(SheetCard, {
        sheet: sheet({ title: "整理、搜索和自定义", body: "结束了第一段熊掌记之旅" }),
        projectTitle: "产品笔记",
        image: { src: "https://example.com/preview.png", alt: "正文配图" },
      }),
    );

    expect(html).toContain('class="sheet-card-title line-clamp-2"');
    expect(html).toContain("结束了第一段熊掌记之旅");
    expect(html).toContain('class="sheet-card-image"');
    expect(html).toContain('src="https://example.com/preview.png"');
    expect(html).toContain("· 产品笔记");
  });

  it("renders a pin marker before the metadata for pinned sheets", () => {
    const html = renderToStaticMarkup(
      React.createElement(SheetCard, {
        sheet: sheet({ pinned: true }),
        projectTitle: "产品笔记",
        image: null,
      }),
    );

    expect(html).toContain("sheet-card-pin");
    expect(html).toContain('aria-label="已置顶"');
    expect(html.indexOf("sheet-card-pin")).toBeLessThan(html.indexOf("· 产品笔记"));
  });
});

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-card",
    title: "文稿标题",
    tags: [],
    targetWords: 0,
    description: "",
    body: "正文",
    createdAt: "2026-07-31T04:00:00.000Z",
    updatedAt: "2026-07-31T04:00:00.000Z",
    properties: {},
    ...overrides,
  };
}
