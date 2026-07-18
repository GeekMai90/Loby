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
