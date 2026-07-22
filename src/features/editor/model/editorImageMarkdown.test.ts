import { describe, expect, it } from "vitest";
import { parseImageLine, rewriteImageLineSize } from "@/features/editor/model/editorImageMarkdown";

describe("editor image markdown helpers", () => {
  it("parses markdown image references with loby size metadata", () => {
    expect(parseImageLine('![封面](assets/images/cover.png "loby-size=small")')).toEqual({
      alt: "封面",
      path: "assets/images/cover.png",
      raw: '![封面](assets/images/cover.png "loby-size=small")',
      size: "small",
    });
  });

  it("parses markdown image paths wrapped in angle brackets", () => {
    expect(parseImageLine('![Alt](<assets/images/my cover.png> "loby-size=thumbnail")')).toMatchObject({
      alt: "Alt",
      path: "assets/images/my cover.png",
      size: "thumbnail",
    });
  });

  it("parses obsidian image references", () => {
    expect(parseImageLine("![[assets/images/cover.png|封面|medium]]")).toEqual({
      alt: "封面",
      path: "assets/images/cover.png",
      raw: "![[assets/images/cover.png|封面|medium]]",
      size: "medium",
    });
  });

  it("rewrites markdown image size while preserving alt text and quoting paths with spaces", () => {
    expect(rewriteImageLineSize("![封面](assets/images/my cover.png)", "large")).toBe(
      '![封面](<assets/images/my cover.png> "loby-size=large")',
    );
  });

  it("rewrites obsidian image size", () => {
    expect(rewriteImageLineSize("![[assets/images/cover.png|封面|small]]", "thumbnail")).toBe(
      "![[assets/images/cover.png|封面|thumbnail]]",
    );
  });

  it("ignores non-image lines", () => {
    expect(parseImageLine("普通段落")).toBeNull();
    expect(rewriteImageLineSize("普通段落", "small")).toBe("普通段落");
  });
});
