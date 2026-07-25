/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供文稿系统元信息定义、文稿自定义属性规范化、默认文稿创建、跨项目默认值补齐与属性读写等公开能力
 * [POS]: 编辑器 feature 的文稿元信息边界，系统属性与按项目隔离的自定义属性都归文稿模型所有
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  MetadataValue,
  DocumentPropertyDefinition,
  PropertyFieldType,
  PropertyOption,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import { moveItemById, type RailDropPosition } from "@/features/library/model/sheetSorting";

export type PropertyFilterOperator =
  | "contains"
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "isNotEmpty"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "isTrue"
  | "isFalse"
  | "containsAny"
  | "containsAll";

export interface DocumentPropertyFilter {
  fieldKey: string;
  operator: PropertyFilterOperator;
  value: string;
  valueTo?: string;
}

const OPTION_COLORS = ["#007aff", "#34c759", "#ff9500", "#af52de", "#ff3b30", "#5ac8fa", "#8e8e93"];
const DIRECT_SHEET_PROPERTY_KEYS = new Set(["tags", "targetWords", "description"]);
const LEGACY_SYSTEM_PROPERTY_KEYS = new Set(["summary"]);

export const DOCUMENT_PROPERTY_DEFINITIONS: DocumentPropertyDefinition[] = [
  {
    id: "loby-tags",
    key: "tags",
    label: "标签",
    type: "tags",
    description: "允许自由创建并复用的主题标签。",
    defaultValue: [],
    locked: true,
  },
  {
    id: "loby-target-words",
    key: "targetWords",
    label: "目标字数",
    type: "number",
    description: "用于显示文稿写作进度。",
    defaultValue: 1000,
    locked: true,
  },
  {
    id: "loby-description",
    key: "description",
    label: "摘要",
    type: "text",
    description: "由作者填写的文稿摘要，发布渠道需要时直接使用。",
    defaultValue: "",
    locked: true,
  },
];

export function getDocumentPropertyDefinitions(customDefinitions: DocumentPropertyDefinition[] = []): DocumentPropertyDefinition[] {
  const systemKeys = new Set([...DOCUMENT_PROPERTY_DEFINITIONS.map((definition) => definition.key), ...LEGACY_SYSTEM_PROPERTY_KEYS]);
  return [
    ...DOCUMENT_PROPERTY_DEFINITIONS.map(cloneDefinition),
    ...customDefinitions.filter((definition) => !systemKeys.has(definition.key)).map(normalizeDefinition),
  ];
}

export function reorderDocumentPropertyDefinitions(
  definitions: DocumentPropertyDefinition[],
  sourceId: string,
  targetId: string,
  position: RailDropPosition,
): DocumentPropertyDefinition[] {
  const systemDefinitions = definitions.filter((definition) => definition.locked);
  if (systemDefinitions.some((definition) => definition.id === sourceId || definition.id === targetId)) return definitions;
  const customDefinitions = definitions.filter((definition) => !definition.locked);
  return [...systemDefinitions, ...moveItemById(customDefinitions, sourceId, targetId, position)];
}

export function normalizeDocumentPropertyModel(project: WritingProject): WritingProject {
  const sourceDefinitions = project.documentPropertyDefinitions ?? [];
  const systemKeys = new Set([...DOCUMENT_PROPERTY_DEFINITIONS.map((definition) => definition.key), ...LEGACY_SYSTEM_PROPERTY_KEYS]);
  const existingDefinitions = sourceDefinitions.filter((definition) => !systemKeys.has(definition.key));
  const documentPropertyDefinitions = existingDefinitions.map(normalizeDefinition);

  return {
    ...project,
    archivedAt: project.archivedAt || (project.status === "已归档" ? project.updatedAt : ""),
    documentPropertyDefinitions,
    sheets: project.sheets.map((sheet) => {
      const { summary: legacySummary, ...currentSheet } = sheet as WritingSheet & { summary?: string };
      const properties = { ...(sheet.properties ?? {}) };
      delete properties.tags;
      delete properties.targetWords;
      delete properties.description;
      delete properties.summary;
      return {
        ...currentSheet,
        archivedAt: sheet.archivedAt || (sheet.status === "已归档" ? sheet.updatedAt : ""),
        tags: sheet.tags ?? [],
        description: sheet.description ?? legacySummary ?? "",
        properties,
      };
    }),
  };
}

export function getSheetPropertyValue(sheet: WritingSheet, definition: DocumentPropertyDefinition): MetadataValue | undefined {
  if (definition.key === "tags") return sheet.tags;
  if (definition.key === "targetWords") return sheet.targetWords;
  if (definition.key === "description") return sheet.description;
  return sheet.properties?.[definition.key];
}

