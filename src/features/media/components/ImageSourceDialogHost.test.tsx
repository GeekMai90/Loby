// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 ImageSourceDialogHost
 * [OUTPUT]: 验证图片来源 surface 只在打开时加载，并保留当前文稿上下文
 * [POS]: media image source host 的聚焦回归测试，保护 lazy 迁移不改变图片入口契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { ImageSourceDialogHost, type ImageSourceDialogHostProps } from "@/features/media/components/ImageSourceDialogHost";

vi.mock("@/features/media/components/ImageSourceDialog", () => ({
  ImageSourceDialog: ({ sheet }: { sheet: WritingSheet }) => createElement("div", { "data-testid": "image-source-dialog" }, sheet.title),
}));

const sheet: WritingSheet = {
  id: "sheet-image-source",
  title: "图片文稿",
  tags: [],
  targetWords: 0,
  description: "",
  body: "正文",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  properties: {},
};

function createProps(overrides: Partial<ImageSourceDialogHostProps> = {}): ImageSourceDialogHostProps {
  return {
    open: true,
    sheet,
    onOpenChange: vi.fn(),
    onInsertLocal: vi.fn(),
    onInsertUnsplash: vi.fn(),
    aiRecommendationEnabled: false,
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

describe("ImageSourceDialogHost", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderHost(props: ImageSourceDialogHostProps) {
    await act(async () => {
      root.render(createElement(ImageSourceDialogHost, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("does not mount the image surface while closed", async () => {
    await renderHost(createProps({ open: false }));
    expect(document.body.querySelector('[data-testid="image-source-dialog"]')).toBeNull();
  });

  it("passes the active sheet to the lazy surface", async () => {
    await renderHost(createProps());
    expect(document.body.querySelector('[data-testid="image-source-dialog"]')?.textContent).toBe("图片文稿");
  });
});
