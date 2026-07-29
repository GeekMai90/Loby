/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供快捷键分组、匹配、平台化组合文本与独立 keycap 标签等公开能力
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type AppShortcutGroup = "file" | "editing" | "navigation" | "view" | "application";
export type AppShortcutModifier = "mod" | "shift" | "alt";
export type ShortcutPlatform = "mac" | "other";

interface PlatformModifierKeyboardEvent {
  metaKey: boolean;
  ctrlKey: boolean;
}

export interface AppShortcut {
  id: string;
  title: string;
  description: string;
  group: AppShortcutGroup;
  key: string;
  modifiers: readonly AppShortcutModifier[];
}

export const APP_SHORTCUT_GROUPS: Array<{ id: AppShortcutGroup; title: string }> = [
  { id: "file", title: "文件" },
  { id: "editing", title: "编辑器" },
  { id: "navigation", title: "导航" },
  { id: "view", title: "视图" },
  { id: "application", title: "应用" },
];

export const APP_SHORTCUTS = {
  saveDocument: {
    id: "saveDocument",
    title: "保存文稿",
    description: "立即保存当前文稿和待写索引",
    group: "file",
    key: "s",
    modifiers: ["mod"],
  },
  newSheet: {
    id: "newSheet",
    title: "新建文稿",
    description: "在当前分组中新建文稿",
    group: "file",
    key: "n",
    modifiers: ["mod"],
  },
  quickCapture: {
    id: "quickCapture",
    title: "快速记录",
    description: "打开随手记输入窗口",
    group: "file",
    key: "d",
    modifiers: ["mod"],
  },
  bold: {
    id: "bold",
    title: "粗体",
    description: "切换选中文本的粗体标记",
    group: "editing",
    key: "b",
    modifiers: ["mod"],
  },
  italic: {
    id: "italic",
    title: "斜体",
    description: "切换选中文本的斜体标记",
    group: "editing",
    key: "i",
    modifiers: ["mod"],
  },
  link: {
    id: "link",
    title: "链接",
    description: "插入或切换 Markdown 链接",
    group: "editing",
    key: "k",
    modifiers: ["mod"],
  },
  inlineCode: {
    id: "inlineCode",
    title: "行内代码",
    description: "切换选中文本的行内代码标记",
    group: "editing",
    key: "e",
    modifiers: ["mod"],
  },
  searchSheets: {
    id: "searchSheets",
    title: "搜索文稿",
    description: "打开当前列表的搜索",
    group: "navigation",
    key: "p",
    modifiers: ["mod"],
  },
  toggleNavigation: {
    id: "toggleNavigation",
    title: "显示或隐藏侧栏",
    description: "切换左侧导航与文稿列表",
    group: "view",
    key: "\\",
    modifiers: ["mod"],
  },
  toggleLibraryRail: {
    id: "toggleLibraryRail",
    title: "显示或隐藏导航栏",
    description: "只切换左侧导航栏，保留文稿列表状态",
    group: "view",
    key: "\\",
    modifiers: ["mod", "shift"],
  },
  toggleInspector: {
    id: "toggleInspector",
    title: "显示或隐藏 AI 助手",
    description: "切换 AI 助手的小窗或右侧边栏",
    group: "view",
    key: "j",
    modifiers: ["mod"],
  },
  toggleFocusMode: {
    id: "toggleFocusMode",
    title: "切换专注模式",
    description: "隐藏或恢复辅助界面",
    group: "view",
    key: "f",
    modifiers: ["mod", "shift"],
  },
  openSettings: {
    id: "openSettings",
    title: "打开设置",
    description: "打开落笔设置",
    group: "application",
    key: ",",
    modifiers: ["mod"],
  },
  openShortcuts: {
    id: "openShortcuts",
    title: "显示快捷键",
    description: "查看所有 App 级快捷键",
    group: "application",
    key: "/",
    modifiers: ["mod"],
  },
} as const satisfies Record<string, AppShortcut>;

export type AppShortcutId = keyof typeof APP_SHORTCUTS;

export const APP_SHORTCUT_LIST = Object.values(APP_SHORTCUTS) as AppShortcut[];

export interface ShortcutKeyboardEvent {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

export function matchesAppShortcut(event: ShortcutKeyboardEvent, shortcut: AppShortcut): boolean {
  if (event.defaultPrevented || event.isComposing || event.repeat) return false;
  const modifiers = new Set(shortcut.modifiers);
  const modPressed = event.metaKey || event.ctrlKey;
  if (modPressed !== modifiers.has("mod")) return false;
  if (event.shiftKey !== modifiers.has("shift")) return false;
  if (event.altKey !== modifiers.has("alt")) return false;
  if (normalizeShortcutKey(event.key) === normalizeShortcutKey(shortcut.key)) return true;
  const shortcutCode = physicalCodeForShortcutKey(shortcut.key);
  return Boolean(event.code && shortcutCode && event.code.toLocaleLowerCase() === shortcutCode.toLocaleLowerCase());
}

export function findMatchingAppShortcut(event: ShortcutKeyboardEvent): AppShortcut | undefined {
  return APP_SHORTCUT_LIST.find((shortcut) => matchesAppShortcut(event, shortcut));
}

export function formatAppShortcut(shortcut: AppShortcut, platform: "mac" | "other" = currentShortcutPlatform()): string {
  return formatAppShortcutKeys(shortcut, platform).join(platform === "mac" ? "" : "+");
}

export function formatAppShortcutKeys(shortcut: AppShortcut, platform: "mac" | "other" = currentShortcutPlatform()): string[] {
  const modifierLabels =
    platform === "mac" ? ({ mod: "⌘", shift: "⇧", alt: "⌥" } as const) : ({ mod: "Ctrl", shift: "Shift", alt: "Alt" } as const);
  return [...shortcut.modifiers.map((modifier) => modifierLabels[modifier]), displayKey(shortcut.key)];
}

export function appShortcutAriaKeys(shortcut: AppShortcut, platform: "mac" | "other" = currentShortcutPlatform()): string {
  const modifiers = shortcut.modifiers.map(
    (modifier) => ({ mod: platform === "mac" ? "Meta" : "Control", shift: "Shift", alt: "Alt" })[modifier],
  );
  return [...modifiers, shortcut.key].join("+");
}

export function appShortcutTitle(id: AppShortcutId, title: string = APP_SHORTCUTS[id].title): string {
  return `${title}（${formatAppShortcut(APP_SHORTCUTS[id])}）`;
}

export function codeMirrorShortcutKey(shortcut: AppShortcut): string {
  const modifiers = shortcut.modifiers.map((modifier) => ({ mod: "Mod", shift: "Shift", alt: "Alt" })[modifier]);
  return [...modifiers, shortcut.key].join("-");
}

export function platformModKeyLabel(platform: ShortcutPlatform = currentShortcutPlatform()): "⌘" | "Ctrl" {
  return platform === "mac" ? "⌘" : "Ctrl";
}

export function isPlatformModKeyPressed(
  event: PlatformModifierKeyboardEvent,
  platform: ShortcutPlatform = currentShortcutPlatform(),
): boolean {
  return platform === "mac" ? event.metaKey : event.ctrlKey;
}

export function currentShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "mac";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "other";
}

function normalizeShortcutKey(key: string): string {
  return key.length === 1 ? key.toLocaleLowerCase() : key;
}

function physicalCodeForShortcutKey(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return `Key${key.toLocaleUpperCase()}`;
  if (key === "\\") return "Backslash";
  return null;
}

function displayKey(key: string): string {
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  return key.length === 1 ? key.toLocaleUpperCase() : key;
}
