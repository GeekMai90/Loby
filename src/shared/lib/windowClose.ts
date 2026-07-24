/**
 * [INPUT]: 依赖待保存任务与不会再次触发 close-requested 的原生强制关闭回调
 * [OUTPUT]: 对外提供 createPersistedWindowCloseHandler
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
interface WindowCloseRequest {
  preventDefault: () => void;
}

interface PersistedWindowCloseOptions {
  flush: () => Promise<void>;
  forceClose: () => Promise<void>;
}

export function createPersistedWindowCloseHandler({ flush, forceClose }: PersistedWindowCloseOptions) {
  let state: "idle" | "closing" | "closed" = "idle";

  return async (event: WindowCloseRequest): Promise<void> => {
    if (state === "closed") return;

    event.preventDefault();
    if (state === "closing") return;

    state = "closing";
    try {
      await flush();
      await forceClose();
      state = "closed";
    } catch (error) {
      state = "idle";
      throw error;
    }
  };
}
