// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockGetMessagesAndMarkAsRead,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockGetMessagesAndMarkAsRead: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  drizzleMessageRepository: {
    getMessagesAndMarkAsRead: mockGetMessagesAndMarkAsRead,
  },
}));

import { ApiError, ErrorCode } from "@/lib/api-error";
import { GET } from "@/app/api/v1/messages/[conversationId]/route";

describe("Message conversation API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("GET /api/v1/messages/[conversationId] returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/v1/messages/12") as never, {
      params: Promise.resolve({ conversationId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/messages/[conversationId] returns 403 when access is forbidden", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetMessagesAndMarkAsRead.mockRejectedValue(new ApiError(ErrorCode.FORBIDDEN, "forbidden"));

    const response = await GET(new Request("http://localhost/api/v1/messages/12") as never, {
      params: Promise.resolve({ conversationId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/messages/[conversationId] returns messages on success", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetMessagesAndMarkAsRead.mockResolvedValue([
      { id: 1, conversation_id: 12, sender: "alice", receiver: "bob", content: "hello" },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/messages/12") as never, {
      params: Promise.resolve({ conversationId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetMessagesAndMarkAsRead).toHaveBeenCalledWith(12, "alice");
    expect(body.data).toHaveLength(1);
  });
});
