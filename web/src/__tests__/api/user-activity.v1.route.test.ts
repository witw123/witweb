// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetActivities } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: {
    getActivities: mockGetActivities,
  },
}));

import { GET } from "@/app/api/v1/users/[username]/activity/route";

describe("User activity v1 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActivities.mockResolvedValue({
      items: [
        {
          type: "post",
          title: "Hello",
          slug: "hello",
          created_at: "2026-03-06T00:00:00.000Z",
          content: "world",
          target_user: null,
        },
      ],
      total: 1,
      page: 2,
      size: 5,
    });
  });

  it("GET returns activity items from drizzle post repository", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/users/alice/activity?page=2&size=5"),
      { params: Promise.resolve({ username: "alice" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetActivities).toHaveBeenCalledWith("alice", 2, 5);
    expect(body.data.total).toBe(1);
    expect(body.data.items[0].slug).toBe("hello");
  });
});
