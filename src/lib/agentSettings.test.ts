import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAgentSettings, saveAgentSettings } from "./agentSettings";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("agent settings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults the assistant send shortcut to Enter", () => {
    expect(loadAgentSettings().assistantSendMode).toBe("enter");
  });

  it("persists the Command+Enter send shortcut", () => {
    saveAgentSettings({ assistantSendMode: "mod-enter" });
    expect(loadAgentSettings().assistantSendMode).toBe("mod-enter");
  });

  it("normalizes an unknown persisted shortcut to Enter", () => {
    localStorage.setItem("nibva.agentSettings.v1", JSON.stringify({ assistantSendMode: "unknown" }));
    expect(loadAgentSettings().assistantSendMode).toBe("enter");
  });
});
