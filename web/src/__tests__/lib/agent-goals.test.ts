import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetGoalById,
  mockGetApprovalByStepKey,
  mockGetGoalStepByKey,
  mockUpdateGoalStepByKey,
  mockUpdateGoalStatus,
  mockUpdateApprovalPayloadByStepKey,
  mockGetGoalSteps,
  mockGetGoalApprovals,
  mockExecuteAgentTool,
  mockGetAgentTool,
} = vi.hoisted(() => ({
  mockGetGoalById: vi.fn(),
  mockGetApprovalByStepKey: vi.fn(),
  mockGetGoalStepByKey: vi.fn(),
  mockUpdateGoalStepByKey: vi.fn(),
  mockUpdateGoalStatus: vi.fn(),
  mockUpdateApprovalPayloadByStepKey: vi.fn(),
  mockGetGoalSteps: vi.fn(),
  mockGetGoalApprovals: vi.fn(),
  mockExecuteAgentTool: vi.fn(),
  mockGetAgentTool: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      getGoalById: mockGetGoalById,
      getApprovalByStepKey: mockGetApprovalByStepKey,
      getGoalStepByKey: mockGetGoalStepByKey,
      updateGoalStepByKey: mockUpdateGoalStepByKey,
      updateGoalStatus: mockUpdateGoalStatus,
      updateApprovalPayloadByStepKey: mockUpdateApprovalPayloadByStepKey,
      getGoalSteps: mockGetGoalSteps,
      getGoalApprovals: mockGetGoalApprovals,
    },
  };
});

vi.mock("@/lib/agent-tools", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent-tools")>("@/lib/agent-tools");
  return {
    ...actual,
    executeAgentTool: mockExecuteAgentTool,
    getAgentTool: mockGetAgentTool,
  };
});

vi.mock("@/lib/ai-models", () => ({
  getModelDescriptor: () => ({ id: "gemini-3-pro" }),
}));

import { executeAgentGoal } from "@/lib/agent-goals";

