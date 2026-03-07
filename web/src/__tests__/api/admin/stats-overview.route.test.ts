// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockUserCount,
  mockPostCountAll,
  mockPostCountByStatus,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockUserCount: vi.fn(),
  mockPostCountAll: vi.fn(),
  mockPostCountByStatus: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  userRepository: {
    count: mockUserCount,
  },
  postRepository: {
    countAll: mockPostCountAll,
    countByStatus: mockPostCountByStatus,
  },
}));

import { GET } from "@/app/api/admin/stats/route";

describe("GET /api/admin/stats?view=overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/stats?view=overview"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await GET(new Request("http://localhost/api/admin/stats?view=overview"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns overview stats for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockUserCount.mockResolvedValue(10);
    mockPostCountAll.mockResolvedValue(20);
    mockPostCountByStatus.mockImplementation(async (status: string) =>
      status === "published" ? 14 : 6
    );

    const response = await GET(new Request("http://localhost/api/admin/stats?view=overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      total_users: 10,
      total_blogs: 20,
      total_published_blogs: 14,
      total_draft_blogs: 6,
    });
  });
});
