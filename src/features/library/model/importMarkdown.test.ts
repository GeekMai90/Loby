import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import type { MarkdownImportDocument, MarkdownImportScan } from "@/features/library/model/persistence";
import {
  buildMarkdownImportResult,
  deriveImportedSheetTitle,
  summarizeMarkdownImportMetadata,
} from "@/features/library/model/importMarkdown";
import { createDefaultInboxProject } from "@/features/library/model/projectModel";

describe("importMarkdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T10:00:00+08:00"));
  });

  afterEach(() => vi.useRealTimers());

  it("maps recognized metadata and drops source-specific fields", () => {
    const project = blogProject();
    const scan = importScan([
      document({
        metadata: {
          id: "foreign-id",
          title: "导入标题",
          date: "2026-06-07",
          created: "2026-06-06T09:06:03+08:00",
          updated: "2026-06-08T10:20:30+08:00",
          draft: false,
          tags: ["obsidian", "", "obsidian"],
          hero_summary: "封面文案",
          source: "legacy-workflow",
        },
      }),
    ]);

    const result = buildMarkdownImportResult(scan, project, "/library", []);
    const [sheet] = result.importedSheets;

    expect(sheet).toMatchObject({
      title: "导入标题",
      tags: ["obsidian"],
      createdAt: "2026-06-06 09:06:03",
      updatedAt: "2026-06-08 10:20:30",
      properties: { 发布日期: "2026-06-07", 公众号: false },
    });
    expect(sheet.id).not.toBe("foreign-id");
    expect(result.preservedKeys).toEqual(expect.arrayContaining(["title", "date", "created", "updated", "tags"]));
    expect(result.droppedKeys).toEqual(expect.arrayContaining(["id", "draft", "hero_summary", "source"]));
  });

  it("uses file timestamps when source metadata has no document timestamps", () => {
    const scan = importScan([
      document({
        createdTimeMs: new Date(2026, 4, 27, 11, 34, 47).getTime(),
        modifiedTimeMs: new Date(2026, 4, 31, 15, 37, 34).getTime(),
      }),
    ]);
    const result = buildMarkdownImportResult(scan, blogProject(), "/library", []);

    expect(result.importedSheets[0]).toMatchObject({
      createdAt: "2026-05-27 11:34:47",
      updatedAt: "2026-05-31 15:37:34",
    });
  });

  it("preserves source wall-clock metadata across runtime time zones", () => {
    const scan = importScan([
      document({
        metadata: {
          created: "2026-06-06T09:06:03+08:00",
          updated: "2026-06-08T10:20:30-05:00",
        },
      }),
    ]);

    expect(buildMarkdownImportResult(scan, blogProject(), "/library", []).importedSheets[0]).toMatchObject({
      createdAt: "2026-06-06 09:06:03",
      updatedAt: "2026-06-08 10:20:30",
    });
  });

  it("maps nested folders to flat project groups and keeps root documents in the default group", () => {
    const scan = importScan([
      document({ name: "根目录.md", relativePath: "根目录.md", body: "# 根目录" }),
      document({ name: "文章.md", relativePath: "专题/年度/文章.md", body: "# 文章" }),
    ]);
    const result = buildMarkdownImportResult(scan, blogProject(), "/library", []);

    expect(result.createdGroups).toMatchObject([{ title: "专题 / 年度" }]);
    expect(result.importedSheets[0]?.groupId).toBe("group-default");
    expect(result.importedSheets[1]?.groupId).toBe(result.createdGroups[0]?.id);
  });

  it("keeps inbox imports flat without creating groups", () => {
    const inbox = createDefaultInboxProject();
    const result = buildMarkdownImportResult(importScan([document({ relativePath: "专题/文章.md" })]), inbox, "/library", []);

    expect(result.createdGroups).toEqual([]);
    expect(result.importedSheets[0]?.groupId).toBe("inbox-default");
  });

  it("rewrites resolved Obsidian embeds to portable Markdown paths", () => {
    const sourcePath = "/vault/attachments/封面.png";
    const scan = importScan([
      document({
        body: "# 文章\n\n![[封面.png]]",
        imageReferences: [
          {
            target: "封面.png",
            format: "obsidian",
            status: "resolved",
            sourcePath,
            candidatePaths: [],
          },
        ],
      }),
    ]);
    const result = buildMarkdownImportResult(scan, blogProject(), "/library", [
      { sourcePath, destinationPath: "/library/assets/images/封面.png" },
    ]);

    expect(result.importedSheets[0]?.body).toContain("![封面](../../../assets/images/封面.png)");
    expect(result.importedSheets[0]?.body).not.toContain("![[");
  });

  it("skips exact duplicate bodies and suffixes same-title different content", () => {
    const project = blogProject();
    project.sheets = [
      {
        id: "existing",
        title: "已有文章",
        groupId: "group-default",
        tags: [],
        targetWords: 1000,
        description: "",
        body: "# 已有文章\n\n内容",
        createdAt: "2026-07-01 10:00:00",
        updatedAt: "2026-07-01 10:00:00",
        properties: {},
      },
    ];
    const result = buildMarkdownImportResult(
      importScan([
        document({ name: "重复.md", body: "# 已有文章\n\n内容" }),
        document({ name: "已有文章.md", body: "# 已有文章\n\n新内容" }),
      ]),
      project,
      "/library",
      [],
    );

    expect(result.skippedDuplicateCount).toBe(1);
    expect(result.importedSheets).toHaveLength(1);
    expect(result.importedSheets[0]?.title).toBe("已有文章 2");
  });

  it("previews destination-aware metadata decisions", () => {
    const scan = importScan([document({ metadata: { date: "2026-06-07", hero_title: "视觉标题" } })]);

    expect(summarizeMarkdownImportMetadata(scan, blogProject())).toEqual({
      preservedKeys: ["date"],
      droppedKeys: ["hero_title"],
    });
    expect(summarizeMarkdownImportMetadata(scan, createDefaultInboxProject())).toEqual({
      preservedKeys: [],
      droppedKeys: ["date", "hero_title"],
    });
  });

  it("derives a title from the first heading and then the filename", () => {
    expect(deriveImportedSheetTitle("fallback.md", "# 正文标题\n\n内容")).toBe("正文标题");
    expect(deriveImportedSheetTitle("fallback-title.md", "正文")).toBe("fallback title");
  });
});

function importScan(documents: MarkdownImportDocument[]): MarkdownImportScan {
  return {
    sourcePaths: ["/vault/articles"],
    sourceType: "obsidian",
    vaultRoot: "/vault",
    attachmentRoot: "/vault/attachments",
    documents,
    skippedFileCount: 0,
    resolvedImageCount: documents.flatMap((item) => item.imageReferences).filter((item) => item.status === "resolved").length,
    externalImageCount: 0,
    missingImageCount: 0,
    ambiguousImageCount: 0,
    warnings: [],
  };
}

function document(overrides: Partial<MarkdownImportDocument> = {}): MarkdownImportDocument {
  return {
    name: "文章.md",
    path: "/vault/articles/文章.md",
    relativePath: "文章.md",
    body: "# 文章\n\n内容",
    metadata: {},
    sizeBytes: 100,
    imageReferences: [],
    ...overrides,
  };
}

function blogProject(): WritingProject {
  return {
    id: "project-blog",
    title: "博客",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-default", title: "待整理" }],
    sheets: [],
    updatedAt: "2026-07-10 10:00:00",
    documentPropertyDefinitions: [
      { id: "wechat", key: "公众号", label: "公众号", type: "checkbox", defaultValue: false },
      { id: "published", key: "发布日期", label: "发布日期", type: "date" },
    ],
  };
}
