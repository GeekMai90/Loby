import { Bot, FolderOpen, Info, Palette, PenLine, Send, type LucideIcon } from "lucide-react";
import type { AgentProvider, AssistantSendMode, EditorFontPreset, ImageReferenceFormat } from "../types";
import { currentShortcutPlatform, platformModKeyLabel, type ShortcutPlatform } from "../lib/keyboardShortcuts";

export type SettingsTabId = "writing" | "appearance" | "ai" | "publishing" | "library" | "about";

export const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; Icon: LucideIcon }> = [
  { id: "writing", label: "写作", Icon: PenLine },
  { id: "appearance", label: "外观", Icon: Palette },
  { id: "ai", label: "AI", Icon: Bot },
  { id: "publishing", label: "发布", Icon: Send },
  { id: "library", label: "写作库", Icon: FolderOpen },
  { id: "about", label: "关于", Icon: Info },
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

export const IMAGE_REFERENCE_FORMAT_OPTIONS: Array<{ value: ImageReferenceFormat; label: string }> = [
  { value: "markdown", label: "Markdown" },
  { value: "obsidian", label: "Obsidian" },
];

export const AGENT_PROVIDER_OPTIONS: Array<{ value: AgentProvider; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude" },
];

export function getAssistantSendModeOptions(
  platform: ShortcutPlatform = currentShortcutPlatform(),
): Array<{ value: AssistantSendMode; label: string }> {
  return [
    { value: "enter", label: "回车" },
    { value: "mod-enter", label: `${platformModKeyLabel(platform)} + 回车` },
  ];
}
