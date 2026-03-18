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

describe("conversation stream attachments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("passes validated attachments to the conversation service", async () => {
    mockAppendIncremental.mockResolvedValue({
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
        meta: {
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
        },
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
    });

    const response = await POST(
      new Request("http://localhost/api/v1/agent/conversations/conv_1/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "hi",
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
        }),
      }) as never,
      { params: Promise.resolve({ id: "conv_1" }) }
    );

    await response.text();

    expect(response.status).toBe(200);
    expect(mockAppendIncremental).toHaveBeenCalledWith(
      "conv_1",
      "alice",
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            id: "att_1",
            name: "brief.md",
          }),
        ],
      }),
      expect.any(Object)
    );
  });
});
