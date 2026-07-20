import { describe, expect, it } from "vitest";
import type { ProjectPropertyDefinition, WritingProject, WritingSheet } from "../types";
import {
  applyDefinitionDefaultToSheet,
  applyProjectArticleGoalTarget,
  buildDefaultDocumentProperties,
  createSheetWithProjectDefaults,
  createPropertyDefinition,
  filterSheetsByDocumentProperty,
  getSheetPropertyValue,
  getVisiblePropertyDefinitions,
  mergeCompatiblePropertyDefinitions,
  normalizeProjectPropertyModel,
  projectArticleGoalTarget,
  setSheetPropertyValue,
} from "./documentProperties";

describe("documentProperties", () => {
  it("keeps app fields without recreating legacy workflow properties", () => {
    const project = normalizeProjectPropertyModel(
      model({
        status: "已归档",
        targetPlatform: "公众号",
        sheets: [
          sheet({ status: "已发布", properties: { 阶段: "已发布", 目标平台: "公众号" } }),
          sheet({ id: "archived", status: "已归档", updatedAt: "2026-07-08" }),
        ],
      }),
    );

    expect(project.archivedAt).toBe("2026-07-09");
    expect(project.propertyDefinitions?.map((definition) => definition.key)).toEqual(["targetWords", "summary", "tags"]);
    expect(project.sheets[0].properties).toEqual({ tags: [] });
    expect(project.sheets[1].archivedAt).toBe("2026-07-08");
    expect(project.sheets[1].properties).not.toHaveProperty("阶段");
  });

  it("removes system-provided custom properties and their stored document values", () => {
    const project = normalizeProjectPropertyModel(
      model({
        propertyDefinitions: [
          definition({ id: "template-stage", key: "阶段", label: "阶段", type: "select" }),
          definition({ id: "template-wechat-published", key: "公众号发布", label: "公众号发布", type: "checkbox" }),
          definition({ id: "custom-priority", key: "优先级", label: "优先级", type: "select" }),
        ],
        sheets: [sheet({ properties: { 阶段: "完稿", 公众号发布: true, 优先级: "高" } })],
      }),
    );

    expect(project.propertyDefinitions?.map((definition) => definition.key)).toEqual(["targetWords", "summary", "tags", "优先级"]);
    expect(project.sheets[0].properties).toEqual({ 优先级: "高", tags: [] });
  });

  it("uses direct app fields without duplicating their values in custom properties", () => {
    const source = sheet({ targetWords: 900, summary: "案例" });
    const target = definition({ key: "targetWords", type: "number" });
    const summary = definition({ key: "summary", type: "text" });

    expect(getSheetPropertyValue(source, target)).toBe(900);
    expect(getSheetPropertyValue(source, summary)).toBe("案例");
    expect(setSheetPropertyValue(source, target, 1200).targetWords).toBe(1200);
  });

  it("creates defaults and filters typed values predictably", () => {
    const fields: ProjectPropertyDefinition[] = [
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
    expect(buildDefaultDocumentProperties(fields)).toEqual({ 公众号发布: false, 阶段: "选题", tags: [] });

    const sheets = [
      sheet({ id: "published", properties: { 公众号发布: true, 阶段: "完稿", tags: ["写作"] } }),
      sheet({ id: "draft", properties: { 公众号发布: false, 阶段: "选题", tags: ["知识管理"] } }),
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
    const first = model({ propertyDefinitions: [definition({ key: "状态", type: "select" })] });
    const second = model({
      id: "second",
      propertyDefinitions: [definition({ key: "状态", type: "text" }), definition({ key: "评分", type: "number" })],
    });

    expect(mergeCompatiblePropertyDefinitions([first, second]).map((item) => item.key)).toEqual(["评分"]);
  });

  it("writes defaults only when a new document is created", () => {
    const fields: ProjectPropertyDefinition[] = [
      definition({ key: "targetWords", type: "number", defaultValue: 2400 }),
      definition({ key: "summary", type: "text", defaultValue: "项目默认摘要" }),
      definition({ key: "tags", type: "tags", defaultValue: ["默认标签"] }),
      definition({ key: "阶段", type: "select", defaultValue: "选题", options: [{ id: "topic", label: "选题" }] }),
    ];
    const project = model({ propertyDefinitions: fields });
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
      targetWords: 2400,
      summary: "项目默认摘要",
      properties: { tags: ["默认标签"], 阶段: "选题" },
    });
  });

  it("applies one article goal to existing and future project documents", () => {
    const project = normalizeProjectPropertyModel(
      model({ sheets: [sheet({ id: "article", targetWords: 800 }), sheet({ id: "material", targetWords: 500 })] }),
    );

    const next = applyProjectArticleGoalTarget(project, 1500);

    expect(projectArticleGoalTarget(next)).toBe(1500);
    expect(next.sheets.find((item) => item.id === "article")?.targetWords).toBe(1500);
    expect(next.sheets.find((item) => item.id === "material")?.targetWords).toBe(1500);
    expect(
      createSheetWithProjectDefaults(next, {
        id: "future",
        title: "新文章",
        body: "",
        updatedAt: "2026-07-10",
      }).targetWords,
    ).toBe(1500);
  });

  it("removes legacy document type definitions and stored values", () => {
    const project = normalizeProjectPropertyModel(
      model({
        propertyDefinitions: [definition({ id: "legacy-type", key: "type", label: "文稿类型", type: "select" })],
        sheets: [sheet({ properties: { type: "素材", tags: [] } })],
      }),
    );

    expect(project.propertyDefinitions?.some((definition) => definition.key === "type")).toBe(false);
    expect(project.sheets[0].properties).not.toHaveProperty("type");
  });

  it("applies a default to existing documents only when requested", () => {
    const field = definition({ key: "阶段", type: "select", defaultValue: "选题", options: [{ id: "topic", label: "选题" }] });
    const empty = sheet({ properties: {} });
    const filled = sheet({ properties: { 阶段: "完稿" } });

    expect(applyDefinitionDefaultToSheet(empty, field).properties?.阶段).toBe("选题");
    expect(applyDefinitionDefaultToSheet(filled, field).properties?.阶段).toBe("完稿");
  });

  it("hides empty fields unless the project or current document requests them", () => {
    const always = definition({ id: "always", key: "always", showWhenEmpty: true });
    const optional = definition({ id: "optional", key: "optional", showWhenEmpty: false });
    const filled = definition({ id: "filled", key: "filled", showWhenEmpty: false });
    const source = sheet({ properties: { filled: "value" } });

    expect(getVisiblePropertyDefinitions(source, [always, optional, filled]).map((item) => item.id)).toEqual(["always", "filled"]);
    expect(getVisiblePropertyDefinitions(source, [always, optional, filled], ["optional"]).map((item) => item.id)).toEqual([
      "always",
      "optional",
      "filled",
    ]);
  });

  it("creates unique project field keys", () => {
    const existing = [definition({ key: "阶段", label: "阶段", type: "select" })];
    expect(createPropertyDefinition("阶段", "text", existing).key).toBe("阶段 2");
  });
});

function definition(overrides: Partial<ProjectPropertyDefinition>): ProjectPropertyDefinition {
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
    targetWords: 1000,
    summary: "",
    body: "正文",
    updatedAt: "2026-07-09",
    ...overrides,
  };
}

function model(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 3000,
    tags: [],
    groups: [{ id: "group-main", title: "正文" }],
    sheets: [sheet()],
    updatedAt: "2026-07-09",
    ...overrides,
  };
}
