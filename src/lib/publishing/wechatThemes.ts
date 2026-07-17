export type WechatBuiltInThemeId = "deep-blue-study" | "cream-paper";
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
  createdAt: string;
  updatedAt: string;
}

export const WECHAT_THEME_SCHEMA_VERSION = 2 as const;
export const DEFAULT_WECHAT_THEME_ID: WechatBuiltInThemeId = "deep-blue-study";

const BUILT_IN_THEME_TIMESTAMP = "2026-07-16T00:00:00.000Z";

const DEEP_BLUE_CSS = `
[data-nibva-role="article-header"] {
  margin: 0 0 24px;
  padding: 24px 18px 20px;
  background: #FFFFFF;
  border: 1.5px solid var(--nibva-accent);
  border-radius: var(--nibva-radius);
  box-shadow: 0 4px 20px rgba(11,18,32,calc(0.06 * var(--nibva-shadow-strength)));
  overflow: hidden;
}
.theme-header-meta { display:flex; align-items:center; gap:8px; margin-bottom:22px; }
.theme-header-dot { width:6px; height:6px; background:var(--nibva-accent); border-radius:50%; }
.theme-header-author { font-size:11px; font-weight:700; letter-spacing:3px; color:var(--nibva-accent); }
.theme-header-rule { flex:1; height:1px; background:linear-gradient(to right,var(--nibva-accent),transparent); }
.theme-header-date { font-size:10px; color:#64748B; }
[data-nibva-role="article-title"] { margin:0; font-weight:900; line-height:1.16; }
[data-nibva-role="article-summary"] { margin:16px 0 0; font-size:13px; line-height:1.7; color:#64748B; }
.theme-tags { display:flex; gap:5px; margin:18px -18px -20px; padding:10px 18px; background:linear-gradient(135deg,var(--nibva-accent),var(--nibva-link-text)); }
.nibva-theme-tag { padding:1px 6px; border-radius:3px; font-size:8px; color:#fff; background:rgba(255,255,255,0.18); }
[data-nibva-role="article-body"] h2 { display:flex; align-items:flex-start; }
.theme-section-number { display:block; width:38px; flex:0 0 38px; font-size:28px; font-weight:850; line-height:1; color:var(--nibva-accent); }
.theme-section-rule { width:1px; min-height:38px; margin:0 12px; background:#CBD5E1; }
.theme-section-title { flex:1; padding-top:1px; line-height:1.25; }
blockquote { padding:14px; background:linear-gradient(135deg,var(--nibva-mark-color),var(--nibva-page-background)); border:1px dashed var(--nibva-accent); border-radius:var(--nibva-radius); box-shadow:0 8px 20px rgba(11,18,32,calc(0.04 * var(--nibva-shadow-strength))); }
.theme-footer { margin-top:18px; padding:24px 18px 20px; text-align:center; background:#FAFAFA; border:1px solid #E2E8F0; border-radius:var(--nibva-radius); }
.theme-footer-author { margin:0 0 6px; font-size:10px; font-weight:700; letter-spacing:1.8px; color:#64748B; }
.theme-footer-text { margin:0 0 16px; font-size:18px; font-weight:900; color:var(--nibva-title-text); }
.theme-footer-icons { margin:0; font-size:20px; letter-spacing:16px; color:var(--nibva-accent); }
`;

const CREAM_CSS = `
[data-nibva-role="article-header"] {
  margin:0 0 32px;
  padding:30px 26px 22px;
  background:linear-gradient(180deg,#FFFDFC 0%,#F8F1E7 62%,var(--nibva-page-background) 100%);
  border-radius:var(--nibva-radius);
}
.theme-header-meta { display:flex; justify-content:space-between; margin-bottom:18px; }
.theme-header-author { font-size:10px; font-weight:700; letter-spacing:2.4px; color:var(--nibva-accent); }
.theme-header-date { font-size:10px; color:#A18D7B; }
[data-nibva-role="article-title"] { max-width:86%; margin:0; font-weight:740; line-height:1.34; }
[data-nibva-role="article-summary"] { margin:20px 0 0 60px; font-size:14px; line-height:1.95; color:#A18D7B; }
.theme-reading-stats { margin:0 10px 26px; text-align:center; }
.theme-reading-stats span { display:inline-flex; padding:10px 16px; border:1px solid #E7D9C8; border-radius:999px; background:#F8F1E7; font-size:12px; font-weight:700; color:var(--nibva-body-text); }
.theme-section-label { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.theme-section-label-text { font-size:10px; font-weight:700; letter-spacing:2.2px; color:#AA9683; }
.theme-section-label-rule { flex:1; height:1px; background:linear-gradient(to right,#D9C4AE,transparent); }
.theme-section-title { display:block; line-height:1.28; }
[data-nibva-role="article-body"] h3 { border-bottom:2px solid var(--nibva-accent); }
blockquote { padding:4px 0 4px 18px; background:transparent; border-left:2px solid var(--nibva-accent); }
.theme-footer { padding:24px 10px 8px; text-align:center; }
.theme-footer-rule { width:72px; height:1px; margin:0 auto 16px; background:linear-gradient(to right,transparent,#D9C4AE,transparent); }
.theme-footer-text { margin:0 0 10px; font-size:15px; font-weight:600; color:var(--nibva-title-text); }
.theme-footer-author { margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:1.8px; color:#A18D7B; }
.theme-footer-signature { margin:0; font-size:10px; font-weight:700; letter-spacing:2.6px; color:#A18D7B; }
`;

export const WECHAT_THEMES: WechatThemeManifest[] = [
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
          selector: '[data-nibva-role="article-header"]',
          operation: "prepend",
          html: '<section class="theme-header-meta"><span class="theme-header-dot"></span><span class="theme-header-author">{{author}}</span><span class="theme-header-rule"></span><span class="theme-header-date">{{date}}</span></section>',
        },
        {
          selector: '[data-nibva-role="article-header"]',
          operation: "append",
          html: '<section class="theme-tags">{{tagsHtml}}</section>',
        },
        {
          selector: '[data-nibva-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="theme-section-number">{{index2}}</span><span class="theme-section-rule"></span><span class="theme-section-title">{{content}}</span>',
        },
        {
          selector: '[data-nibva-publish="wechat"]',
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
          selector: '[data-nibva-role="article-header"]',
          operation: "prepend",
          html: '<section class="theme-header-meta"><span class="theme-header-author">麦先生说</span><span class="theme-header-date">{{date}}</span></section>',
        },
        {
          selector: '[data-nibva-role="article-header"]',
          operation: "append",
          html: '<section class="theme-reading-stats"><span>全文约 {{textCount}} 字 · 预计阅读 {{readingMinutes}} 分钟</span></section>',
        },
        {
          selector: '[data-nibva-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="theme-section-label"><span class="theme-section-label-text">SECTION {{index2}}</span><span class="theme-section-label-rule"></span></span><span class="theme-section-title">{{content}}</span>',
        },
        {
          selector: '[data-nibva-publish="wechat"]',
          operation: "append",
          html: '<section class="theme-footer"><span class="theme-footer-rule"></span><p class="theme-footer-text">写到这里，刚好停下。</p><p class="theme-footer-author">@麦先生说</p><p class="theme-footer-signature">A LIFE OF GROWTH</p></section>',
        },
      ],
    },
    createdAt: BUILT_IN_THEME_TIMESTAMP,
    updatedAt: BUILT_IN_THEME_TIMESTAMP,
  },
];

export function getWechatTheme(id: WechatThemeId): WechatThemeManifest {
  return WECHAT_THEMES.find((theme) => theme.id === id) ?? WECHAT_THEMES[0];
}
