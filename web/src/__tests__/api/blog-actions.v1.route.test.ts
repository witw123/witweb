// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockIncrementViewCount,
  mockToggleLike,
  mockToggleFavorite,
  mockDrizzleGetPostDetail,
  mockDrizzleFindBySlug,
  mockCreateComment,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockIncrementViewCount: vi.fn(),
  mockToggleLike: vi.fn(),
  mockToggleFavorite: vi.fn(),
  mockDrizzleGetPostDetail: vi.fn(),
  mockDrizzleFindBySlug: vi.fn(),
  mockCreateComment: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: {
    incrementViewCount: mockIncrementViewCount,
    toggleLike: mockToggleLike,
    toggleFavorite: mockToggleFavorite,
    getPostDetail: mockDrizzleGetPostDetail,
    findBySlug: mockDrizzleFindBySlug,
  },
  drizzleCommentRepository: {
    create: mockCreateComment,
    findByPostSlug: vi.fn(),
  },
  drizzleUserRepository: {
    listBasicByUsernames: vi.fn(),
  },
}));

import { POST as POST_COMMENT } from "@/app/api/v1/blog/[slug]/comments/route";
import { POST as POST_VIEW } from "@/app/api/v1/blog/[slug]/view/route";
import { POST as POST_LIKE } from "@/app/api/v1/blog/[slug]/like/route";
import { POST as POST_DISLIKE } from "@/app/api/v1/blog/[slug]/dislike/route";
import { POST as POST_FAVORITE } from "@/app/api/v1/blog/[slug]/favorite/route";

describe("Blog action APIs v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
    mockIncrementViewCount.mockResolvedValue(11);
    mockToggleLike.mockResolvedValue({ liked: true, disliked: true });
    mockToggleFavorite.mockResolvedValue(true);
    mockDrizzleGetPostDetail.mockResolvedValue({
      like_count: 3,
      dislike_count: 1,
      favorite_count: 2,
      comment_count: 4,
    });
    mockDrizzleFindBySlug.mockResolvedValue({ id: 9, slug: "hello" });
    mockCreateComment.mockResolvedValue(1);
  });

  it("POST /api/v1/blog/[slug]/view increments count with drizzle repository", async () => {
    const response = await POST_VIEW(
      new Request("http://localhost/api/v1/blog/hello/view", { method: "POST" }),
      { params: Promise.resolve({ slug: "hello" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockIncrementViewCount).toHaveBeenCalledWith("hello");
    expect(body.data.view_count).toBe(11);
  });

  it("POST /api/v1/blog/[slug]/comments resolves post with drizzle repository", async () => {
    const response = await POST_COMMENT(
      new Request("http://localhost/api/v1/blog/hello/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      }),
      { params: Promise.resolve({ slug: "hello" }) },
    );

    expect(response.status).toBe(201);
    expect(mockDrizzleFindBySlug).toHaveBeenCalledWith("hello");
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ post_id: 9, author: "alice", content: "hello" }),
    );
  });

  it("POST /api/v1/blog/[slug]/like reads updated counters from drizzle repository", async () => {
    const response = await POST_LIKE(
      new Request("http://localhost/api/v1/blog/hello/like", { method: "POST" }),
      { params: Promise.resolve({ slug: "hello" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockToggleLike).toHaveBeenCalledWith("hello", "alice", 1);
    expect(mockDrizzleGetPostDetail).toHaveBeenCalledWith("hello", "alice");
    expect(body.data.like_count).toBe(3);
  });

  it("POST /api/v1/blog/[slug]/dislike reads updated counters from drizzle repository", async () => {
    const response = await POST_DISLIKE(
      new Request("http://localhost/api/v1/blog/hello/dislike", { method: "POST" }),
      { params: Promise.resolve({ slug: "hello" }) },
    );

    expect(response.status).toBe(200);
    expect(mockToggleLike).toHaveBeenCalledWith("hello", "alice", -1);
    expect(mockDrizzleGetPostDetail).toHaveBeenCalledWith("hello", "alice");
  });

  it("POST /api/v1/blog/[slug]/favorite reads updated counters from drizzle repository", async () => {
    const response = await POST_FAVORITE(
      new Request("http://localhost/api/v1/blog/hello/favorite", { method: "POST" }),
      { params: Promise.resolve({ slug: "hello" }) },
    );

    expect(response.status).toBe(200);
    expect(mockToggleFavorite).toHaveBeenCalledWith("hello", "alice");
    expect(mockDrizzleGetPostDetail).toHaveBeenCalledWith("hello", "alice");
  });
});
