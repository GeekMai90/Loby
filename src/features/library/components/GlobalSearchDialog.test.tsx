// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchDialog } from "@/features/library/components/GlobalSearchDialog";
import { searchLibrary } from "@/features/library/model/persistence";
import type { WritingProject } from "@/shared/types";

vi.mock("@/features/library/model/persistence", () => ({
  searchLibrary: vi.fn(),
}));

const mockedSearchLibrary = vi.mocked(searchLibrary);

const sheet = {
  id: "sheet-search",
  title: "写作方法",
  tags: [],
  targetWords: 0,
  description: "",
  body: "正文里包含性能优化关键词。",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  properties: {},
};

const projects: WritingProject[] = [
  {
    id: "project-writing",
    title: "产品研发",
    status: "修改中",
    updatedAt: "2026-01-01T00:00:00.000Z",
    groups: [{ id: "group-default", title: "文章" }],
    sheets: [sheet],
  },
];

describe("GlobalSearchDialog", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mockedSearchLibrary.mockResolvedValue([{ sheetId: sheet.id, title: sheet.title, score: 1 }]);
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    root?.unmount();
    root = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderDialog(onOpenSheet = vi.fn(), dialogProjects = projects) {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(GlobalSearchDialog, {
          open: true,
          libraryPath: "/writing-library",
          projects: dialogProjects,
          onClose: vi.fn(),
          onOpenSheet,
        }),
      );
    });
    return onOpenSheet;
  }

  async function searchFor(query: string) {
    const input = document.querySelector<HTMLInputElement>("input[aria-label='搜索文稿标题和正文']");
    expect(input).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, query);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(60);
    });
  }

  it("searches full text and opens the selected article with normal Enter", async () => {
    const onOpenSheet = await renderDialog();
    await searchFor("性能优化");

    expect(mockedSearchLibrary).toHaveBeenCalledWith("/writing-library", "性能优化", 50);
    expect(document.body.textContent).toContain("写作方法");
    expect(document.body.textContent).toContain("正文里包含性能优化关键词");

    const input = document.querySelector<HTMLInputElement>("input[aria-label='搜索文稿标题和正文']")!;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onOpenSheet).toHaveBeenCalledWith(sheet.id, "all");
  });

  it("uses Command+Enter to request project navigation", async () => {
    const onOpenSheet = await renderDialog();
    await searchFor("关键词");

    const input = document.querySelector<HTMLInputElement>("input[aria-label='搜索文稿标题和正文']")!;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    });

    expect(onOpenSheet).toHaveBeenCalledWith(sheet.id, "project");
  });

  it("uses a normal click for all navigation and Command+click for project navigation", async () => {
    const onOpenSheet = await renderDialog();
    await searchFor("关键词");

    const result = document.querySelector<HTMLButtonElement>(`#global-search-result-${sheet.id}`)!;
    await act(async () => {
      result.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      result.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
    });

    expect(onOpenSheet).toHaveBeenNthCalledWith(1, sheet.id, "all");
    expect(onOpenSheet).toHaveBeenNthCalledWith(2, sheet.id, "project");
  });

  it("removes image destinations and highlights body matches in the snippet", async () => {
    const imageSheet = {
      ...sheet,
      body: "前文\n![测试图片](assets/images/preview.png)\n这是效果关键词正文。",
    };
    const imageProjects = [{ ...projects[0], sheets: [imageSheet] }];
    mockedSearchLibrary.mockResolvedValue([{ sheetId: imageSheet.id, title: imageSheet.title, score: 1 }]);

    await renderDialog(vi.fn(), imageProjects);
    await searchFor("效果");

    expect(document.body.textContent).not.toContain("assets/images/preview.png");
    expect(document.querySelector("mark")?.textContent).toBe("效果");
  });
});
