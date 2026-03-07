// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockDrizzleGetPostDetail,
  mockDrizzleFindBySlug,
  mockDrizzleUpdateBySlug,
  mockUserFindByUsername,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockDrizzleGetPostDetail: vi.fn(),
  mockDrizzleFindBySlug: vi.fn(),
  mockDrizzleUpdateBySlug: vi.fn(),
  mockUserFindByUsername: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
  isAdminUser: vi.fn(() => false),
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: {
    getPostDetail: mockDrizzleGetPostDetail,
    findBySlug: mockDrizzleFindBySlug,
    updateBySlug: mockDrizzleUpdateBySlug,
  },
  postRepository: {
    hardDelete: vi.fn(),
  },
  userRepository: {
    findByUsername: mockUserFindByUsername,
  },
}));

import { GET, PUT } from "@/app/api/v1/blog/[slug]/route";

describe("Blog slug v1 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockUserFindByUsername.mockResolvedValue(null);
    mockDrizzleFindBySlug.mockResolvedValue(null);
    mockDrizzleUpdateBySlug.mockResolvedValue(true);
  });

  it("GET returns post detail from drizzle repository", async () => {
    mockGetAuthUser.mockResolvedValue("reader");
    mockDrizzleGetPostDetail.mockResolvedValue({
      id: 1,
      title: "Hello",
      slug: "hello",
      content: "world",
      created_at: "2026-03-06T00:00:00.000Z",
      updated_at: "2026-03-06T00:00:00.000Z",
      author: "alice",
      tags: "ai",
      status: "published",
      category_id: 2,
      view_count: 10,
      category_name: "AI",
      category_slug: "ai",
      like_count: 3,
      dislike_count: 0,
      comment_count: 1,
      favorite_count: 2,
      liked_by_me: true,
      favorited_by_me: true,
    });
    mockUserFindByUsername.mockResolvedValue({
      username: "alice",
      nickname: "Alice",
      avatar_url: "/a.png",
    });

    const response = await GET(
      new Request("http://localhost/api/v1/blog/hello"),
      { params: Promise.resolve({ slug: "hello" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDrizzleGetPostDetail).toHaveBeenCalledWith("hello", "reader");
    expect(body.data).toMatchObject({
      slug: "hello",
      author_name: "Alice",
      author_avatar: "/a.png",
    });
  });

  it("GET returns 404 when post does not exist", async () => {
    mockDrizzleGetPostDetail.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/blog/missing"),
      { params: Promise.resolve({ slug: "missing" }) },
    );

    expect(response.status).toBe(404);
  });

  it("PUT updates post content with drizzle repository", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockDrizzleFindBySlug.mockResolvedValue({
      slug: "hello",
      author: "alice",
    });

    const response = await PUT(
      new Request("http://localhost/api/v1/blog/hello", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated",
          content: "Updated body",
          tags: "ai,test",
          category_id: 3,
        }),
      }),
      { params: Promise.resolve({ slug: "hello" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDrizzleFindBySlug).toHaveBeenCalledWith("hello");
    expect(mockDrizzleUpdateBySlug).toHaveBeenCalledWith("hello", {
      title: "Updated",
      content: "Updated body",
      tags: "ai,test",
      category_id: 3,
    });
  });
});
