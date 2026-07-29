import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentChangeBuffer } from "@/features/editor/model/documentChangeBuffer";

afterEach(() => {
  vi.useRealTimers();
});

describe("DocumentChangeBuffer", () => {
  it("collapses rapid keystrokes before updating the React document model", async () => {
    vi.useFakeTimers();
    const committed: string[] = [];
    let bodyReads = 0;
    const buffer = new DocumentChangeBuffer({
      delayMs: 120,
      maxDelayMs: 500,
      commit: (change) => committed.push(change.body),
    });

    buffer.schedule({ sheetId: "sheet-1", readBody: () => "一" });
    buffer.schedule({ sheetId: "sheet-1", readBody: () => "一二" });
    buffer.schedule({
      sheetId: "sheet-1",
      readBody: () => {
        bodyReads += 1;
        return "一二三";
      },
    });
    await vi.advanceTimersByTimeAsync(119);
    expect(committed).toEqual([]);
    expect(bodyReads).toBe(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(committed).toEqual(["一二三"]);
    expect(bodyReads).toBe(1);
  });

  it("commits continuous typing at the maximum delay", async () => {
    vi.useFakeTimers();
    const committed: string[] = [];
    const buffer = new DocumentChangeBuffer({
      delayMs: 120,
      maxDelayMs: 500,
      commit: (change) => committed.push(change.body),
    });

    for (let index = 1; index <= 5; index += 1) {
      buffer.schedule({ sheetId: "sheet-1", readBody: () => String(index) });
      if (index < 5) await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(99);
    expect(committed).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    expect(committed).toEqual(["5"]);
  });

  it("flushes the previous document before accepting another sheet", () => {
    const committed: string[] = [];
    const buffer = new DocumentChangeBuffer({
      delayMs: 120,
      maxDelayMs: 500,
      commit: (change) => committed.push(`${change.sheetId}:${change.body}`),
    });

    buffer.schedule({ sheetId: "sheet-1", readBody: () => "first" });
    buffer.schedule({ sheetId: "sheet-2", readBody: () => "second" });
    buffer.flush();

    expect(committed).toEqual(["sheet-1:first", "sheet-2:second"]);
  });

  it("returns the exact reader identity used for a delayed model commit", () => {
    const committedReaders: Array<() => string> = [];
    const buffer = new DocumentChangeBuffer({
      delayMs: 120,
      maxDelayMs: 500,
      commit: (change) => committedReaders.push(change.readBody),
    });
    const olderReader = () => "较早输入";
    const latestReader = () => "较新输入";

    buffer.schedule({ sheetId: "sheet-1", readBody: olderReader });
    buffer.schedule({ sheetId: "sheet-1", readBody: latestReader });
    buffer.flush();

    expect(committedReaders).toEqual([latestReader]);
  });
});
