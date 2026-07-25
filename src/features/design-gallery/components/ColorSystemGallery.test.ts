// @vitest-environment happy-dom
/// <reference types="node" />

/**
 * [INPUT]: 依赖 React DOM、Vitest、ColorSystemGallery 与真实样式源码
 * [OUTPUT]: 验证颜色系统独立展示亮暗基础色、语义映射、材质、源码裸色与收敛审计
 * [POS]: design-gallery 的颜色页完整性回归测试，保护从组件设计系统拆出的颜色治理边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ColorSystemGallery } from "@/features/design-gallery/components/ColorSystemGallery";
import { RAW_COLOR_RECORDS, SEMANTIC_COLOR_TOKENS, UNRESOLVED_RAW_COLORS } from "@/features/design-gallery/colorAudit";

vi.mock("@/styles/index.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  return { default: readFileSync(join(process.cwd(), "src/styles/index.css"), "utf8") };
});

vi.mock("@/styles/shadcn.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  return { default: readFileSync(join(process.cwd(), "src/styles/shadcn.css"), "utf8") };
});

describe("ColorSystemGallery", () => {
  it("独立展示完整的亮暗颜色治理内容", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ColorSystemGallery, { onClose: vi.fn() }));
    });

    expect(container.textContent).toContain("颜色系统");
    expect(container.textContent).toContain("Light / Dark 色板、语义与源码审计");
    for (const label of ["主背景", "柔和背景", "次级背景", "悬停背景", "普通边框", "强边框", "主文字", "次级文字"]) {
      expect(container.querySelector("#foundation-colors-light")?.textContent).toContain(label);
      expect(container.querySelector("#foundation-colors-dark")?.textContent).toContain(label);
    }
    expect(container.querySelector("#foundation-colors-dark")?.classList.contains("dark")).toBe(true);
    expect(container.querySelector("#colors-light")?.classList.contains("theme-scope-light")).toBe(true);
    expect(container.querySelector("#effects-light")?.textContent).toContain("现有阴影与材质");
    expect(SEMANTIC_COLOR_TOKENS.length).toBeGreaterThan(80);
    expect(SEMANTIC_COLOR_TOKENS.some(({ token }) => token.includes("surface"))).toBe(false);
    expect(UNRESOLVED_RAW_COLORS).toHaveLength(0);
    expect(
      RAW_COLOR_RECORDS.some((record) => record.locations.some((location) => location.path.includes("publishing/model/wechatThemes.ts"))),
    ).toBe(true);
    expect(container.querySelectorAll("[data-color-token]").length).toBe(SEMANTIC_COLOR_TOKENS.length);
    expect(container.querySelector("#color-audit-summary")?.textContent).toContain("未语义化 UI 裸色");
    expect(container.querySelector("#color-audit-summary")?.textContent).toContain("当前已清零");
    expect(container.querySelector("#color-audit-summary")?.textContent).toContain("未使用 Token");
    expect(container.querySelector("#color-audit-summary")?.textContent).toContain("近似色候选");
    expect(container.querySelector("#hardcoded-colors")?.textContent).toContain("普通应用 UI 裸色已清零");
    expect(container.querySelector("#hardcoded-colors")?.textContent).toContain("src/features/publishing/model/wechatThemes.ts");
    expect(container.querySelector("#colors-light")?.textContent).toContain("--status-success");
    expect(container.querySelector("#colors-light")?.textContent).toContain("--status-warning");
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
      "--interactive-hover",
      "--dialog-shadow",
      "--menu-hover",
      "--brand-wordpress",
      "--publishing-preview-background",
      "--publish-loader-primary",
    ]) {
      expect(container.querySelectorAll(`[data-color-token="${token}"]`)).toHaveLength(1);
    }
    expect(container.querySelector('[data-color-token="--assistant-launcher-fluid-bg"]')).toBeNull();
    expect(container.querySelector('[data-color-token="--sidebar-glass-material-background"]')).toBeNull();
    expect(container.querySelector("#color-audit-summary")?.textContent).toContain("特殊视觉 Token");
    expect(container.querySelector('[data-color-token="--brand-wordpress"]')?.textContent).toContain("DirectPublishDialog.tsx");

    await act(async () => root.unmount());
  });
});