export function setSheetPropertyValue(
  sheet: WritingSheet,
  definition: DocumentPropertyDefinition,
  value: MetadataValue | undefined,
): WritingSheet {
  if (definition.key === "tags") {
    return { ...sheet, tags: Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [] };
  }
  if (definition.key === "targetWords") return { ...sheet, targetWords: typeof value === "number" ? value : 0 };
  if (definition.key === "description") return { ...sheet, description: typeof value === "string" ? value : "" };
  const properties = { ...(sheet.properties ?? {}) };
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    delete properties[definition.key];
  } else {
    properties[definition.key] = value;
  }
  return { ...sheet, properties };
}

export function isEmptyMetadataValue(value: MetadataValue | undefined): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function applyDefinitionDefaultToSheet(sheet: WritingSheet, definition: DocumentPropertyDefinition): WritingSheet {
  if (definition.defaultValue === undefined || !isEmptyMetadataValue(getSheetPropertyValue(sheet, definition))) return sheet;
  return setSheetPropertyValue(sheet, definition, cloneMetadataValue(definition.defaultValue));
}

export function applyDefinitionDefaultsToSheet(sheet: WritingSheet, definitions: DocumentPropertyDefinition[]): WritingSheet {
  return definitions.reduce((current, definition) => applyDefinitionDefaultToSheet(current, definition), sheet);
}

export function applyDefinitionDefaultsToSheets(sheets: WritingSheet[], definitions: DocumentPropertyDefinition[]): WritingSheet[] {
  return sheets.map((sheet) => applyDefinitionDefaultsToSheet(sheet, definitions));
}

export function getVisiblePropertyDefinitions(
  _sheet: WritingSheet,
  definitions: DocumentPropertyDefinition[],
): DocumentPropertyDefinition[] {
  return definitions;
}

export function buildDefaultDocumentProperties(definitions: DocumentPropertyDefinition[]): Record<string, MetadataValue> {
  const properties: Record<string, MetadataValue> = {};
  for (const definition of definitions) {
    if (DIRECT_SHEET_PROPERTY_KEYS.has(definition.key) || definition.key === "tags") continue;
    if (definition.defaultValue !== undefined) properties[definition.key] = cloneMetadataValue(definition.defaultValue);
  }
  return properties;
}

export interface NewProjectSheetInput {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  groupId?: string;
  status?: WritingSheet["status"];
  tags?: string[];
  targetWords?: number;
  description?: string;
  createdAt?: string;
  properties?: Record<string, MetadataValue>;
  archivedAt?: string;
  versions?: WritingSheet["versions"];
}

export function createSheetWithProjectDefaults(project: WritingProject, input: NewProjectSheetInput): WritingSheet {
  const customDefinitions = project.documentPropertyDefinitions ?? [];
  const inputProperties = { ...(input.properties ?? {}) };

  return {
    id: input.id,
    title: input.title,
    groupId: input.groupId,
    status: input.status ?? "构思",
    tags: input.tags ?? [],
    targetWords: input.targetWords ?? 1000,
    description: input.description ?? "",
    body: input.body,
    createdAt: input.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    properties: {
      ...buildDefaultDocumentProperties(customDefinitions),
      ...inputProperties,
    },
    archivedAt: input.archivedAt,
    versions: input.versions,
  };
}

export function createPropertyDefinition(
  label: string,
  type: PropertyFieldType,
  existingDefinitions: DocumentPropertyDefinition[],
): DocumentPropertyDefinition {
  const trimmedLabel = label.trim() || "新属性";
  const key = uniquePropertyKey(trimmedLabel, existingDefinitions);
  return {
    id: createPropertyId("field"),
    key,
    label: trimmedLabel,
    type,
    options:
      type === "select" || type === "multiSelect"
        ? [
            { id: createPropertyId("option"), label: "选项 1", color: OPTION_COLORS[0] },
            { id: createPropertyId("option"), label: "选项 2", color: OPTION_COLORS[1] },
          ]
        : [],
  };
}

export function createPropertyOption(label: string, optionCount: number): PropertyOption {
  return {
    id: createPropertyId("option"),
    label: label.trim() || `选项 ${optionCount + 1}`,
    color: OPTION_COLORS[optionCount % OPTION_COLORS.length],
  };
}

