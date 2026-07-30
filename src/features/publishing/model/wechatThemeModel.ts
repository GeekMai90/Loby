/**
 * [INPUT]: 依赖 wechatThemes 的 schema 版本、内置 registry 与主题 manifest/样式类型
 * [OUTPUT]: 对外提供主题 manifest 校验、克隆、旧格式/namespace 迁移、兼容诊断与颜色选择器归一化能力
 * [POS]: 公众号主题 manifest 的权威校验与迁移层，统一旧 namespace、旧 shape、颜色和数值预算
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  WECHAT_THEME_SCHEMA_VERSION,
  getWechatTheme,
  type WechatThemeBaseStyle,
  type WechatThemeHtmlTransform,
  type WechatThemeHtmlTransformOperation,
  type WechatThemeManifest,
} from "@/features/publishing/model/wechatThemes";

const HTML_TRANSFORM_OPERATIONS = new Set<WechatThemeHtmlTransformOperation>(["prepend", "append", "replace-inner", "replace"]);
const TYPOGRAPHY_RANGES: Record<keyof WechatThemeBaseStyle["typography"], [number, number]> = {
  articleTitleSize: [12, 72],
  h2Size: [12, 56],
  h3Size: [10, 48],
  h4Size: [10, 40],
  bodySize: [10, 32],
  bodyLineHeight: [1, 3],
  paragraphSpacing: [0, 64],
};
const LAYOUT_RANGES: Record<keyof WechatThemeBaseStyle["layout"], [number, number]> = {
  contentPadding: [0, 80],
  sectionSpacing: [0, 120],
  radius: [0, 80],
  imageRadius: [0, 80],
  shadowStrength: [0, 2],
};
const COLOR_KEYS: Array<keyof WechatThemeBaseStyle["colors"]> = [
  "accent",
  "pageBackground",
  "titleText",
  "bodyText",
  "emphasisText",
  "linkText",
  "markColor",
];
const LEGACY_THEME_NAMESPACE = "nibva-";
const CURRENT_THEME_NAMESPACE = "loby-";

export function getWechatThemeValidationIssues(value: unknown): string[] {
  if (!isRecord(value)) return ["主题必须是对象。"];

  const issues: string[] = [];
  if (value.schemaVersion !== WECHAT_THEME_SCHEMA_VERSION) issues.push("主题协议版本不受支持。");
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(value.id)) issues.push("主题 ID 无效。");
  if (value.kind !== "built-in" && value.kind !== "personal") issues.push("主题类型无效。");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 80) issues.push("主题名称无效。");
  if (typeof value.description !== "string") issues.push("主题描述无效。");
  if (value.baseThemeId !== undefined && typeof value.baseThemeId !== "string") issues.push("基础主题 ID 无效。");
  if (
    !Array.isArray(value.swatches) ||
    value.swatches.length !== 3 ||
    value.swatches.some((item) => !isNonEmptyString(item) || !isWechatThemeColor(item.trim()))
  ) {
    issues.push("主题色板必须包含三个颜色值。");
  }

  if (!isRecord(value.baseStyle)) {
    issues.push("主题缺少基础样式。");
  } else {
    validateBaseStyle(value.baseStyle, issues);
  }

  if (value.custom !== undefined) validateCustomSource(value.custom, issues);
  if (!isNonEmptyString(value.createdAt) || !isNonEmptyString(value.updatedAt)) issues.push("主题时间信息无效。");
  return issues;
}

export function isWechatThemeManifest(value: unknown): value is WechatThemeManifest {
  return getWechatThemeValidationIssues(value).length === 0;
}

export function cloneWechatThemeManifest(theme: WechatThemeManifest): WechatThemeManifest {
  return {
    ...theme,
    swatches: [...theme.swatches],
    baseStyle: {
      typography: { ...theme.baseStyle.typography },
      colors: { ...theme.baseStyle.colors },
      layout: { ...theme.baseStyle.layout },
    },
    custom: theme.custom
      ? {
          css: theme.custom.css,
          htmlTransforms: theme.custom.htmlTransforms.map((transform) => ({ ...transform })),
        }
      : undefined,
    source: theme.source ? { ...theme.source } : undefined,
  };
}

export function normalizeWechatThemeManifest(value: unknown): WechatThemeManifest | null {
  const namespaceMigrated = migrateLegacyWechatThemeNamespace(value);
  if (isWechatThemeManifest(namespaceMigrated)) return cloneWechatThemeManifest(namespaceMigrated);
  const shapeMigrated = migrateDraftV2WechatTheme(namespaceMigrated) ?? migrateLegacyWechatTheme(namespaceMigrated);
  const migrated = migrateLegacyWechatThemeNamespace(shapeMigrated);
  return isWechatThemeManifest(migrated) ? cloneWechatThemeManifest(migrated) : null;
}

export function getWechatThemeCompatibilityIssues(theme: WechatThemeManifest): string[] {
  return hasLegacyWechatThemeNamespace(theme) ? ["主题仍使用旧版样式命名，相关样式可能无法应用；请重新加载主题以完成自动迁移。"] : [];
}

export function hasLegacyWechatThemeNamespace(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.custom)) return false;
  const custom = value.custom;
  const values = [
    custom.css,
    ...(Array.isArray(custom.htmlTransforms)
      ? custom.htmlTransforms.flatMap((transform) => (isRecord(transform) ? [transform.selector, transform.html] : []))
      : []),
  ];
  return values.some((item) => typeof item === "string" && item.includes(LEGACY_THEME_NAMESPACE));
}

export function isWechatThemeColor(value: string): boolean {
  return (
    value === "transparent" ||
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
    /^rgba?\([0-9.,%\s+-]+\)$/.test(value) ||
    /^hsla?\([0-9.,%\s+-]+\)$/.test(value)
  );
}

export function wechatThemeColorToPickerValue(value: string): string {
  const color = value.trim();
  const hex = color.match(/^#([0-9a-fA-F]{3,8})$/)?.[1];
  if (hex && (hex.length === 3 || hex.length === 4)) {
    return `#${hex
      .slice(0, 3)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`.toUpperCase();
  }
  if (hex && (hex.length === 6 || hex.length === 8)) return `#${hex.slice(0, 6)}`.toUpperCase();

  const rgb = color.match(/^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i);
  if (rgb) {
    const percentages = color.slice(0, color.indexOf(")")).includes("%");
    const channels = rgb.slice(1, 4).map((channel) => {
      const numeric = Number(channel);
      return Math.round(Math.min(255, Math.max(0, percentages ? (numeric / 100) * 255 : numeric)));
    });
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }
  return "#000000";
}

function validateBaseStyle(value: Record<string, unknown>, issues: string[]) {
  if (!isRecord(value.typography)) {
    issues.push("主题缺少字体基础样式。");
  } else {
    for (const [key, range] of Object.entries(TYPOGRAPHY_RANGES) as Array<[keyof WechatThemeBaseStyle["typography"], [number, number]]>) {
      if (!isNumberInRange(value.typography[key], range)) issues.push(`主题字体参数 ${key} 无效。`);
    }
  }

  if (!isRecord(value.colors)) {
    issues.push("主题缺少颜色基础样式。");
  } else {
    for (const key of COLOR_KEYS) {
      if (!isNonEmptyString(value.colors[key]) || !isWechatThemeColor(value.colors[key].trim())) {
        issues.push(`主题颜色参数 ${key} 无效。`);
      }
    }
  }

  if (!isRecord(value.layout)) {
    issues.push("主题缺少版式基础样式。");
  } else {
    for (const [key, range] of Object.entries(LAYOUT_RANGES) as Array<[keyof WechatThemeBaseStyle["layout"], [number, number]]>) {
      if (!isNumberInRange(value.layout[key], range)) issues.push(`主题版式参数 ${key} 无效。`);
    }
  }
}

function validateCustomSource(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("主题自由样式必须是对象。");
    return;
  }
  if (typeof value.css !== "string" || value.css.length > 200_000) issues.push("主题 CSS 无效或过长。");
  if (!Array.isArray(value.htmlTransforms) || value.htmlTransforms.length > 100) {
    issues.push("主题 HTML 变换无效或过多。");
    return;
  }
  for (const transform of value.htmlTransforms) {
    if (!isWechatHtmlTransform(transform)) {
      issues.push("主题包含无效的 HTML 变换。");
      break;
    }
  }
}

function isWechatHtmlTransform(value: unknown): value is WechatThemeHtmlTransform {
  return (
    isRecord(value) &&
    isNonEmptyString(value.selector) &&
    value.selector.length <= 500 &&
    HTML_TRANSFORM_OPERATIONS.has(value.operation as WechatThemeHtmlTransformOperation) &&
    typeof value.html === "string" &&
    value.html.length <= 100_000
  );
}

function migrateLegacyWechatTheme(value: unknown): WechatThemeManifest | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.tokens)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const baseThemeId = typeof value.baseThemeId === "string" ? value.baseThemeId : id;
  const base = cloneWechatThemeManifest(getWechatTheme(baseThemeId));
  const tokens = value.tokens;
  const radius = parsePixelValue(tokens.radius, base.baseStyle.layout.radius);
  const migrated: WechatThemeManifest = {
    ...base,
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id,
    kind: value.kind === "built-in" ? "built-in" : "personal",
    name: typeof value.name === "string" ? value.name : base.name,
    description: typeof value.description === "string" ? value.description : base.description,
    baseThemeId: typeof value.baseThemeId === "string" ? value.baseThemeId : undefined,
    swatches: normalizeLegacySwatches(value.swatches, base.swatches),
    baseStyle: {
      typography: { ...base.baseStyle.typography },
      colors: {
        accent: legacyColor(tokens.accent, base.baseStyle.colors.accent),
        pageBackground: legacyColor(tokens.pageBackground, base.baseStyle.colors.pageBackground),
        titleText: legacyColor(tokens.headingTitle, base.baseStyle.colors.titleText),
        bodyText: legacyColor(tokens.paragraphText, base.baseStyle.colors.bodyText),
        emphasisText: legacyColor(tokens.emphasisText, base.baseStyle.colors.emphasisText),
        linkText: legacyColor(tokens.linkText, base.baseStyle.colors.linkText),
        markColor: legacyColor(tokens.markBackground, base.baseStyle.colors.markColor),
      },
      layout: { ...base.baseStyle.layout, radius },
    },
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
  return migrated;
}

function migrateDraftV2WechatTheme(value: unknown): WechatThemeManifest | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== WECHAT_THEME_SCHEMA_VERSION ||
    !isRecord(value.baseStyle) ||
    !isRecord(value.baseStyle.colors) ||
    typeof value.baseStyle.colors.markColor === "string"
  ) {
    return null;
  }
  const baseThemeId = typeof value.baseThemeId === "string" ? value.baseThemeId : typeof value.id === "string" ? value.id : "";
  const markColor = legacyColor(value.baseStyle.colors.markBackground, getWechatTheme(baseThemeId).baseStyle.colors.markColor);
  const colors = { ...value.baseStyle.colors };
  delete colors.markBackground;
  delete colors.markText;
  return {
    ...(value as unknown as WechatThemeManifest),
    baseStyle: {
      ...(value.baseStyle as unknown as WechatThemeBaseStyle),
      colors: {
        ...(colors as unknown as WechatThemeBaseStyle["colors"]),
        markColor,
      },
    },
  };
}

function migrateLegacyWechatThemeNamespace(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.custom)) return value;
  const custom = value.custom;
  let changed = false;
  const migrateText = (text: unknown): unknown => {
    if (typeof text !== "string" || !text.includes(LEGACY_THEME_NAMESPACE)) return text;
    changed = true;
    return text.replaceAll(LEGACY_THEME_NAMESPACE, CURRENT_THEME_NAMESPACE);
  };
  const css = migrateText(custom.css);
  const htmlTransforms = Array.isArray(custom.htmlTransforms)
    ? custom.htmlTransforms.map((transform) => {
        if (!isRecord(transform)) return transform;
        return {
          ...transform,
          selector: migrateText(transform.selector),
          html: migrateText(transform.html),
        };
      })
    : custom.htmlTransforms;
  if (!changed) return value;
  return {
    ...value,
    custom: {
      ...custom,
      css,
      htmlTransforms,
    },
  };
}

function normalizeLegacySwatches(value: unknown, fallback: [string, string, string]): [string, string, string] {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "string" && isWechatThemeColor(item))) {
    return [value[0], value[1], value[2]];
  }
  return [...fallback];
}

function legacyColor(value: unknown, fallback: string): string {
  return typeof value === "string" && isWechatThemeColor(value) ? value : fallback;
}

function parsePixelValue(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : fallback;
}

function isNumberInRange(value: unknown, [min, max]: [number, number]): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}
