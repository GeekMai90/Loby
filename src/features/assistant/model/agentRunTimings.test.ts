import { describe, expect, it } from "vitest";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";

describe("agentRunTimings", () => {
  it("records comparable runtime lifecycle stages", () => {
    const runtime = applyAgentRunMetric({}, { rawType: "runtime/ready", status: "warm", elapsedMs: 4.4 });
    const thread = applyAgentRunMetric(runtime, { rawType: "thread/ready", elapsedMs: 21 });
    const firstDelta = applyAgentRunMetric(thread, { rawType: "response/first-delta", elapsedMs: 386.8 });

    expect(firstDelta).toEqual({
      runtimeMode: "warm",
      runtimeReadyMs: 4,
      threadReadyMs: 21,
      firstTextDeltaMs: 387,
    });
  });

  it("ignores unknown stages and invalid durations", () => {
    const timings = { runtimeReadyMs: 8 };
    expect(applyAgentRunMetric(timings, { rawType: "unknown", elapsedMs: 12 })).toBe(timings);
    expect(applyAgentRunMetric(timings, { rawType: "turn/ready", elapsedMs: -1 })).toBe(timings);
  });
});
