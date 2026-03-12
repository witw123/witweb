import { describe, expect, it } from "vitest";
import { createAgentThinkingStages, upsertAgentThinkingStage } from "@/features/agent/constants";

describe("agent thinking stages", () => {
  it("inserts goal phase when it was not part of the initial blueprint", () => {
    const stages = createAgentThinkingStages();
    const next = upsertAgentThinkingStage(stages, {
      key: "goal",
      title: "规划并执行任务",
      status: "running",
    });

    expect(next.some((item) => item.key === "goal")).toBe(true);
    expect(next[next.length - 1]).toMatchObject({
      key: "goal",
      status: "running",
    });
  });
});
