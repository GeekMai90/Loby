/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供公众号主题领域类型、schema 版本、内置主题 registry 与按 ID 查询能力
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type WechatBuiltInThemeId = "loby-basic" | "classic" | "grace" | "simple";
export type WechatThemeId = string;
export type WechatThemeKind = "built-in" | "personal";

export interface WechatThemeTypography {
  articleTitleSize: number;
  h2Size: number;
  h3Size: number;
  h4Size: number;
  bodySize: number;
  bodyLineHeight: number;
  paragraphSpacing: number;
}

export interface WechatThemeColors {
  accent: string;
  pageBackground: string;
  titleText: string;
  bodyText: string;
  emphasisText: string;
  linkText: string;
  markColor: string;
}

export interface WechatThemeLayout {
  contentPadding: number;
  sectionSpacing: number;
  radius: number;
  imageRadius: number;
  shadowStrength: number;
}

export interface WechatThemeBaseStyle {
  typography: WechatThemeTypography;
  colors: WechatThemeColors;
  layout: WechatThemeLayout;
}

export type WechatThemeHtmlTransformOperation = "prepend" | "append" | "replace-inner" | "replace";

export interface WechatThemeHtmlTransform {
  selector: string;
  operation: WechatThemeHtmlTransformOperation;
  html: string;
}

export interface WechatThemeCustomSource {
  css: string;
  htmlTransforms: WechatThemeHtmlTransform[];
}

export interface WechatThemeSource {
  project: string;
  url: string;
  license: string;
  attribution?: string;
}

export interface WechatThemeManifest {
  schemaVersion: 2;
  id: WechatThemeId;
  kind: WechatThemeKind;
  name: string;
  description: string;
  baseThemeId?: WechatThemeId;
  swatches: [string, string, string];
  baseStyle: WechatThemeBaseStyle;
  custom?: WechatThemeCustomSource;
  source?: WechatThemeSource;
  createdAt: string;
  updatedAt: string;
}

export const WECHAT_THEME_SCHEMA_VERSION = 2 as const;
export const DEFAULT_WECHAT_THEME_ID: WechatBuiltInThemeId = "loby-basic";

const BUILT_IN_THEME_TIMESTAMP = "2026-07-16T00:00:00.000Z";

const DOOCS_THEME_SOURCE = {
  project: "doocs/md",
  url: "https://github.com/doocs/md/tree/main/packages/shared/src/configs/theme-css",
  license: "WTFPL",
  attribution: "Adapted from the classic, grace and simple themes in doocs/md.",
} satisfies WechatThemeSource;

const LOBY_BASIC_CSS = `
[data-loby-role="article-header"] { margin-top:0; margin-bottom:18px; }
[data-loby-role="article-title"] { margin:0; font-weight:700; line-height:1.35; }
[data-loby-role="article-body"] h2 { margin:34px 0 14px; line-height:1.4; }
[data-loby-role="article-body"] h3 { margin:28px 0 12px; line-height:1.5; }
[data-loby-role="article-body"] h4 { margin:24px 0 10px; line-height:1.5; }
[data-loby-role="article-body"] li { margin-bottom:14px; }
[data-loby-role="article-body"] strong { font-weight:800; }
[data-loby-role="article-body"] mark { padding:0 3px; border-radius:5px; }
[data-loby-role="article-body"] sup, [data-loby-role="article-body"] .loby-footnote-reference { color:var(--loby-accent); font-size:0.68em; font-weight:800; line-height:0; vertical-align:super; }
[data-loby-role="article-body"] blockquote { margin:0 0 18px; padding:10px 14px; border-left:3px solid #D7D7DD; color:#5F6068; background:#F7F7F9; }
[data-loby-role="article-body"] code { padding:2px 5px; border-radius:5px; background:#F5F5F7; font-family:'SF Mono','SFMono-Regular',Consolas,monospace; font-size:0.9em; }
[data-loby-role="article-body"] pre { margin:0 0 18px; padding:12px; border:0; border-radius:8px; background:#F5F5F7; }
[data-loby-role="article-body"] pre code { padding:0; background:transparent; }
[data-loby-role="article-body"] img { margin:24px auto; padding:0; border-radius:0; box-shadow:none; }
[data-loby-role="article-body"] hr { height:0; margin:28px 0; border:0; border-top:1px solid #D7D7DD; background:transparent; }
`;

