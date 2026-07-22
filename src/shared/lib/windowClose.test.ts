import { describe, expect, it, vi } from "vitest";
import { createPersistedWindowCloseHandler } from "@/shared/lib/windowClose";

describe("createPersistedWindowCloseHandler", () => {
  it("flushes pending work before re-requesting the native close", async () => {
    const events: string[] = [];
    const preventDefault = vi.fn(() => events.push("prevent"));
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {
        events.push("flush");
      },
      requestClose: async () => {
        events.push("close");
      },
    });

    await handler({ preventDefault });

    expect(events).toEqual(["prevent", "flush", "close"]);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("allows the re-requested close to pass through", async () => {
    const preventDefault = vi.fn();
    const requestClose = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {},
      requestClose,
    });

    await handler({ preventDefault });
    await handler({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestClose).toHaveBeenCalledOnce();
  });

  it("prevents duplicate close requests while a flush is active", async () => {
    let finishFlush: (() => void) | undefined;
    const flushFinished = new Promise<void>((resolve) => {
      finishFlush = resolve;
    });
    const preventDefault = vi.fn();
    const requestClose = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: () => flushFinished,
      requestClose,
    });

    const firstClose = handler({ preventDefault });
    await handler({ preventDefault });
    finishFlush?.();
    await firstClose;

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(requestClose).toHaveBeenCalledOnce();
  });
});
