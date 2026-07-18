export type ImageDisplaySize = "thumbnail" | "small" | "medium" | "large";

export interface EditorImageLine {
  path: string;
  alt: string;
  raw: string;
  size: ImageDisplaySize;
}

export function parseImageLine(text: string): EditorImageLine | null {
  const raw = text.trim();
  const markdownMatch = raw.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    const target = parseMarkdownImageTarget(markdownMatch[2] ?? "");
    return {
      alt: markdownMatch[1]?.trim() ?? "",
      path: target.path,
      raw,
      size: target.size,
    };
  }

  const obsidianMatch = raw.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (!obsidianMatch) return null;
  const [path = "", alt = "", size = ""] = (obsidianMatch[1] ?? "").split("|");
  return { path: path.trim(), alt: alt.trim(), raw, size: normalizeImageSize(size) };
}

export function rewriteImageLineSize(text: string, size: ImageDisplaySize): string {
  const raw = text.trim();
  const markdownMatch = raw.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    const target = parseMarkdownImageTarget(markdownMatch[2] ?? "");
    const path = formatMarkdownImagePath(target.path);
    return `![${markdownMatch[1] ?? ""}](${path} "loby-size=${size}")`;
  }

  const obsidianMatch = raw.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (obsidianMatch) {
    const [path = "", alt = ""] = (obsidianMatch[1] ?? "").split("|");
    return `![[${path.trim()}|${alt.trim()}|${size}]]`;
  }

  return text;
}

function parseMarkdownImageTarget(target: string): { path: string; size: ImageDisplaySize } {
  const value = target.trim();
  if (!value) return { path: "", size: "large" };
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    const path = end > 1 ? value.slice(1, end).trim() : "";
    return { path, size: parseImageSizeFromText(value.slice(end + 1)) };
  }
  const quotedTitleIndex = value.search(/\s+["']/);
  const path = (quotedTitleIndex > 0 ? value.slice(0, quotedTitleIndex) : value).trim();
  const metadata = quotedTitleIndex > 0 ? value.slice(quotedTitleIndex) : "";
  return { path, size: parseImageSizeFromText(metadata) };
}

function parseImageSizeFromText(value: string): ImageDisplaySize {
  const match = value.match(/loby-size=(thumbnail|small|medium|large)/);
  return normalizeImageSize(match?.[1] ?? "");
}

function normalizeImageSize(value: string): ImageDisplaySize {
  if (value === "thumbnail" || value === "small" || value === "medium" || value === "large") return value;
  return "large";
}

function formatMarkdownImagePath(path: string): string {
  return /\s/.test(path) ? `<${path}>` : path;
}
