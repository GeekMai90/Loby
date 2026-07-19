import type {
  MetadataValue,
  ProjectPropertyDefinition,
  PropertyFieldType,
  PropertyOption,
  SheetType,
  WritingProject,
  WritingSheet,
} from "../types";

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
const SHEET_TYPES: SheetType[] = ["正文", "章节", "提纲", "素材", "发布版本"];

const SHEET_TYPE_OPTIONS: PropertyOption[] = (["正文", "章节", "提纲", "素材", "发布版本"] as SheetType[]).map((label, index) => ({
  id: `kind-${index}`,
  label,
  color: OPTION_COLORS[index % OPTION_COLORS.length],
}));

export const APP_PROPERTY_DEFINITIONS: ProjectPropertyDefinition[] = [
  {
    id: "loby-kind",
    key: "type",
    label: "文稿类型",
    type: "select",
    description: "落笔使用该字段区分正文、素材和发布版本。",
    options: SHEET_TYPE_OPTIONS,
    defaultValue: "正文",
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
  {
    id: "loby-summary",
    key: "summary",
    label: "摘要",
    type: "text",
    description: "帮助列表预览和 AI 理解文稿用途。",
    showWhenEmpty: false,
    locked: true,
  },
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
];

export const LEGACY_STAGE_FIELD_ID = "legacy-stage";
export const LEGACY_PLATFORM_FIELD_ID = "legacy-target-platform";

export function createDefaultPropertyDefinitions(project?: Pick<WritingProject, "sheets" | "targetPlatform">): ProjectPropertyDefinition[] {
  const statuses = Array.from(new Set((project?.sheets ?? []).map((sheet) => sheet.status).filter((status) => status !== "已归档")));
  const stageOptions = (statuses.length > 0 ? statuses : ["构思", "初稿", "修改中", "完稿"]).map((label, index) => ({
    id: `stage-${index}`,
    label,
    color: OPTION_COLORS[index % OPTION_COLORS.length],
  }));
  const definitions: ProjectPropertyDefinition[] = [
    ...APP_PROPERTY_DEFINITIONS.map(cloneDefinition),
    {
      id: LEGACY_STAGE_FIELD_ID,
      key: "阶段",
      label: "阶段",
      type: "select",
      description: "项目自定义的写作阶段，不触发落笔自动流程。",
      options: stageOptions,
      defaultValue: stageOptions[0]?.label ?? "构思",
      showWhenEmpty: true,
    },
  ];
  const platform = project?.targetPlatform?.trim();
  if (platform && platform !== "未指定") {
    definitions.push({
      id: LEGACY_PLATFORM_FIELD_ID,
      key: "目标平台",
      label: "目标平台",
      type: "text",
      description: "从旧版项目目标平台迁移，可按当前项目需要调整。",
      defaultValue: platform,
      showWhenEmpty: false,
    });
  }
  return definitions;
}

export function normalizeProjectPropertyModel(project: WritingProject): WritingProject {
  const existingDefinitions = project.propertyDefinitions ?? [];
  const defaultDefinitions = createDefaultPropertyDefinitions(project);
  const existingKeys = new Set(existingDefinitions.map((definition) => definition.key));
  const legacyDefinitions = existingDefinitions.length === 0 ? defaultDefinitions : [];
  const propertyDefinitions = [
    ...APP_PROPERTY_DEFINITIONS.filter((definition) => !existingKeys.has(definition.key)).map(cloneDefinition),
    ...existingDefinitions.map(normalizeDefinition),
    ...legacyDefinitions.filter(
      (definition) =>
        !APP_PROPERTY_DEFINITIONS.some((appDefinition) => appDefinition.key === definition.key) && !existingKeys.has(definition.key),
    ),
  ];
  const hasPlatformDefinition = propertyDefinitions.some((definition) => definition.key === "目标平台");
  const legacyPlatform = project.targetPlatform?.trim();

  return {
    ...project,
    archivedAt: project.archivedAt || (project.status === "已归档" ? project.updatedAt : ""),
    propertyDefinitions,
    sheets: project.sheets.map((sheet) => {
      const properties = { ...(sheet.properties ?? {}) };
      if (!("阶段" in properties) && sheet.status !== "已归档") properties["阶段"] = sheet.status;
      if (hasPlatformDefinition && !("目标平台" in properties) && legacyPlatform && legacyPlatform !== "未指定") {
        properties["目标平台"] = legacyPlatform;
      }
      if (!("tags" in properties)) properties.tags = [];
      return {
        ...sheet,
        archivedAt: sheet.archivedAt || (sheet.status === "已归档" ? sheet.updatedAt : ""),
        properties,
      };
    }),
  };
}

export function getSheetPropertyValue(sheet: WritingSheet, definition: ProjectPropertyDefinition): MetadataValue | undefined {
  if (definition.key === "type") return sheet.type;
  if (definition.key === "targetWords") return sheet.targetWords;
  if (definition.key === "summary") return sheet.summary;
  return sheet.properties?.[definition.key];
}

export function setSheetPropertyValue(
  sheet: WritingSheet,
  definition: ProjectPropertyDefinition,
  value: MetadataValue | undefined,
): WritingSheet {
  if (definition.key === "type") return { ...sheet, type: value as SheetType };
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
  type?: SheetType;
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
  const typeDefault = definitions.find((definition) => definition.key === "type")?.defaultValue;
  const targetWordsDefault = definitions.find((definition) => definition.key === "targetWords")?.defaultValue;
  const summaryDefault = definitions.find((definition) => definition.key === "summary")?.defaultValue;
  const defaultType =
    typeof typeDefault === "string" && SHEET_TYPES.includes(typeDefault as SheetType) ? (typeDefault as SheetType) : "正文";
  const defaultTargetWords = typeof targetWordsDefault === "number" && Number.isFinite(targetWordsDefault) ? targetWordsDefault : 1000;
  const defaultSummary = typeof summaryDefault === "string" ? summaryDefault : "";

  return {
    id: input.id,
    title: input.title,
    groupId: input.groupId,
    type: input.type ?? defaultType,
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
    (sheet) =>
      !sheet.archivedAt && (sheet.type === "正文" || sheet.type === "章节") && Number.isFinite(sheet.targetWords) && sheet.targetWords > 0,
  )?.targetWords;
  return Math.max(0, Math.round(existingTarget ?? 0));
}

export function applyProjectArticleGoalTarget(project: WritingProject, targetWords: number): WritingProject {
  const normalizedTarget = Number.isFinite(targetWords) ? Math.max(0, Math.round(targetWords)) : 0;
  const definitions = project.propertyDefinitions ?? [];
  const hasTargetDefinition = definitions.some((definition) => definition.key === "targetWords");
  const targetDefinition = APP_PROPERTY_DEFINITIONS.find((definition) => definition.key === "targetWords");
  const propertyDefinitions = hasTargetDefinition
    ? definitions.map((definition) => (definition.key === "targetWords" ? { ...definition, defaultValue: normalizedTarget } : definition))
    : targetDefinition
      ? [...definitions, { ...targetDefinition, defaultValue: normalizedTarget }]
      : definitions;
  return {
    ...project,
    propertyDefinitions,
    sheets: project.sheets.map((sheet) =>
      sheet.type === "正文" || sheet.type === "章节" ? { ...sheet, targetWords: normalizedTarget } : sheet,
    ),
  };
}

export function createPropertyDefinition(
  label: string,
  type: PropertyFieldType,
  existingDefinitions: ProjectPropertyDefinition[],
): ProjectPropertyDefinition {
  const trimmedLabel = label.trim() || "新字段";
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
