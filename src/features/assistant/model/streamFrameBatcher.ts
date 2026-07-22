/**
 * [INPUT]: 依赖浏览器 requestAnimationFrame/cancelAnimationFrame 调度能力
 * [OUTPUT]: 对外提供 createStreamFrameBatcher 与 StreamFrameScheduler
 * [POS]: AI 助手流式渲染节流器，把同一绘制帧内的 token、activity 与 usage 更新合并为一次状态发布
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

export interface StreamFrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export function createStreamFrameBatcher(flush: () => void, scheduler: StreamFrameScheduler = browserFrameScheduler()) {
  let scheduledHandle: number | null = null;

  return {
    schedule() {
      if (scheduledHandle !== null) return;
      scheduledHandle = scheduler.request(() => {
        scheduledHandle = null;
        flush();
      });
    },
    flushNow() {
      if (scheduledHandle === null) return;
      scheduler.cancel(scheduledHandle);
      scheduledHandle = null;
      flush();
    },
    cancel() {
      if (scheduledHandle === null) return;
      scheduler.cancel(scheduledHandle);
      scheduledHandle = null;
    },
  };
}

function browserFrameScheduler(): StreamFrameScheduler {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return {
      request: (callback) => window.requestAnimationFrame(callback),
      cancel: (handle) => window.cancelAnimationFrame(handle),
    };
  }

  return {
    request: (callback) => globalThis.setTimeout(callback, 16) as unknown as number,
    cancel: (handle) => globalThis.clearTimeout(handle),
  };
}
