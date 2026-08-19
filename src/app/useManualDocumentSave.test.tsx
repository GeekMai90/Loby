// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、主动保存 hook，以及格式化/Toast 测试替身
 * [OUTPUT]: 验证保存基线、格式化版本写回、并发门禁、失败反馈与失败后的再次保存
 * [POS]: app 主动保存协调边界的聚焦回归测试，保护 App 拆分后的正文权威、持久化顺序和反馈语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useManualDocumentSave } from "@/app/useManualDocumentSave";
import { DEFAULT_MARKDOWN_FORMATTING_SETTINGS } from "@/features/editor/model/markdownFormattingSettings";
import type { WritingProject, WritingSheet } from "@/shared/types";

const { formatMarkdownDocumentMock, showAppToastMock } = vi.hoisted(() => ({
  formatMarkdownDocumentMock: vi.fn((body: string) => body),
  showAppToastMock: vi.fn(),
}));

vi.mock("@/features/editor/model/markdownFormatting", () => ({
  formatMarkdownDocument: formatMarkdownDocumentMock,
}));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: showAppToastMock }));

const sheet: WritingSheet = {
  id: "sheet-manual-save",
  title: "已保存标题",
  body: "# 已保存标题\n\n已保存正文",
  tags: [],
  targetWords: 0,
  description: "",
  properties: {},
  createdAt: "2026-01-01 10:00:00",
  updatedAt: "2026-01-01 10:00:00",
};

const project: WritingProject = {
  id: "project-manual-save",
  title: "主动保存测试",
  status: "初稿",
  sheets: [sheet],
  updatedAt: "2026-01-01",
};

type SaveOptions = Parameters<typeof useManualDocumentSave>[0];

function ManualSaveHarness(props: SaveOptions) {
  const { saveActiveDocument } = useManualDocumentSave(props);
  return createElement("button", { type: "button", onClick: () => void saveActiveDocument() }, "保存");
}

describe("useManualDocumentSave", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    formatMarkdownDocumentMock.mockReset().mockImplementation((body: string) => body);
    showAppToastMock.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function createOptions(overrides: Partial<SaveOptions> = {}): SaveOptions {
    return {
      persistenceReady: true,
      libraryPath: "/tmp/loby-library",
      projects: [project],
      project,
      sheet,
      blocked: false,
      markdownFormatting: { ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS, formatOnSave: false },
      materializeLatestSheet: vi.fn(() => sheet),
      onProjectsChange: vi.fn(),
      flushPendingSave: vi.fn(async () => undefined),
      persistDocumentImmediately: vi.fn(async () => undefined),
      onLibraryStatusChange: vi.fn(),
      ...overrides,
    };
  }

  async function renderSave(options: SaveOptions) {
    await act(async () => root.render(createElement(ManualSaveHarness, options)));
  }

  async function clickSave() {
    await act(async () => {
      container.querySelector("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("flushes pending writes without creating a duplicate version when the baseline is unchanged", async () => {
    const options = createOptions();
    await renderSave(options);
    await clickSave();

    expect(options.materializeLatestSheet).toHaveBeenCalledWith(sheet);
    expect(options.flushPendingSave).toHaveBeenCalledOnce();
    expect(options.persistDocumentImmediately).not.toHaveBeenCalled();
    expect(options.onProjectsChange).not.toHaveBeenCalled();
    expect(options.onLibraryStatusChange).toHaveBeenCalledWith("当前文稿没有需要保存的修改");
    expect(showAppToastMock).toHaveBeenCalledWith({
      variant: "info",
      title: "无需保存",
      description: "当前文稿没有修改",
      id: "manual-document-save",
    });
  });

  it("formats the live body, creates a manual version, updates the project, then persists immediately", async () => {
    const liveSheet = { ...sheet, body: "# 新标题\n\n中文Markdown,正文!" };
    const formattedBody = "# 新标题\n\n中文 Markdown，正文！\n";
    formatMarkdownDocumentMock.mockReturnValue(formattedBody);
    const options = createOptions({
      markdownFormatting: { ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS, formatOnSave: true },
      materializeLatestSheet: vi.fn(() => liveSheet),
    });
    await renderSave(options);
    await clickSave();

    expect(formatMarkdownDocumentMock).toHaveBeenCalledWith(liveSheet.body, options.markdownFormatting);
    const nextProjects = vi.mocked(options.onProjectsChange).mock.calls[0]?.[0];
    const savedSheet = nextProjects?.[0].sheets[0];
    expect(savedSheet).toMatchObject({ title: "新标题", body: formattedBody });
    expect(savedSheet?.versions?.[0]).toMatchObject({
      body: formattedBody,
      source: "manual",
      reason: "手动保存",
    });
    expect(options.persistDocumentImmediately).toHaveBeenCalledWith(project, savedSheet, nextProjects);
    expect(options.onLibraryStatusChange).toHaveBeenCalledWith("已优化中文排版、保存文稿并生成历史版本");
    expect(showAppToastMock).toHaveBeenLastCalledWith({
      variant: "success",
      title: "排版并保存完成",
      description: "已优化中文排版并生成历史版本",
      id: "manual-document-save",
    });
  });

  it("ignores a second save while immediate persistence is still in flight", async () => {
    let finishPersistence: (() => void) | undefined;
    const persistence = new Promise<void>((resolve) => {
      finishPersistence = resolve;
    });
    const persistDocumentImmediately = vi.fn(() => persistence);
    const options = createOptions({
      materializeLatestSheet: vi.fn(() => ({ ...sheet, body: `${sheet.body}\n新增内容` })),
      persistDocumentImmediately,
    });
    await renderSave(options);

    await act(async () => {
      container.querySelector("button")?.click();
      container.querySelector("button")?.click();
      await Promise.resolve();
    });

    expect(persistDocumentImmediately).toHaveBeenCalledOnce();
    await act(async () => {
      finishPersistence?.();
      await persistence;
    });
  });

  it("reports persistence failures and releases the gate so the user can retry", async () => {
    const persistDocumentImmediately = vi
      .fn<SaveOptions["persistDocumentImmediately"]>()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce(undefined);
    const options = createOptions({
      materializeLatestSheet: vi.fn(() => ({ ...sheet, body: `${sheet.body}\n新增内容` })),
      persistDocumentImmediately,
    });
    await renderSave(options);
    await clickSave();

    expect(options.onLibraryStatusChange).toHaveBeenCalledWith("当前文稿保存失败");
    expect(showAppToastMock).toHaveBeenLastCalledWith({
      variant: "error",
      title: "保存失败",
      description: "请稍后重试",
      id: "manual-document-save",
    });

    await clickSave();
    expect(persistDocumentImmediately).toHaveBeenCalledTimes(2);
    expect(showAppToastMock).toHaveBeenLastCalledWith({
      variant: "success",
      title: "保存完成",
      description: "已生成历史版本",
      id: "manual-document-save",
    });
  });
});
