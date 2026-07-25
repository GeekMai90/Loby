/**
 * [INPUT]: 依赖 Vite raw glob 提供的 renderer 源码与 styles/index.css 全局 Token 值源
 * [OUTPUT]: 对外提供代表性语义颜色、特殊视觉过滤清单、源码引用、裸色位置、领域豁免与迁移备注的实时审计结果
 * [POS]: design-gallery 的只读颜色审计模型；过滤独立视觉作品后从真实源码派生治理清单，避免维护会漂移的第二份色表
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import aiActionImagePreviewSource from "@/styles/ai-action-image-preview.css?raw";
import aiReviewSource from "@/styles/ai-review.css?raw";
import aiThreadSource from "@/styles/ai-thread.css?raw";
import aiSource from "@/styles/ai.css?raw";
import assistantSurfaceSource from "@/styles/assistant-surface.css?raw";
import baseSource from "@/styles/base.css?raw";
import editorSource from "@/styles/editor.css?raw";
import indexSource from "@/styles/index.css?raw";
import leftWorkspaceGlassSource from "@/styles/left-workspace-glass.css?raw";
import libraryRailSource from "@/styles/library-rail.css?raw";
import publishingSource from "@/styles/publishing.css?raw";
import railModeSwitchSource from "@/styles/rail-mode-switch.css?raw";
import responsiveSource from "@/styles/responsive.css?raw";
import settingsControlsSource from "@/styles/settings-controls.css?raw";
import shadcnSource from "@/styles/shadcn.css?raw";
import sheetRowSource from "@/styles/sheet-row.css?raw";
import shellSource from "@/styles/shell.css?raw";
import themesSource from "@/styles/themes.css?raw";
import toastSource from "@/styles/toast.css?raw";
import writingGoalsSource from "@/styles/writing-goals.css?raw";

const rawSourceModules = import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}", "!/src/**/*.spec.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const explicitStyleSources: Record<string, string> = {
  "/src/styles/ai-action-image-preview.css": aiActionImagePreviewSource,
  "/src/styles/ai-review.css": aiReviewSource,
  "/src/styles/ai-thread.css": aiThreadSource,
  "/src/styles/ai.css": aiSource,
  "/src/styles/assistant-surface.css": assistantSurfaceSource,
  "/src/styles/base.css": baseSource,
  "/src/styles/editor.css": editorSource,
  "/src/styles/index.css": indexSource,
  "/src/styles/left-workspace-glass.css": leftWorkspaceGlassSource,
  "/src/styles/library-rail.css": libraryRailSource,
  "/src/styles/publishing.css": publishingSource,
  "/src/styles/rail-mode-switch.css": railModeSwitchSource,
  "/src/styles/responsive.css": responsiveSource,
  "/src/styles/settings-controls.css": settingsControlsSource,
  "/src/styles/shadcn.css": shadcnSource,
  "/src/styles/sheet-row.css": sheetRowSource,
  "/src/styles/shell.css": shellSource,
  "/src/styles/themes.css": themesSource,
  "/src/styles/toast.css": toastSource,
  "/src/styles/writing-goals.css": writingGoalsSource,
};

const sourceModules = {
  ...Object.fromEntries(
    Object.entries(rawSourceModules).map(([path, source]) => {
      const sourcePathStart = path.indexOf("/src/");
      const normalizedPath = (sourcePathStart >= 0 ? path.slice(sourcePathStart) : path).replace(/\?.*$/, "");
      return [normalizedPath, source];
    }),
  ),
  ...explicitStyleSources,
} as Record<string, string>;

const INDEX_SOURCE_PATH = "/src/styles/index.css";
const SHADCN_SOURCE_PATH = "/src/styles/shadcn.css";
const DESIGN_GALLERY_PREFIX = "/src/features/design-gallery/";
const semanticTokenSource = sourceModules[INDEX_SOURCE_PATH] ?? "";
const SPECIAL_VISUAL_TOKEN_PREFIXES = ["--sidebar-glass-", "--assistant-launcher-"] as const;

export type SemanticColorKind = "channel" | "solid" | "effect";

export interface ColorSourceLocation {
  path: string;
  line: number;
  snippet: string;
}

