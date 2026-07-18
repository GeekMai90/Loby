import { GFM, type DelimiterType, type InlineContext, type MarkdownConfig, type MarkdownExtension } from "@lezer/markdown";

const bearStrongDelimiter: DelimiterType = { resolve: "StrongEmphasis", mark: "EmphasisMark" };
const bearUnderlineDelimiter: DelimiterType = { resolve: "LobyUnderline", mark: "LobyUnderlineMark" };
const punctuation = createPunctuationPattern();

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
  const spaceBefore = /\s|^$/.test(before);
  const spaceAfter = /\s|^$/.test(after);
  const punctuationBefore = isPunctuation(before);
  const punctuationAfter = isPunctuation(after);
  return {
    canOpen: !spaceAfter && (!punctuationAfter || spaceBefore || punctuationBefore),
    canClose: !spaceBefore && (!punctuationBefore || spaceAfter || punctuationAfter),
  };
}

function isPunctuation(value: string) {
  return value !== "~" && punctuation.test(value);
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
