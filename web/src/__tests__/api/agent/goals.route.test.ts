// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockCreateAgentGoal } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCreateAgentGoal: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-goals", () => ({
  createAgentGoal: mockCreateAgentGoal,
}));

import { POST } from "@/app/api/v1/agent/goals/route";

describe("Agent goals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/agent/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "帮我完成一篇 AI 内容策划文章",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("creates an agent goal with execution mode", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockCreateAgentGoal.mockResolvedValue({
      goal: { id: "goal_1", goal: "test" },
      timeline: [],
      approvals: [],
    });

    const response = await POST(
      new Request("http://localhost/api/v1/agent/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "帮我找热点并生成文章草稿",
          execution_mode: "confirm",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateAgentGoal).toHaveBeenCalledWith("alice", {
      goal: "帮我找热点并生成文章草稿",
      executionMode: "confirm",
    });
  });
});
