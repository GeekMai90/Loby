import { describe, expect, it } from "vitest";
import { formatLibraryParentPath } from "./libraryDisplayPath";

describe("formatLibraryParentPath", () => {
  it("humanizes the default macOS Documents location", () => {
    expect(formatLibraryParentPath("/Users/writer/Documents/LobyLibrary")).toBe("文稿 / LobyLibrary");
  });

  it("humanizes Windows Documents paths", () => {
    expect(formatLibraryParentPath("C:\\Users\\writer\\Documents\\LobyLibrary")).toBe("文稿 / LobyLibrary");
  });

  it("keeps custom locations concise", () => {
    expect(formatLibraryParentPath("/Volumes/Writing/Projects")).toBe("… / Writing / Projects");
  });

  it("uses a friendly browser fallback", () => {
    expect(formatLibraryParentPath("Browser Storage")).toBe("浏览器存储");
  });

  it("shows loading copy before the default path is ready", () => {
    expect(formatLibraryParentPath(" ")).toBe("正在读取默认目录…");
  });
});