const CLASSIC_CSS = `
[data-loby-role="article-header"] { margin:0 0 32px; text-align:center; }
[data-loby-role="article-title"] { display:table; margin:0 auto 18px; padding:0 16px 8px; border-bottom:2px solid var(--loby-accent); font-weight:700; line-height:1.4; }
[data-loby-role="article-body"] h2 { display:table; margin-left:auto; margin-right:auto; padding:5px 16px; color:#FFFFFF; background:var(--loby-accent); text-align:center; }
[data-loby-role="article-body"] h3 { padding-left:10px; border-left:3px solid var(--loby-accent); line-height:1.3; }
[data-loby-role="article-body"] h4 { color:var(--loby-accent); }
[data-loby-role="article-body"] blockquote { padding:14px 16px; border-left:4px solid var(--loby-accent); border-radius:6px; background:var(--loby-mark-color); }
[data-loby-role="article-body"] li { margin-bottom:6px; }
`;

const GRACE_CSS = `
[data-loby-role="article-header"] { margin:0 16px 34px; padding:0; border-radius:0; background:transparent; box-shadow:none; text-align:center; }
[data-loby-role="article-title"] { display:table; margin:0 auto; padding:0 16px 10px; border-bottom:2px solid var(--loby-accent); font-weight:750; line-height:1.4; }
[data-loby-role="article-body"] h2 { padding:7px 18px; border-radius:8px; color:#FFFFFF; background:var(--loby-accent); text-align:center; box-shadow:0 4px 12px rgba(31,41,55,calc(0.1 * var(--loby-shadow-strength))); }
[data-loby-role="article-body"] h3 { padding:0 0 7px 12px; border-left:4px solid var(--loby-accent); border-bottom:1px dashed var(--loby-accent); }
[data-loby-role="article-body"] blockquote { padding:16px 18px 16px 24px; border-left:4px solid var(--loby-accent); border-radius:8px; background:#FFFFFF; font-style:italic; box-shadow:0 4px 12px rgba(31,41,55,calc(0.06 * var(--loby-shadow-strength))); }
[data-loby-role="article-body"] table { border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(31,41,55,calc(0.08 * var(--loby-shadow-strength))); }
`;

const SIMPLE_CSS = `
[data-loby-role="article-header"] { margin-top:0; margin-bottom:30px; }
[data-loby-role="article-title"] { margin:0 0 14px; font-weight:720; line-height:1.4; }
[data-loby-role="article-body"] h2 { padding:6px 16px; border-radius:8px 24px 8px 24px; color:#FFFFFF; background:var(--loby-accent); box-shadow:0 2px 8px rgba(31,41,55,calc(0.06 * var(--loby-shadow-strength))); }
[data-loby-role="article-body"] h3 { padding:7px 12px; border:1px solid rgba(59,130,246,0.14); border-left:4px solid var(--loby-accent); border-radius:6px; background:var(--loby-mark-color); }
[data-loby-role="article-body"] blockquote { padding:14px 18px 14px 24px; border:1px solid rgba(127,127,127,0.08); border-left:3px solid var(--loby-accent); background:transparent; font-style:italic; }
[data-loby-role="article-body"] hr { background:linear-gradient(to right,transparent,rgba(127,127,127,0.22),transparent); }
`;

