export function formatLibraryParentPath(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath) return "正在读取默认目录…";
  if (normalizedPath.toLowerCase().startsWith("browser")) return "浏览器存储";

  const segments = normalizedPath.split(/[\\/]+/).filter(Boolean);
  const documentsIndex = segments.findIndex((segment) => segment.toLowerCase() === "documents");

  if (documentsIndex >= 0) {
    return ["文稿", ...segments.slice(documentsIndex + 1)].join(" / ");
  }

  if (segments.length <= 2) return segments.join(" / ");
  return ["…", ...segments.slice(-2)].join(" / ");
}
