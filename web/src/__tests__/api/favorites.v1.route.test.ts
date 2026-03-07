// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockDrizzleListFavorites,
  mockUserListBasicByUsernames,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockDrizzleListFavorites: vi.fn(),
  mockUserListBasicByUsernames: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: {
    listFavorites: mockDrizzleListFavorites,
  },
  userRepository: {
    listBasicByUsernames: mockUserListBasicByUsernames,
  },
}));

import { GET } from "@/app/api/v1/favorites/route";

describe("Favorites v1 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserListBasicByUsernames.mockResolvedValue([]);
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/favorites") as never);

    expect(response.status).toBe(401);
    expect(mockDrizzleListFavorites).not.toHaveBeenCalled();
  });

  it("GET returns paginated favorites from drizzle repository", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockDrizzleListFavorites.mockResolvedValue({
      items: [
        {
          title: "Hello",
          slug: "hello",
          content: "world",
          created_at: "2026-03-06T00:00:00.000Z",
          author: "bob",
          tags: "ai",
          category_id: 2,
          view_count: 10,
          category_name: null,
          category_slug: null,
          like_count: 3,
          dislike_count: 0,
          comment_count: 1,
          favorite_count: 2,
          favorited_by_me: true,
          author_name: "bob",
          author_avatar: "",
        },
      ],
      total: 1,
      page: 2,
      size: 5,
    });
    mockUserListBasicByUsernames.mockResolvedValue([
      { username: "bob", nickname: "Bob", avatar_url: "/b.png" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/favorites?page=2&size=5") as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDrizzleListFavorites).toHaveBeenCalledWith("alice", 2, 5);
    expect(body.data.items[0]).toMatchObject({
      slug: "hello",
      author_name: "Bob",
      author_avatar: "/b.png",
    });
  });
});
