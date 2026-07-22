// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 DesignGallery
 * [OUTPUT]: 验证设计页同时陈列双主题 Token、圆角尺度、真实栏位组件、Dialog 与两类功能切换器
 * [POS]: design-gallery 的内容完整性回归测试，防止开发陈列面在重构时退化或漏项
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DesignGallery } from "@/features/design-gallery/components/DesignGallery";

describe("DesignGallery", () => {
  it("完整展示双主题、圆角尺度、真实导航样例和两类功能切换器", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(DesignGallery, { onClose: vi.fn() }));
    });

    expect(container.textContent).toContain("19 个组件与基础规范");
    expect(container.querySelector("#colors-light")?.classList.contains("theme-scope-light")).toBe(true);
    expect(container.querySelector("#colors-dark")?.classList.contains("dark")).toBe(true);
    expect(container.querySelector("#colors-light")?.textContent).toContain("--status-success");
    expect(container.querySelector("#colors-dark")?.textContent).toContain("--status-warning");
    expect(container.textContent).toContain("13px · Base");
    expect(container.textContent).toContain("24px · Display");
    expect(container.querySelector("#radius-scale")?.textContent).toContain("--radius-4xl");
    expect(container.querySelector("#radius-scale")?.textContent).toContain("rounded-full");
    expect(container.textContent).toContain("基础 Dialog 表面");
    expect(container.querySelectorAll(".sheet-row")).toHaveLength(3);

    const tabLists = Array.from(container.querySelectorAll('[role="tablist"]')).map((node) => node.getAttribute("aria-label"));
    expect(tabLists).toContain("文稿功能");
    expect(tabLists).toContain("文稿信息分类");

    await act(async () => root.unmount());
  });
});