export interface SemanticColorToken {
  token: string;
  label: string;
  group: string;
  kind: SemanticColorKind;
  lightValue: string;
  darkValue: string;
  directLocations: ColorSourceLocation[];
  indirectTokens: string[];
  used: boolean;
  migrationNote?: string;
}

export interface RawColorRecord {
  key: string;
  value: string;
  cssValue: string;
  group: string;
  purpose: string;
  decision: "domain" | "unresolved";
  locations: ColorSourceLocation[];
}

const CORE_COLOR_TOKENS = new Set([
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
]);

const COLOR_NAME_HINT =
  /(?:color|foreground|background|(?:^|-)bg|border|primary|secondary|muted|accent|destructive|status|separator|scrim|chart|sidebar|control|canvas|highlight|hover|pressed|divider|stroke|decoration|icon|shine|title|description|success|error|warning|selected|empty|light|medium|strong|start|middle|end|popover|card|input|ring)/;
const COLOR_VALUE_HINT = /(?:#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|\btransparent\b)/i;
const EFFECT_VALUE_HINT = /(?:gradient|drop-shadow|(?:^|\s)[^;]*shadow)/i;
const RAW_COLOR_PATTERN = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(\s*[\d.][^)]*\)/gi;
const RAW_TAILWIND_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/(?:[\d.]+|\[[^\]]+\]))?\b/gi;
const MASK_BLACK_PATTERN = new RegExp("#0{3}(?:0{3})?\\b", "i");
const MASK_BLACK_GLOBAL_PATTERN = new RegExp(MASK_BLACK_PATTERN.source, "gi");

const MIGRATION_NOTES: Readonly<Record<string, string>> = {
  "--brand-wordpress": "原硬编码：DirectPublishDialog.tsx 的 WordPress 渠道图标。",
  "--brand-wordpress-soft": "原硬编码：DirectPublishDialog.tsx 的 WordPress 图标底色。",
  "--status-success":
    "原硬编码：GitHubPublishView.tsx、MowenPublishView.tsx、ExportPublishingSection.tsx 与 DirectPublishDialog.tsx 的成功反馈。",
  "--status-success-foreground": "原硬编码：发布成功图标和检查项中的白色前景。",
  "--status-warning": "原硬编码：GitHubPublishView.tsx 与 WechatThemePreview.tsx 的提醒状态。",
  "--status-warning-soft": "原硬编码：GitHubPublishView.tsx 的仓库授权提醒背景。",
  "--publishing-preview-background": "原硬编码：WechatThemePreview.tsx 的 HTML、iframe 与移动设备预览固定亮色画布。",
  "--publishing-preview-foreground": "原硬编码：WechatThemePreview.tsx 的 HTML 源码文字。",
  "--publishing-preview-muted": "原硬编码：WechatThemePreview.tsx 的加载与兼容性提示文字。",
  "--publishing-preview-border": "原硬编码：WechatThemePreview.tsx 的源码卡片和提示胶囊边界。",
  "--publishing-preview-panel": "原硬编码：WechatThemePreview.tsx 的半透明兼容性提示表面。",
  "--publishing-preview-warning-bg": "原硬编码：WechatThemePreview.tsx 的兼容性提示条目背景。",
  "--publish-loader-primary": "原硬编码：publishing.css 的打字机加载插画主蓝色。",
  "--publish-loader-primary-strong": "原硬编码：publishing.css 的打字机加载插画深蓝色。",
  "--publish-loader-key": "原硬编码：publishing.css 的打字机按键。",
  "--publish-loader-paper": "原硬编码：publishing.css 的打字机纸张。",
  "--publish-loader-text": "原硬编码：publishing.css 的打字机纸面文字。",
  "--publish-loader-tool": "原硬编码：publishing.css 的打字机机械部件。",
};

