import { describe, expect, it } from "vitest";
import { hasProjectResourceChanges, isProjectResourcePath, libraryIndexChangePaths } from "./libraryFileChanges";

describe("libraryFileChanges", () => {
  it("classifies files in project resource directories", () => {
    expect(isProjectResourcePath("/Library/projects/Article/assets/images/pasted.png")).toBe(true);
    expect(isProjectResourcePath("/Library/projects/Article/references/source.pdf")).toBe(true);
    expect(isProjectResourcePath("C:\\Library\\projects\\Article\\exports\\article.html")).toBe(true);
  });

  it("keeps Markdown and project metadata changes in the library index refresh", () => {
    const paths = [
      "/Library/projects/Article/assets/images/pasted.png",
      "/Library/projects/Article/draft.md",
      "/Library/projects/Article/project.toml",
      "/Library/notes/inbox.md",
    ];

    expect(libraryIndexChangePaths(paths)).toEqual([
      "/Library/projects/Article/draft.md",
      "/Library/projects/Article/project.toml",
      "/Library/notes/inbox.md",
    ]);
    expect(hasProjectResourceChanges(paths)).toBe(true);
  });

  it("does not treat a similarly named project or sheet as a resource directory", () => {
    expect(isProjectResourcePath("/Library/projects/assets/draft.md")).toBe(false);
    expect(isProjectResourcePath("/Library/notes/assets.md")).toBe(false);
  });
});
