import type { ImageReferenceFormat, WritingProject, WritingSheet } from "../types";
import { buildProjectFolderPath, buildSheetMarkdownPath } from "./projectModel";

export interface ImageReference {
  raw: string;
  path: string;
  alt: string;
  format: ImageReferenceFormat;
  index: number;
}

export interface ExportImageAsset {
  sourcePath: string;
  relativePath: string;
}

export interface ImageExportBundle {
  assets: ExportImageAsset[];
  missing: string[];
}

export interface ImageDependencySummary {
  total: number;
  local: number;
  external: number;
  bundled: number;
  missing: string[];
}

interface ImageBundleOptions {
  knownResourcePaths?: string[];
}

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const STANDARD_IMAGE_PATTERN = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;
const OBSIDIAN_IMAGE_PATTERN = /!\[\[([^\]\n]+)\]\]/g;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const extension = getPathExtension(file.name);
  return extension ? IMAGE_EXTENSIONS.has(extension.toLowerCase()) : false;
}

export function getPreferredImageFilename(file: File, fallbackStem = "image"): string {
  const extension = getPathExtension(file.name) || extensionFromMimeType(file.type) || "png";
  const stem = stripExtension(file.name).trim() || fallbackStem;
  return `${stem}.${extension}`;
}

export function createImageReference(path: string, alt: string, format: ImageReferenceFormat): string {
  const cleanAlt = alt.replace(/\n/g, " ").replaceAll("[", " ").replaceAll("]", " ").trim();
  const cleanPath = path.replace(/\n/g, "").trim();
  if (format === "obsidian") {
    return `![[${cleanPath}${cleanAlt ? `|${cleanAlt}` : ""}]]`;
  }
  return `![${cleanAlt}](${cleanPath})`;
}

export function parseImageReferences(markdown: string): ImageReference[] {
  const references: ImageReference[] = [];

  for (const match of markdown.matchAll(STANDARD_IMAGE_PATTERN)) {
    const raw = match[0];
    const path = parseMarkdownImageDestination(match[2]);
    if (!path) continue;
    references.push({
      raw,
      path,
      alt: match[1]?.trim() ?? "",
      format: "markdown",
      index: match.index ?? 0,
    });
  }

  for (const match of markdown.matchAll(OBSIDIAN_IMAGE_PATTERN)) {
    const raw = match[0];
    const target = match[1] ?? "";
    const [path = "", alt = ""] = target.split("|");
    const cleanPath = path.trim();
    if (!cleanPath || !looksLikeImagePath(cleanPath)) continue;
    references.push({
      raw,
      path: cleanPath,
      alt: alt.trim(),
      format: "obsidian",
      index: match.index ?? 0,
    });
  }

  return references.sort((a, b) => a.index - b.index);
}

export function renderObsidianImagesAsMarkdown(markdown: string): string {
  return markdown.replace(OBSIDIAN_IMAGE_PATTERN, (raw, target: string) => {
    const [path = "", alt = ""] = target.split("|");
    const cleanPath = path.trim();
    if (!cleanPath || !looksLikeImagePath(cleanPath)) return raw;
    return createImageReference(cleanPath, alt.trim() || stripExtension(getBasename(cleanPath)), "markdown");
  });
}

export function buildImageExportBundle(
  libraryPath: string,
  project: WritingProject,
  sheets: WritingSheet[],
  options: ImageBundleOptions = {},
): ImageExportBundle {
  const projectPath = buildProjectFolderPath(libraryPath, project);
  if (!projectPath) return { assets: [], missing: [] };

  const sourceToRelativePath = new Map<string, string>();
  const usedRelativePaths = new Set<string>();
  const missing = new Set<string>();
  const knownResourcePaths = new Set(options.knownResourcePaths?.map(normalizePath) ?? []);

  for (const sheet of sheets) {
    const sheetPath = buildSheetMarkdownPath(libraryPath, project, sheet);
    for (const reference of parseImageReferences(sheet.body)) {
      const sourcePath = resolveImageSourcePath(projectPath, getDirname(sheetPath), reference.path);
      if (!sourcePath) continue;
      if (knownResourcePaths.size > 0 && !knownResourcePaths.has(sourcePath)) {
        missing.add(reference.path);
        continue;
      }
      if (sourceToRelativePath.has(sourcePath)) continue;
      const relativePath = uniqueBundleImagePath(sourcePath, usedRelativePaths);
      sourceToRelativePath.set(sourcePath, relativePath);
    }
  }

  const assets = Array.from(sourceToRelativePath.entries()).map(([sourcePath, relativePath]) => ({
    sourcePath,
    relativePath,
  }));

  return { assets, missing: Array.from(missing) };
}

