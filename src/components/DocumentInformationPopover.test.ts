import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectPropertyDefinition, WritingProject, WritingSheet } from "../types";
import { DocumentInformationPopoverPanel } from "./DocumentInformationPopover";

describe("DocumentInformationPopoverPanel", () => {
  it("shows tags and project-defined properties without field descriptions", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentInformationPopoverPanel, {
        activeTab: "properties",
        project: project(),
        sheet: sheet(),
        libraryPath: "/Users/writer/Documents/Loby",
        onActiveTabChange: vi.fn(),
        onUpdateSheet: vi.fn(),
      }),
    );

    expect(html).toContain("标签");
    expect(html).toContain("优先级");
    expect(html).not.toContain("目标字数");
    expect(html).not.toContain("摘要");
    expect(html).not.toContain("允许自由创建并复用的主题标签");
    expect(html).not.toContain("当前文稿的处理优先级");
  });

  it("shows the requested document statistics", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentInformationPopoverPanel, {
        activeTab: "statistics",
        project: project(),
        sheet: sheet(),
        libraryPath: "/Users/writer/Documents/Loby",
        onActiveTabChange: vi.fn(),
        onUpdateSheet: vi.fn(),
      }),
    );

    expect(html).toContain("编辑日期");
    expect(html).toContain("创建日期");
    expect(html).toContain("2026年7月20日 16:07");
    expect(html).toContain("字数");
    expect(html).toContain("字符");
    expect(html).toContain("段落");
    expect(html).toContain("阅读时间");
    expect(html).toContain("所属位置");
    expect(html).toContain("测试项目 / 写作中");
    expect(html).toContain("本地文件");
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="在访达中显示本地文件"');
  });

  it("does not repeat the project name when its default group has the same title", () => {
    const inboxProject = {
      ...project(),
      title: "收件箱",
      groups: [{ id: "group-1", title: "收件箱" }],
    };
    const html = renderToStaticMarkup(
      createElement(DocumentInformationPopoverPanel, {
        activeTab: "statistics",
        project: inboxProject,
        sheet: sheet(),
        libraryPath: "/Users/writer/Documents/Loby",
        onActiveTabChange: vi.fn(),
        onUpdateSheet: vi.fn(),
      }),
    );

    expect(html).toContain("所属位置");
    expect(html).not.toContain("收件箱 / 收件箱");
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
    tags: ["产品"],
    groups: [{ id: "group-1", title: "写作中" }],
    sheets: [sheet()],
    updatedAt: "2026-07-20 16:07:32",
    propertyDefinitions: propertyDefinitions(),
  };
}

function sheet(): WritingSheet {
  return {
    id: "sheet-1",
    groupId: "group-1",
    title: "测试一下",
    status: "构思",
    targetWords: 1000,
    summary: "摘要内容",
    body: "正文",
    createdAt: "2026-07-19 20:00:53",
    updatedAt: "2026-07-20 16:07:32",
    properties: { tags: ["产品"], 优先级: "高" },
  };
}

function propertyDefinitions(): ProjectPropertyDefinition[] {
  return [
    {
      id: "target-words",
      key: "targetWords",
      label: "目标字数",
      type: "number",
      description: "用于显示文稿写作进度",
      locked: true,
    },
    {
      id: "summary",
      key: "summary",
      label: "摘要",
      type: "text",
      description: "帮助列表预览",
      locked: true,
    },
    {
      id: "tags",
      key: "tags",
      label: "标签",
      type: "tags",
      description: "允许自由创建并复用的主题标签",
      locked: true,
    },
    {
      id: "priority",
      key: "优先级",
      label: "优先级",
      type: "select",
      description: "当前文稿的处理优先级",
      options: [{ id: "high", label: "高", color: "#007aff" }],
    },
  ];
}
