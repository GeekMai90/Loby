import type { MetadataValue, ProjectPropertyDefinition, PropertyFieldType, PropertyOption, WritingProject, WritingSheet } from "../types";
import { moveItemById, type RailDropPosition } from "./sheetSorting";

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
const DIRECT_SHEET_PROPERTY_KEYS = new Set(["type", "targetWords", "summary"]);

export const APP_PROPERTY_DEFINITIONS: ProjectPropertyDefinition[] = [
  {
    id: "loby-tags",
    key: "tags",
    label: "标签",
    type: "tags",
    description: "允许自由创建并复用的主题标签。",
    defaultValue: [],
    showWhenEmpty: true,
    locked: true,
  },
  {
    id: "loby-target-words",
    key: "targetWords",
    label: "目标字数",
    type: "number",
    description: "用于显示文稿写作进度。",
    defaultValue: 1000,
    showWhenEmpty: true,
    locked: true,
  },
];

const LEGACY_STAGE_FIELD_ID = "legacy-stage";
const LEGACY_PLATFORM_FIELD_ID = "legacy-target-platform";

export function createDefaultPropertyDefinitions(): ProjectPropertyDefinition[] {
  return APP_PROPERTY_DEFINITIONS.map(cloneDefinition);
}

export function reorderProjectPropertyDefinitions(
  definitions: ProjectPropertyDefinition[],
  sourceId: string,
  targetId: string,
  position: RailDropPosition,
): ProjectPropertyDefinition[] {
  const systemDefinitions = definitions.filter((definition) => definition.locked);
  if (systemDefinitions.some((definition) => definition.id === sourceId || definition.id === targetId)) return definitions;
  const customDefinitions = definitions.filter((definition) => !definition.locked);
  return [...systemDefinitions, ...moveItemById(customDefinitions, sourceId, targetId, position)];
}

export function normalizeProjectPropertyModel(project: WritingProject): WritingProject {
  const sourceDefinitions = project.propertyDefinitions ?? [];
  const removedDefaultDefinitions = sourceDefinitions.filter(isSystemDefaultCustomPropertyDefinition);
  const existingDefinitions = sourceDefinitions.filter(
    (definition) => definition.key !== "type" && definition.key !== "summary" && !isSystemDefaultCustomPropertyDefinition(definition),
  );
  const propertyDefinitions = normalizeOrderedPropertyDefinitions(existingDefinitions);
  const removedDefaultPropertyKeys = new Set(removedDefaultDefinitions.map((definition) => definition.key));
  const hasUserStageDefinition = existingDefinitions.some((definition) => definition.key === "阶段");
  const hasUserPlatformDefinition = existingDefinitions.some((definition) => definition.key === "目标平台");

  return {
    ...project,
    archivedAt: project.archivedAt || (project.status === "已归档" ? project.updatedAt : ""),
    propertyDefinitions,
    sheets: project.sheets.map((sheet) => {
      const properties = { ...(sheet.properties ?? {}) };
      delete properties.type;
      delete properties.targetWords;
      delete properties.summary;
      for (const key of removedDefaultPropertyKeys) delete properties[key];
      if (!hasUserStageDefinition) delete properties["阶段"];
      if (!hasUserPlatformDefinition) delete properties["目标平台"];
      if (!("tags" in properties)) properties.tags = [];
      return {
        ...sheet,
        archivedAt: sheet.archivedAt || (sheet.status === "已归档" ? sheet.updatedAt : ""),
        properties,
      };
    }),
  };
}

function isSystemDefaultCustomPropertyDefinition(definition: ProjectPropertyDefinition): boolean {
  return definition.id === LEGACY_STAGE_FIELD_ID || definition.id === LEGACY_PLATFORM_FIELD_ID || definition.id.startsWith("template-");
}

export function getSheetPropertyValue(sheet: WritingSheet, definition: ProjectPropertyDefinition): MetadataValue | undefined {
  if (definition.key === "targetWords") return sheet.targetWords;
  if (definition.key === "summary") return sheet.summary;
  return sheet.properties?.[definition.key];
}

