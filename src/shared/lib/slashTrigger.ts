/**
 * [INPUT]: 依赖纯文本与光标偏移，不依赖 CodeMirror、React 或任何 feature
 * [OUTPUT]: 对外提供 SLASH_TRIGGER_CHARACTERS、SlashTriggerRange、findSlashTriggerAt
 * [POS]: shared 层的 slash 触发边界；编辑器与 AI composer 共用同一套斜杠变体识别，避免各自维护正则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

// ============================================================
// 触发字符
// ============================================================
// Windows 中文输入法（微软拼音、搜狗等）在中文标点模式下把 `/` 物理键输出为顿号 `、`，
// 全角模式下输出全角斜杠 `／`；macOS 系统拼音不做这层替换，所以同一套按键在两端结果不同。
// 键盘层拦不住这件事：标点由 IME 直接上屏，编辑器只看得到最终字符。
// 因此把三个字符视为同一个触发语义，并且只在行首或空白之后触发——
// 中文顿号真正的用法总是紧跟在字符后面（「苹果、香蕉」），不会落在这个位置。
//
// 约束：本常量会被消费方直接嵌入正则字符类，新增字符必须在字符类中是字面量，
// 不得含 `\` `]` `^` `-`；否则应先在此处提供转义后的字符类，而不是让调用方各自处理。
export const SLASH_TRIGGER_CHARACTERS = "/、／";

const SLASH_TRIGGER_PATTERN = /(?:^|\s)[/、／]([^\s/、／]*)$/;

export interface SlashTriggerRange {
  from: number;
  to: number;
  query: string;
}

/** 在 `text` 的 `cursor` 处向前解析未闭合的 slash 触发，`from` 指向触发字符本身。 */
export function findSlashTriggerAt(text: string, cursor: number): SlashTriggerRange | null {
  const match = text.slice(0, cursor).match(SLASH_TRIGGER_PATTERN);
  if (!match) return null;
  const query = match[1] ?? "";
  // 三种触发字符都是单个 UTF-16 码元，触发字符必然落在 query 之前一位。
  return { from: cursor - query.length - 1, to: cursor, query };
}
