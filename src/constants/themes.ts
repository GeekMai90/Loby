import type { AppThemePreference, EditorThemeId } from "../types";

export const APP_THEME_OPTIONS: Array<{
  value: AppThemePreference;
  label: string;
  description: string;
}> = [
  { value: "system", label: "跟随系统", description: "随 macOS、Windows 或 Linux 自动切换" },
  { value: "light", label: "浅色", description: "始终使用明亮的应用界面" },
  { value: "dark", label: "深色", description: "始终使用低亮度的应用界面" },
];

export interface EditorThemeOption {
  id: EditorThemeId;
  name: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  swatches: readonly [string, string, string];
}

export const EDITOR_THEME_OPTIONS: EditorThemeOption[] = [
  {
    id: "nibva",
    name: "Nibva",
    description: "清爽克制的系统蓝，适合日常长时间写作。",
    sourceLabel: "Nibva 原生",
    swatches: ["#ffffff", "#1d1d1f", "#007aff"],
  },
  {
    id: "graphite",
    name: "石墨红",
    description: "温和的红色强调与衬线标题，带有 Bear 的优雅气质。",
    sourceLabel: "灵感来自 Ursine",
    sourceUrl: "https://github.com/noatpad/typora-theme-ursine",
    swatches: ["#fbfbfb", "#333333", "#db4d52"],
  },
  {
    id: "vue",
    name: "青岚",
    description: "清晰的文档层级与绿色强调，适合结构化内容。",
    sourceLabel: "改造自 typora-vue-theme",
    sourceUrl: "https://github.com/blinkfox/typora-vue-theme",
    swatches: ["#ffffff", "#34495e", "#42b983"],
  },
  {
    id: "lapis",
    name: "青金石",
    description: "蓝灰正文、宁静块面与书卷感，适合长文和知识笔记。",
    sourceLabel: "改造自 typora-theme-lapis",
    sourceUrl: "https://github.com/YiNNx/typora-theme-lapis",
    swatches: ["#ffffff", "#40464f", "#4870ac"],
  },
];
