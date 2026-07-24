/**
 * [INPUT]: 依赖待保存任务与按平台收起原生窗口的回调
 * [OUTPUT]: 对外提供 createPersistedWindowCloseHandler
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
interface WindowCloseRequest {
  preventDefault: () => void;
}

interface PersistedWindowCloseOptions {
  flush: () => Promise<void>;
  dismissWindow: () => Promise<void>;
}

export function createPersistedWindowCloseHandler({ flush, dismissWindow }: PersistedWindowCloseOptions) {
  let dismissing = false;

  return async (event: WindowCloseRequest): Promise<void> => {
    event.preventDefault();
    if (dismissing) return;

    dismissing = true;
    try {
      await flush();
      await dismissWindow();
    } finally {
      dismissing = false;
    }
  };
}
