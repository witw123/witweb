// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockVerifyAuth,
  mockGetConversationList,
  mockSendMessage,
  mockListBasicByUsernames,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockVerifyAuth: vi.fn(),
  mockGetConversationList: vi.fn(),
  mockSendMessage: vi.fn(),
  mockListBasicByUsernames: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
}));

vi.mock("@/lib/repositories", () => ({
  drizzleMessageRepository: {
    getConversationList: mockGetConversationList,
    sendMessage: mockSendMessage,
  },
  drizzleUserRepository: {
    listBasicByUsernames: mockListBasicByUsernames,
  },
}));

import { ApiError, ErrorCode } from "@/lib/api-error";
import { GET, POST } from "@/app/api/v1/messages/route";

describe("Messages API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue(null);
    mockListBasicByUsernames.mockResolvedValue([]);
  });

  it("GET /api/v1/messages returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/v1/messages"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/messages filters out conversations for deleted users", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetConversationList.mockResolvedValue([
      {
        id: 1,
        last_message: "hi",
        last_time: "2026-03-06T00:00:00.000Z",
        unread_count: 0,
        other_user: { username: "bob", nickname: "Bob", avatar_url: "/b.png" },
      },
      {
        id: 2,
        last_message: "gone",
        last_time: "2026-03-06T00:00:00.000Z",
        unread_count: 1,
        other_user: { username: "ghost", nickname: "Ghost", avatar_url: "" },
      },
    ]);
    mockListBasicByUsernames.mockResolvedValue([
      { username: "bob", nickname: "Bob", avatar_url: "/b.png" },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/messages"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetConversationList).toHaveBeenCalledWith("alice");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].other_user.username).toBe("bob");
  });

  it("POST /api/v1/messages returns 401 when unauthenticated", async () => {
    const request = new Request("http://localhost/api/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver: "bob", content: "hello" }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("POST /api/v1/messages returns conversation id on success", async () => {
    mockVerifyAuth.mockResolvedValue({ username: "alice" });
    mockSendMessage.mockResolvedValue({ conversationId: 42, messageId: 100 });

    const request = new Request("http://localhost/api/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver: "bob", content: "hello" }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith({
      sender: "alice",
      receiver: "bob",
      content: "hello",
    });
    expect(body.data).toEqual({ conversation_id: 42 });
  });

  it("POST /api/v1/messages returns 404 when receiver does not exist", async () => {
    mockVerifyAuth.mockResolvedValue({ username: "alice" });
    mockSendMessage.mockRejectedValue(new ApiError(ErrorCode.USER_NOT_FOUND, "missing"));

    const request = new Request("http://localhost/api/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver: "ghost", content: "hello" }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});