export function setSheetPropertyValue(
  sheet: WritingSheet,
  definition: ProjectPropertyDefinition,
  value: MetadataValue | undefined,
): WritingSheet {
  if (definition.key === "targetWords") return { ...sheet, targetWords: typeof value === "number" ? value : 0 };
  if (definition.key === "summary") return { ...sheet, summary: typeof value === "string" ? value : "" };
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

export function applyDefinitionDefaultToSheet(sheet: WritingSheet, definition: ProjectPropertyDefinition): WritingSheet {
  if (definition.defaultValue === undefined || !isEmptyMetadataValue(getSheetPropertyValue(sheet, definition))) return sheet;
  return setSheetPropertyValue(sheet, definition, cloneMetadataValue(definition.defaultValue));
}

export function countSheetsMissingPropertyValue(sheets: WritingSheet[], definition: ProjectPropertyDefinition): number {
  return sheets.filter((sheet) => isEmptyMetadataValue(getSheetPropertyValue(sheet, definition))).length;
}

export function getVisiblePropertyDefinitions(
  sheet: WritingSheet,
  definitions: ProjectPropertyDefinition[],
  forcedVisibleFieldIds: string[] = [],
): ProjectPropertyDefinition[] {
  return definitions.filter(
    (definition) =>
      definition.showWhenEmpty ||
      forcedVisibleFieldIds.includes(definition.id) ||
      !isEmptyMetadataValue(getSheetPropertyValue(sheet, definition)),
  );
}

export function buildDefaultDocumentProperties(definitions: ProjectPropertyDefinition[]): Record<string, MetadataValue> {
  const properties: Record<string, MetadataValue> = {};
  for (const definition of definitions) {
    if (DIRECT_SHEET_PROPERTY_KEYS.has(definition.key)) continue;
    if (definition.defaultValue !== undefined) properties[definition.key] = cloneMetadataValue(definition.defaultValue);
  }
  if (!("tags" in properties)) properties.tags = [];
  return properties;
}

export interface NewProjectSheetInput {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  groupId?: string;
  status?: WritingSheet["status"];
  targetWords?: number;
  summary?: string;
  createdAt?: string;
  properties?: Record<string, MetadataValue>;
  archivedAt?: string;
  versions?: WritingSheet["versions"];
}

export function createSheetWithProjectDefaults(project: WritingProject, input: NewProjectSheetInput): WritingSheet {
  const definitions = project.propertyDefinitions ?? [];
  const targetWordsDefault = definitions.find((definition) => definition.key === "targetWords")?.defaultValue;
  const summaryDefault = definitions.find((definition) => definition.key === "summary")?.defaultValue;
  const defaultTargetWords = typeof targetWordsDefault === "number" && Number.isFinite(targetWordsDefault) ? targetWordsDefault : 1000;
  const defaultSummary = typeof summaryDefault === "string" ? summaryDefault : "";

  return {
    id: input.id,
    title: input.title,
    groupId: input.groupId,
    status: input.status ?? "构思",
    targetWords: input.targetWords ?? defaultTargetWords,
    summary: input.summary ?? defaultSummary,
    body: input.body,
    createdAt: input.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    properties: {
      ...buildDefaultDocumentProperties(definitions),
      ...(input.properties ?? {}),
    },
    archivedAt: input.archivedAt,
    versions: input.versions,
  };
}

export function projectArticleGoalTarget(project: Pick<WritingProject, "propertyDefinitions" | "sheets">): number {
  const defaultValue = project.propertyDefinitions?.find((definition) => definition.key === "targetWords")?.defaultValue;
  if (typeof defaultValue === "number" && Number.isFinite(defaultValue)) return Math.max(0, Math.round(defaultValue));
  const existingTarget = project.sheets.find(
    (sheet) => !sheet.archivedAt && Number.isFinite(sheet.targetWords) && sheet.targetWords > 0,
  )?.targetWords;
  return Math.max(0, Math.round(existingTarget ?? 0));
}

export function applyProjectArticleGoalTarget(project: WritingProject, targetWords: number): WritingProject {
  const normalizedTarget = Number.isFinite(targetWords) ? Math.max(0, Math.round(targetWords)) : 0;
  const definitions = (project.propertyDefinitions ?? []).filter((definition) => definition.key !== "summary");
  const targetDefinition = definitions.find((definition) => definition.key === "targetWords");
  const appTargetDefinition = APP_PROPERTY_DEFINITIONS.find((definition) => definition.key === "targetWords");
  const nextDefinitions = targetDefinition
    ? definitions.map((definition) => (definition.key === "targetWords" ? { ...definition, defaultValue: normalizedTarget } : definition))
    : appTargetDefinition
      ? [...definitions, { ...cloneDefinition(appTargetDefinition), defaultValue: normalizedTarget }]
      : definitions;
  return {
    ...project,
    propertyDefinitions: normalizeOrderedPropertyDefinitions(nextDefinitions),
    sheets: project.sheets.map((sheet) => ({ ...sheet, targetWords: normalizedTarget })),
  };
}

export function createPropertyDefinition(
  label: string,
  type: PropertyFieldType,
  existingDefinitions: ProjectPropertyDefinition[],
): ProjectPropertyDefinition {
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
    showWhenEmpty: true,
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
  return (project.propertyDefinitions ?? [])
    .map((definition) => {
      const value = getSheetPropertyValue(sheet, definition);
      const formatted = formatMetadataValue(value);
      return formatted ? `${definition.label}：${formatted}` : "";
    })
    .filter(Boolean);
}

export function filterSheetsByDocumentProperty(
  sheets: WritingSheet[],
  definition: ProjectPropertyDefinition | undefined,
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

export function mergeCompatiblePropertyDefinitions(projects: WritingProject[]): ProjectPropertyDefinition[] {
  const byKey = new Map<string, ProjectPropertyDefinition>();
  const conflicts = new Set<string>();
  for (const project of projects) {
    for (const definition of project.propertyDefinitions ?? []) {
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

function normalizeDefinition(definition: ProjectPropertyDefinition): ProjectPropertyDefinition {
  const appDefinition = APP_PROPERTY_DEFINITIONS.find((item) => item.key === definition.key);
  if (appDefinition) {
    return {
      ...cloneDefinition(appDefinition),
      defaultValue:
        definition.defaultValue === undefined
          ? cloneOptionalMetadataValue(appDefinition.defaultValue)
          : cloneMetadataValue(definition.defaultValue),
      showWhenEmpty: definition.showWhenEmpty ?? appDefinition.showWhenEmpty,
    };
  }
  return {
    ...definition,
    options: (definition.options ?? []).map((option) => ({ ...option })),
    showWhenEmpty: definition.showWhenEmpty ?? true,
    locked: false,
  };
}

function normalizeOrderedPropertyDefinitions(definitions: ProjectPropertyDefinition[]): ProjectPropertyDefinition[] {
  const systemKeys = new Set(APP_PROPERTY_DEFINITIONS.map((definition) => definition.key));
  return [
    ...APP_PROPERTY_DEFINITIONS.map((appDefinition) =>
      normalizeDefinition(definitions.find((definition) => definition.key === appDefinition.key) ?? appDefinition),
    ),
    ...definitions.filter((definition) => !systemKeys.has(definition.key)).map(normalizeDefinition),
  ];
}

function cloneDefinition(definition: ProjectPropertyDefinition): ProjectPropertyDefinition {
  return {
    ...definition,
    options: (definition.options ?? []).map((option) => ({ ...option })),
    defaultValue: definition.defaultValue === undefined ? undefined : cloneMetadataValue(definition.defaultValue),
  };
}

function cloneMetadataValue<T extends MetadataValue>(value: T): T {
  return structuredClone(value);
}

function cloneOptionalMetadataValue(value: MetadataValue | undefined): MetadataValue | undefined {
  return value === undefined ? undefined : cloneMetadataValue(value);
}

function uniquePropertyKey(label: string, definitions: ProjectPropertyDefinition[]): string {
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
