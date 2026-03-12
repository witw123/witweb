// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockAppendIncremental } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockAppendIncremental: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-conversations", () => ({
  appendAgentConversationMessageIncremental: mockAppendIncremental,
}));

import { POST } from "@/app/api/v1/agent/conversations/[id]/messages/stream/route";

describe("conversation stream API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("streams phase, delta and done events in order", async () => {
    mockAppendIncremental.mockImplementation(async (_id, _user, _input, options) => {
      await options?.onPhase?.({ key: "intent", title: "识别用户意图", status: "running" });
      await options?.onPhase?.({ key: "intent", title: "识别用户意图", status: "done" });
      await options?.onDelta?.("你好", "msg_assistant_1");
      return {
        conversation: {
          id: "conv_1",
          title: "测试",
          last_message_preview: "你好",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        user_message: {
          id: "msg_user_1",
          conversation_id: "conv_1",
          role: "user",
          content: "hi",
          goal_id: null,
          created_at: new Date().toISOString(),
        },
        assistant_message: {
          id: "msg_assistant_1",
          conversation_id: "conv_1",
          role: "assistant",
          content: "你好",
          goal_id: null,
          created_at: new Date().toISOString(),
          meta: {},
        },
        reply_meta: {},
      };
    });

    const response = await POST(
      new Request("http://localhost/api/v1/agent/conversations/conv_1/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hi" }),
      }) as never,
      { params: Promise.resolve({ id: "conv_1" }) }
    );

    const text = await response.text();
    const events = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; key?: string; chunk?: string });

    expect(response.status).toBe(200);
    expect(events.some((event) => event.type === "phase" && event.key === "intent")).toBe(true);
    expect(events.some((event) => event.type === "delta" && event.chunk === "你好")).toBe(true);
    expect(events[events.length - 1].type).toBe("done");
  });
});
