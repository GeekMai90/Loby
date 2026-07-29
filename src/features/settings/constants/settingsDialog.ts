/**
 * [INPUT]: 依赖 lucide-react、shared 公共契约
 * [OUTPUT]: 对外提供 SettingsTabId、SETTINGS_TABS、EDITOR_FONT_OPTIONS、getAssistantSendModeOptions
 * [POS]: 设置 feature 的稳定配置边界，集中 设置 选项、默认值与持久化标识
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Bot, FolderOpen, PenLine, Send, Settings2, type LucideIcon } from "lucide-react";
import type { AssistantSendMode, EditorFontPreset } from "@/shared/types";
import { currentShortcutPlatform, platformModKeyLabel, type ShortcutPlatform } from "@/shared/lib/keyboardShortcuts";

export type SettingsTabId = "writing" | "appearance" | "ai" | "publishing" | "storage";

export const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; Icon: LucideIcon }> = [
  { id: "appearance", label: "通用", Icon: Settings2 },
  { id: "writing", label: "写作", Icon: PenLine },
  { id: "ai", label: "AI 助手", Icon: Bot },
  { id: "publishing", label: "发布", Icon: Send },
  { id: "storage", label: "文件与存储", Icon: FolderOpen },
];

export const EDITOR_FONT_OPTIONS: Array<{ value: EditorFontPreset; label: string }> = [
  { value: "system", label: "系统默认" },
  { value: "pingfang", label: "苹方" },
  { value: "songti", label: "宋体" },
  { value: "kaiti", label: "楷体" },
  { value: "lxgw-wenkai", label: "霞鹜文楷" },
  { value: "huiwen-mincho", label: "汇文明朝" },
  { value: "mono", label: "等宽" },
  { value: "custom", label: "自定义" },
];

export function getAssistantSendModeOptions(
  platform: ShortcutPlatform = currentShortcutPlatform(),
): Array<{ value: AssistantSendMode; label: string }> {
  return [
    { value: "enter", label: "回车" },
    { value: "mod-enter", label: `${platformModKeyLabel(platform)} + 回车` },
  ];
}
