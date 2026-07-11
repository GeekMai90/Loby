import { describe, expect, it } from "vitest";
import {
  activeWritingLibrary,
  createWritingLibrary,
  emptyWritingLibraryRegistry,
  loadWritingLibraryRegistry,
  registerWritingLibrary,
  removeWritingLibrary,
  updateWritingLibrary,
} from "./libraryRegistry";

describe("writing library registry", () => {
  it("migrates the previous single-library path", () => {
    const registry = loadWritingLibraryRegistry("/Users/test/Documents/NibvaLibrary", 100);
    expect(registry.libraries).toHaveLength(1);
    expect(registry.libraries[0]).toMatchObject({ name: "NibvaLibrary", path: "/Users/test/Documents/NibvaLibrary" });
    expect(activeWritingLibrary(registry)?.id).toBe(registry.activeLibraryId);
  });

  it("registers paths once and updates their display names", () => {
    const first = registerWritingLibrary(emptyWritingLibraryRegistry(), { name: "工作", path: "/tmp/work/" }, 100);
    const second = registerWritingLibrary(first, { name: "工作写作库", path: "/tmp/work" }, 200);
    expect(second.libraries).toHaveLength(1);
    expect(second.libraries[0]).toMatchObject({ name: "工作写作库", path: "/tmp/work", createdAt: 100, lastOpenedAt: 200 });
  });

  it("keeps per-library selection and removes only registry entries", () => {
    const work = createWritingLibrary("工作", "/tmp/work", 100);
    const personal = createWritingLibrary("个人", "/tmp/personal", 100);
    const registry = updateWritingLibrary({ version: 1, activeLibraryId: work.id, libraries: [work, personal] }, work.id, {
      lastProjectId: "project-1",
      lastSheetId: "sheet-1",
    });
    const removed = removeWritingLibrary(registry, personal.id);
    expect(removed.libraries).toHaveLength(1);
    expect(removed.libraries[0]).toMatchObject({ lastProjectId: "project-1", lastSheetId: "sheet-1" });
  });
});
