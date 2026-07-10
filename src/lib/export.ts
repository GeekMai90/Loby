import type { WritingProject, WritingSheet } from "../types";
import { formatMetadataTimestamp } from "./dates";
import { renderObsidianImagesAsMarkdown } from "./imageAssets";

interface CompileOptions {
  transformSheetBody?: (sheet: WritingSheet) => string;
}

export function getPublishableSheets(project: WritingProject): WritingSheet[] {
  return project.sheets.filter((sheet) => sheet.type !== "素材");
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
  <title>${project.title}</title>
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

  return `<section data-nibva-export="wechat" style="color: #1d1d1f; font-size: 16px; letter-spacing: 0; word-break: break-word;">\n${body}\n</section>`;
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
    .replace(/\+\+([^+\n]+?)\+\+/g, "$1")
    .replace(/::([^:\n]+?)::/g, "$1")
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
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(renderObsidianImagesAsMarkdown(input));
  return renderNibvaHtmlExtensions(String(file));
}

function renderInlineMarkdown(input: string): string {
  return escapeHtml(input)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
      return `<a href="${escapeAttribute(url)}">${text}</a>`;
    })
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\+\+([^+\n]+?)\+\+/g, '<u style="text-underline-offset: 2px;">$1</u>')
    .replace(/::([^:\n]+?)::/g, '<mark style="border-radius: 5px; padding: 0 3px; color: #1d1d1f; background: #fff3a8;">$1</mark>');
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

function renderNibvaHtmlExtensions(input: string): string {
  return input
    .replace(/\+\+([^+<>\n]+?)\+\+/g, '<u class="nibva-underline">$1</u>')
    .replace(/::([^:<>\n]+?)::/g, '<mark class="nibva-highlight">$1</mark>');
}

export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("当前环境不允许写入剪贴板");
}

export function openPrintPreview(title: string, html: string): boolean {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!printWindow) return false;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const body = parsed.body.innerHTML || html;
  const escapedTitle = escapeHtml(title || "Nibva Export");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapedTitle}</title>
  <style>
    @page { margin: 22mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1d1d1f;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 16px;
      line-height: 1.78;
      -webkit-font-smoothing: antialiased;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 0 80px;
    }
    h1 { margin: 0 0 20px; font-size: 28px; line-height: 1.35; }
    h2 { margin: 34px 0 14px; font-size: 22px; line-height: 1.4; }
    h3 { margin: 28px 0 12px; font-size: 18px; line-height: 1.45; }
    p, li { margin: 0 0 14px; }
    mark, .nibva-highlight { border-radius: 5px; padding: 0 3px; color: #1d1d1f; background: #fff3a8; }
    blockquote { margin: 0 0 18px; border-radius: 0; padding: 10px 14px; border-left: 3px solid #d7d7dd; color: #5f6068; background: #f7f7f9; }
    code { border-radius: 5px; padding: 2px 5px; background: #f5f5f7; font-family: "SF Mono", "SFMono-Regular", Consolas, monospace; font-size: 0.9em; }
    pre { overflow: auto; margin: 0 0 18px; border-radius: 8px; padding: 12px; background: #f5f5f7; }
    pre code { padding: 0; background: transparent; }
    hr { margin: 28px 0; border: 0; border-top: 1px solid #ececf0; }
    a { color: #005bb8; }
  </style>
</head>
<body>
  <main>${body}</main>
  <script>
    window.addEventListener("load", () => {
      window.focus();
      setTimeout(() => window.print(), 150);
    });
  </script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
