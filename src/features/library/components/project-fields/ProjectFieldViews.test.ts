// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectPropertyDefinition } from "@/shared/types";
import { FieldDefinitionEditor, FieldListScreen, NewFieldEditor } from "@/features/library/components/project-fields/ProjectFieldViews";

describe("project field views", () => {
  it("locks system properties while keeping custom property actions available", () => {
    const html = renderToStaticMarkup(
      createElement(FieldListScreen, {
        definitions: [lockedDefinition(), lockedTargetDefinition(), customDefinition()],
        onEdit: vi.fn(),
        onRemove: vi.fn(),
        onReorder: vi.fn(),
      }),
    );

    expect(html).not.toContain("全部字段");
    expect(html).toContain("系统");
    expect(html.match(/title="系统属性不能调整顺序"/g)).toHaveLength(2);
    expect(html.match(/title="拖拽调整顺序"/g)).toHaveLength(1);
    expect(html).toContain("标签为系统属性，不能调整顺序");
    expect(html).toContain("目标字数为系统属性，不能调整顺序");
    expect(html).toContain("拖拽排序：阶段");
    expect(html.match(/title="编辑属性"/g)).toHaveLength(1);
    expect(html.match(/title="删除属性"/g)).toHaveLength(1);
    expect(html).toContain("w-[calc(100%-48px)]");
  });

  it("renders creatable field types with Chinese labels and leaves progression to the dialog footer", () => {
    const emptyHtml = renderToStaticMarkup(
      createElement(NewFieldEditor, {
        name: "",
        type: "text",
        onNameChange: vi.fn(),
        onTypeChange: vi.fn(),
      }),
    );
    const namedHtml = renderToStaticMarkup(
      createElement(NewFieldEditor, {
        name: "发布渠道",
        type: "select",
        onNameChange: vi.fn(),
        onTypeChange: vi.fn(),
      }),
    );

    for (const label of ["文本", "数字", "复选框", "日期", "URL", "单选", "多选"]) {
      expect(emptyHtml).toContain(label);
    }
    expect(emptyHtml).not.toContain("Checkbox");
    expect(emptyHtml).not.toContain(">标签<");
    expect(emptyHtml).not.toContain("添加属性");
    expect(emptyHtml).toContain("第 1 步，共 2 步");
    expect(emptyHtml).toContain("w-[calc(100%-48px)]");
    expect(namedHtml).toContain("发布渠道");
  });

  it("keeps creation steps focused while preserving option and default controls", () => {
    const newFieldHtml = renderToStaticMarkup(
      createElement(FieldDefinitionEditor, {
        definition: customDefinition(),
        isNew: true,
        index: 0,
        minimumIndex: 0,
        fieldCount: 2,
        onUpdate: vi.fn(),
        onMove: vi.fn(),
        onRemove: vi.fn(),
        onChangeType: vi.fn(),
        onRemoveOption: vi.fn(),
        onMoveOption: vi.fn(),
      }),
    );

    expect(newFieldHtml).toContain("选项");
    expect(newFieldHtml).toContain("第 2 步，共 2 步");
    expect(newFieldHtml).toContain("选题");
    expect(newFieldHtml).toContain("完稿");
    expect(newFieldHtml).toContain("默认值");
    expect(newFieldHtml).toContain('title="选择颜色"');
    expect(newFieldHtml).not.toContain("空值时显示");
    expect(newFieldHtml).not.toContain("应用到已有空值文稿");
    expect(newFieldHtml).not.toContain('title="移除属性"');

    const existingFieldHtml = renderToStaticMarkup(
      createElement(FieldDefinitionEditor, {
        definition: customDefinition(),
        index: 0,
        minimumIndex: 0,
        fieldCount: 2,
        onUpdate: vi.fn(),
        onMove: vi.fn(),
        onRemove: vi.fn(),
        onChangeType: vi.fn(),
        onRemoveOption: vi.fn(),
        onMoveOption: vi.fn(),
      }),
    );

    expect(existingFieldHtml).toContain('title="上移" disabled=""');
    expect(existingFieldHtml).not.toContain('title="下移" disabled=""');
    expect(existingFieldHtml).toContain('title="移除属性"');
    expect(existingFieldHtml).not.toContain("YAML 键");
    expect(existingFieldHtml).not.toContain("用于文稿元数据");
    expect(existingFieldHtml).toContain("w-[calc(100%-48px)]");
  });

  it("uses the shared calendar control instead of the browser date input", () => {
    const html = renderToStaticMarkup(
      createElement(FieldDefinitionEditor, {
        definition: { id: "publish-date", key: "发布日期", label: "发布日期", type: "date" },
        isNew: true,
        index: 0,
        minimumIndex: 0,
        fieldCount: 1,
        onUpdate: vi.fn(),
        onMove: vi.fn(),
        onRemove: vi.fn(),
        onChangeType: vi.fn(),
        onRemoveOption: vi.fn(),
        onMoveOption: vi.fn(),
      }),
    );

    expect(html).toContain("选择日期");
    expect(html).not.toContain('type="date"');
  });
});

function lockedDefinition(): ProjectPropertyDefinition {
  return { id: "tags", key: "tags", label: "标签", type: "tags", locked: true };
}

function lockedTargetDefinition(): ProjectPropertyDefinition {
  return { id: "targetWords", key: "targetWords", label: "目标字数", type: "number", locked: true };
}

function customDefinition(): ProjectPropertyDefinition {
  return {
    id: "stage",
    key: "阶段",
    label: "阶段",
    type: "select",
    options: [
      { id: "topic", label: "选题", color: "#8e8e93" },
      { id: "done", label: "完稿", color: "#34c759" },
    ],
    defaultValue: "选题",
  };
}
