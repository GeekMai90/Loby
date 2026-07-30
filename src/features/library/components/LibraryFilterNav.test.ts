// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 LibraryFilterNav
 * [OUTPUT]: 验证收藏紧随收件箱、开发态工具连续位于废纸篓之后，并与普通筛选互斥切换
 * [POS]: library 一级导航顺序、收藏入口与开发入口的选择态回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { LibraryFilterNav } from "@/features/library/components/LibraryFilterNav";

describe("LibraryFilterNav", () => {
  it("在废纸篓下方展示两个开发工具页，并在选择普通筛选时退出", async () => {
    const onProjectFilterChange = vi.fn();
    const onDeveloperGalleryPageChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(LibraryFilterNav, {
          active: true,
          projectFilter: "trash",
          activeNoteGroupId: "",
          developerGalleryPage: null,
          onProjectFilterChange,
          onDeveloperGalleryPageChange,
        }),
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent)).toEqual([
      "全部",
      "收件箱",
      "收藏",
      "最近 7 天",
      "已归档",
      "废纸篓",
      "设计系统",
      "颜色系统",
    ]);

    await act(async () => buttons[2]?.click());
    expect(onProjectFilterChange).toHaveBeenLastCalledWith("favorites");

    await act(async () => buttons.at(-2)?.click());
    expect(onDeveloperGalleryPageChange).toHaveBeenLastCalledWith("design-system");

    await act(async () => buttons.at(-1)?.click());
    expect(onDeveloperGalleryPageChange).toHaveBeenLastCalledWith("color-system");

    await act(async () => buttons[0]?.click());
    expect(onDeveloperGalleryPageChange).toHaveBeenLastCalledWith(null);
    expect(onProjectFilterChange).toHaveBeenCalledWith("active");

    await act(async () => root.unmount());
  });
});