const RAW_COLOR_SCOPES: ReadonlyArray<{
  matches: (path: string) => boolean;
  group: string;
  purpose: string;
}> = [
  {
    matches: (path) =>
      path === "/src/styles/themes.css" || path === "/src/styles/settings-controls.css" || path === "/src/shared/constants/themes.ts",
    group: "编辑器主题 palette",
    purpose: "用户可选择的 CodeMirror 编辑器主题及设置缩略图；属于主题内容数据，不随应用明暗语义变化。",
  },
  {
    matches: (path) =>
      path === "/src/features/library/constants/projectAppearance.ts" ||
      path === "/src/features/library/model/projectModel.ts" ||
      path === "/src/features/library/components/LibraryNotesSection.tsx" ||
      path === "/src/features/editor/components/document-properties/DocumentPropertyDefinitionEditor.tsx" ||
      path === "/src/features/editor/model/documentProperties.ts",
    group: "用户内容 palette",
    purpose: "项目图标、属性选项等可持久化用户颜色；颜色本身是领域数据，不是应用界面语义。",
  },
  {
    matches: (path) => path.startsWith("/src/features/publishing/model/"),
    group: "发布内容 palette",
    purpose: "公众号主题、导出 HTML 与预览文档的内容颜色；必须随发布产物保存，不能映射应用主题 Token。",
  },
];

function extractThemeBlock(source: string, selectorPattern: RegExp) {
  return selectorPattern.exec(source)?.[1] ?? "";
}

function parseDeclarations(source: string) {
  const declarations = new Map<string, string>();
  const declarationPattern = /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm;
  for (const match of source.matchAll(declarationPattern)) declarations.set(match[1], match[2].replace(/\s+/g, " ").trim());
  return declarations;
}

function isSemanticColorToken(token: string, value: string) {
  if (token.endsWith("-rgb")) return true;
  if (CORE_COLOR_TOKENS.has(token)) return true;
  if (/^--(?:brand|publish|publishing)-/.test(token) && COLOR_VALUE_HINT.test(value)) return true;
  if (/-(?:shadow|filter)$/.test(token) && (COLOR_VALUE_HINT.test(value) || EFFECT_VALUE_HINT.test(value) || value.startsWith("var(")))
    return true;
  if (EFFECT_VALUE_HINT.test(value) && COLOR_VALUE_HINT.test(value)) return true;
  return COLOR_NAME_HINT.test(token) && (COLOR_VALUE_HINT.test(value) || value.startsWith("var("));
}

function getColorKind(token: string, value: string): SemanticColorKind {
  if (token.endsWith("-rgb")) return "channel";
  if (EFFECT_VALUE_HINT.test(value) || token.endsWith("-shadow")) return "effect";
  return "solid";
}

function getTokenGroup(token: string) {
  if (token.endsWith("-rgb")) return "基础通道";
  if (CORE_COLOR_TOKENS.has(token) || token.startsWith("--chart-") || token.startsWith("--sidebar-")) return "shadcn 公共语义";
  if (token.startsWith("--assistant-")) return "AI 助手";
  if (token.startsWith("--editor-")) return "编辑器与审阅";
  if (token.startsWith("--writing-") || token.startsWith("--project-goal-")) return "写作活动与目标";
  if (token.startsWith("--toast-") || token.startsWith("--menu-")) return "通知与菜单";
  if (token.startsWith("--sidebar-") || token.startsWith("--rail-") || token.startsWith("--drag-") || token === "--left-workspace-bg") {
    return "导航与玻璃材质";
  }
  if (token.startsWith("--publishing-") || token.startsWith("--publish-") || token.startsWith("--brand-")) return "发布与渠道";
  if (
    token.startsWith("--liquid-") ||
    token.startsWith("--button-") ||
    token.startsWith("--navigation-") ||
    token.startsWith("--sheet-selection-") ||
    token.startsWith("--settings-")
  ) {
    return "共享控件";
  }
  if (
    token.startsWith("--empty-") ||
    token.startsWith("--form-") ||
    token.startsWith("--color-swatch-") ||
    token.startsWith("--quick-") ||
    token.startsWith("--media-")
  ) {
    return "表单与空状态";
  }
  if (token.startsWith("--shiny-") || token.startsWith("--border-glow-")) return "共享特效";
  return "应用扩展语义";
}

