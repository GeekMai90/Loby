// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectPropertyDefinition } from "../../types";
import { FieldDefinitionEditor, FieldListScreen, NewFieldEditor } from "./ProjectFieldViews";

describe("project field views", () => {
  it("keeps locked fields editable but hides their destructive action", () => {
    const html = renderToStaticMarkup(
      createElement(FieldListScreen, {
        definitions: [lockedDefinition(), customDefinition()],
        onEdit: vi.fn(),
        onRemove: vi.fn(),
        onAdd: vi.fn(),
      }),
    );

    expect(html).toContain("全部字段");
    expect(html).toContain("2 个");
    expect(html).toContain("系统");
    expect(html.match(/title="编辑字段"/g)).toHaveLength(2);
    expect(html.match(/title="删除字段"/g)).toHaveLength(1);
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
    expect(namedHtml).toContain("发布渠道");
    expect(namedHtml).not.toContain('disabled=""');
  });

  it("keeps option controls, default application state and movement limits in the definition editor", () => {
    const html = renderToStaticMarkup(
      createElement(FieldDefinitionEditor, {
        definition: customDefinition(),
        index: 0,
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
  return { id: "title", key: "title", label: "标题", type: "text", locked: true };
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
