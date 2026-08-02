/**
 * [INPUT]: 依赖 shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供属性选项/类型迁移计划、定义保存归一化与文稿值批量迁移能力
 * [POS]: 写作库 feature 的领域模型边界，集中属性值迁移规则；元信息迁移保留文稿标题/正文的内容更新时间
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MetadataValue, DocumentPropertyDefinition, PropertyFieldType, PropertyOption, WritingSheet } from "@/shared/types";
import { isEmptyMetadataValue } from "@/features/editor/model/documentProperties";

export interface OptionValueMigration {
  fieldKey: string;
  from: string;
  to?: string;
  toOptionId?: string;
}

export interface TypeValueMigration {
  fieldKey: string;
  nextType: PropertyFieldType;
  mode: "convert" | "clear";
}

export function resolveOptionMigrationTargets(
  migrations: OptionValueMigration[],
  definitions: DocumentPropertyDefinition[],
): OptionValueMigration[] {
  return migrations.map((migration) => {
    if (!migration.toOptionId) return migration;
    const replacement = definitions
      .find((definition) => definition.key === migration.fieldKey)
      ?.options?.find((option) => option.id === migration.toOptionId);
    return { ...migration, to: replacement?.label };
  });
}

export function normalizeDefinitionForSave(
  original: DocumentPropertyDefinition | undefined,
  definition: DocumentPropertyDefinition,
): DocumentPropertyDefinition {
  const { showWhenEmpty: _legacyShowWhenEmpty, ...definitionWithoutVisibility } = definition;
  const options = (definition.options ?? []).map((option) => ({ ...option, label: option.label.trim() || "未命名选项" }));
  let defaultValue = definition.defaultValue;
  if (original && defaultValue !== undefined) {
    const renamedOptions = new Map(
      (original.options ?? []).map((option) => [option.label, options.find((item) => item.id === option.id)?.label ?? option.label]),
    );
    if (typeof defaultValue === "string" && renamedOptions.has(defaultValue)) defaultValue = renamedOptions.get(defaultValue);
    if (Array.isArray(defaultValue)) {
      defaultValue = defaultValue.map((item) => (typeof item === "string" ? (renamedOptions.get(item) ?? item) : item));
    }
  }
  const next = {
    ...definitionWithoutVisibility,
    label: definition.label.trim() || definition.key,
    options,
    defaultValue,
  };
  if (defaultValue === undefined) return next;
  return { ...next, defaultValue: normalizeValueForDefinition(defaultValue, next) };
}

export function replaceOptionValue(value: MetadataValue | undefined, from: string, to?: string): MetadataValue | undefined {
  if (value === from) return to;
  if (!Array.isArray(value)) return value;
  const next = value.map((item) => (item === from ? to : item)).filter((item): item is MetadataValue => item !== undefined);
  return next.length > 0 ? next : undefined;
}

export function applyPendingValueMigrations(
  sheet: WritingSheet,
  optionMigrations: OptionValueMigration[],
  typeMigrations: TypeValueMigration[],
  definitions: DocumentPropertyDefinition[],
): WritingSheet {
  const properties = { ...(sheet.properties ?? {}) };
  for (const migration of optionMigrations) {
    const value = properties[migration.fieldKey];
    if (value === undefined) continue;
    const next = replaceOptionValue(value, migration.from, migration.to);
    if (next === undefined || isEmptyMetadataValue(next)) delete properties[migration.fieldKey];
    else properties[migration.fieldKey] = next;
  }
  for (const migration of typeMigrations) {
    const value = properties[migration.fieldKey];
    if (value === undefined) continue;
    if (migration.mode === "clear") {
      delete properties[migration.fieldKey];
      continue;
    }
    const definition = definitions.find((item) => item.key === migration.fieldKey);
    const next = definition ? convertMetadataValue(value, migration.nextType, definition.options ?? []) : undefined;
    if (next === undefined || isEmptyMetadataValue(next)) delete properties[migration.fieldKey];
    else properties[migration.fieldKey] = next;
  }
  return { ...sheet, properties };
}

export function removeSheetPropertyValues(sheets: WritingSheet[], keys: string[]): WritingSheet[] {
  if (keys.length === 0) return sheets;
  const removedKeys = new Set(keys);
  return sheets.map((sheet) => ({
    ...sheet,
    properties: Object.fromEntries(Object.entries(sheet.properties ?? {}).filter(([key]) => !removedKeys.has(key))),
  }));
}

export function migrateSheetValues(
  sheet: WritingSheet,
  originalDefinitions: DocumentPropertyDefinition[],
  nextDefinitions: DocumentPropertyDefinition[],
): WritingSheet {
  const properties = { ...(sheet.properties ?? {}) };
  for (const definition of nextDefinitions) {
    const original = originalDefinitions.find((item) => item.id === definition.id);
    if (!original || definition.locked) continue;
    const currentValue = properties[definition.key];
    if (currentValue === undefined) continue;

    const renamedOptions = new Map(
      (original.options ?? []).map((option) => [
        option.label,
        definition.options?.find((item) => item.id === option.id)?.label ?? option.label,
      ]),
    );
    let nextValue: MetadataValue = currentValue;
    if (typeof currentValue === "string" && renamedOptions.has(currentValue)) nextValue = renamedOptions.get(currentValue) ?? currentValue;
    if (Array.isArray(currentValue)) {
      nextValue = currentValue.map((item) => (typeof item === "string" ? (renamedOptions.get(item) ?? item) : item));
    }
    const normalized = normalizeValueForDefinition(nextValue, definition);
    if (normalized === undefined) delete properties[definition.key];
    else properties[definition.key] = normalized;
  }
  return { ...sheet, properties };
}

export function convertMetadataValue(value: MetadataValue, type: PropertyFieldType, options: PropertyOption[]): MetadataValue | undefined {
  if (type === "text" || type === "url" || type === "date") {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return undefined;
  }
  if (type === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    return undefined;
  }
  if (type === "checkbox") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (["true", "是", "已完成", "已发布"].includes(normalized)) return true;
      if (["false", "否", "未完成", "未发布"].includes(normalized)) return false;
    }
    return undefined;
  }
  if (type === "tags") {
    if (typeof value === "string") return value.trim() ? [value.trim()] : undefined;
    if (Array.isArray(value)) {
      const tags = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
      return tags.length > 0 ? tags : undefined;
    }
    return undefined;
  }
  const optionLabels = new Set(options.map((option) => option.label));
  if (type === "select") return typeof value === "string" && optionLabels.has(value) ? value : undefined;
  if (type === "multiSelect") {
    const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const selected = values.filter((item): item is string => typeof item === "string" && optionLabels.has(item));
    return selected.length > 0 ? selected : undefined;
  }
  return undefined;
}

function normalizeValueForDefinition(value: MetadataValue, definition: DocumentPropertyDefinition): MetadataValue | undefined {
  if (definition.type === "text" || definition.type === "url" || definition.type === "date") {
    return typeof value === "string" ? value : undefined;
  }
  if (definition.type === "number") return typeof value === "number" ? value : undefined;
  if (definition.type === "checkbox") return typeof value === "boolean" ? value : undefined;
  if (definition.type === "select") {
    const labels = new Set((definition.options ?? []).map((option) => option.label));
    return typeof value === "string" && labels.has(value) ? value : undefined;
  }
  if (definition.type === "multiSelect") {
    const labels = new Set((definition.options ?? []).map((option) => option.label));
    const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && labels.has(item)) : [];
    return values.length > 0 ? values : undefined;
  }
  if (definition.type === "tags") {
    const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return values.length > 0 ? values : undefined;
  }
  return undefined;
}
