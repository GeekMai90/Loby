/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 LibraryFileChangePayload、isProjectResourcePath、libraryIndexChangePaths、hasProjectResourceChanges
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface LibraryFileChangePayload {
  paths: string[];
  kind: string;
}

const PROJECT_RESOURCE_DIRECTORIES = new Set(["assets", "references", "exports"]);

function pathSegments(path: string) {
  return path.split(/[\\/]+/).filter(Boolean);
}

export function isProjectResourcePath(path: string) {
  const segments = pathSegments(path);
  const assetsIndex = segments.lastIndexOf("assets");
  if (assetsIndex >= 0 && segments[assetsIndex + 1] === "images") return true;
  const projectsIndex = segments.lastIndexOf("projects");
  if (projectsIndex < 0) return false;
  return PROJECT_RESOURCE_DIRECTORIES.has(segments[projectsIndex + 2] ?? "");
}

export function libraryIndexChangePaths(paths: string[]) {
  return paths.filter((path) => !isProjectResourcePath(path));
}

export function hasProjectResourceChanges(paths: string[]) {
  return paths.some(isProjectResourcePath);
}
