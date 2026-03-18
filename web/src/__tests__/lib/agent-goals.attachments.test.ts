// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetGoalById,
  mockGetApprovalByStepKey,
  mockGetGoalStepByKey,
  mockUpdateGoalStepByKey,
  mockUpdateGoalStatus,
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

describe("executeAgentGoal attachment tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoalApprovals.mockResolvedValue([]);
    mockGetGoalSteps.mockResolvedValue([]);
    mockGetApprovalByStepKey.mockResolvedValue(null);
    mockGetGoalStepByKey.mockResolvedValue(null);
    mockGetAgentTool.mockReturnValue({ name: "file.read" });
  });

  it("passes stored plan attachments into file.read", async () => {
    mockGetGoalById.mockResolvedValue({
      id: "goal_attachments",
      username: "alice",
      goal: "分析我上传的 brief",
      task_type: "publish_draft",
      template_id: null,
      conversation_id: null,
      status: "planned",
      execution_mode: "auto_low_risk",
      requested_tools_json: JSON.stringify(["file.read"]),
      plan_json: JSON.stringify({
        model: "gemini-3-pro",
        summary: "plan",
        attachments: [
          {
            id: "att_1",
            name: "brief.md",
            mime_type: "text/markdown",
            url: "/uploads/brief.md",
            size: 128,
            kind: "document",
          },
        ],
        steps: [
          {
            step_key: "read_attachments",
            kind: "tool",
            title: "Read uploaded attachments",
            tool_name: "file.read",
            rationale: "read attachments",
            status: "planned",
            input: {},
          },
        ],
      }),
      summary: "plan",
    });
    mockExecuteAgentTool.mockResolvedValue({
      items: [{ id: "att_1", name: "brief.md" }],
    });

    await executeAgentGoal("goal_attachments", "alice");

    expect(mockExecuteAgentTool).toHaveBeenCalledWith(
      "alice",
      "file.read",
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            id: "att_1",
            name: "brief.md",
          }),
        ],
      })
    );
  });
});
