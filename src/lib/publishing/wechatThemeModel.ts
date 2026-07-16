import {
  WECHAT_THEME_SCHEMA_VERSION,
  type WechatFooterStyle,
  type WechatHeadingStyle,
  type WechatHeroStyle,
  type WechatQuoteStyle,
  type WechatThemeManifest,
  type WechatThemeTokens,
} from "./wechatThemes";

const HEADING_STYLES = new Set<WechatHeadingStyle>(["part", "editorial"]);
const HERO_STYLES = new Set<WechatHeroStyle>(["product", "editorial"]);
const QUOTE_STYLES = new Set<WechatQuoteStyle>(["card", "editorial"]);
const FOOTER_STYLES = new Set<WechatFooterStyle>(["interactive", "signature"]);
const TOKEN_KEYS: Array<keyof WechatThemeTokens> = [
  "accent",
  "accentSoft",
  "pageBackground",
  "pageText",
  "surface",
  "surfaceAlt",
  "border",
  "borderStrong",
  "headingTitle",
  "headingLabel",
  "paragraphText",
  "mutedText",
  "quoteBackground",
  "quoteBorder",
  "quoteText",
  "listText",
  "linkText",
  "emphasisText",
  "markBackground",
  "markText",
  "inlineCodeBackground",
  "inlineCodeText",
  "tableBackground",
  "tableHeadBackground",
  "tableBorder",
  "imageBackground",
  "imageBorder",
  "shadow",
  "shadowSoft",
  "radius",
];
const SHADOW_TOKEN_KEYS = new Set<keyof WechatThemeTokens>(["shadow", "shadowSoft"]);

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
    value.swatches.some((item) => !isNonEmptyString(item) || !isSafeCssColor(item.trim()))
  ) {
    issues.push("主题色板必须包含三个颜色值。");
  }
  if (!isRecord(value.tokens)) {
    issues.push("主题缺少样式变量。");
  } else {
    for (const key of TOKEN_KEYS) {
      const token = value.tokens[key];
      if (!isNonEmptyString(token)) {
        issues.push(`主题样式变量 ${key} 无效。`);
      } else if (!isSafeThemeToken(key, token)) {
        issues.push(`主题样式变量 ${key} 包含不安全的 CSS 值。`);
      }
    }
  }
  if (!isRecord(value.components)) {
    issues.push("主题缺少结构组件配置。");
  } else {
    if (!HEADING_STYLES.has(value.components.heading as WechatHeadingStyle)) issues.push("标题结构无效。");
    if (!HERO_STYLES.has(value.components.hero as WechatHeroStyle)) issues.push("文章头部结构无效。");
    if (!QUOTE_STYLES.has(value.components.quote as WechatQuoteStyle)) issues.push("引用结构无效。");
    if (!FOOTER_STYLES.has(value.components.footer as WechatFooterStyle)) issues.push("文章结尾结构无效。");
  }
  if (!isRecord(value.brand)) {
    issues.push("主题缺少品牌配置。");
  } else {
    if (!isNonEmptyString(value.brand.author)) issues.push("主题作者署名无效。");
    if (typeof value.brand.footerText !== "string") issues.push("主题结尾文案无效。");
    for (const key of ["showDate", "showTags", "showReadingStats"] as const) {
      if (typeof value.brand[key] !== "boolean") issues.push(`主题品牌开关 ${key} 无效。`);
    }
  }
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
    tokens: { ...theme.tokens },
    components: { ...theme.components },
    brand: { ...theme.brand },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function isSafeThemeToken(key: keyof WechatThemeTokens, value: string): boolean {
  const token = value.trim();
  if (token.length > 180 || /[;{}<>"'\\]/.test(token) || /(?:url|expression|var|javascript)\s*\(/i.test(token)) return false;
  if (key === "radius") return /^\d+(?:\.\d+)?(?:px|rem|%)$/.test(token);
  if (SHADOW_TOKEN_KEYS.has(key)) return token === "none" || /^[a-zA-Z0-9#(),.%\s+-]+$/.test(token);
  if (key === "quoteBackground" && /^linear-gradient\(/i.test(token)) {
    return /^[a-zA-Z0-9#(),.%\s+-]+$/.test(token) && token.endsWith(")");
  }
  return isSafeCssColor(token);
}

function isSafeCssColor(value: string): boolean {
  return (
    value === "transparent" ||
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgba?\([0-9.,%\s+-]+\)$/.test(value) ||
    /^hsla?\([0-9.,%\s+-]+\)$/.test(value)
  );
}
