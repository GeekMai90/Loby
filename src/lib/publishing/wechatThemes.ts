export type WechatThemeId = "deep-blue-study" | "cream-paper";
export type WechatHeadingStyle = "part" | "editorial";
export type WechatHeroStyle = "product" | "editorial";
export type WechatQuoteStyle = "card" | "editorial";
export type WechatFooterStyle = "interactive" | "signature";

export interface WechatThemeTokens {
  accent: string;
  accentSoft: string;
  headingStyle: WechatHeadingStyle;
  heroStyle: WechatHeroStyle;
  quoteStyle: WechatQuoteStyle;
  footerStyle: WechatFooterStyle;
  pageBackground: string;
  pageText: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  headingTitle: string;
  headingLabel: string;
  paragraphText: string;
  mutedText: string;
  quoteBackground: string;
  quoteBorder: string;
  quoteText: string;
  listText: string;
  linkText: string;
  emphasisText: string;
  markBackground: string;
  markText: string;
  inlineCodeBackground: string;
  inlineCodeText: string;
  tableBackground: string;
  tableHeadBackground: string;
  tableBorder: string;
  imageBackground: string;
  imageBorder: string;
  shadow: string;
  shadowSoft: string;
  radius: string;
}

export interface WechatThemeDefinition {
  id: WechatThemeId;
  label: string;
  description: string;
  swatches: [string, string, string];
  tokens: WechatThemeTokens;
}

export const WECHAT_THEMES: WechatThemeDefinition[] = [
  {
    id: "deep-blue-study",
    label: "深蓝书房",
    description: "清晰、理性、有结构感，适合教程和知识文章。",
    swatches: ["#4F6FFF", "#0B1220", "#F8FAFC"],
    tokens: {
      accent: "#4F6FFF",
      accentSoft: "#7C93FF",
      headingStyle: "part",
      heroStyle: "product",
      quoteStyle: "card",
      footerStyle: "interactive",
      pageBackground: "#FFFFFF",
      pageText: "#334155",
      surface: "#FFFFFF",
      surfaceAlt: "#FAFAFA",
      border: "#E2E8F0",
      borderStrong: "#CBD5E1",
      headingTitle: "#0B1220",
      headingLabel: "#64748B",
      paragraphText: "#334155",
      mutedText: "#64748B",
      quoteBackground: "linear-gradient(135deg,rgba(79,111,255,0.08),rgba(255,255,255,0.98))",
      quoteBorder: "rgba(79,111,255,0.28)",
      quoteText: "#475569",
      listText: "#334155",
      linkText: "#3F5EF5",
      emphasisText: "#3F5EF5",
      markBackground: "rgba(79,111,255,0.14)",
      markText: "#3048C8",
      inlineCodeBackground: "#EEF2F7",
      inlineCodeText: "#111827",
      tableBackground: "#FFFFFF",
      tableHeadBackground: "#F8FAFC",
      tableBorder: "#E2E8F0",
      imageBackground: "#FFFFFF",
      imageBorder: "#EEF2F7",
      shadow: "0 4px 20px rgba(11,18,32,0.06)",
      shadowSoft: "0 8px 20px rgba(11,18,32,0.04)",
      radius: "20px",
    },
  },
  {
    id: "cream-paper",
    label: "奶油纸页",
    description: "温和、留白充分，适合随笔、日更和个人表达。",
    swatches: ["#B56A4B", "#3F352D", "#FBF6EE"],
    tokens: {
      accent: "#B56A4B",
      accentSoft: "#D59A72",
      headingStyle: "editorial",
      heroStyle: "editorial",
      quoteStyle: "editorial",
      footerStyle: "signature",
      pageBackground: "#FBF6EE",
      pageText: "#625446",
      surface: "#FFFDFC",
      surfaceAlt: "#F8F1E7",
      border: "#E7D9C8",
      borderStrong: "#D9C4AE",
      headingTitle: "#45382F",
      headingLabel: "#AA9683",
      paragraphText: "#625446",
      mutedText: "#A18D7B",
      quoteBackground: "linear-gradient(135deg,rgba(213,154,114,0.12),rgba(255,253,250,0.98))",
      quoteBorder: "rgba(181,106,75,0.22)",
      quoteText: "#65574B",
      listText: "#625446",
      linkText: "#A55C3F",
      emphasisText: "#A9583E",
      markBackground: "rgba(213,154,114,0.18)",
      markText: "#8B4D32",
      inlineCodeBackground: "#F6EDE2",
      inlineCodeText: "#594B40",
      tableBackground: "#FFFDFC",
      tableHeadBackground: "#F7EFE6",
      tableBorder: "#E6D8C8",
      imageBackground: "#FFF9F3",
      imageBorder: "#F1E4D6",
      shadow: "0 6px 22px rgba(101,72,52,0.08)",
      shadowSoft: "0 8px 20px rgba(125,88,60,0.05)",
      radius: "20px",
    },
  },
];

export function getWechatTheme(id: WechatThemeId): WechatThemeDefinition {
  return WECHAT_THEMES.find((theme) => theme.id === id) ?? WECHAT_THEMES[0];
}