export function analyzeImageDependencies(
  libraryPath: string,
  project: WritingProject,
  sheets: WritingSheet[],
  knownResourcePaths: string[] = [],
): ImageDependencySummary {
  const references = sheets.flatMap((sheet) => parseImageReferences(sheet.body));
  const external = references.filter((reference) => isExternalReference(reference.path)).length;
  const bundle = buildImageExportBundle(libraryPath, project, sheets, { knownResourcePaths });
  return {
    total: references.length,
    local: references.length - external,
    external,
    bundled: bundle.assets.length,
    missing: bundle.missing,
  };
}

export function rewriteSheetImageReferencesForBundle(
  markdown: string,
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  assets: ExportImageAsset[],
  outputFormat: ImageReferenceFormat,
): string {
  const projectPath = buildProjectFolderPath(libraryPath, project);
  if (!projectPath || assets.length === 0) return outputFormat === "markdown" ? renderObsidianImagesAsMarkdown(markdown) : markdown;

  const sheetPath = buildSheetMarkdownPath(libraryPath, project, sheet);
  const assetBySourcePath = new Map(assets.map((asset) => [asset.sourcePath, asset]));

  return markdown.replace(
    /!\[([^\]\n]*)\]\(([^)\n]+)\)|!\[\[([^\]\n]+)\]\]/g,
    (raw, markdownAlt: string, markdownTarget: string, obsidianTarget: string) => {
      const isObsidian = typeof obsidianTarget === "string";
      const target = isObsidian ? obsidianTarget : markdownTarget;
      const [obsidianPath = "", obsidianAlt = ""] = String(target ?? "").split("|");
      const originalPath = isObsidian ? obsidianPath.trim() : parseMarkdownImageDestination(String(markdownTarget ?? ""));
      if (!originalPath) return raw;
      const sourcePath = resolveImageSourcePath(projectPath, getDirname(sheetPath), originalPath);
      if (!sourcePath) return raw;
      const asset = assetBySourcePath.get(sourcePath);
      if (!asset) {
        return outputFormat === "markdown" && isObsidian ? renderObsidianImagesAsMarkdown(raw) : raw;
      }
      const alt = (isObsidian ? obsidianAlt : markdownAlt)?.trim() || stripExtension(getBasename(asset.relativePath));
      return createImageReference(asset.relativePath, alt, outputFormat);
    },
  );
}

export function resolveInsertedImagePath(
  importedImagePath: string,
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  format: ImageReferenceFormat,
): string {
  const projectPath = buildProjectFolderPath(libraryPath, project);
  if (!projectPath) return importedImagePath;
  if (format === "obsidian") return relativePath(projectPath, importedImagePath);
  return relativePath(getDirname(buildSheetMarkdownPath(libraryPath, project, sheet)), importedImagePath);
}

export function resolveSheetImageSourcePath(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  referencePath: string,
): string {
  if (!libraryPath.startsWith("/")) return "";
  const projectPath = buildProjectFolderPath(libraryPath, project) ?? libraryPath;
  return resolveImageSourcePath(projectPath, getDirname(buildSheetMarkdownPath(libraryPath, project, sheet)), referencePath);
}

