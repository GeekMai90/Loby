/**
 * [INPUT]: 依赖 React DOM、Vitest、useMarkdownImport 与 mocked native 导入适配
 * [OUTPUT]: 验证导入协调器在重新扫描、图片传输和显式保存成功后才提交 renderer 状态
 * [POS]: 写作库导入的 React 集成回归测试，保护预览到提交之间的持久化时序
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import { useMarkdownImport, type MarkdownImportController } from "@/features/library/hooks/useMarkdownImport";
import { createDefaultInboxProject } from "@/features/library/model/projectModel";

const nativeMocks = vi.hoisted(() => ({
  chooseMarkdownImportFiles: vi.fn(),
  chooseMarkdownImportFolder: vi.fn(),
  scanMarkdownImport: vi.fn(),
  importMarkdownImages: vi.fn(),
}));

vi.mock("@/features/library/model/persistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/library/model/persistence")>()),
  ...nativeMocks,
}));

describe("useMarkdownImport", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("revalidates the source and persists before exposing imported projects", async () => {
    const inbox = createDefaultInboxProject();
    const scan = sampleScan();
    const events: string[] = [];
    nativeMocks.chooseMarkdownImportFiles.mockResolvedValue(["/vault/文章.md"]);
    nativeMocks.scanMarkdownImport.mockResolvedValue(scan);
    nativeMocks.importMarkdownImages.mockResolvedValue([
      { sourcePath: "/vault/attachments/封面.png", destinationPath: "/library/assets/images/封面.png" },
    ]);
    const persistProjectsImmediately = vi.fn(async () => {
      events.push("persist");
    });
    const onProjectsChange = vi.fn(() => events.push("state"));
    const onSkipNextLibrarySave = vi.fn(() => events.push("skip"));
    let controller!: MarkdownImportController;

    await act(async () => {
      root.render(
        createElement(Harness, {
          projects: [inbox],
          onController: (value) => {
            controller = value;
          },
          onProjectsChange,
          onSkipNextLibrarySave,
          persistProjectsImmediately,
        }),
      );
    });
    await act(async () => controller.openImport());
    await act(async () => controller.selectFiles());
    expect(controller.phase).toBe("ready");

    await act(async () => controller.confirmImport());

    expect(nativeMocks.scanMarkdownImport).toHaveBeenCalledTimes(2);
    expect(nativeMocks.importMarkdownImages).toHaveBeenCalledWith("/library", ["/vault/attachments/封面.png"]);
    expect(persistProjectsImmediately).toHaveBeenCalledOnce();
    expect(onProjectsChange).toHaveBeenCalledOnce();
    expect(events).toEqual(["persist", "skip", "state"]);
    expect(controller.phase).toBe("finished");
    expect(controller.result?.importedSheets).toHaveLength(1);
    expect(controller.result?.importedSheets[0]?.body).toContain("../assets/images/封面.png");
  });
});

function Harness({
  projects,
  onController,
  onProjectsChange,
  onSkipNextLibrarySave,
  persistProjectsImmediately,
}: {
  projects: WritingProject[];
  onController: (controller: MarkdownImportController) => void;
  onProjectsChange: (projects: WritingProject[]) => void;
  onSkipNextLibrarySave: () => void;
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
}) {
  const controller = useMarkdownImport({
    libraryPath: "/library",
    projects,
    onProjectsChange,
    onSkipNextLibrarySave,
    persistProjectsImmediately,
    onActiveProjectChange: vi.fn(),
    onActiveGroupChange: vi.fn(),
    onActiveSheetChange: vi.fn(),
    onLibraryStatusChange: vi.fn(),
  });
  onController(controller);
  return null;
}

function sampleScan() {
  return {
    sourcePaths: ["/vault/文章.md"],
    sourceType: "obsidian" as const,
    vaultRoot: "/vault",
    attachmentRoot: "/vault/attachments",
    documents: [
      {
        name: "文章.md",
        path: "/vault/文章.md",
        relativePath: "文章.md",
        body: "# 文章\n\n![[封面.png]]",
        metadata: {},
        sizeBytes: 100,
        imageReferences: [
          {
            target: "封面.png",
            format: "obsidian" as const,
            status: "resolved" as const,
            sourcePath: "/vault/attachments/封面.png",
            candidatePaths: [],
          },
        ],
      },
    ],
    skippedFileCount: 0,
    resolvedImageCount: 1,
    externalImageCount: 0,
    missingImageCount: 0,
    ambiguousImageCount: 0,
    warnings: [],
  };
}
