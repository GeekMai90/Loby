// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectPropertyDefinition } from "../../types";
import { FieldDefinitionEditor, FieldListScreen, NewFieldEditor } from "./ProjectFieldViews";

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
  });

  it("renders all field types and disables creation until a name exists", () => {
    const emptyHtml = renderToStaticMarkup(
      createElement(NewFieldEditor, {
        name: "",
        type: "text",
        onNameChange: vi.fn(),
        onTypeChange: vi.fn(),
        onAdd: vi.fn(),
      }),
    );
    const namedHtml = renderToStaticMarkup(
      createElement(NewFieldEditor, {
        name: "发布渠道",
        type: "select",
        onNameChange: vi.fn(),
        onTypeChange: vi.fn(),
        onAdd: vi.fn(),
      }),
    );

    for (const label of ["文本", "数字", "Checkbox", "日期", "URL", "单选", "多选", "标签"]) {
      expect(emptyHtml).toContain(label);
    }
    expect(emptyHtml).toContain('disabled=""');
    expect(emptyHtml).toContain("新增属性");
    expect(namedHtml).toContain("发布渠道");
    expect(namedHtml).not.toContain('disabled=""');
  });

  it("keeps option controls, default application state and movement limits in the definition editor", () => {
    const html = renderToStaticMarkup(
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
        onApplyDefault: vi.fn(),
        defaultApplicationPending: true,
        defaultApplicationNotice: "保存时应用到 3 篇文稿",
      }),
    );

    expect(html).toContain("预设选项");
    expect(html).toContain("选题");
    expect(html).toContain("完稿");
    expect(html).toContain("保存后将应用到已有文稿");
    expect(html).toContain("保存时应用到 3 篇文稿");
    expect(html).toContain('title="上移" disabled=""');
    expect(html).not.toContain('title="下移" disabled=""');
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
