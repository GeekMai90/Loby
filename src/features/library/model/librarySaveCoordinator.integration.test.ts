import { afterEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import { LibrarySaveCoordinator } from "@/features/library/model/librarySaveCoordinator";
import { loadProjects } from "@/features/library/model/persistence";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LibrarySaveCoordinator persistence integration", () => {
  it("persists only the latest snapshot from rapid edits", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", new MemoryStorage());
    const libraryPath = "browser://libraries/rapid-edits";
    const coordinator = new LibrarySaveCoordinator({ delayMs: 500 });

    coordinator.schedule({ projects: projectsWithBody("第一版"), libraryPath });
    coordinator.schedule({ projects: projectsWithBody("第二版"), libraryPath });
    coordinator.schedule({ projects: projectsWithBody("最终版本"), libraryPath });

    await vi.advanceTimersByTimeAsync(499);
    expect((await loadProjects(libraryPath)).projects).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    const loaded = await loadProjects(libraryPath);
    expect(loaded.projects[0]?.sheets[0]?.body).toBe("最终版本");
  });

  it("finishes the active library save before a switch can load the next library", async () => {
    const events: string[] = [];
    let finishSave: (() => void) | undefined;
    const saveFinished = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const coordinator = new LibrarySaveCoordinator({
      delayMs: 10_000,
      persist: async (_projects, libraryPath) => {
        events.push(`save:${libraryPath}`);
        await saveFinished;
        events.push("save:finished");
        return libraryPath ?? "";
      },
    });

    coordinator.schedule({ projects: projectsWithBody("切换前最后修改"), libraryPath: "browser://libraries/first" });
    const switchLibrary = (async () => {
      await coordinator.flush();
      events.push("load:browser://libraries/second");
    })();

    await vi.waitFor(() => expect(events).toEqual(["save:browser://libraries/first"]));
    finishSave?.();
    await switchLibrary;

    expect(events).toEqual(["save:browser://libraries/first", "save:finished", "load:browser://libraries/second"]);
  });

  it("flushes a pending snapshot immediately at the close boundary", async () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const libraryPath = "browser://libraries/close-flush";
    const coordinator = new LibrarySaveCoordinator({ delayMs: 60_000 });
    let closed = false;

    coordinator.schedule({ projects: projectsWithBody("关闭前内容"), libraryPath });
    await coordinator.flushBefore(() => {
      closed = true;
    });

    const loaded = await loadProjects(libraryPath);
    expect(closed).toBe(true);
    expect(loaded.projects[0]?.sheets[0]?.body).toBe("关闭前内容");
  });

  it("rejects a close-boundary flush after persistence fails", async () => {
    const coordinator = new LibrarySaveCoordinator({
      delayMs: 60_000,
      persist: async () => {
        throw new Error("disk full");
      },
    });

    coordinator.schedule({ projects: projectsWithBody("不能丢失"), libraryPath: "/Library" });

    await expect(coordinator.flush()).rejects.toThrow("disk full");
  });
});

function projectsWithBody(body: string): WritingProject[] {
  const updatedAt = "2026-07-25T10:00:00.000Z";
  return [
    {
      id: "project-save",
      title: "保存测试",
      status: "构思",
      projectGoal: { enabled: false, unit: "words", target: 0 },
      groups: [{ id: "group-default", title: "待整理" }],
      sheets: [
        {
          id: "sheet-save",
          title: "保存文稿",
          groupId: "group-default",
          status: "构思",
          tags: [],
          targetWords: 1000,
          description: "",
          body,
          createdAt: updatedAt,
          updatedAt,
          properties: {},
        },
      ],
      updatedAt,
      documentPropertyDefinitions: [],
    },
  ];
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
