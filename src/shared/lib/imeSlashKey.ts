/**
 * [INPUT]: 依赖 KeyboardEvent 的物理键位 code 与刚上屏的文本，不依赖 CodeMirror、React 或任何 feature
 * [OUTPUT]: 对外提供 SLASH_KEY_IME_VARIANTS、isSlashKeyImeVariant、createSlashKeyTracker、normalizeSlashKeyInput、SlashKeyTracker
 * [POS]: shared 层的中文输入法斜杠键归一边界；编辑器与 AI composer 共用同一套「这个顿号是从哪个键来的」判定，上游于 slashTrigger 的纯文本解析
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

// ============================================================
// 按键位归一，而不是按字符等价
// ============================================================
// Windows 中文输入法在中文标点模式下把物理 `/` 键上屏为顿号 `、`，全角模式下上屏 `／`；
// 而顿号本身的标准键位是 `\`——中文键盘上这个键印的就是 `、`。
// 两个键上屏同一个字符，字符层没有任何信息可以区分意图：只认字符必然二选一失败，
// 要么 `/` 唤不出斜杠菜单，要么顿号根本打不出来。
//
// 唯一可靠的事实来源是物理键位。IME 接管按键时 keydown 的 key 变成 "Process"、
// keyCode 变成 229，但 code 源自扫描码，不受 IME 改写。因此这里只认 code：
// Slash 键上屏的变体归一为半角 `/`（用户按斜杠键就该得到斜杠，并唤出菜单），
// Backslash 键上屏的顿号原样保留，既不改写也不触发菜单。
//
// 失效方向必须是安全的：拿不到 code 时不归一，退化为「顿号照常输入、菜单不弹」，
// 绝不能反过来让中文顿号变得无法输入。
const SLASH_KEY_CODE = "Slash";

/** 物理 `/` 键经中文标点或全角标点模式上屏的替身字符 */
export const SLASH_KEY_IME_VARIANTS = "、／";

/** IME 上屏晚于 keydown，超过这个窗口的键位记录视为陈旧，不再参与归一 */
const SLASH_KEY_MEMORY_MS = 500;

/** 文本是否是物理 `/` 键可能上屏的单个替身字符 */
export function isSlashKeyImeVariant(text: string): boolean {
  return text.length === 1 && SLASH_KEY_IME_VARIANTS.includes(text);
}

export interface SlashKeyTracker {
  /** 记录最近一次物理键位；IME 接管时 key/keyCode 已被改写，只有 code 仍然可信 */
  observeKeyDown(event: { code?: string }): void;
  /** 刚上屏的文本是否是物理 `/` 键经 IME 产生的替身 */
  isSlashKeyInsertion(inserted: string): boolean;
}

/** `readClock` 是唯一的时间接缝，供回归测试注入可控时钟。 */
export function createSlashKeyTracker(readClock: () => number = Date.now): SlashKeyTracker {
  let pressedAt = Number.NEGATIVE_INFINITY;
  return {
    observeKeyDown(event) {
      pressedAt = event.code === SLASH_KEY_CODE ? readClock() : Number.NEGATIVE_INFINITY;
    },
    isSlashKeyInsertion(inserted) {
      return isSlashKeyImeVariant(inserted) && readClock() - pressedAt <= SLASH_KEY_MEMORY_MS;
    },
  };
}

/**
 * 把光标前刚上屏的斜杠键替身改写为半角 `/`；不属于该情形时原样返回。
 * 替身与 `/` 都是单个 UTF-16 码元，改写不移动光标。
 */
export function normalizeSlashKeyInput(value: string, cursor: number, tracker: SlashKeyTracker): string {
  if (cursor <= 0 || cursor > value.length) return value;
  if (!tracker.isSlashKeyInsertion(value.slice(cursor - 1, cursor))) return value;
  return `${value.slice(0, cursor - 1)}/${value.slice(cursor)}`;
}
