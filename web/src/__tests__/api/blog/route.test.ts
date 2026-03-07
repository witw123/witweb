// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockDrizzlePostList,
  mockDrizzlePostCreate,
  mockDrizzlePostFindBySlug,
  mockUserFindByUsername,
  mockUserListBasicByUsernames,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockDrizzlePostList: vi.fn(),
  mockDrizzlePostCreate: vi.fn(),
  mockDrizzlePostFindBySlug: vi.fn(),
  mockUserFindByUsername: vi.fn(),
  mockUserListBasicByUsernames: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: {
    list: mockDrizzlePostList,
    create: mockDrizzlePostCreate,
    findBySlug: mockDrizzlePostFindBySlug,
  },
  userRepository: {
    findByUsername: mockUserFindByUsername,
    listBasicByUsernames: mockUserListBasicByUsernames,
  },
}));

import { GET, POST } from "@/app/api/v1/blog/route";

describe("Blog API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockUserFindByUsername.mockResolvedValue(null);
    mockUserListBasicByUsernames.mockResolvedValue([]);
    mockDrizzlePostFindBySlug.mockResolvedValue(null);
    mockDrizzlePostCreate.mockResolvedValue(1);
  });

  it("GET returns paginated posts with attached author profile", async () => {
    mockGetAuthUser.mockResolvedValue("reader");
    mockUserFindByUsername.mockResolvedValue({ id: 12, username: "alice" });
    mockDrizzlePostList.mockResolvedValue({
      items: [
        {
          title: "Hello",
          slug: "hello",
          content: "world",
          created_at: "2026-03-06T00:00:00.000Z",
          author: "alice",
          tags: "ai",
          category_id: 2,
          category_name: "AI",
          category_slug: "ai",
          view_count: 10,
          like_count: 3,
          dislike_count: 0,
          comment_count: 1,
          favorite_count: 2,
          favorited_by_me: true,
        },
      ],
      total: 1,
      page: 2,
      size: 5,
    });
    mockUserListBasicByUsernames.mockResolvedValue([
      { username: "alice", nickname: "Alice", avatar_url: "/a.png" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/blog?page=2&size=5&q=test&author=alice&tag=ai&category=tools")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDrizzlePostList).toHaveBeenCalledWith({
      page: 2,
      size: 5,
      query: "test",
      author: "alice",
      authorAliases: ["alice", "12"],
      tag: "ai",
      category: "tools",
      username: "reader",
    });
    expect(body.data.items[0]).toMatchObject({
      author: "alice",
      author_name: "Alice",
      author_avatar: "/a.png",
    });
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Post",
          content: "Body",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockDrizzlePostCreate).not.toHaveBeenCalled();
  });

  it("POST creates a blog with generated slug", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST(
      new Request("http://localhost/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Post",
          content: "Body",
          tags: "ai,news",
          category_id: 3,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockDrizzlePostCreate).toHaveBeenCalledWith({
      title: "New Post",
      slug: "new-post",
      content: "Body",
      author: "alice",
      tags: "ai,news",
      category_id: 3,
    });
  });

  it("POST increments slug suffix when slug already exists", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockDrizzlePostFindBySlug
      .mockResolvedValueOnce({ id: 1, slug: "hello" })
      .mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Hello",
          content: "Body",
          slug: "hello",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockDrizzlePostCreate).toHaveBeenCalledWith({
      title: "Hello",
      slug: "hello-1",
      content: "Body",
      author: "alice",
      tags: "",
      category_id: null,
    });
  });
});
