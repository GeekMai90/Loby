import { afterEach, describe, expect, it, vi } from "vitest";
import { LatestTaskQueue } from "./latestTaskQueue";

afterEach(() => {
  vi.useRealTimers();
});

describe("LatestTaskQueue", () => {
  it("debounces scheduled work to the latest value", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const queue = new LatestTaskQueue<number>({
      delayMs: 400,
      run: async (value) => {
        saved.push(value);
      },
    });

    queue.schedule(1);
    queue.schedule(2);
    queue.schedule(3);
    await vi.advanceTimersByTimeAsync(399);
    expect(saved).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual([3]);
  });

  it("serializes work and collapses updates received during a save", async () => {
    const saved: number[] = [];
    let finishFirst: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const queue = new LatestTaskQueue<number>({
      delayMs: 0,
      run: async (value) => {
        saved.push(value);
        if (value === 1) await firstSave;
      },
    });

    queue.schedule(1);
    const flushing = queue.flush();
    await Promise.resolve();
    queue.schedule(2);
    queue.schedule(3);
    finishFirst?.();
    await flushing;

    expect(saved).toEqual([1, 3]);
  });

  it("flushes pending work immediately", async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const queue = new LatestTaskQueue<string>({
      delayMs: 10_000,
      run: async (value) => {
        saved.push(value);
      },
    });

    queue.schedule("latest");
    await queue.flush();

    expect(saved).toEqual(["latest"]);
  });

  it("reports failures and continues with later work", async () => {
    const errors: string[] = [];
    const saved: number[] = [];
    const queue = new LatestTaskQueue<number>({
      delayMs: 0,
      run: async (value) => {
        if (value === 1) throw new Error("failed");
        saved.push(value);
      },
      onError: (error) => errors.push(error instanceof Error ? error.message : String(error)),
    });

    queue.schedule(1);
    await queue.flush();
    queue.schedule(2);
    await queue.flush();

    expect(errors).toEqual(["failed"]);
    expect(saved).toEqual([2]);
  });
});
