// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthIdentity, mockPgQuery } = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockPgQuery: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/postgres-query", () => ({
  pgQuery: mockPgQuery,
}));

import { GET } from "@/app/api/admin/stats/trends/route";

describe("GET /api/admin/stats/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/stats/trends?days=7"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when non-admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await GET(new Request("http://localhost/api/admin/stats/trends?days=7"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns merged trend data for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockPgQuery
      .mockResolvedValueOnce([{ day: "2026-02-26" }, { day: "2026-02-27" }])
      .mockResolvedValueOnce([{ day: "2026-02-26", cnt: 2 }])
      .mockResolvedValueOnce([{ day: "2026-02-27", cnt: 3 }])
      .mockResolvedValueOnce([{ day: "2026-02-27", cnt: 5 }])
      .mockResolvedValueOnce([{ day: "2026-02-26", cnt: 4 }, { day: "2026-02-27", cnt: 6 }]);

    const response = await GET(new Request("http://localhost/api/admin/stats/trends?days=7"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.days).toBe(7);
    expect(body.data.items).toEqual([
      {
        day: "2026-02-26",
        new_users: 2,
        new_posts: 0,
        active_users: 4,
        messages: 0,
      },
      {
        day: "2026-02-27",
        new_users: 0,
        new_posts: 3,
        active_users: 6,
        messages: 5,
      },
    ]);
    expect(body.data.totals).toEqual({
      new_users: 2,
      new_posts: 3,
      active_users: 10,
      messages: 5,
    });
  });
});