const DEEP_BLUE_CSS = `
[data-loby-role="article-header"] {
  margin: 0 0 24px;
  padding: 24px 18px 20px;
  background: #FFFFFF;
  border: 1.5px solid var(--loby-accent);
  border-radius: var(--loby-radius);
  box-shadow: 0 4px 20px rgba(11,18,32,calc(0.06 * var(--loby-shadow-strength)));
  overflow: hidden;
}
.theme-header-meta { display:flex; align-items:center; gap:8px; margin-bottom:22px; }
.theme-header-dot { width:6px; height:6px; background:var(--loby-accent); border-radius:50%; }
.theme-header-author { font-size:11px; font-weight:700; letter-spacing:3px; color:var(--loby-accent); }
.theme-header-rule { flex:1; height:1px; background:linear-gradient(to right,var(--loby-accent),transparent); }
.theme-header-date { font-size:10px; color:#64748B; }
[data-loby-role="article-title"] { margin:0; font-weight:900; line-height:1.16; }
.theme-tags { display:flex; gap:5px; margin:18px -18px -20px; padding:10px 18px; background:linear-gradient(135deg,var(--loby-accent),var(--loby-link-text)); }
.loby-theme-tag { padding:1px 6px; border-radius:3px; font-size:8px; color:#fff; background:rgba(255,255,255,0.18); }
[data-loby-role="article-body"] h2 { display:flex; align-items:flex-start; }
.theme-section-number { display:block; width:38px; flex:0 0 38px; font-size:28px; font-weight:850; line-height:1; color:var(--loby-accent); }
.theme-section-rule { width:1px; min-height:38px; margin:0 12px; background:#CBD5E1; }
.theme-section-title { flex:1; padding-top:1px; line-height:1.25; }
blockquote { padding:14px; background:linear-gradient(135deg,var(--loby-mark-color),var(--loby-page-background)); border:1px dashed var(--loby-accent); border-radius:var(--loby-radius); box-shadow:0 8px 20px rgba(11,18,32,calc(0.04 * var(--loby-shadow-strength))); }
.theme-footer { margin-top:18px; padding:24px 18px 20px; text-align:center; background:#FAFAFA; border:1px solid #E2E8F0; border-radius:var(--loby-radius); }
.theme-footer-author { margin:0 0 6px; font-size:10px; font-weight:700; letter-spacing:1.8px; color:#64748B; }
.theme-footer-text { margin:0 0 16px; font-size:18px; font-weight:900; color:var(--loby-title-text); }
.theme-footer-icons { margin:0; font-size:20px; letter-spacing:16px; color:var(--loby-accent); }
`;

const CREAM_CSS = `
[data-loby-role="article-header"] {
  margin:0 0 32px;
  padding:30px 26px 22px;
  background:linear-gradient(180deg,#FFFDFC 0%,#F8F1E7 62%,var(--loby-page-background) 100%);
  border-radius:var(--loby-radius);
}
.theme-header-meta { display:flex; justify-content:space-between; margin-bottom:18px; }
.theme-header-author { font-size:10px; font-weight:700; letter-spacing:2.4px; color:var(--loby-accent); }
.theme-header-date { font-size:10px; color:#A18D7B; }
[data-loby-role="article-title"] { max-width:86%; margin:0; font-weight:740; line-height:1.34; }
.theme-reading-stats { margin:0 10px 26px; text-align:center; }
.theme-reading-stats span { display:inline-flex; padding:10px 16px; border:1px solid #E7D9C8; border-radius:999px; background:#F8F1E7; font-size:12px; font-weight:700; color:var(--loby-body-text); }
.theme-section-label { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.theme-section-label-text { font-size:10px; font-weight:700; letter-spacing:2.2px; color:#AA9683; }
.theme-section-label-rule { flex:1; height:1px; background:linear-gradient(to right,#D9C4AE,transparent); }
.theme-section-title { display:block; line-height:1.28; }
[data-loby-role="article-body"] h3 { border-bottom:2px solid var(--loby-accent); }
blockquote { padding:4px 0 4px 18px; background:transparent; border-left:2px solid var(--loby-accent); }
.theme-footer { padding:24px 10px 8px; text-align:center; }
.theme-footer-rule { width:72px; height:1px; margin:0 auto 16px; background:linear-gradient(to right,transparent,#D9C4AE,transparent); }
.theme-footer-text { margin:0 0 10px; font-size:15px; font-weight:600; color:var(--loby-title-text); }
.theme-footer-author { margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:1.8px; color:#A18D7B; }
.theme-footer-signature { margin:0; font-size:10px; font-weight:700; letter-spacing:2.6px; color:#A18D7B; }
`;

