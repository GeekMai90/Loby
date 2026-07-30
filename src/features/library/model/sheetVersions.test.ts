import { describe, expect, it } from "vitest";
import {
  createManualSaveVersion,
  createSheetVersionSnapshot,
  manualSaveNeedsVersion,
  resolveManualSaveBaseline,
  restoreSheetVersion,
} from "@/features/library/model/sheetVersions";
import type { SheetVersion, WritingSheet } from "@/shared/types";

describe("sheetVersions", () => {
  it("creates readable snapshots with source labels and word counts", () => {
    const snapshot = createSheetVersionSnapshot(sheet({ title: "第一章", body: "hello world" }), "ai", "AI 修改前");

    expect(snapshot.id).toMatch(/^version-/);
    expect(snapshot.title).toContain("第一章");
    expect(snapshot.title).toContain("AI 修改前");
    expect(snapshot.body).toBe("hello world");
    expect(snapshot.wordCount).toBe(2);
    expect(snapshot.source).toBe("ai");
    expect(snapshot.reason).toBe("AI 修改前");
  });

  it("backs up the current body before restoring a historical version", () => {
    const existingVersion = version({ id: "version-existing", body: "更早的正文" });
    const currentSheet = sheet({
      title: "当前标题",
      body: "# 当前版本\n\n当前正文",
      versions: [existingVersion],
    });
    const targetVersion = version({
      id: "version-target",
      title: "目标快照",
      body: "# 历史标题\n\n历史正文",
    });

    const restored = restoreSheetVersion(currentSheet, targetVersion);

    expect(restored.body).toBe(targetVersion.body);
    expect(restored.title).toBe("历史标题");
    expect(restored.versions).toHaveLength(2);
    expect(restored.versions?.[0]).toMatchObject({
      body: currentSheet.body,
      source: "restore",
      reason: "恢复前自动备份当前版本",
    });
    expect(restored.versions?.[1]).toBe(existingVersion);
  });

  it("records the current saved body and reuses it as the next manual dirty baseline", () => {
    const saved = createManualSaveVersion(sheet({ title: "旧标题", body: "旧正文" }), "# 新标题\n\n新正文", "2026-07-29T16:00:00.000Z");

    expect(saved.title).toBe("新标题");
    expect(saved.body).toBe("# 新标题\n\n新正文");
    expect(saved.updatedAt).toBe("2026-07-29T16:00:00.000Z");
    expect(saved.versions?.[0]).toMatchObject({
      body: "# 新标题\n\n新正文",
      source: "manual",
      reason: "手动保存",
    });
    expect(resolveManualSaveBaseline(saved)).toBe("# 新标题\n\n新正文");
  });

  it("uses the loaded body as the baseline before the first manual save", () => {
    expect(resolveManualSaveBaseline(sheet({ body: "当前磁盘正文" }))).toBe("当前磁盘正文");
  });

  it("creates a version when formatting changes an otherwise unmodified body", () => {
    expect(manualSaveNeedsVersion("中文Markdown,正文!", "中文Markdown,正文!", "中文 Markdown，正文！")).toBe(true);
  });

  it("skips a version only when neither editing nor formatting changes the body", () => {
    expect(manualSaveNeedsVersion("已排版正文", "已排版正文", "已排版正文")).toBe(false);
  });
});

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    tags: [],
    targetWords: 1000,
    description: "",
    body: "",
    createdAt: "2026-07-09T10:00:00+08:00",
    updatedAt: "2026-07-09T10:00:00+08:00",
    properties: {},
    ...overrides,
  };
}

function version(overrides: Partial<SheetVersion> = {}): SheetVersion {
  return {
    id: "version-1",
    title: "历史版本",
    body: "历史正文",
    createdAt: "2026-07-09T10:00:00+08:00",
    wordCount: 4,
    source: "manual",
    reason: "手动保存",
    ...overrides,
  };
}
