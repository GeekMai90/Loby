/**
 * [INPUT]: 依赖 Vitest 与 windowClose 保存后强制关闭契约
 * [OUTPUT]: 验证保存顺序、重复关闭去重与关闭失败后的重试能力
 * [POS]: shared window close 适配器的纯单元回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import { createPersistedWindowCloseHandler } from "@/shared/lib/windowClose";

describe("createPersistedWindowCloseHandler", () => {
  it("flushes pending work before forcing the native window closed", async () => {
    const events: string[] = [];
    const preventDefault = vi.fn(() => events.push("prevent"));
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {
        events.push("flush");
      },
      forceClose: async () => {
        events.push("close");
      },
    });

    await handler({ preventDefault });

    expect(events).toEqual(["prevent", "flush", "close"]);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("does not repeat a completed forced close", async () => {
    const preventDefault = vi.fn();
    const forceClose = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {},
      forceClose,
    });

    await handler({ preventDefault });
    await handler({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(forceClose).toHaveBeenCalledOnce();
  });

  it("prevents duplicate close requests while a flush is active", async () => {
    let finishFlush: (() => void) | undefined;
    const flushFinished = new Promise<void>((resolve) => {
      finishFlush = resolve;
    });
    const preventDefault = vi.fn();
    const forceClose = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: () => flushFinished,
      forceClose,
    });

    const firstClose = handler({ preventDefault });
    await handler({ preventDefault });
    finishFlush?.();
    await firstClose;

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(forceClose).toHaveBeenCalledOnce();
  });

  it("allows retrying when the forced close fails", async () => {
    const forceClose = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("destroy failed")).mockResolvedValueOnce(undefined);
    const handler = createPersistedWindowCloseHandler({ flush: async () => {}, forceClose });

    await expect(handler({ preventDefault: vi.fn() })).rejects.toThrow("destroy failed");
    await expect(handler({ preventDefault: vi.fn() })).resolves.toBeUndefined();

    expect(forceClose).toHaveBeenCalledTimes(2);
  });
});