function toLabel(token: string) {
  return token
    .slice(2)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceLocation(path: string, line: number, snippet: string): ColorSourceLocation {
  return { path: path.replace(/^\//, ""), line, snippet: snippet.trim().replace(/\s+/g, " ").slice(0, 180) };
}

function findTokenLocations(token: string) {
  const locations: ColorSourceLocation[] = [];
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const referencePattern = new RegExp(`var\\(\\s*${escaped}(?:\\s*[,)]|\\))`);

  for (const [path, source] of Object.entries(sourceModules)) {
    if (path === INDEX_SOURCE_PATH || path === SHADCN_SOURCE_PATH || path.startsWith(DESIGN_GALLERY_PREFIX)) continue;
    source.split("\n").forEach((line, index) => {
      if (referencePattern.test(line)) locations.push(sourceLocation(path, index + 1, line));
    });
  }
  return locations;
}

function utilityLocationsByToken() {
  const locations = new Map<string, ColorSourceLocation[]>();
  const shadcnSource = sourceModules[SHADCN_SOURCE_PATH] ?? "";
  const mappingPattern = /^\s*--color-([\w-]+)\s*:\s*var\((--[\w-]+)\);/gm;

  for (const mapping of shadcnSource.matchAll(mappingPattern)) {
    const utility = mapping[1];
    const token = mapping[2];
    const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const utilityPattern = new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|outline|shadow|from|via|to)-${escaped}(?:\\/[^\\s"']+)?\\b`);
    const tokenLocations: ColorSourceLocation[] = [];

    for (const [path, source] of Object.entries(sourceModules)) {
      if (path.startsWith(DESIGN_GALLERY_PREFIX)) continue;
      source.split("\n").forEach((line, index) => {
        if (utilityPattern.test(line)) tokenLocations.push(sourceLocation(path, index + 1, line));
      });
    }
    locations.set(token, tokenLocations);
  }
  return locations;
}

function tokenDependents(declarations: Map<string, string>) {
  const dependents = new Map<string, Set<string>>();
  for (const [owner, value] of declarations) {
    for (const match of value.matchAll(/var\((--[\w-]+)/g)) {
      const owners = dependents.get(match[1]) ?? new Set<string>();
      owners.add(owner);
      dependents.set(match[1], owners);
    }
  }
  return dependents;
}

function buildSemanticTokens() {
  const lightBlock = extractThemeBlock(
    semanticTokenSource,
    /:root,\s*:root\[data-app-theme="light"\],\s*\.theme-scope-light\s*\{([\s\S]*?)\n\}/,
  );
  const darkBlock = extractThemeBlock(semanticTokenSource, /:root\[data-app-theme="dark"\],\s*\.dark\s*\{([\s\S]*?)\n\}/);
  const lightDeclarations = parseDeclarations(lightBlock);
  const darkDeclarations = parseDeclarations(darkBlock);
  const allDeclarations = parseDeclarations(semanticTokenSource);
  const utilities = utilityLocationsByToken();
  const dependents = tokenDependents(allDeclarations);
  const directLocationMap = new Map<string, ColorSourceLocation[]>();

  for (const token of lightDeclarations.keys()) {
    const uniqueLocations = new Map<string, ColorSourceLocation>();
    for (const location of [...findTokenLocations(token), ...(utilities.get(token) ?? [])]) {
      uniqueLocations.set(`${location.path}:${location.line}`, location);
    }
    directLocationMap.set(token, [...uniqueLocations.values()]);
  }

  const usedMemo = new Map<string, boolean>();
  const isUsed = (token: string, trail = new Set<string>()): boolean => {
    if (usedMemo.has(token)) return usedMemo.get(token) ?? false;
    if ((directLocationMap.get(token)?.length ?? 0) > 0) {
      usedMemo.set(token, true);
      return true;
    }
    if (trail.has(token)) return false;
    const nextTrail = new Set(trail).add(token);
    const used = [...(dependents.get(token) ?? [])].some((owner) => isUsed(owner, nextTrail));
    usedMemo.set(token, used);
    return used;
  };

  return [...lightDeclarations.entries()]
    .filter(([token, value]) => isSemanticColorToken(token, value))
    .map(([token, lightValue]): SemanticColorToken => {
      const indirectTokens = [...(dependents.get(token) ?? [])].filter((owner) => isUsed(owner));
      return {
        token,
        label: toLabel(token),
        group: getTokenGroup(token),
        kind: getColorKind(token, lightValue),
        lightValue,
        darkValue: darkDeclarations.get(token) ?? lightValue,
        directLocations: directLocationMap.get(token) ?? [],
        indirectTokens,
        used: isUsed(token),
        migrationNote: MIGRATION_NOTES[token],
      };
    });
}

function normalizeHex(value: string) {
  return value.toUpperCase();
}

function tailwindColorSpec(value: string) {
  return value.replace(/^(?:bg|text|border|ring|fill|stroke|from|via|to|shadow)-/, "");
}

function tailwindColorToCss(value: string) {
  const spec = tailwindColorSpec(value);
  const [base, opacity] = spec.split("/");
  const color = `var(--color-${base})`;
  if (!opacity) return color;
  const normalized = opacity.startsWith("[") ? Number.parseFloat(opacity.slice(1, -1)) * 100 : Number.parseFloat(opacity);
  return Number.isFinite(normalized) ? `color-mix(in srgb, ${color} ${normalized}%, transparent)` : color;
}

function rawColorScope(path: string) {
  const scope = RAW_COLOR_SCOPES.find((candidate) => candidate.matches(path));
  if (scope) return { ...scope, decision: "domain" as const };
  return {
    group: "未语义化应用 UI",
    purpose: "普通应用界面仍直接持有颜色值，应迁入 styles/index.css 的语义 Token。",
    decision: "unresolved" as const,
  };
}

function buildRawColors() {
  const records = new Map<string, RawColorRecord>();

  const addRecord = (path: string, line: number, snippet: string, value: string, cssValue: string, key: string) => {
    const scope = rawColorScope(path);
    const existing = records.get(key);
    const location = sourceLocation(path, line, snippet);
    if (existing) {
      existing.locations.push(location);
      if (scope.decision === "unresolved") {
        existing.group = scope.group;
        existing.purpose = scope.purpose;
        existing.decision = scope.decision;
      }
      return;
    }
    records.set(key, { key, value, cssValue, group: scope.group, purpose: scope.purpose, decision: scope.decision, locations: [location] });
  };

  for (const [path, source] of Object.entries(sourceModules)) {
    if (path === INDEX_SOURCE_PATH || path === SHADCN_SOURCE_PATH || path.startsWith(DESIGN_GALLERY_PREFIX)) continue;
    source.split("\n").forEach((sourceLine, index) => {
      const line =
        /(?:mask|linear-gradient)\b/.test(sourceLine) && MASK_BLACK_PATTERN.test(sourceLine)
          ? sourceLine.replace(MASK_BLACK_GLOBAL_PATTERN, "")
          : sourceLine;

      for (const match of line.matchAll(RAW_COLOR_PATTERN)) {
        const value = match[0];
        const normalized = value.startsWith("#") ? normalizeHex(value) : value.replace(/\s+/g, " ");
        addRecord(path, index + 1, sourceLine, normalized, normalized, `literal:${normalized.toLowerCase()}`);
      }
      for (const match of line.matchAll(RAW_TAILWIND_PATTERN)) {
        const value = match[0];
        const spec = tailwindColorSpec(value);
        addRecord(path, index + 1, sourceLine, `Tailwind ${spec}`, tailwindColorToCss(value), `tailwind:${spec}`);
      }
    });
  }

  return [...records.values()].sort((left, right) => {
    if (left.decision !== right.decision) return left.decision === "unresolved" ? -1 : 1;
    if (left.group !== right.group) return left.group.localeCompare(right.group, "zh-CN");
    return left.value.localeCompare(right.value);
  });
}

const allSemanticColorTokens = buildSemanticTokens();

export const SPECIAL_VISUAL_COLOR_TOKENS = allSemanticColorTokens.filter((token) =>
  SPECIAL_VISUAL_TOKEN_PREFIXES.some((prefix) => token.token.startsWith(prefix)),
);
export const SEMANTIC_COLOR_TOKENS = allSemanticColorTokens.filter(
  (token) => !SPECIAL_VISUAL_TOKEN_PREFIXES.some((prefix) => token.token.startsWith(prefix)),
);
export const RAW_COLOR_RECORDS = buildRawColors();

export const SEMANTIC_COLOR_GROUPS = [...new Set(SEMANTIC_COLOR_TOKENS.map((token) => token.group))];
export const RAW_COLOR_GROUPS = [...new Set(RAW_COLOR_RECORDS.map((record) => record.group))];
export const UNUSED_SEMANTIC_COLOR_TOKENS = SEMANTIC_COLOR_TOKENS.filter((token) => !token.used);
export const UNRESOLVED_RAW_COLORS = RAW_COLOR_RECORDS.filter((record) => record.decision === "unresolved");
