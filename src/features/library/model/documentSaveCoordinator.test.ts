/**
 * [INPUT]: 依赖 Vitest、DocumentSaveCoordinator 与写作项目/文稿契约
 * [OUTPUT]: 验证逐文稿 revision 折叠、最大脏时长、串行写入、失败重试及待提交正文覆盖
 * [POS]: 高频正文持久化协调器回归，确保最新编辑在成功保存前始终保持 dirty 且不会被旧快照替代
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectSingleDocumentChange,
  DocumentSaveCoordinator,
  materializeDocumentSnapshots,
  type DocumentSaveRequest,
} from "@/features/library/model/documentSaveCoordinator";
import type { WritingProject, WritingSheet } from "@/shared/types";

afterEach(() => {
  vi.useRealTimers();
});

describe("DocumentSaveCoordinator", () => {
  it("persists only the latest revision for one dirty document", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const coordinator = coordinatorWith(async (request) => {
      saved.push(request.revision);
      return receipt(request);
    });

    coordinator.schedule(request(1, "第一版"));
    coordinator.schedule(request(2, "第二版"));
    coordinator.schedule(request(3, "最终版"));

    await vi.advanceTimersByTimeAsync(399);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual([3]);
    expect(coordinator.isDirty("/Library", "sheet-1")).toBe(false);
  });

  it("does not materialize the full body on every scheduled keystroke", async () => {
    vi.useFakeTimers();
    let bodyReads = 0;
    const coordinator = coordinatorWith(async (current) => {
      current.resolveSheet();
      return receipt(current);
    });
    const first = request(1, "first");
    const second = request(2, "second");
    first.resolveSheet = () => {
      bodyReads += 1;
      return sheet({ body: "first" });
    };
    second.resolveSheet = () => {
      bodyReads += 1;
      return sheet({ body: "second" });
    };

    coordinator.schedule(first);
    coordinator.schedule(second);
    expect(bodyReads).toBe(0);
    await vi.advanceTimersByTimeAsync(400);

    expect(bodyReads).toBe(1);
  });

  it("persists continuous typing when the maximum dirty age is reached", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const coordinator = coordinatorWith(async (request) => {
      saved.push(request.revision);
      return receipt(request);
    });

    for (let revision = 1; revision <= 7; revision += 1) {
      coordinator.schedule(request(revision, String(revision)));
      if (revision < 7) await vi.advanceTimersByTimeAsync(300);
    }
    await vi.advanceTimersByTimeAsync(199);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    expect(saved).toEqual([7]);
  });

  it("serializes documents and keeps a newer revision dirty until it is saved", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const saved: string[] = [];
    const coordinator = coordinatorWith(async (current) => {
      saved.push(`${current.sheetId}:${current.revision}:start`);
      if (current.sheetId === "sheet-1" && current.revision === 1) await firstSave;
      saved.push(`${current.sheetId}:${current.revision}:end`);
      return receipt(current);
    });

    coordinator.schedule(request(1, "one"));
    const firstFlush = coordinator.flush();
    await vi.waitFor(() => expect(saved).toEqual(["sheet-1:1:start"]));
    coordinator.schedule(request(2, "two"));
    coordinator.schedule(request(1, "other", "sheet-2"));
    expect(coordinator.isDirty("/Library", "sheet-1")).toBe(true);
    releaseFirst?.();
    await firstFlush;

    expect(saved).toEqual(["sheet-1:1:start", "sheet-1:1:end", "sheet-1:2:start", "sheet-1:2:end", "sheet-2:1:start", "sheet-2:1:end"]);
    expect(coordinator.isDirty("/Library", "sheet-1")).toBe(false);
  });

  it("automatically retries the latest dirty revision after a transient failure", async () => {
    vi.useFakeTimers();
    const attempts: number[] = [];
    const coordinator = new DocumentSaveCoordinator({
      delayMs: 400,
      maxDelayMs: 2_000,
      retryDelayMs: 1_000,
      persist: async (current) => {
        attempts.push(current.revision);
        if (attempts.length === 1) throw new Error("temporary disk error");
        return receipt(current);
      },
    });

    coordinator.schedule(request(1, "不能丢失"));
    await vi.advanceTimersByTimeAsync(400);
    expect(attempts).toEqual([1]);
    expect(coordinator.isDirty("/Library", "sheet-1")).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(attempts).toEqual([1, 1]);
    expect(coordinator.isDirty("/Library", "sheet-1")).toBe(false);
  });
});

describe("detectSingleDocumentChange", () => {
  it("recognizes one immutable sheet replacement without treating it as a library save", () => {
    const previous = [project()];
    const nextSheet = { ...previous[0].sheets[0], body: "after", updatedAt: "2026-07-29T12:00:01.000Z" };
    const next = [{ ...previous[0], updatedAt: "2026-07-29", sheets: [nextSheet, previous[0].sheets[1]] }];

    expect(detectSingleDocumentChange(previous, next)).toEqual({ project: next[0], sheet: nextSheet });
  });

  it("rejects project metadata and structural changes", () => {
    const previous = [project()];
    expect(detectSingleDocumentChange(previous, [{ ...previous[0], title: "新项目名" }])).toBeNull();
    expect(detectSingleDocumentChange(previous, [{ ...previous[0], sheets: previous[0].sheets.slice(1) }])).toBeNull();
  });
});

describe("materializeDocumentSnapshots", () => {
  it("overlays the latest editor body without reverting structural metadata", () => {
    const projects = [project()];
    projects[0].sheets[0] = {
      ...projects[0].sheets[0],
      groupId: "group-moved",
    };
    const editorSnapshot = {
      ...projects[0].sheets[0],
      groupId: "group-1",
      title: "最新标题",
      body: "最新正文",
      updatedAt: "2026-07-29T12:01:00.000Z",
    };

    const materialized = materializeDocumentSnapshots(projects, new Map([[editorSnapshot.id, editorSnapshot]]));

    expect(materialized[0].sheets[0]).toMatchObject({
      groupId: "group-moved",
      title: "最新标题",
      body: "最新正文",
      updatedAt: "2026-07-29T12:01:00.000Z",
    });
    expect(materialized[0].sheets[1]).toBe(projects[0].sheets[1]);
  });

  it("keeps a pending editor title and body over an older external scan", () => {
    const externalProjects = [project()];
    externalProjects[0].sheets[0] = {
      ...externalProjects[0].sheets[0],
      title: "磁盘旧标题",
      body: "# 磁盘旧标题\n\n旧正文",
    };
    const pendingEditorSnapshot = {
      ...externalProjects[0].sheets[0],
      title: "编辑器新标题",
      body: "# 编辑器新标题\n\n刚写完的正文",
      updatedAt: "2026-07-29T12:02:00.000Z",
    };

    const reconciled = materializeDocumentSnapshots(externalProjects, new Map([[pendingEditorSnapshot.id, pendingEditorSnapshot]]));

    expect(reconciled[0].sheets[0]).toMatchObject({
      title: "编辑器新标题",
      body: "# 编辑器新标题\n\n刚写完的正文",
      updatedAt: "2026-07-29T12:02:00.000Z",
    });
  });
});

function coordinatorWith(persist: (request: DocumentSaveRequest) => Promise<ReturnType<typeof receipt>>) {
  return new DocumentSaveCoordinator({ delayMs: 400, maxDelayMs: 2_000, persist });
}

function request(revision: number, body: string, sheetId = "sheet-1"): DocumentSaveRequest {
  return {
    libraryPath: "/Library",
    project: { id: "project-1", title: "项目", groups: [{ id: "group-1", title: "正文" }] },
    sheetId,
    resolveSheet: () => sheet({ id: sheetId, body }),
    revision,
  };
}

function receipt(request: DocumentSaveRequest) {
  return { path: `/Library/${request.sheetId}.md`, revision: request.revision, written: true };
}

function project(): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-1", title: "正文" }],
    sheets: [sheet({ id: "sheet-1", body: "before" }), sheet({ id: "sheet-2", body: "second" })],
    updatedAt: "2026-07-29",
    documentPropertyDefinitions: [],
  };
}

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    groupId: "group-1",
    tags: [],
    targetWords: 1_000,
    description: "",
    body: "",
    createdAt: "2026-07-29T12:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
    properties: {},
    ...overrides,
  };
}
