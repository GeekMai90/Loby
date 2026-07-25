// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownImportDialog } from "@/features/library/components/MarkdownImportDialog";
import type { MarkdownImportController } from "@/features/library/hooks/useMarkdownImport";
import { createDefaultInboxProject } from "@/features/library/model/projectModel";

describe("MarkdownImportDialog", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("shows detected Obsidian sources, attachment health, and metadata decisions", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(MarkdownImportDialog, { controller: readyController() })));

    expect(document.body.textContent).toContain("已识别为 Obsidian Vault");
    expect(document.body.textContent).toContain("83");
    expect(document.body.textContent).toContain("160");
    expect(document.body.textContent).toContain("已自动找到：/vault/attachments");
    expect(document.body.textContent).toContain("date");
    expect(document.body.textContent).toContain("hero_title");
    expect(document.body.textContent).toContain("收件箱会递归导入全部文稿，但不创建文件夹分组");

    await act(async () => root.unmount());
  });

  it("offers a supplemental attachment picker without blocking document import", async () => {
    const chooseAttachmentFolder = vi.fn().mockResolvedValue(undefined);
    const controller = readyController();
    controller.chooseAttachmentFolder = chooseAttachmentFolder;
    controller.scan = { ...controller.scan!, attachmentRoot: "", resolvedImageCount: 150, missingImageCount: 10 };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(MarkdownImportDialog, { controller })));
    const button = Array.from(document.body.querySelectorAll("button")).find((item) => item.textContent?.includes("选择附件目录"));
    expect(button).toBeDefined();
    await act(async () => button?.click());

    expect(chooseAttachmentFolder).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("10 张图片未找到");
    expect(document.body.textContent).toContain("继续导入会保留原引用");

    await act(async () => root.unmount());
  });
});

function readyController(): MarkdownImportController {
  const inbox = createDefaultInboxProject();
  return {
    open: true,
    busy: false,
    phase: "ready",
    targetProjectId: inbox.id,
    targetProjects: [inbox],
    scan: {
      sourcePaths: ["/vault/articles"],
      sourceType: "obsidian",
      vaultRoot: "/vault",
      attachmentRoot: "/vault/attachments",
      documents: Array.from({ length: 83 }, (_, index) => ({
        name: `文章 ${index + 1}.md`,
        path: `/vault/articles/文章 ${index + 1}.md`,
        relativePath: `文章 ${index + 1}.md`,
        body: `# 文章 ${index + 1}`,
        metadata: {},
        sizeBytes: 100,
        imageReferences: [],
      })),
      skippedFileCount: 1,
      resolvedImageCount: 160,
      externalImageCount: 2,
      missingImageCount: 0,
      ambiguousImageCount: 0,
      warnings: [],
    },
    result: null,
    error: "",
    metadataSummary: { preservedKeys: ["date", "title", "tags"], droppedKeys: ["hero_title", "source"] },
    openImport: vi.fn(),
    closeImport: vi.fn(),
    resetSource: vi.fn(),
    setTargetProjectId: vi.fn(),
    selectFiles: vi.fn().mockResolvedValue(undefined),
    selectFolder: vi.fn().mockResolvedValue(undefined),
    chooseAttachmentFolder: vi.fn().mockResolvedValue(undefined),
    confirmImport: vi.fn().mockResolvedValue(undefined),
  };
}
