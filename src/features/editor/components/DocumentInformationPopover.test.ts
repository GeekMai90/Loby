// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、文稿属性模型与 DocumentInformationPopoverPanel
 * [OUTPUT]: 验证属性/统计 Animate UI Tabs 下的字段、Select 语义宽度、统计与项目设置交互
 * [POS]: editor 的文稿信息面板回归测试，保护属性数据和统计视图的职责边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DocumentPropertyDefinition, WritingProject, WritingSheet } from "@/shared/types";
import { DocumentInformationPopoverPanel } from "@/features/editor/components/DocumentInformationPopover";

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
        onManageFields: vi.fn(),
      }),
    );

    expect(html).toContain("标签");
    expect(html).toContain("优先级");
    expect(html).toContain("公众号");
    expect(html).toContain('role="checkbox"');
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("未勾选");
    expect(html).toContain('data-width="fit"');
    expect(html).toContain("max-w-full");
    expect(html).toContain("ml-auto min-w-24");
    expect(html).toContain("2026年7月20日");
    expect(html).not.toContain('type="date"');
    expect(html).toContain("选项 1");
    expect(html).toContain('placeholder="https://"');
    expect(html).not.toContain("grid-cols-[minmax(0,1fr)_28px]");
    expect(html).toContain("目标字数");
    expect(html).toContain("摘要");
    expect(html).not.toContain("允许自由创建并复用的主题标签");
    expect(html).not.toContain("当前文稿的处理优先级");
    expect(html).not.toContain("设置自定义属性");
  });

  it("opens project property setup when the project has no custom properties", async () => {
    const projectWithoutCustomProperties = {
      ...project(),
      documentPropertyDefinitions: documentPropertyDefinitions().filter((definition) => definition.locked),
    };
    const onManageFields = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(DocumentInformationPopoverPanel, {
          activeTab: "properties",
          project: projectWithoutCustomProperties,
          sheet: sheet(),
          libraryPath: "/Users/writer/Documents/Loby",
          onActiveTabChange: vi.fn(),
          onUpdateSheet: vi.fn(),
          onManageFields,
        }),
      );
    });

    expect(container.textContent).toContain("标签");
    expect(container.textContent).toContain("属性");
    const setupButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "设置自定义属性");
    expect(setupButton).toBeDefined();
    await act(async () => setupButton?.click());
    expect(onManageFields).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("keeps the property setup prompt out of the statistics tab", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentInformationPopoverPanel, {
        activeTab: "statistics",
        project: project(),
        sheet: sheet(),
        libraryPath: "/Users/writer/Documents/Loby",
        onActiveTabChange: vi.fn(),
        onUpdateSheet: vi.fn(),
        onManageFields: vi.fn(),
      }),
    );

    expect(html).not.toContain("设置自定义属性");
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
        onManageFields: vi.fn(),
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
        onManageFields: vi.fn(),
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
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-1", title: "写作中" }],
    sheets: [sheet()],
    updatedAt: "2026-07-20 16:07:32",
    documentPropertyDefinitions: documentPropertyDefinitions(),
  };
}

function sheet(): WritingSheet {
  return {
    id: "sheet-1",
    groupId: "group-1",
    title: "测试一下",
    status: "构思",
    tags: ["产品"],
    targetWords: 1000,
    summary: "摘要内容",
    body: "正文",
    createdAt: "2026-07-19 20:00:53",
    updatedAt: "2026-07-20 16:07:32",
    properties: {
      优先级: "高",
      公众号: false,
      发布日期: "2026-07-20",
      多选: ["选项 1"],
      地址: "",
    },
  };
}

function documentPropertyDefinitions(): DocumentPropertyDefinition[] {
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
    {
      id: "wechat",
      key: "公众号",
      label: "公众号",
      type: "checkbox",
      description: "是否用于公众号发布",
    },
    {
      id: "publish-date",
      key: "发布日期",
      label: "发布日期",
      type: "date",
    },
    {
      id: "multi-select",
      key: "多选",
      label: "多选",
      type: "multiSelect",
      options: [
        { id: "option-1", label: "选项 1", color: "#007aff" },
        { id: "option-2", label: "选项 2", color: "#34c759" },
      ],
    },
    {
      id: "address",
      key: "地址",
      label: "地址",
      type: "url",
    },
  ];
}