export function resolveProjectImageSourcePath(projectPath: string, referencePath: string): string {
  if (!projectPath || isExternalReference(referencePath)) return "";
  const decodedPath = decodePath(referencePath);
  if (decodedPath.startsWith("/")) return normalizePath(decodedPath);
  const projectRelativePath = decodedPath.replace(/^(?:\.\.\/)+(assets\/|references\/)/, "$1");
  if (projectRelativePath.startsWith("assets/") || projectRelativePath.startsWith("references/")) {
    return normalizePath(joinPath(projectPath, projectRelativePath));
  }
  if (projectRelativePath.startsWith("./") || projectRelativePath.startsWith("../")) return "";
  return normalizePath(joinPath(joinPath(projectPath, "assets/images"), projectRelativePath));
}

export function getBasename(path: string): string {
  return normalizePath(path).split("/").filter(Boolean).at(-1) ?? path;
}

export function stripExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return filename;
  return filename.slice(0, dotIndex);
}

function parseMarkdownImageDestination(target: string): string {
  const value = target.trim();
  if (!value) return "";
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end > 1 ? value.slice(1, end).trim() : "";
  }
  const quotedTitleIndex = value.search(/\s+["']/);
  return (quotedTitleIndex > 0 ? value.slice(0, quotedTitleIndex) : value).trim();
}

function resolveImageSourcePath(projectPath: string, sheetDir: string, referencePath: string): string {
  if (isExternalReference(referencePath)) return "";
  const decodedPath = decodePath(referencePath);
  if (decodedPath.startsWith("/")) return normalizePath(decodedPath);
  if (decodedPath.startsWith("./") || decodedPath.startsWith("../")) return normalizePath(joinPath(sheetDir, decodedPath));
  if (decodedPath.startsWith("assets/") || decodedPath.startsWith("references/")) return normalizePath(joinPath(projectPath, decodedPath));
  return normalizePath(joinPath(joinPath(projectPath, "assets/images"), decodedPath));
}

function uniqueBundleImagePath(sourcePath: string, usedRelativePaths: Set<string>): string {
  const basename = getBasename(sourcePath) || "image";
  const stem = stripExtension(basename) || "image";
  const extension = getPathExtension(basename);
  let candidate = `assets/images/${basename}`;
  for (let index = 2; usedRelativePaths.has(candidate); index += 1) {
    candidate = extension ? `assets/images/${stem}-${index}.${extension}` : `assets/images/${stem}-${index}`;
  }
  usedRelativePaths.add(candidate);
  return candidate;
}

function looksLikeImagePath(path: string): boolean {
  if (isExternalReference(path)) return true;
  const extension = getPathExtension(path);
  return extension ? IMAGE_EXTENSIONS.has(extension.toLowerCase()) : false;
}

function isExternalReference(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(path);
}

function extensionFromMimeType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/svg+xml") return "svg";
  const match = type.match(/^image\/([a-z0-9.+-]+)$/i);
  return match?.[1]?.replace("jpeg", "jpg") ?? "";
}

function getPathExtension(path: string): string {
  const basename = getBasename(path);
  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === basename.length - 1) return "";
  return basename.slice(dotIndex + 1);
}

function decodePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function normalizePath(path: string): string {
  const isAbsolute = path.startsWith("/");
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0 && parts.at(-1) !== "..") {
        parts.pop();
      } else if (!isAbsolute) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }
  return `${isAbsolute ? "/" : ""}${parts.join("/")}`;
}

function getDirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return normalized.startsWith("/") ? "/" : ".";
  return normalized.slice(0, index);
}

function joinPath(base: string, path: string): string {
  if (path.startsWith("/")) return normalizePath(path);
  return normalizePath(`${base}/${path}`);
}

function relativePath(fromDir: string, toPath: string): string {
  const fromParts = normalizePath(fromDir).split("/").filter(Boolean);
  const toParts = normalizePath(toPath).split("/").filter(Boolean);
  let commonLength = 0;
  while (fromParts[commonLength] && fromParts[commonLength] === toParts[commonLength]) {
    commonLength += 1;
  }
  const upSegments = fromParts.slice(commonLength).map(() => "..");
  const downSegments = toParts.slice(commonLength);
  const relative = [...upSegments, ...downSegments].join("/");
  return relative || getBasename(toPath);
}
