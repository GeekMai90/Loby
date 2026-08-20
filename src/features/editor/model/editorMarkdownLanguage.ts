/**
 * [INPUT]: 依赖 @lezer/markdown
 * [OUTPUT]: 对外提供 lobyMarkdownExtensions；让中文标点包裹的行内粗体在紧接中文正文时正确闭合
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { GFM, type DelimiterType, type InlineContext, type MarkdownConfig, type MarkdownExtension } from "@lezer/markdown";

const bearStrongDelimiter: DelimiterType = { resolve: "StrongEmphasis", mark: "EmphasisMark" };
const bearUnderlineDelimiter: DelimiterType = { resolve: "LobyUnderline", mark: "LobyUnderlineMark" };
const punctuation = createPunctuationPattern();
const openingPunctuation = createOpeningPunctuationPattern();
const cjkCharacter = createCjkCharacterPattern();

const bearStrong: MarkdownConfig = {
  parseInline: [
    {
      name: "LobyStrongEmphasis",
      before: "Emphasis",
      parse(context, next, position) {
        if (next !== 42 || context.char(position + 1) !== 42 || context.char(position + 2) === 42) return -1;
        const flanking = resolveFlanking(context, position, position + 2);
        return context.addDelimiter(bearStrongDelimiter, position, position + 2, flanking.canOpen, flanking.canClose);
      },
    },
  ],
};

const bearUnderline: MarkdownConfig = {
  defineNodes: [{ name: "LobyUnderline" }, { name: "LobyUnderlineMark" }],
  parseInline: [
    {
      name: "LobyUnderline",
      parse(context, next, position) {
        if (next !== 126 || context.char(position - 1) === 126 || context.char(position + 1) === 126) return -1;
        const flanking = resolveFlanking(context, position, position + 1);
        const canOpen = flanking.canOpen || startsNestedStyle(context, position + 1);
        return context.addDelimiter(bearUnderlineDelimiter, position, position + 1, canOpen, flanking.canClose);
      },
    },
  ],
};

export const lobyMarkdownExtensions: MarkdownExtension = [GFM, bearStrong, bearUnderline];

function resolveFlanking(context: InlineContext, from: number, to: number) {
  const before = context.slice(from - 1, from);
  const after = context.slice(to, to + 1);
  const afterAfter = context.slice(to + 1, to + 2);
  const spaceBefore = /\s|^$/.test(before);
  const spaceAfter = /\s|^$/.test(after);
  const punctuationBefore = isPunctuation(before);
  const punctuationAfter = isPunctuation(after);
  const canOpenBeforeCjkText = openingPunctuation.test(after) && isCjkCharacter(afterAfter);
  const canCloseBeforeCjkText = punctuationBefore && !punctuationAfter && isCjkCharacter(after);
  return {
    canOpen: !spaceAfter && (!punctuationAfter || spaceBefore || punctuationBefore || canOpenBeforeCjkText),
    canClose: !spaceBefore && (!punctuationBefore || spaceAfter || punctuationAfter || canCloseBeforeCjkText),
  };
}

function isPunctuation(value: string) {
  return value !== "~" && punctuation.test(value);
}

function isCjkCharacter(value: string) {
  return cjkCharacter.test(value);
}

function startsNestedStyle(context: InlineContext, position: number) {
  const marker = context.slice(position, position + 2);
  return marker === "==" || marker === "**" || marker === "__" || marker.startsWith("*") || marker.startsWith("_");
}

function createPunctuationPattern() {
  try {
    return new RegExp("[\\p{S}\\p{P}]", "u");
  } catch {
    return /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\xA1\u2010-\u2027]/;
  }
}

function createOpeningPunctuationPattern() {
  try {
    return new RegExp("[\\p{Ps}\\p{Pi}]", "u");
  } catch {
    return /[\u2018\u201c\u3008-\u300f\u3010-\u3011\uff08\uff3b\uff5b]/;
  }
}

function createCjkCharacterPattern() {
  try {
    return new RegExp("[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]", "u");
  } catch {
    return /[\u2e80-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
  }
}
