// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 DesignGallery
 * [OUTPUT]: 验证设计页同时陈列双主题 Token、圆角尺度、真实栏位组件、GitHub/墨问发布三状态、连续菜单、Toast 与动效控件
 * [POS]: design-gallery 的内容完整性回归测试，防止开发陈列面在重构时退化或漏项
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DesignGallery } from "@/features/design-gallery/components/DesignGallery";

describe("DesignGallery", () => {
  it("完整展示双主题、圆角尺度、真实导航样例和三种 Tabs 形态", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(DesignGallery, { onClose: vi.fn() }));
    });

    expect(container.textContent).toContain("24 个组件与基础规范");
    expect(container.querySelector("#colors-light")?.classList.contains("theme-scope-light")).toBe(true);
    expect(container.querySelector("#colors-dark")?.classList.contains("dark")).toBe(true);
    expect(container.querySelector("#colors-light")?.textContent).toContain("--status-success");
    expect(container.querySelector("#colors-dark")?.textContent).toContain("--status-warning");
    for (const token of [
      "--background",
      "--card",
      "--popover",
      "--muted",
      "--foreground",
      "--muted-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--accent",
      "--border",
      "--input",
      "--ring",
      "--separator",
      "--destructive",
      "--status-success",
      "--status-warning",
    ]) {
      expect(container.querySelectorAll(`[data-color-token="${token}"]`)).toHaveLength(2);
    }
    expect(container.textContent).toContain("13px · Base");
    expect(container.textContent).toContain("24px · Display");
    expect(container.textContent).toContain("导航项、正文、主要控件文字");
    expect(container.textContent).toContain("透明交互面");
    expect(container.querySelector('[data-surface="transparent"]')?.textContent).toContain("无背景");
    expect(container.textContent).toContain("14px 文字 · 16px 图标 · 32px 高 · 水平 8px · 图文 6px · 项间 4px · 10px 圆角");
    expect(container.querySelector("#radius-scale")?.textContent).toContain("--radius-4xl");
    expect(container.querySelector("#radius-scale")?.textContent).toContain("rounded-full");
    expect(container.textContent).toContain("基础 Dialog 表面");
    expect(container.querySelector("#github-publishing-states")?.textContent).toContain("GitHub Publish · GitHub 发布");
    expect(container.querySelector("#mowen-publishing-states")?.textContent).toContain("Mowen Publish · 墨问便签发布");
    expect(container.querySelectorAll("[data-publishing-state-grid]")).toHaveLength(2);
    for (const channel of ["github", "mowen"]) {
      expect(container.querySelector(`[data-publish-state='${channel}-ready']`)?.textContent).toContain("确认态");
      expect(container.querySelector(`[data-publish-state='${channel}-publishing']`)?.textContent).toContain("发布中");
      expect(container.querySelector(`[data-publish-state='${channel}-success']`)?.textContent).toContain("成功态");
    }
    expect(container.querySelector("[data-publish-state='github-publishing'] .publish-typewriter-loader")).not.toBeNull();
    expect(container.querySelector("[data-publish-state='mowen-publishing'] .publish-typewriter-loader")).not.toBeNull();
    expect(container.querySelector("[data-publish-state='github-ready'] h3")?.textContent).toBe("发布到麦先生说博客");
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).not.toContain("GitHub 发布当前文稿");
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).not.toContain("文章地址 ID");
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).not.toContain("blog.geekmailab.com/posts/");
    expect(container.querySelector("[data-publish-state='github-ready'] [role='tablist']")?.getAttribute("aria-label")).toBe(
      "GitHub 发布可见范围",
    );
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).toContain("所有人可查看");
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).toContain("发布");
    expect(container.querySelector("[data-publish-state='github-ready']")?.textContent).not.toContain("确认发布");
    expect(container.querySelector("[data-publish-state='github-publishing'] strong")).toBeNull();
    expect(container.querySelector("[data-publish-state='github-success'] strong")).toBeNull();
    expect(container.querySelector("[data-publish-state='github-success']")?.textContent).toContain("GitHub 提交 7f31c9a2");
    expect(container.querySelector("[data-publish-state='github-success']")?.textContent).toContain("复制链接");
    expect(container.querySelector("[data-publish-state='github-success']")?.textContent).toContain("完成");
    expect(container.querySelector("[data-publish-state='mowen-success']")?.textContent).toContain("已发布到墨问笔记");
    expect(container.querySelectorAll(".sheet-row")).toHaveLength(3);
    expect(container.querySelectorAll("#toast .app-toast-surface")).toHaveLength(4);
    expect(container.querySelector("#toast")?.textContent).toContain("保存成功");
    expect(container.querySelector("#toast")?.textContent).toContain("保存失败");
    expect(container.querySelector("#toast")?.textContent).toContain("存在未完成内容");
    expect(container.querySelector("#toast")?.textContent).toContain("已同步外部改动");
    expect(container.querySelector("#toast")?.textContent).toContain("触发真实 Toast");
    expect(container.querySelector("#tooltip")?.textContent).toContain("Tooltip · 工具提示");
    expect(container.querySelector("#context-menu")?.textContent).toContain("点击鼠标右键");
    expect(container.querySelector("#context-menu [data-slot='context-menu-trigger']")).not.toBeNull();
    expect(container.querySelector("#select")?.nextElementSibling).toBe(container.querySelector("#dropdown"));
    expect(container.querySelector("#dropdown")?.nextElementSibling).toBe(container.querySelector("#context-menu"));
    expect(container.querySelector("#button")?.textContent).toContain("Button · 按钮");
    expect(container.querySelector("#select")?.textContent).toContain("Select · 选择菜单");
    expect(container.querySelector<HTMLElement>("#gallery-format-select")?.dataset.width).toBe("default");
    expect(container.querySelector<HTMLElement>("#gallery-format-select")?.className).toContain("w-44");

    const tabLists = Array.from(container.querySelectorAll('[role="tablist"]')).map((node) => node.getAttribute("aria-label"));
    expect(tabLists).toContain("文稿功能");
    expect(tabLists).toContain("文稿信息分类");
    expect(tabLists).toContain("Animate UI 标签页示例");
    expect(container.querySelector("#animate-tabs")?.textContent).toContain("专注写作");

    await act(async () => root.unmount());
  });
});
