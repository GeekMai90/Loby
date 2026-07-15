interface MowenMark {
  type: "bold" | "highlight" | "code" | "link";
  attrs?: { href: string };
}

interface MowenTextNode {
  type: "text";
  text: string;
  marks?: MowenMark[];
}

interface MowenBlock {
  type: "paragraph" | "quote" | "mowen_attachment";
  content?: MowenTextNode[];
  attrs?: { index: number };
}

export interface MowenDocument {
  type: "doc";
  content: MowenBlock[];
}

export function buildMowenDocument(title: string, markdown: string): MowenDocument {
  const blocks: MowenBlock[] = [];
  const normalizedTitle = title.trim();
  if (normalizedTitle) {
    blocks.push(paragraph([{ type: "text", text: normalizedTitle, marks: [{ type: "bold" }] }]), paragraph());
  }

  const source = removeMatchingH1(markdown, normalizedTitle);
  let paragraphLines: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push(paragraph(parseInline(paragraphLines.join(" ").trim())));
    paragraphLines = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push({ type: "quote", content: parseInline(quoteLines.join(" ").trim()) });
    quoteLines = [];
  };
  const flushCode = () => {
    codeLines.forEach((line) => blocks.push(paragraph(line ? [{ type: "text", text: line, marks: [{ type: "code" }] }] : undefined)));
    codeLines = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushQuote();
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushQuote();
      if (blocks.length && blocks.at(-1)?.content?.length) blocks.push(paragraph());
      continue;
    }
    const attachment = line.trim().match(/^@@MOWEN_ATTACHMENT:(\d+)@@$/);
    if (attachment) {
      flushParagraph();
      flushQuote();
      blocks.push({ type: "mowen_attachment", attrs: { index: Number(attachment[1]) } });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      quoteLines.push(quote[1]);
      continue;
    }
    flushQuote();
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      flushParagraph();
      blocks.push(paragraph([{ type: "text", text: heading[1], marks: [{ type: "bold" }] }]));
      continue;
    }
    const list = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/);
    if (list) {
      flushParagraph();
      blocks.push(paragraph(parseInline(`- ${list[1]}`)));
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();
  flushQuote();
  flushCode();
  while (blocks.at(-1)?.type === "paragraph" && !blocks.at(-1)?.content?.length) blocks.pop();
  return { type: "doc", content: blocks };
}

function paragraph(content?: MowenTextNode[]): MowenBlock {
  return content?.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function parseInline(value: string, activeMarks: MowenMark[] = []): MowenTextNode[] {
  const patterns = [
    { type: "link" as const, expression: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/ },
    { type: "bold" as const, expression: /\*\*(.+?)\*\*/ },
    { type: "highlight" as const, expression: /==(.+?)==/ },
    { type: "code" as const, expression: /`([^`]+)`/ },
  ];
  const nodes: MowenTextNode[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const matches = patterns
      .map((pattern) => ({ ...pattern, match: pattern.expression.exec(value.slice(cursor)) }))
      .filter((entry) => entry.match)
      .sort((left, right) => (left.match?.index ?? 0) - (right.match?.index ?? 0));
    const next = matches[0];
    if (!next?.match) {
      pushText(nodes, value.slice(cursor), activeMarks);
      break;
    }
    const start = cursor + next.match.index;
    if (start > cursor) pushText(nodes, value.slice(cursor, start), activeMarks);
    const inner = next.match[1];
    const mark: MowenMark = next.type === "link" ? { type: "link", attrs: { href: next.match[2] } } : { type: next.type };
    if (next.type === "code") pushText(nodes, inner, [...activeMarks, mark]);
    else nodes.push(...parseInline(inner, [...activeMarks, mark]));
    cursor = start + next.match[0].length;
  }
  return nodes;
}

function pushText(nodes: MowenTextNode[], text: string, marks: MowenMark[]) {
  if (!text) return;
  nodes.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
}

function removeMatchingH1(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index >= 0 && lines[index].replace(/^#\s+/, "").trim() === title) lines.splice(index, 1);
  return lines.join("\n").trim();
}
