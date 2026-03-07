// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockGetTotalUnread,
  mockFindByUsername,
  mockGetNewCommentsCount,
  mockDrizzleGetNewLikesCount,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockGetTotalUnread: vi.fn(),
  mockFindByUsername: vi.fn(),
  mockGetNewCommentsCount: vi.fn(),
  mockDrizzleGetNewLikesCount: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  messageRepository: {
    getTotalUnread: mockGetTotalUnread,
  },
  userRepository: {
    findByUsername: mockFindByUsername,
  },
  commentRepository: {
    getNewCommentsCount: mockGetNewCommentsCount,
  },
  drizzlePostRepository: {
    getNewLikesCount: mockDrizzleGetNewLikesCount,
  },
}));

import { GET } from "@/app/api/v1/messages/unread/route";

describe("Message unread API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockFindByUsername.mockResolvedValue({ last_read_notifications_at: "2026-03-01T00:00:00.000Z" });
    mockGetTotalUnread.mockResolvedValue(0);
    mockGetNewCommentsCount.mockResolvedValue(0);
    mockDrizzleGetNewLikesCount.mockResolvedValue(0);
  });

  it("GET /api/v1/messages/unread returns 0 for anonymous user without deprecation headers", async () => {
    const response = await GET(new Request("http://localhost/api/v1/messages/unread") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ unread_count: 0 });
    expect(response.headers.get("Deprecation")).toBeNull();
  });

  it("GET /api/v1/messages/unread returns combined unread counts", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetTotalUnread.mockResolvedValue(2);
    mockGetNewCommentsCount.mockResolvedValue(3);
    mockDrizzleGetNewLikesCount.mockResolvedValue(1);

    const response = await GET(new Request("http://localhost/api/v1/messages/unread") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ unread_count: 6 });
  });
});