describe("executeAgentGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoalSteps.mockResolvedValue([]);
    mockGetGoalApprovals.mockResolvedValue([]);
    mockUpdateApprovalPayloadByStepKey.mockResolvedValue(undefined);
  });

  it("does not execute high-risk tool before approval", async () => {
    mockGetGoalById.mockResolvedValue({
      id: "goal_1",
      username: "alice",
      goal: "鍙戝竷鏂囩珷",
      status: "waiting_approval",
      execution_mode: "confirm",
      requested_tools_json: JSON.stringify(["blog.create_post"]),
      plan_json: JSON.stringify({
        model: "gemini-3-pro",
        summary: "plan",
        steps: [
          {
            step_key: "create_post",
            kind: "tool",
            title: "鍒涘缓鏂囩珷",
            tool_name: "blog.create_post",
            rationale: "publish",
            status: "waiting_approval",
            requires_approval: true,
            risk_level: "publish_or_send",
            input: { status: "published" },
          },
        ],
      }),
      summary: "plan",
    });
    mockGetGoalStepByKey.mockResolvedValue({
      id: 1,
      goal_id: "goal_1",
      step_key: "create_post",
      kind: "tool",
      title: "鍒涘缓鏂囩珷",
      status: "waiting_approval",
      input_json: "{}",
      output_json: "{}",
      started_at: "2026-03-11T00:00:00.000Z",
      finished_at: null,
    });
    mockGetApprovalByStepKey.mockResolvedValue({
      id: 9,
      goal_id: "goal_1",
      step_key: "create_post",
      action: "blog.create_post",
      risk_level: "publish_or_send",
      status: "pending",
      payload_json: "{}",
      created_at: "2026-03-11T00:00:00.000Z",
      resolved_at: null,
    });

    await executeAgentGoal("goal_1", "alice");

    expect(mockExecuteAgentTool).not.toHaveBeenCalled();
    expect(mockUpdateApprovalPayloadByStepKey).toHaveBeenCalledWith(
      "goal_1",
      "create_post",
      expect.stringContaining("content")
    );
    expect(mockUpdateGoalStepByKey).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        stepKey: "create_post",
        status: "skipped_waiting_approval",
        inputJson: expect.stringContaining("content"),
      })
    );
  });

  it("does not re-enter goals already running", async () => {
    mockGetGoalById.mockResolvedValue({
      id: "goal_2",
      username: "alice",
      goal: "璇诲彇璧勬枡",
      status: "running",
      execution_mode: "confirm",
      requested_tools_json: JSON.stringify(["profile.read"]),
      plan_json: JSON.stringify({
        model: "gemini-3-pro",
        summary: "plan",
        steps: [
          {
            step_key: "read_profile",
            kind: "tool",
            title: "璇诲彇璧勬枡",
            tool_name: "profile.read",
            rationale: "read",
            status: "done",
            input: {},
          },
        ],
      }),
      summary: "plan",
    });
    mockGetGoalStepByKey.mockResolvedValue({
      id: 1,
      goal_id: "goal_2",
      step_key: "read_profile",
      kind: "tool",
      title: "璇诲彇璧勬枡",
      status: "done",
      input_json: "{}",
      output_json: "{}",
      started_at: "2026-03-11T00:00:00.000Z",
      finished_at: "2026-03-11T00:00:01.000Z",
    });
    mockGetAgentTool.mockReturnValue({ name: "profile.read" });

    await executeAgentGoal("goal_2", "alice");

    expect(mockExecuteAgentTool).not.toHaveBeenCalled();
    expect(mockUpdateGoalStatus).not.toHaveBeenCalled();
  });

  it("does not re-run goals already done", async () => {
    mockGetGoalById.mockResolvedValue({
      id: "goal_done",
      username: "alice",
      goal: "完成的任务",
      status: "done",
      execution_mode: "confirm",
      requested_tools_json: JSON.stringify(["blog.create_post"]),
      plan_json: JSON.stringify({
        model: "gemini-3-pro",
        summary: "plan",
        steps: [],
      }),
      summary: "done",
    });

    await executeAgentGoal("goal_done", "alice");

    expect(mockExecuteAgentTool).not.toHaveBeenCalled();
    expect(mockUpdateGoalStatus).not.toHaveBeenCalled();
  });

  it("fails a rejected approval without executing the tool", async () => {
    mockGetGoalById.mockResolvedValue({
      id: "goal_rejected",
      username: "alice",
      goal: "发布文章",
      status: "waiting_approval",
      execution_mode: "confirm",
      requested_tools_json: JSON.stringify(["blog.create_post"]),
      plan_json: JSON.stringify({
        model: "gemini-3-pro",
        summary: "plan",
        steps: [
          {
            step_key: "create_post",
            kind: "tool",
            title: "创建文章",
            tool_name: "blog.create_post",
            rationale: "publish",
            status: "waiting_approval",
            requires_approval: true,
            risk_level: "publish_or_send",
            input: { title: "A", content: "B", status: "draft" },
          },
        ],
      }),
      summary: "plan",
    });
    mockGetGoalStepByKey.mockResolvedValue({
      id: 1,
      goal_id: "goal_rejected",
      step_key: "create_post",
      kind: "tool",
      title: "创建文章",
      status: "skipped_waiting_approval",
      input_json: "{}",
      output_json: "{}",
      started_at: "2026-03-11T00:00:00.000Z",
      finished_at: null,
    });
    mockGetApprovalByStepKey.mockResolvedValue({
      id: 10,
      goal_id: "goal_rejected",
      step_key: "create_post",
      action: "blog.create_post",
      risk_level: "publish_or_send",
      status: "rejected",
      payload_json: "{}",
      created_at: "2026-03-11T00:00:00.000Z",
      resolved_at: "2026-03-11T00:00:01.000Z",
    });

    await executeAgentGoal("goal_rejected", "alice");

    expect(mockExecuteAgentTool).not.toHaveBeenCalled();
    expect(mockUpdateGoalStepByKey).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_rejected",
        stepKey: "create_post",
        status: "failed",
      })
    );
  });
});

