/**
 * [INPUT]: 依赖纯文本与光标偏移，不依赖 CodeMirror、React 或任何 feature
 * [OUTPUT]: 对外提供 SLASH_TRIGGER_CHARACTER、SlashTriggerRange、findSlashTriggerAt
 * [POS]: shared 层的 slash 触发边界；编辑器斜线菜单与 AI composer 共用同一套解析，避免各自维护正则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

// ============================================================
// 触发字符
// ============================================================
// 只有半角 `/` 是触发字符，且只在行首或空白之后触发——紧跟在字符后面的斜杠属于
// 路径或行内写法（`src/shared`），不该唤出菜单。
//
// 约束：本常量会被消费方直接嵌入正则字符类，新增字符必须在字符类中是字面量，
// 不得含 `\` `]` `^` `-`；否则应先在此处提供转义后的字符类，而不是让调用方各自处理。
export const SLASH_TRIGGER_CHARACTER = "/";

const SLASH_TRIGGER_PATTERN = /(?:^|\s)\/([^\s/]*)$/;

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
  return { from: cursor - query.length - 1, to: cursor, query };
}
