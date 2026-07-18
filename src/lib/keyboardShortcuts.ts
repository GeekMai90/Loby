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
  newProject: {
    id: "newProject",
    title: "新建项目",
    description: "打开新建项目窗口",
    group: "file",
    key: "n",
    modifiers: ["mod", "shift"],
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
  heading1: {
    id: "heading1",
    title: "一级标题",
    description: "将当前行切换为一级标题",
    group: "editing",
    key: "1",
    modifiers: ["mod", "alt"],
  },
  heading2: {
    id: "heading2",
    title: "二级标题",
    description: "将当前行切换为二级标题",
    group: "editing",
    key: "2",
    modifiers: ["mod", "alt"],
  },
  bulletList: {
    id: "bulletList",
    title: "无序列表",
    description: "切换当前行的无序列表标记",
    group: "editing",
    key: "8",
    modifiers: ["mod", "shift"],
  },
  quote: {
    id: "quote",
    title: "引用",
    description: "切换当前行的引用标记",
    group: "editing",
    key: "9",
    modifiers: ["mod", "shift"],
  },
  task: {
    id: "task",
    title: "任务列表",
    description: "切换当前行的任务标记",
    group: "editing",
    key: "t",
    modifiers: ["mod", "alt"],
  },
  searchSheets: {
    id: "searchSheets",
    title: "搜索文稿",
    description: "打开当前列表的搜索",
    group: "navigation",
    key: "k",
    modifiers: ["mod", "shift"],
  },
  previousSheet: {
    id: "previousSheet",
    title: "上一篇文稿",
    description: "切换到列表中的上一篇文稿",
    group: "navigation",
    key: "ArrowUp",
    modifiers: ["mod", "alt"],
  },
  nextSheet: {
    id: "nextSheet",
    title: "下一篇文稿",
    description: "切换到列表中的下一篇文稿",
    group: "navigation",
    key: "ArrowDown",
    modifiers: ["mod", "alt"],
  },
  toggleNavigation: {
    id: "toggleNavigation",
    title: "显示或隐藏侧栏",
    description: "切换左侧导航与文稿列表",
    group: "view",
    key: "\\",
    modifiers: ["mod"],
  },
  toggleInspector: {
    id: "toggleInspector",
    title: "显示或隐藏 AI 面板",
    description: "切换右侧 AI 助手面板",
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
  enterZenMode: {
    id: "enterZenMode",
    title: "进入禅模式",
    description: "在当前桌面打开沉浸式写作窗口",
    group: "view",
    key: "f",
    modifiers: ["mod", "alt"],
  },
  togglePreview: {
    id: "togglePreview",
    title: "切换 Markdown 预览",
    description: "在编辑与预览模式之间切换",
    group: "view",
    key: "p",
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
}

export function matchesAppShortcut(event: ShortcutKeyboardEvent, shortcut: AppShortcut): boolean {
  if (event.isComposing || event.repeat) return false;
  const modifiers = new Set(shortcut.modifiers);
  const modPressed = event.metaKey || event.ctrlKey;
  if (modPressed !== modifiers.has("mod")) return false;
  if (event.shiftKey !== modifiers.has("shift")) return false;
  if (event.altKey !== modifiers.has("alt")) return false;
  if (normalizeShortcutKey(event.key) === normalizeShortcutKey(shortcut.key)) return true;
  if (!event.code || shortcut.key.length !== 1 || !/^[a-z]$/i.test(shortcut.key)) return false;
  return event.code.toLocaleLowerCase() === `key${shortcut.key.toLocaleLowerCase()}`;
}

export function findMatchingAppShortcut(event: ShortcutKeyboardEvent): AppShortcut | undefined {
  return APP_SHORTCUT_LIST.find((shortcut) => matchesAppShortcut(event, shortcut));
}

export function formatAppShortcut(shortcut: AppShortcut, platform: "mac" | "other" = currentShortcutPlatform()): string {
  const key = displayKey(shortcut.key);
  if (platform === "mac") {
    const modifiers = shortcut.modifiers.map((modifier) => ({ mod: "⌘", shift: "⇧", alt: "⌥" })[modifier]).join("");
    return `${modifiers}${key}`;
  }
  const modifiers = shortcut.modifiers.map((modifier) => ({ mod: "Ctrl", shift: "Shift", alt: "Alt" })[modifier]);
  return [...modifiers, key].join("+");
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

function displayKey(key: string): string {
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  return key.length === 1 ? key.toLocaleUpperCase() : key;
}
