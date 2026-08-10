/**
 * [INPUT]: 依赖 Vitest、Tauri asset URL mock 与 documentFunctionRail 的搜索、图片解析、替换和行定位纯函数
 * [OUTPUT]: 验证搜索坐标、最新正文替换和行号定位不会因延迟列表快照丢失用户输入
 * [POS]: 编辑器文稿功能栏领域回归，锁定查找展示可延迟但替换执行必须重新解析实时正文的边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentImageItems,
  buildSearchResults,
  positionFromLine,
  replaceAllDocumentSearchMatches,
  replaceDocumentSearchMatch,
} from "@/features/editor/model/documentFunctionRail";
import type { WritingProject, WritingSheet } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

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

  it("resolves document images from a Windows writing library", () => {
    const project: WritingProject = {
      id: "project-1",
      title: "项目",
      status: "构思",
      groups: [{ id: "group-main", title: "正文", icon: "article", iconColor: "#007aff", description: "" }],
      sheets: [],
      updatedAt: "2026-08-01",
    };
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "第一篇",
      groupId: "group-main",
      tags: [],
      targetWords: 1000,
      description: "",
      body: "![封面](../../../assets/images/cover.png)",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
      properties: {},
    };

    expect(buildDocumentImageItems("C:\\Users\\Mai\\Loby", project, sheet)[0]?.src).toBe("asset:C:/Users/Mai/Loby/assets/images/cover.png");
  });

  it("re-resolves a stale search position against the latest body without dropping new text", () => {
    const latestBody = "刚写的新开头\n旧目标仍在这里";

    expect(replaceDocumentSearchMatch(latestBody, "目标", "结果", 1)).toBe("刚写的新开头\n旧结果仍在这里");
    expect(replaceAllDocumentSearchMatches(`${latestBody}\n目标二`, "目标", "结果")).toBe("刚写的新开头\n旧结果仍在这里\n结果二");
  });
});
