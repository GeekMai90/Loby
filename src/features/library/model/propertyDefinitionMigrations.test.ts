import { describe, expect, it } from "vitest";
import type { ProjectPropertyDefinition, WritingSheet } from "@/shared/types";
import {
  applyPendingValueMigrations,
  convertMetadataValue,
  migrateSheetValues,
  normalizeDefinitionForSave,
  removeSheetPropertyValues,
  resolveOptionMigrationTargets,
  replaceOptionValue,
} from "@/features/library/model/propertyDefinitionMigrations";

describe("propertyDefinitionMigrations", () => {
  it("replaces or clears removed select values", () => {
    expect(replaceOptionValue("待发布", "待发布", "已发布")).toBe("已发布");
    expect(replaceOptionValue(["微信", "博客"], "微信")).toEqual(["博客"]);

    const replaced = applyPendingValueMigrations(
      sheet({ 渠道: ["微信", "博客"] }),
      [{ fieldKey: "渠道", from: "微信", to: "公众号" }],
      [],
      [],
    );
    expect(replaced.properties?.渠道).toEqual(["公众号", "博客"]);
  });

  it("converts compatible values and clears incompatible values", () => {
    expect(convertMetadataValue("1200", "number", [])).toBe(1200);
    expect(convertMetadataValue("已发布", "checkbox", [])).toBe(true);
    expect(convertMetadataValue("无法转换", "number", [])).toBeUndefined();

    const definition = field({ type: "number" });
    const converted = applyPendingValueMigrations(
      sheet({ 字段: "1200" }),
      [],
      [{ fieldKey: "字段", nextType: "number", mode: "convert" }],
      [definition],
    );
    expect(converted.properties?.字段).toBe(1200);
  });

  it("renames option values and defaults by stable option id", () => {
    const original = field({
      type: "select",
      defaultValue: "选题",
      options: [{ id: "topic", label: "选题" }],
    });
    const draft = field({
      type: "select",
      defaultValue: "选题",
      options: [{ id: "topic", label: "准备写" }],
    });
    const normalized = normalizeDefinitionForSave(original, draft);

    expect(normalized.defaultValue).toBe("准备写");
    expect(migrateSheetValues(sheet({ 字段: "选题" }), [original], [normalized]).properties?.字段).toBe("准备写");
    expect(
      resolveOptionMigrationTargets([{ fieldKey: "字段", from: "旧选项", to: "临时名称", toOptionId: "topic" }], [normalized])[0].to,
    ).toBe("准备写");
  });

  it("removes field values only after the user chooses deletion", () => {
    const source = [sheet({ 保留: "内容", 删除: true })];
    expect(removeSheetPropertyValues(source, []).at(0)?.properties).toEqual({ 保留: "内容", 删除: true });
    expect(removeSheetPropertyValues(source, ["删除"]).at(0)?.properties).toEqual({ 保留: "内容" });
  });
});

function field(overrides: Partial<ProjectPropertyDefinition> = {}): ProjectPropertyDefinition {
  return { id: "field", key: "字段", label: "字段", type: "text", ...overrides };
}

function sheet(properties: WritingSheet["properties"]): WritingSheet {
  return {
    id: "sheet",
    title: "文稿",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "正文",
    updatedAt: "2026-07-10 10:00:00",
    properties,
  };
}
