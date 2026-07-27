import { describe, expect, it } from "vitest";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";

describe("agentRunTimings", () => {
  it("records comparable runtime lifecycle stages", () => {
    const runtime = applyAgentRunMetric({}, { rawType: "runtime_ready", status: "ready", elapsedMs: 4.4 });
    const firstDelta = applyAgentRunMetric(runtime, { rawType: "first_text_delta", elapsedMs: 386.8 });

    expect(firstDelta).toEqual({
      runtimeReadyMs: 4,
      firstTextDeltaMs: 387,
    });
  });

  it("ignores unknown stages and invalid durations", () => {
    const timings = { runtimeReadyMs: 8 };
    expect(applyAgentRunMetric(timings, { rawType: "unknown", elapsedMs: 12 })).toBe(timings);
    expect(applyAgentRunMetric(timings, { rawType: "first_text_delta", elapsedMs: -1 })).toBe(timings);
  });
});