export function isSupportedPropertyValue(value: MetadataValue | undefined): value is string | number | boolean | string[] | null {
  return (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

export function formatDocumentPropertiesForContext(project: WritingProject, sheet: WritingSheet): string[] {
  return getDocumentPropertyDefinitions(project.documentPropertyDefinitions)
    .map((definition) => {
      const value = getSheetPropertyValue(sheet, definition);
      const formatted = formatMetadataValue(value);
      return formatted ? `${definition.label}：${formatted}` : "";
    })
    .filter(Boolean);
}

export function filterSheetsByDocumentProperty(
  sheets: WritingSheet[],
  definition: DocumentPropertyDefinition | undefined,
  filter: DocumentPropertyFilter,
): WritingSheet[] {
  if (!definition || !filter.fieldKey) return sheets;
  const operator = filter.operator || getDefaultPropertyFilterOperator(definition.type);
  if (!["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(operator) && filter.value.trim() === "") return sheets;
  return sheets.filter((sheet) => {
    const value = getSheetPropertyValue(sheet, definition);
    if (operator === "isEmpty") return isEmptyMetadataValue(value);
    if (operator === "isNotEmpty") return !isEmptyMetadataValue(value);
    if (operator === "isTrue") return value === true;
    if (operator === "isFalse") return value === false;
    if (definition.type === "multiSelect" || definition.type === "tags") {
      if (!Array.isArray(value)) return false;
      const actual = value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
      const expected = splitFilterValues(filter.value);
      if (operator === "containsAll") return expected.every((item) => actual.includes(item));
      return expected.some((item) => actual.includes(item));
    }
    if (definition.type === "number") {
      if (typeof value !== "number") return false;
      const expected = Number(filter.value);
      if (!Number.isFinite(expected)) return false;
      if (operator === "greaterThan") return value > expected;
      if (operator === "lessThan") return value < expected;
      if (operator === "between") {
        const upper = Number(filter.valueTo);
        return Number.isFinite(upper) && value >= Math.min(expected, upper) && value <= Math.max(expected, upper);
      }
      return operator === "notEquals" ? value !== expected : value === expected;
    }
    if (definition.type === "date") {
      if (typeof value !== "string") return false;
      if (operator === "greaterThan") return value > filter.value;
      if (operator === "lessThan") return value < filter.value;
      if (operator === "between") {
        if (!filter.valueTo) return false;
        const [start, end] = filter.value <= filter.valueTo ? [filter.value, filter.valueTo] : [filter.valueTo, filter.value];
        return value >= start && value <= end;
      }
      return operator === "notEquals" ? value !== filter.value : value === filter.value;
    }
    if (typeof value !== "string") return false;
    const actual = value.toLowerCase();
    const expected = filter.value.toLowerCase();
    if (operator === "equals") return actual === expected;
    if (operator === "notEquals") return actual !== expected;
    return actual.includes(expected);
  });
}

export function getDefaultPropertyFilterOperator(type: PropertyFieldType): PropertyFilterOperator {
  if (type === "checkbox") return "isTrue";
  if (type === "select" || type === "number" || type === "date") return "equals";
  if (type === "multiSelect" || type === "tags") return "containsAny";
  return "contains";
}

export function mergeCompatiblePropertyDefinitions(projects: WritingProject[]): DocumentPropertyDefinition[] {
  const byKey = new Map<string, DocumentPropertyDefinition>();
  const conflicts = new Set<string>();
  for (const project of projects) {
    for (const definition of project.documentPropertyDefinitions ?? []) {
      const current = byKey.get(definition.key);
      if (!current) {
        byKey.set(definition.key, cloneDefinition(definition));
        continue;
      }
      if (current.type !== definition.type) {
        conflicts.add(definition.key);
        continue;
      }
      if (definition.type === "select" || definition.type === "multiSelect") {
        const options = new Map((current.options ?? []).map((option) => [option.label, option]));
        for (const option of definition.options ?? []) if (!options.has(option.label)) options.set(option.label, { ...option });
        byKey.set(definition.key, { ...current, options: Array.from(options.values()) });
      }
    }
  }
  return Array.from(byKey.values()).filter((definition) => !conflicts.has(definition.key));
}

function splitFilterValues(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function formatMetadataValue(value: MetadataValue | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join("、");
  return "";
}

function normalizeDefinition(definition: DocumentPropertyDefinition): DocumentPropertyDefinition {
  const { showWhenEmpty: _legacyShowWhenEmpty, ...definitionWithoutVisibility } = definition;
  return {
    ...definitionWithoutVisibility,
    options: (definition.options ?? []).map((option) => ({ ...option })),
    locked: false,
  };
}

function cloneDefinition(definition: DocumentPropertyDefinition): DocumentPropertyDefinition {
  return {
    ...definition,
    options: (definition.options ?? []).map((option) => ({ ...option })),
    defaultValue: definition.defaultValue === undefined ? undefined : cloneMetadataValue(definition.defaultValue),
  };
}

function cloneMetadataValue<T extends MetadataValue>(value: T): T {
  return structuredClone(value);
}

function uniquePropertyKey(label: string, definitions: DocumentPropertyDefinition[]): string {
  const existingKeys = new Set(definitions.map((definition) => definition.key));
  if (!existingKeys.has(label)) return label;
  let suffix = 2;
  while (existingKeys.has(`${label} ${suffix}`)) suffix += 1;
  return `${label} ${suffix}`;
}

function createPropertyId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
