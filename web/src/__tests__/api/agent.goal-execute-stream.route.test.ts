// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockExecuteAgentGoal } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockExecuteAgentGoal: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-goals", () => ({
  executeAgentGoal: mockExecuteAgentGoal,
}));

import { POST } from "@/app/api/v1/agent/goals/[id]/execute/stream/route";

describe("goal execute stream API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("streams goal status, tool events, artifact events and done", async () => {
    mockExecuteAgentGoal.mockImplementation(async (_id, _user, options) => {
      await options?.onEvent?.({
        id: "goal_running_1",
        source: "goal",
        kind: "goal_status",
        goal_id: "goal_1",
        title: "Goal 状态",
        status: "running",
        detail: "Goal 开始执行",
        created_at: new Date().toISOString(),
      });
      await options?.onEvent?.({
        id: "tool_start_1",
        source: "tool",
        kind: "tool_start",
        goal_id: "goal_1",
        step_key: "create_post",
        tool_name: "blog.create_post",
        title: "保存博客草稿",
        status: "running",
        input_preview: "{\"title\":\"AI Agent\"}",
        created_at: new Date().toISOString(),
      });
      await options?.onEvent?.({
        id: "tool_result_1",
        source: "tool",
        kind: "tool_result",
        goal_id: "goal_1",
        step_key: "create_post",
        tool_name: "blog.create_post",
        title: "保存博客草稿",
        status: "done",
        output_preview: "{\"id\":1,\"status\":\"draft\"}",
        created_at: new Date().toISOString(),
      });
      await options?.onEvent?.({
        id: "artifact_1",
        source: "artifact",
        kind: "artifact",
        goal_id: "goal_1",
        step_key: "compose_content",
        artifact_kind: "content",
        artifact_preview: "文章内容预览",
        title: "正文草稿",
        status: "done",
        created_at: new Date().toISOString(),
      });

      return {
        goal: {
          id: "goal_1",
          goal: "写一篇 AI Agent 文章",
          summary: "done",
          status: "done",
          plan: { steps: [] },
        },
        timeline: [],
        approvals: [],
        deliveries: [],
        events: [],
      };
    });

    const response = await POST(
      new Request("http://localhost/api/v1/agent/goals/goal_1/execute/stream", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ id: "goal_1" }) } as never
    );

    const text = await response.text();
    const events = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; event?: { kind?: string; tool_name?: string } });

    expect(response.status).toBe(200);
    expect(events.some((event) => event.type === "goal_status" && event.event?.kind === "goal_status")).toBe(true);
    expect(events.some((event) => event.type === "tool_start" && event.event?.tool_name === "blog.create_post")).toBe(true);
    expect(events.some((event) => event.type === "tool_result" && event.event?.tool_name === "blog.create_post")).toBe(true);
    expect(events.some((event) => event.type === "artifact" && event.event?.kind === "artifact")).toBe(true);
    expect(events[events.length - 1].type).toBe("done");
  });
});
