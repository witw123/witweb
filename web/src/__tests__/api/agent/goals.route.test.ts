// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockCreateAgentGoal, mockListAgentGoalGalleryItems } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCreateAgentGoal: vi.fn(),
  mockListAgentGoalGalleryItems: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-goals", () => ({
  createAgentGoal: mockCreateAgentGoal,
  listAgentGoalGalleryItems: mockListAgentGoalGalleryItems,
}));

import { GET, POST } from "@/app/api/v1/agent/goals/route";

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

  it("GET /api/v1/agent/goals returns 401 when unauthenticated", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/agent/goals?status=done&size=12") as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/agent/goals returns gallery projection items", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListAgentGoalGalleryItems.mockResolvedValue([
      {
        goal_id: "goal_1",
        conversation_id: "conv_1",
        task_type: "hot_topic_article",
        status: "done",
        updated_at: new Date().toISOString(),
        title: "AI Agent 画廊文章",
        summary: "摘要",
        tags: ["AI", "Agent"],
        source: "post_draft",
        preview: {
          content: "# AI Agent 画廊文章",
          seo_title: "AI Agent 画廊文章",
        },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/agent/goals?status=done&size=12") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].goal_id).toBe("goal_1");
    expect(mockListAgentGoalGalleryItems).toHaveBeenCalledWith("alice", {
      size: 12,
      status: "done",
    });
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
