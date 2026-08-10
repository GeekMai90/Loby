/**
 * [INPUT]: 依赖 shared/types 的 WritingLibrary registry 契约、浏览器 localStorage 与随机身份生成
 * [OUTPUT]: 对外提供全局写作库 registry 的加载、保存、创建、登记、更新、移除、活动项解析与跨平台本地路径判断能力
 * [POS]: 全局写作库名称/路径 registry 的唯一浏览器适配层，不移动、重命名或删除实际目录
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingLibrary, WritingLibraryRegistry } from "@/shared/types";

const LIBRARY_REGISTRY_STORAGE_KEY = "loby.libraryRegistry.v1";

export function loadWritingLibraryRegistry(legacyLibraryPath = "", now = Date.now()): WritingLibraryRegistry {
  try {
    const raw = localStorage.getItem(LIBRARY_REGISTRY_STORAGE_KEY);
    if (raw) return normalizeWritingLibraryRegistry(JSON.parse(raw), now);
  } catch {
    // A malformed global registry should not prevent recovery through onboarding.
  }

  if (isDesktopLibraryPath(legacyLibraryPath)) {
    const library = createWritingLibrary(libraryNameFromPath(legacyLibraryPath), legacyLibraryPath, now);
    const migrated = { version: 1, activeLibraryId: library.id, libraries: [library] } satisfies WritingLibraryRegistry;
    saveWritingLibraryRegistry(migrated);
    return migrated;
  }

  return emptyWritingLibraryRegistry();
}

export function saveWritingLibraryRegistry(registry: WritingLibraryRegistry): void {
  try {
    localStorage.setItem(LIBRARY_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // Non-browser tests and restricted webviews can still use the in-memory registry.
  }
}

export function emptyWritingLibraryRegistry(): WritingLibraryRegistry {
  return { version: 1, activeLibraryId: "", libraries: [] };
}

export function createWritingLibrary(name: string, path: string, now = Date.now()): WritingLibrary {
  const normalizedPath = normalizeLibraryPath(path);
  return {
    id: writingLibraryId(normalizedPath),
    name: normalizeLibraryName(name, libraryNameFromPath(normalizedPath)),
    path: normalizedPath,
    createdAt: now,
    lastOpenedAt: now,
  };
}

export function registerWritingLibrary(
  registry: WritingLibraryRegistry,
  input: { name: string; path: string },
  now = Date.now(),
): WritingLibraryRegistry {
  const candidate = createWritingLibrary(input.name, input.path, now);
  const existing = registry.libraries.find((library) => library.path === candidate.path);
  const library = existing ? { ...existing, name: normalizeLibraryName(input.name, existing.name), lastOpenedAt: now } : candidate;
  return {
    version: 1,
    activeLibraryId: library.id,
    libraries: existing ? registry.libraries.map((item) => (item.id === existing.id ? library : item)) : [...registry.libraries, library],
  };
}

export function updateWritingLibrary(
  registry: WritingLibraryRegistry,
  libraryId: string,
  update: Partial<Pick<WritingLibrary, "name" | "path" | "lastOpenedAt" | "lastProjectId" | "lastSheetId">>,
): WritingLibraryRegistry {
  return {
    ...registry,
    libraries: registry.libraries.map((library) =>
      library.id === libraryId
        ? {
            ...library,
            ...update,
            name: update.name === undefined ? library.name : normalizeLibraryName(update.name, library.name),
            path: update.path === undefined ? library.path : normalizeLibraryPath(update.path),
          }
        : library,
    ),
  };
}

export function removeWritingLibrary(registry: WritingLibraryRegistry, libraryId: string): WritingLibraryRegistry {
  const libraries = registry.libraries.filter((library) => library.id !== libraryId);
  return {
    version: 1,
    activeLibraryId: registry.activeLibraryId === libraryId ? (libraries[0]?.id ?? "") : registry.activeLibraryId,
    libraries,
  };
}

export function activeWritingLibrary(registry: WritingLibraryRegistry): WritingLibrary | undefined {
  return registry.libraries.find((library) => library.id === registry.activeLibraryId) ?? registry.libraries[0];
}

export function libraryNameFromPath(path: string): string {
  const normalized = normalizeLibraryPath(path);
  const name = normalized.split(/[\\/]/).filter(Boolean).at(-1);
  return name || "写作库";
}

export function normalizeLibraryName(value: string, fallback = "写作库"): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

export function normalizeLibraryPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "/" || /^[A-Za-z]:[\\/]?$/.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, "");
}

export function isDesktopLibraryPath(value: string): boolean {
  return isAbsoluteLocalPath(value);
}

export function isAbsoluteLocalPath(value: string): boolean {
  const path = value.trim();
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function normalizeWritingLibraryRegistry(value: unknown, now: number): WritingLibraryRegistry {
  if (!value || typeof value !== "object") return emptyWritingLibraryRegistry();
  const candidate = value as Partial<WritingLibraryRegistry>;
  if (!Array.isArray(candidate.libraries)) return emptyWritingLibraryRegistry();
  const byPath = new Map<string, WritingLibrary>();
  for (const item of candidate.libraries) {
    if (!item || typeof item !== "object") continue;
    const library = item as Partial<WritingLibrary>;
    if (typeof library.path !== "string" || !library.path.trim()) continue;
    const normalized = createWritingLibrary(typeof library.name === "string" ? library.name : "", library.path, now);
    byPath.set(normalized.path, {
      ...normalized,
      id: typeof library.id === "string" && library.id ? library.id : normalized.id,
      createdAt: finiteTimestamp(library.createdAt, now),
      lastOpenedAt: finiteTimestamp(library.lastOpenedAt, now),
      lastProjectId: typeof library.lastProjectId === "string" ? library.lastProjectId : undefined,
      lastSheetId: typeof library.lastSheetId === "string" ? library.lastSheetId : undefined,
    });
  }
  const libraries = [...byPath.values()];
  const activeLibraryId =
    typeof candidate.activeLibraryId === "string" && libraries.some((library) => library.id === candidate.activeLibraryId)
      ? candidate.activeLibraryId
      : (libraries[0]?.id ?? "");
  return { version: 1, activeLibraryId, libraries };
}

function writingLibraryId(path: string): string {
  let hash = 0x811c9dc5;
  for (const character of path) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `library-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function finiteTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