export const LEGACY_WECHAT_THEMES: WechatThemeManifest[] = [
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "deep-blue-study",
    kind: "built-in",
    name: "深蓝书房",
    description: "清晰、理性、有结构感，适合教程和知识文章。",
    swatches: ["#4F6FFF", "#0B1220", "#F8FAFC"],
    baseStyle: {
      typography: {
        articleTitleSize: 28,
        h2Size: 24,
        h3Size: 18,
        h4Size: 15,
        bodySize: 15,
        bodyLineHeight: 1.9,
        paragraphSpacing: 18,
      },
      colors: {
        accent: "#4F6FFF",
        pageBackground: "#FFFFFF",
        titleText: "#0B1220",
        bodyText: "#334155",
        emphasisText: "#3F5EF5",
        linkText: "#3F5EF5",
        markColor: "rgba(79,111,255,0.14)",
      },
      layout: { contentPadding: 8, sectionSpacing: 36, radius: 20, imageRadius: 14, shadowStrength: 1 },
    },
    custom: {
      css: DEEP_BLUE_CSS,
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-header"]',
          operation: "prepend",
          html: '<section class="theme-header-meta"><span class="theme-header-dot"></span><span class="theme-header-author">{{author}}</span><span class="theme-header-rule"></span><span class="theme-header-date">{{date}}</span></section>',
        },
        {
          selector: '[data-loby-role="article-header"]',
          operation: "append",
          html: '<section class="theme-tags">{{tagsHtml}}</section>',
        },
        {
          selector: '[data-loby-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="theme-section-number">{{index2}}</span><span class="theme-section-rule"></span><span class="theme-section-title">{{content}}</span>',
        },
        {
          selector: '[data-loby-publish="wechat"]',
          operation: "append",
          html: '<section class="theme-footer"><p class="theme-footer-author">@麦先生说</p><p class="theme-footer-text">如果对你有用，欢迎点赞、分享、推荐</p><p class="theme-footer-icons">♡ ↗ ✦</p></section>',
        },
      ],
    },
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "cream-paper",
    kind: "built-in",
    name: "奶油纸页",
    description: "温和、留白充分，适合随笔、日更和个人表达。",
    swatches: ["#B56A4B", "#3F352D", "#FBF6EE"],
    baseStyle: {
      typography: {
        articleTitleSize: 30,
        h2Size: 25,
        h3Size: 18,
        h4Size: 15,
        bodySize: 15,
        bodyLineHeight: 1.9,
        paragraphSpacing: 18,
      },
      colors: {
        accent: "#B56A4B",
        pageBackground: "#FBF6EE",
        titleText: "#45382F",
        bodyText: "#625446",
        emphasisText: "#A9583E",
        linkText: "#A55C3F",
        markColor: "rgba(213,154,114,0.18)",
      },
      layout: { contentPadding: 8, sectionSpacing: 38, radius: 20, imageRadius: 14, shadowStrength: 0.7 },
    },
    custom: {
      css: CREAM_CSS,
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-header"]',
          operation: "prepend",
          html: '<section class="theme-header-meta"><span class="theme-header-author">麦先生说</span><span class="theme-header-date">{{date}}</span></section>',
        },
        {
          selector: '[data-loby-role="article-header"]',
          operation: "append",
          html: '<section class="theme-reading-stats"><span>全文约 {{textCount}} 字 · 预计阅读 {{readingMinutes}} 分钟</span></section>',
        },
        {
          selector: '[data-loby-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="theme-section-label"><span class="theme-section-label-text">SECTION {{index2}}</span><span class="theme-section-label-rule"></span></span><span class="theme-section-title">{{content}}</span>',
        },
        {
          selector: '[data-loby-publish="wechat"]',
          operation: "append",
          html: '<section class="theme-footer"><span class="theme-footer-rule"></span><p class="theme-footer-text">写到这里，刚好停下。</p><p class="theme-footer-author">@麦先生说</p><p class="theme-footer-signature">A LIFE OF GROWTH</p></section>',
        },
      ],
    },
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
];

