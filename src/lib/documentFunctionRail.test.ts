import { describe, expect, it } from "vitest";
import { buildSearchResults, positionFromLine } from "./documentFunctionRail";

describe("documentFunctionRail", () => {
  it("builds line-aware search results with absolute positions", () => {
    const body = "第一段有我\n第二段没有\n第三段也有我";

    expect(buildSearchResults(body, "我")).toMatchObject([
      { index: 4, line: 1, match: "我" },
      { index: 17, line: 3, match: "我" },
    ]);
  });

  it("returns no search results for an empty query", () => {
    expect(buildSearchResults("正文", "")).toEqual([]);
  });

  it("resolves line starts without moving past the document end", () => {
    const body = "第一行\n第二行\n第三行";

    expect(positionFromLine(body, 1)).toBe(0);
    expect(positionFromLine(body, 2)).toBe(4);
    expect(positionFromLine(body, 99)).toBe(body.length);
  });
});
