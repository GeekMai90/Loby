/**
 * [INPUT]: 依赖 Vitest 与 windowClose 保存后按平台收起窗口的契约
 * [OUTPUT]: 验证保存顺序、并发关闭去重、窗口恢复后的再次收起与失败重试能力
 * [POS]: shared window close 适配器的纯单元回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import { createPersistedWindowCloseHandler } from "@/shared/lib/windowClose";

describe("createPersistedWindowCloseHandler", () => {
  it("flushes pending work before hiding the native window", async () => {
    const events: string[] = [];
    const preventDefault = vi.fn(() => events.push("prevent"));
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {
        events.push("flush");
      },
      dismissWindow: async () => {
        events.push("close");
      },
    });

    await handler({ preventDefault });

    expect(events).toEqual(["prevent", "flush", "close"]);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("can hide the same window again after it has been restored", async () => {
    const preventDefault = vi.fn();
    const dismissWindow = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: async () => {},
      dismissWindow,
    });

    await handler({ preventDefault });
    await handler({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(dismissWindow).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate close requests while a flush is active", async () => {
    let finishFlush: (() => void) | undefined;
    const flushFinished = new Promise<void>((resolve) => {
      finishFlush = resolve;
    });
    const preventDefault = vi.fn();
    const dismissWindow = vi.fn(async () => {});
    const handler = createPersistedWindowCloseHandler({
      flush: () => flushFinished,
      dismissWindow,
    });

    const firstClose = handler({ preventDefault });
    await handler({ preventDefault });
    finishFlush?.();
    await firstClose;

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(dismissWindow).toHaveBeenCalledOnce();
  });

  it("allows retrying when hiding the window fails", async () => {
    const dismissWindow = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("dismiss failed")).mockResolvedValueOnce(undefined);
    const handler = createPersistedWindowCloseHandler({ flush: async () => {}, dismissWindow });

    await expect(handler({ preventDefault: vi.fn() })).rejects.toThrow("dismiss failed");
    await expect(handler({ preventDefault: vi.fn() })).resolves.toBeUndefined();

    expect(dismissWindow).toHaveBeenCalledTimes(2);
  });
});
