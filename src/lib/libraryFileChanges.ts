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
