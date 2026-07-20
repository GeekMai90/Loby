import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WritingProject, WritingSheet } from "../types";
import { DocumentInformationSection } from "./DocumentInformationSection";

describe("DocumentInformationSection", () => {
  it("shows document information as an always-visible section", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentInformationSection, {
        project: project(),
        sheet: sheet(),
        libraryPath: "/Users/writer/Documents/Loby",
        onUpdateSheet: vi.fn(),
        onManageFields: vi.fn(),
      }),
    );

    expect(html).toContain('<h2 class="text-[15px] font-bold">文稿信息</h2>');
    expect(html).toContain("测试项目");
    expect(html).toContain("收件箱");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });
});

function project(): WritingProject {
  return {
    id: "project-1",
    title: "测试项目",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
    tags: [],
    groups: [{ id: "group-1", title: "收件箱" }],
    sheets: [],
    updatedAt: "2026-07-20 16:07:32",
  };
}

function sheet(): WritingSheet {
  return {
    id: "sheet-1",
    groupId: "group-1",
    title: "测试一下",
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "",
    createdAt: "2026-07-19 20:00:53",
    updatedAt: "2026-07-20 16:07:32",
  };
}
