import { describe, expect, it } from "vitest";
import type { DocumentPropertyDefinition, WritingProject, WritingSheet } from "@/shared/types";
import {
  applyDefinitionDefaultsToSheets,
  buildDefaultDocumentProperties,
  createSheetWithProjectDefaults,
  createPropertyDefinition,
  filterSheetsByDocumentProperty,
  getSheetPropertyValue,
  getVisiblePropertyDefinitions,
  mergeCompatiblePropertyDefinitions,
  normalizeDocumentPropertyModel,
  reorderDocumentPropertyDefinitions,
  setSheetPropertyValue,
} from "@/features/editor/model/documentProperties";

describe("documentProperties", () => {
  it("keeps project lifecycle separate from document properties", () => {
    const project = normalizeDocumentPropertyModel(
      model({
        status: "已归档",
        sheets: [
          sheet({ status: "已发布", properties: { 渠道: "公众号" } }),
          sheet({ id: "archived", status: "已归档", updatedAt: "2026-07-08" }),
        ],
      }),
    );

    expect(project.archivedAt).toBe("2026-07-09");
    expect(project.documentPropertyDefinitions).toEqual([]);
    expect(project.sheets[0].properties).toEqual({ 渠道: "公众号" });
    expect(project.sheets[1].archivedAt).toBe("2026-07-08");
  });

  it("keeps built-in document fields out of custom definitions", () => {
    const project = normalizeDocumentPropertyModel(
      model({
        documentPropertyDefinitions: [
          definition({
            id: "legacy-target",
            key: "targetWords",
            label: "目标字数",
            type: "number",
            defaultValue: 1750,
            locked: true,
          }),
          definition({ id: "legacy-summary", key: "summary", label: "摘要", type: "text", locked: true }),
          definition({ id: "custom-priority", key: "优先级", label: "优先级", type: "select" }),
        ],
        sheets: [
          sheet({
            targetWords: 1200,
            description: "内部摘要",
            properties: { targetWords: 800, summary: "重复摘要", 优先级: "高" },
          }),
        ],
      }),
    );

    expect(project.documentPropertyDefinitions?.map((definition) => definition.key)).toEqual(["优先级"]);
    expect(project.sheets[0].properties).toEqual({ 优先级: "高" });
    expect(project.sheets[0].targetWords).toBe(1200);
    expect(project.sheets[0].description).toBe("内部摘要");
  });

  it("migrates the legacy top-level summary field into description", () => {
    const legacySheet = { ...sheet(), description: undefined, summary: "旧摘要" } as unknown as WritingSheet;
    const project = normalizeDocumentPropertyModel(model({ sheets: [legacySheet] }));

    expect(project.sheets[0].description).toBe("旧摘要");
    expect(project.sheets[0]).not.toHaveProperty("summary");
  });

  it("uses direct app fields without duplicating their values in custom properties", () => {
    const source = sheet({ targetWords: 900, description: "案例" });
    const target = definition({ key: "targetWords", type: "number" });
    const description = definition({ key: "description", type: "text" });

    expect(getSheetPropertyValue(source, target)).toBe(900);
    expect(getSheetPropertyValue(source, description)).toBe("案例");
    expect(setSheetPropertyValue(source, target, 1200).targetWords).toBe(1200);
  });

  it("creates defaults and filters typed values predictably", () => {
    const fields: DocumentPropertyDefinition[] = [
      definition({ key: "公众号发布", label: "公众号发布", type: "checkbox", defaultValue: false }),
      definition({
        key: "阶段",
        label: "阶段",
        type: "select",
        defaultValue: "选题",
        options: [
          { id: "topic", label: "选题" },
          { id: "done", label: "完稿" },
        ],
      }),
    ];
    expect(buildDefaultDocumentProperties(fields)).toEqual({ 公众号发布: false, 阶段: "选题" });

    const sheets = [
      sheet({ id: "published", tags: ["写作"], properties: { 公众号发布: true, 阶段: "完稿" } }),
      sheet({ id: "draft", tags: ["知识管理"], properties: { 公众号发布: false, 阶段: "选题" } }),
    ];
    expect(
      filterSheetsByDocumentProperty(sheets, fields[0], { fieldKey: "公众号发布", operator: "isTrue", value: "" }).map((item) => item.id),
    ).toEqual(["published"]);
    expect(
      filterSheetsByDocumentProperty(sheets, fields[1], { fieldKey: "阶段", operator: "equals", value: "选题" }).map((item) => item.id),
    ).toEqual(["draft"]);
    expect(
      filterSheetsByDocumentProperty(sheets, definition({ key: "tags", type: "tags" }), {
        fieldKey: "tags",
        operator: "containsAny",
        value: "知识管理",
      }).map((item) => item.id),
    ).toEqual(["draft"]);
  });

  it("supports empty, range, and contains-all filters", () => {
    const fields = [
      definition({ key: "字数", type: "number" }),
      definition({ key: "渠道", type: "multiSelect" }),
      definition({ key: "备注", type: "text" }),
    ];
    const sheets = [
      sheet({ id: "one", properties: { 字数: 1200, 渠道: ["微信", "博客"], 备注: "" } }),
      sheet({ id: "two", properties: { 字数: 2600, 渠道: ["微信"], 备注: "完成" } }),
    ];

    expect(
      filterSheetsByDocumentProperty(sheets, fields[0], { fieldKey: "字数", operator: "between", value: "1000", valueTo: "2000" }).map(
        (item) => item.id,
      ),
    ).toEqual(["one"]);
    expect(
      filterSheetsByDocumentProperty(sheets, fields[1], { fieldKey: "渠道", operator: "containsAll", value: "微信, 博客" }).map(
        (item) => item.id,
      ),
    ).toEqual(["one"]);
    expect(filterSheetsByDocumentProperty(sheets, fields[2], { fieldKey: "备注", operator: "isEmpty", value: "" })[0].id).toBe("one");
  });

  it("excludes cross-project fields whose types conflict", () => {
    const first = model({ documentPropertyDefinitions: [definition({ key: "状态", type: "select" })] });
    const second = model({
      id: "second",
      documentPropertyDefinitions: [definition({ key: "状态", type: "text" }), definition({ key: "评分", type: "number" })],
    });

    expect(mergeCompatiblePropertyDefinitions([first, second]).map((item) => item.key)).toEqual(["评分"]);
  });

  it("writes defaults only when a new document is created", () => {
    const fields: DocumentPropertyDefinition[] = [
      definition({ key: "targetWords", type: "number", defaultValue: 2400 }),
      definition({ key: "description", type: "text", defaultValue: "项目默认摘要" }),
      definition({ key: "tags", type: "tags", defaultValue: ["默认标签"] }),
      definition({ key: "阶段", type: "select", defaultValue: "选题", options: [{ id: "topic", label: "选题" }] }),
    ];
    const project = model({ documentPropertyDefinitions: fields });
    const existing = sheet({ properties: {} });

    expect(getSheetPropertyValue(existing, fields[3])).toBeUndefined();
    expect(
      createSheetWithProjectDefaults(project, {
        id: "new-sheet",
        title: "新文稿",
        body: "",
        updatedAt: "2026-07-10",
      }),
    ).toMatchObject({
      targetWords: 1000,
      description: "",
      tags: [],
      properties: { 阶段: "选题" },
    });
  });

  it("keeps document goals independent from project custom field definitions", () => {
    const project = normalizeDocumentPropertyModel(
      model({
        documentPropertyDefinitions: [definition({ id: "legacy-target", key: "targetWords", type: "number", defaultValue: 1500 })],
        sheets: [sheet({ id: "article", targetWords: 800 }), sheet({ id: "material", targetWords: 500 })],
      }),
    );

    expect(project.documentPropertyDefinitions).toEqual([]);
    expect(project.sheets.find((item) => item.id === "article")?.targetWords).toBe(800);
    expect(project.sheets.find((item) => item.id === "material")?.targetWords).toBe(500);
    expect(
      createSheetWithProjectDefaults(project, {
        id: "future",
        title: "新文章",
        body: "",
        updatedAt: "2026-07-10",
      }).targetWords,
    ).toBe(1000);
  });

  it("automatically fills configured defaults into existing empty documents without overwriting values", () => {
    const field = definition({ key: "阶段", type: "select", defaultValue: "选题", options: [{ id: "topic", label: "选题" }] });
    const empty = sheet({ properties: {} });
    const filled = sheet({ properties: { 阶段: "完稿" } });

    const [nextEmpty, nextFilled] = applyDefinitionDefaultsToSheets([empty, filled], [field]);
    expect(nextEmpty.properties?.阶段).toBe("选题");
    expect(nextFilled.properties?.阶段).toBe("完稿");
  });

  it("shows every document property even when its current value is empty", () => {
    const always = definition({ id: "always", key: "always", showWhenEmpty: true });
    const optional = definition({ id: "optional", key: "optional", showWhenEmpty: false });
    const filled = definition({ id: "filled", key: "filled", showWhenEmpty: false });
    const source = sheet({ properties: { filled: "value" } });

    expect(getVisiblePropertyDefinitions(source, [always, optional, filled]).map((item) => item.id)).toEqual([
      "always",
      "optional",
      "filled",
    ]);
  });

  it("removes legacy empty-value visibility settings during normalization", () => {
    const project = normalizeDocumentPropertyModel(
      model({ documentPropertyDefinitions: [definition({ id: "optional", key: "optional", showWhenEmpty: false })] }),
    );

    expect(project.documentPropertyDefinitions?.find((item) => item.id === "optional")).not.toHaveProperty("showWhenEmpty");
  });

  it("creates unique document property keys", () => {
    const existing = [definition({ key: "阶段", label: "阶段", type: "select" })];
    expect(createPropertyDefinition("阶段", "text", existing).key).toBe("阶段 2");
  });

  it("reorders project-scoped document properties", () => {
    const first = definition({ id: "first", key: "阶段", label: "阶段" });
    const second = definition({ id: "second", key: "渠道", label: "渠道" });
    const third = definition({ id: "third", key: "备注", label: "备注" });
    const definitions = [first, second, third];

    expect(reorderDocumentPropertyDefinitions(definitions, "third", "first", "before").map((item) => item.id)).toEqual([
      "third",
      "first",
      "second",
    ]);
  });
});

function definition(overrides: Partial<DocumentPropertyDefinition>): DocumentPropertyDefinition {
  return {
    id: overrides.key ?? "field",
    key: "字段",
    label: "字段",
    type: "text",
    ...overrides,
  };
}

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet",
    title: "文稿",
    groupId: "group-main",
    status: "构思",
    tags: [],
    targetWords: 1000,
    description: "",
    body: "正文",
    createdAt: "2026-07-09",
    updatedAt: "2026-07-09",
    properties: {},
    ...overrides,
  };
}

function model(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project",
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-main", title: "正文" }],
    sheets: [sheet()],
    documentPropertyDefinitions: [],
    updatedAt: "2026-07-09",
    ...overrides,
  };
}