export const WECHAT_THEMES: WechatThemeManifest[] = [
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "loby-basic",
    kind: "built-in",
    name: "简约黑白",
    description: "与落笔 Markdown 预览一致的克制基础样式，适合直接使用或作为个性化起点。",
    swatches: ["#007AFF", "#1D1D1F", "#FFFFFF"],
    baseStyle: {
      typography: {
        articleTitleSize: 28,
        h2Size: 23,
        h3Size: 19,
        h4Size: 17,
        bodySize: 17,
        bodyLineHeight: 1.76,
        paragraphSpacing: 14,
      },
      colors: {
        accent: "#007AFF",
        pageBackground: "#FFFFFF",
        titleText: "#1D1D1F",
        bodyText: "#1D1D1F",
        emphasisText: "#1D1D1F",
        linkText: "#007AFF",
        markColor: "hsl(89 99% 82%)",
      },
      layout: { contentPadding: 16, sectionSpacing: 34, radius: 8, imageRadius: 0, shadowStrength: 0 },
    },
    custom: { css: LOBY_BASIC_CSS, htmlTransforms: [] },
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "classic",
    kind: "built-in",
    name: "清雅蓝白",
    description: "清晰醒目的传统公众号排版，适合教程、知识和结构化长文。",
    swatches: ["#3B82F6", "#1F2937", "#FFFFFF"],
    baseStyle: {
      typography: {
        articleTitleSize: 27,
        h2Size: 20,
        h3Size: 18,
        h4Size: 16,
        bodySize: 16,
        bodyLineHeight: 1.8,
        paragraphSpacing: 18,
      },
      colors: {
        accent: "#3B82F6",
        pageBackground: "#FFFFFF",
        titleText: "#1F2937",
        bodyText: "#374151",
        emphasisText: "#2563EB",
        linkText: "#576B95",
        markColor: "rgba(59,130,246,0.10)",
      },
      layout: { contentPadding: 6, sectionSpacing: 40, radius: 6, imageRadius: 4, shadowStrength: 0.4 },
    },
    custom: { css: CLASSIC_CSS, htmlTransforms: [] },
    source: DOOCS_THEME_SOURCE,
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "grace",
    kind: "built-in",
    name: "柔雅紫调",
    description: "圆角、柔和阴影与舒展留白，适合随笔、阅读和生活表达。",
    swatches: ["#7C6AE6", "#2F2F35", "#FAFAFC"],
    baseStyle: {
      typography: {
        articleTitleSize: 29,
        h2Size: 21,
        h3Size: 18,
        h4Size: 16,
        bodySize: 16,
        bodyLineHeight: 1.85,
        paragraphSpacing: 19,
      },
      colors: {
        accent: "#7C6AE6",
        pageBackground: "#FAFAFC",
        titleText: "#2F2F35",
        bodyText: "#4B4B53",
        emphasisText: "#6856D6",
        linkText: "#576B95",
        markColor: "rgba(124,106,230,0.10)",
      },
      layout: { contentPadding: 8, sectionSpacing: 38, radius: 12, imageRadius: 10, shadowStrength: 1 },
    },
    custom: { css: GRACE_CSS, htmlTransforms: [] },
    source: DOOCS_THEME_SOURCE,
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
  {
    schemaVersion: WECHAT_THEME_SCHEMA_VERSION,
    id: "simple",
    kind: "built-in",
    name: "清新绿意",
    description: "轻量、现代、装饰克制，适合大多数日常公众号文章。",
    swatches: ["#10A37F", "#252A2E", "#FFFFFF"],
    baseStyle: {
      typography: {
        articleTitleSize: 28,
        h2Size: 21,
        h3Size: 18,
        h4Size: 16,
        bodySize: 16,
        bodyLineHeight: 1.82,
        paragraphSpacing: 18,
      },
      colors: {
        accent: "#10A37F",
        pageBackground: "#FFFFFF",
        titleText: "#252A2E",
        bodyText: "#3F474C",
        emphasisText: "#087F63",
        linkText: "#576B95",
        markColor: "rgba(16,163,127,0.09)",
      },
      layout: { contentPadding: 6, sectionSpacing: 36, radius: 8, imageRadius: 8, shadowStrength: 0.5 },
    },
    custom: { css: SIMPLE_CSS, htmlTransforms: [] },
    source: DOOCS_THEME_SOURCE,
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
];

export function getWechatTheme(id: WechatThemeId): WechatThemeManifest {
  return WECHAT_THEMES.find((theme) => theme.id === id) ?? WECHAT_THEMES[0];
}

export function getLegacyWechatTheme(id: WechatThemeId): WechatThemeManifest | undefined {
  return LEGACY_WECHAT_THEMES.find((theme) => theme.id === id);
}
