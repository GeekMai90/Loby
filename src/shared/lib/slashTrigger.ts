/**
 * [INPUT]: 依赖纯文本与光标偏移，不依赖 CodeMirror、React 或任何 feature
 * [OUTPUT]: 对外提供 SLASH_TRIGGER_CHARACTER、SlashTriggerRange、findSlashTriggerAt
 * [POS]: shared 层的 slash 触发边界；编辑器与 AI composer 共用同一套解析，IME 变体字符已由上游 imeSlashKey 归一，这里只认半角 `/`
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

// ============================================================
// 触发字符
// ============================================================
// 只有半角 `/` 是触发字符。Windows 中文输入法把物理 `/` 键上屏成顿号 `、` 或全角 `／`
// 的问题在输入层解决：shared/lib/imeSlashKey 按物理键位把它们归一成 `/` 之后才进入文本。
// 这里绝不能再把 `、` 当作 `/` 的同义词——顿号的标准键位是 `\`，字符层等价会让顿号无法输入。
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
