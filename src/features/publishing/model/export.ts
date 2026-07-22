/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块、unified、remark-parse、remark-gfm、remark-rehype
 * [OUTPUT]: 对外提供 getPublishableSheets、compileMarkdown、compileHtml、renderMarkdownHtml、compilePlainText、compileWechatHtml、compileXhsDraft
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";
import { formatMetadataTimestamp } from "@/shared/lib/dates";
import { renderObsidianImagesAsMarkdown } from "@/features/library/model/imageAssets";

interface CompileOptions {
  transformSheetBody?: (sheet: WritingSheet) => string;
}

export function getPublishableSheets(project: WritingProject): WritingSheet[] {
  return project.sheets.filter((sheet) => !sheet.archivedAt && sheet.status !== "已归档");
}

export function compileMarkdown(
  project: WritingProject,
  sheets: WritingSheet[] = getPublishableSheets(project),
  options: CompileOptions = {},
): string {
  const frontmatter = [
    "---",
    `title: ${project.title}`,
    `updatedAt: ${formatMetadataTimestamp(project.updatedAt)}`,
    `tags: [${project.tags.join(", ")}]`,
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${sheets.map((sheet) => (options.transformSheetBody?.(sheet) ?? sheet.body).trim()).join("\n\n---\n\n")}\n`;
}

export async function compileHtml(
  project: WritingProject,
  sheets: WritingSheet[] = getPublishableSheets(project),
  options: CompileOptions = {},
): Promise<string> {
  const renderedSheets = await Promise.all(
    sheets.map(async (sheet) => {
      return `<section data-sheet-id="${escapeAttribute(sheet.id)}">\n${await markdownToHtml(options.transformSheetBody?.(sheet) ?? sheet.body)}\n</section>`;
    }),
  );
  const body = renderedSheets.join("\n<hr />\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(project.title)}</title>
</head>
<body>
${body}
</body>
</html>`;
}

export async function renderMarkdownHtml(input: string): Promise<string> {
  return markdownToHtml(input);
}

export function compilePlainText(project: WritingProject, sheets: WritingSheet[] = getPublishableSheets(project)): string {
  return sheets
    .map((sheet) =>
      stripMarkdown(sheet.body)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}

export function compileWechatHtml(project: WritingProject, sheets: WritingSheet[] = getPublishableSheets(project)): string {
  const body = sheets
    .flatMap((sheet) => sheet.body.split("\n"))
    .map((line) => line.trim())
    .map((line) => {
      if (!line) return '<p style="margin: 0 0 18px; line-height: 1.85;"><br /></p>';
      const image = parseSingleLineImage(line);
      if (image) {
        return `<p style="margin: 24px 0; text-align: center;"><img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}" style="max-width: 100%; height: auto; border-radius: 0;" /></p>`;
      }
      if (line.startsWith("# ")) {
        return `<h1 style="margin: 32px 0 18px; font-size: 22px; line-height: 1.45; font-weight: 700;">${renderInlineMarkdown(line.slice(2))}</h1>`;
      }
      if (line.startsWith("## ")) {
        return `<h2 style="margin: 28px 0 14px; font-size: 18px; line-height: 1.5; font-weight: 700;">${renderInlineMarkdown(line.slice(3))}</h2>`;
      }
      if (/^---+$/.test(line)) {
        return '<hr style="margin: 28px 0; border: 0; border-top: 1px solid #e5e5ea;" />';
      }
      if (/^>\s?/.test(line)) {
        return `<blockquote style="margin: 0 0 18px; border-radius: 0; padding: 10px 14px; border-left: 3px solid #d7d7dd; color: #5f6068; background: #f7f7f9; line-height: 1.85;">${renderInlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`;
      }
      if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) {
        const checked = /^[-*+]\s+\[[xX]\]\s+/.test(line);
        return `<p style="margin: 0 0 10px; line-height: 1.85;">${checked ? "☑" : "☐"} ${renderInlineMarkdown(line.replace(/^[-*+]\s+\[[ xX]\]\s+/, ""))}</p>`;
      }
      if (/^[-*+]\s+/.test(line)) {
        return `<p style="margin: 0 0 10px; line-height: 1.85;">• ${renderInlineMarkdown(line.replace(/^[-*+]\s+/, ""))}</p>`;
      }
      return `<p style="margin: 0 0 18px; line-height: 1.85;">${renderInlineMarkdown(line)}</p>`;
    })
    .join("\n");

  return `<section data-loby-export="wechat" style="color: #1d1d1f; font-size: 16px; letter-spacing: 0; word-break: break-word;">\n${body}\n</section>`;
}

export function compileXhsDraft(project: WritingProject, sheets: WritingSheet[] = getPublishableSheets(project)): string {
  const text = compilePlainText(project, sheets);
  const summary = sheets.map((sheet, index) => `${index + 1}. ${sheet.title}：${sheet.summary}`).join("\n");
  return [
    `# ${project.title}`,
    "",
    "## 小红书笔记拆条草稿",
    "",
    "### 标题方向",
    `- ${project.title}`,
    `- ${project.title}，我重新想清楚了`,
    `- 写给正在做${project.tags[0] ?? "内容"}的人`,
    "",
    "### 卡片结构",
    summary,
    "",
    "### 正文素材",
    text,
  ].join("\n");
}

function stripMarkdown(input: string): string {
  return renderObsidianImagesAsMarkdown(input)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2")
    .replace(/~~([^~\n]+?)~~/g, "$1")
    .replace(/(?<!~)~([^~\n]+?)~(?!~)/g, "$1")
    .replace(/==(?!=)([^\n]+?)(?<!\\)==(?![=])/g, "$1")
    .replace(/\[\^([^\]\n]+)\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(input: string): string {
  return input.replace(/"/g, "&quot;");
}

async function markdownToHtml(input: string): Promise<string> {
  const [{ unified }, { default: remarkParse }, { default: remarkGfm }, { default: remarkRehype }, { default: rehypeStringify }] =
    await Promise.all([
      import("unified"),
      import("remark-parse"),
      import("remark-gfm"),
      import("remark-rehype"),
      import("rehype-stringify"),
    ]);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkLobyInlineExtensions)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(renderObsidianImagesAsMarkdown(input));
  return String(file);
}

function renderInlineMarkdown(input: string): string {
  const protectedSegments: string[] = [];
  const protect = (html: string) => {
    const token = `\uE000${protectedSegments.length}\uE001`;
    protectedSegments.push(html);
    return token;
  };

  const rendered = renderInlineText(
    escapeHtml(input)
      .replace(/`([^`]+)`/g, (_match, code: string) => protect(`<code>${code}</code>`))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
        return protect(`<a href="${escapeAttribute(url)}">${renderInlineText(text)}</a>`);
      }),
  );

  return rendered.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedSegments[Number(index)] ?? "");
}

function renderInlineText(input: string): string {
  return input
    .replace(
      /\[\^([^\]\n]+)\]/g,
      '<sup style="color: #005bb8; font-size: 0.68em; font-weight: 800; line-height: 0; vertical-align: super;">$1</sup>',
    )
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+?)~~/g, "<s>$1</s>")
    .replace(/(?<!~)~([^~\n]+?)~(?!~)/g, '<u style="text-underline-offset: 2px;">$1</u>')
    .replace(
      /==(?!=)([^\n]+?)(?<!\\)==(?![=])/g,
      '<mark style="border-radius: 5px; padding: 0 3px; color: #1d1d1f; background: hsl(89 99% 82%);">$1</mark>',
    );
}

function parseSingleLineImage(line: string): { src: string; alt: string } | null {
  const markdownMatch = line.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    return {
      alt: markdownMatch[1]?.trim() ?? "",
      src: markdownMatch[2]?.trim().replace(/\s+["'][^"']*["']$/, "") ?? "",
    };
  }
  const obsidianMatch = line.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (!obsidianMatch) return null;
  const [src = "", alt = ""] = (obsidianMatch[1] ?? "").split("|");
  return { src: src.trim(), alt: alt.trim() };
}

interface MarkdownAstNode {
  type: string;
  value?: string;
  children?: MarkdownAstNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

function remarkLobyInlineExtensions() {
  return (tree: MarkdownAstNode) => transformLobyInlineChildren(tree);
}

function transformLobyInlineChildren(parent: MarkdownAstNode) {
  if (!parent.children) return;

  for (const child of parent.children) {
    transformLobyInlineChildren(child);
  }
  parent.children = parseLobyFootnoteReferences(parseLobyInlineDelimiters(parent.children));
}

function parseLobyFootnoteReferences(children: MarkdownAstNode[]): MarkdownAstNode[] {
  return children.flatMap((child) => {
    if (child.type !== "text" || !child.value) return [child];
    const nodes: MarkdownAstNode[] = [];
    const expression = /\[\^([^\]\n]+)\]/g;
    let cursor = 0;

    for (const match of child.value.matchAll(expression)) {
      if (match.index > cursor) nodes.push({ type: "text", value: child.value.slice(cursor, match.index) });
      nodes.push({
        type: "lobyFootnoteReference",
        children: [{ type: "text", value: match[1] }],
        data: {
          hName: "sup",
          hProperties: { className: ["loby-footnote-reference"] },
        },
      });
      cursor = match.index + match[0].length;
    }

    if (!nodes.length) return [child];
    if (cursor < child.value.length) nodes.push({ type: "text", value: child.value.slice(cursor) });
    return nodes;
  });
}

interface LobyDelimiterToken {
  marker: "~" | "==";
}

interface OpenLobyDelimiter extends LobyDelimiterToken {
  children: MarkdownAstNode[];
}

function parseLobyInlineDelimiters(children: MarkdownAstNode[]): MarkdownAstNode[] {
  const output: MarkdownAstNode[] = [];
  const stack: OpenLobyDelimiter[] = [];
  const append = (node: MarkdownAstNode) => {
    const target = stack[stack.length - 1]?.children ?? output;
    target.push(node);
  };

  for (const token of tokenizeLobyInlineDelimiters(children)) {
    if (!("marker" in token)) {
      append(token);
      continue;
    }

    const current = stack[stack.length - 1];
    if (current?.marker === token.marker && current.children.length) {
      stack.pop();
      append(createLobyInlineNode(token.marker, current.children));
      continue;
    }
    stack.push({ marker: token.marker, children: [] });
  }

  while (stack.length) {
    const unmatched = stack.pop();
    if (!unmatched) break;
    const target = stack[stack.length - 1]?.children ?? output;
    target.push({ type: "text", value: unmatched.marker }, ...unmatched.children);
  }

  return output;
}

function tokenizeLobyInlineDelimiters(children: MarkdownAstNode[]): Array<MarkdownAstNode | LobyDelimiterToken> {
  return children.flatMap((child) => {
    if (child.type !== "text" || !child.value) return [child];
    return splitLobyTextDelimiters(child.value);
  });
}

function splitLobyTextDelimiters(value: string): Array<MarkdownAstNode | LobyDelimiterToken> {
  const tokens: Array<MarkdownAstNode | LobyDelimiterToken> = [];
  const expression = /(?<!~)~(?!~)|(?<![=])==(?![=])/g;
  let cursor = 0;

  for (const match of value.matchAll(expression)) {
    if (match.index > cursor) tokens.push({ type: "text", value: value.slice(cursor, match.index) });
    tokens.push({ marker: match[0] as LobyDelimiterToken["marker"] });
    cursor = match.index + match[0].length;
  }

  if (!tokens.length) return [{ type: "text", value }];
  if (cursor < value.length) tokens.push({ type: "text", value: value.slice(cursor) });
  return tokens;
}

function createLobyInlineNode(marker: LobyDelimiterToken["marker"], children: MarkdownAstNode[]): MarkdownAstNode {
  const isUnderline = marker === "~";
  return {
    type: isUnderline ? "lobyUnderline" : "lobyHighlight",
    children,
    data: {
      hName: isUnderline ? "u" : "mark",
      hProperties: { className: [isUnderline ? "loby-underline" : "loby-highlight"] },
    },
  };
}
