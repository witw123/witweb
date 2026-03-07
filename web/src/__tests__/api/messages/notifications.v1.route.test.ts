// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockGetRepliesToUser,
  mockDrizzleGetLikesToUser,
  mockGetMentionsToUser,
  mockListBasicByUsernames,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockGetRepliesToUser: vi.fn(),
  mockDrizzleGetLikesToUser: vi.fn(),
  mockGetMentionsToUser: vi.fn(),
  mockListBasicByUsernames: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  commentRepository: {
    getRepliesToUser: mockGetRepliesToUser,
    getMentionsToUser: mockGetMentionsToUser,
  },
  drizzlePostRepository: {
    getLikesToUser: mockDrizzleGetLikesToUser,
  },
  userRepository: {
    listBasicByUsernames: mockListBasicByUsernames,
  },
}));

import { GET } from "@/app/api/v1/messages/notifications/route";

describe("Message notifications API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockGetRepliesToUser.mockResolvedValue([]);
    mockDrizzleGetLikesToUser.mockResolvedValue([]);
    mockGetMentionsToUser.mockResolvedValue([]);
    mockListBasicByUsernames.mockResolvedValue([]);
  });

  it("GET /api/v1/messages/notifications returns 401 when unauthenticated", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/messages/notifications?type=replies&page=1&size=20") as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/messages/notifications returns system notification payload", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await GET(
      new Request("http://localhost/api/v1/messages/notifications?type=system&page=1&size=20") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].sender).toBe("system");
  });

  it("GET /api/v1/messages/notifications enriches reply sender profile", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetRepliesToUser.mockResolvedValue([
      {
        sender: "bob",
        content: "hi",
        created_at: "2026-03-06T00:00:00.000Z",
        post_title: "Post",
        post_slug: "post",
      },
    ]);
    mockListBasicByUsernames.mockResolvedValue([
      { username: "bob", nickname: "Bob", avatar_url: "/b.png" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/messages/notifications?type=replies&page=1&size=20") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items[0].sender_nickname).toBe("Bob");
    expect(body.data.items[0].sender_avatar).toBe("/b.png");
  });
});
