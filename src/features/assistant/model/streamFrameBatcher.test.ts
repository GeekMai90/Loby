import { describe, expect, it, vi } from "vitest";
import { createStreamFrameBatcher, type StreamFrameScheduler } from "@/features/assistant/model/streamFrameBatcher";

describe("streamFrameBatcher", () => {
  it("coalesces repeated updates within one frame", () => {
    const callbacks = new Map<number, () => void>();
    let nextHandle = 0;
    const scheduler: StreamFrameScheduler = {
      request: (callback) => {
        nextHandle += 1;
        callbacks.set(nextHandle, callback);
        return nextHandle;
      },
      cancel: (handle) => callbacks.delete(handle),
    };
    const flush = vi.fn();
    const batcher = createStreamFrameBatcher(flush, scheduler);

    batcher.schedule();
    batcher.schedule();
    batcher.schedule();

    expect(callbacks.size).toBe(1);
    callbacks.get(1)?.();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("can flush or cancel a pending frame without leaving stale work", () => {
    const callbacks = new Map<number, () => void>();
    const scheduler: StreamFrameScheduler = {
      request: (callback) => {
        callbacks.set(1, callback);
        return 1;
      },
      cancel: (handle) => callbacks.delete(handle),
    };
    const flush = vi.fn();
    const batcher = createStreamFrameBatcher(flush, scheduler);

    batcher.schedule();
    batcher.flushNow();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);

    batcher.schedule();
    batcher.cancel();
    expect(callbacks.size).toBe(0);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
