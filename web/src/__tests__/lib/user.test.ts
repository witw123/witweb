import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindByUsername,
  mockGetFollowCounts,
  mockIsFollowing,
  mockGetUserLikesReceived,
  mockGetPostCountByAuthor,
  mockGetActivityCount,
} = vi.hoisted(() => ({
  mockFindByUsername: vi.fn(),
  mockGetFollowCounts: vi.fn(),
  mockIsFollowing: vi.fn(),
  mockGetUserLikesReceived: vi.fn(),
  mockGetPostCountByAuthor: vi.fn(),
  mockGetActivityCount: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  drizzleUserRepository: {
    findByUsername: mockFindByUsername,
    getFollowCounts: mockGetFollowCounts,
    isFollowing: mockIsFollowing,
  },
  drizzlePostRepository: {
    getUserLikesReceived: mockGetUserLikesReceived,
    getPostCountByAuthor: mockGetPostCountByAuthor,
    getActivityCount: mockGetActivityCount,
  },
}));

import { publicProfile } from "@/lib/user";

describe("publicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByUsername.mockResolvedValue({
      username: "alice",
      role: "user",
      nickname: "Alice",
      avatar_url: "/a.png",
      cover_url: "",
      bio: "hello",
      created_at: "2026-03-01T00:00:00.000Z",
    });
    mockGetFollowCounts.mockResolvedValue({ following_count: 2, follower_count: 3 });
    mockGetUserLikesReceived.mockResolvedValue(4);
    mockGetPostCountByAuthor.mockResolvedValue(5);
    mockGetActivityCount.mockResolvedValue(6);
    mockIsFollowing.mockResolvedValue(true);
  });

  it("builds user profile statistics from drizzle repositories", async () => {
    const profile = await publicProfile("alice", "bob");

    expect(mockGetUserLikesReceived).toHaveBeenCalledWith("alice");
    expect(mockGetPostCountByAuthor).toHaveBeenCalledWith("alice");
    expect(mockGetActivityCount).toHaveBeenCalledWith("alice");
    expect(profile).toMatchObject({
      username: "alice",
      follower_count: 3,
      following_count: 2,
      like_received_count: 4,
      post_count: 5,
      activity_count: 6,
      is_following: true,
    });
  });
});
