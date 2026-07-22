/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 createPersistedWindowCloseHandler
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
interface WindowCloseRequest {
  preventDefault: () => void;
}

interface PersistedWindowCloseOptions {
  flush: () => Promise<void>;
  requestClose: () => Promise<void>;
}

export function createPersistedWindowCloseHandler({ flush, requestClose }: PersistedWindowCloseOptions) {
  let state: "idle" | "closing" | "approved" = "idle";

  return async (event: WindowCloseRequest): Promise<void> => {
    if (state === "approved") return;

    event.preventDefault();
    if (state === "closing") return;

    state = "closing";
    try {
      await flush();
      state = "approved";
      await requestClose();
    } catch (error) {
      state = "idle";
      throw error;
    }
  };
}
