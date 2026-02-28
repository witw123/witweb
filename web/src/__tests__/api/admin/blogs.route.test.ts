// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthIdentity, mockListAdminBlogs } = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockListAdminBlogs: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    listAdminBlogs: mockListAdminBlogs,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: vi.fn(),
}));

import { GET } from "@/app/api/admin/blogs/route";

describe("GET /api/admin/blogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/blogs?page=1&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when role has no blogs permission", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await GET(new Request("http://localhost/api/admin/blogs?page=1&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns 422 for invalid query", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });

    const response = await GET(new Request("http://localhost/api/admin/blogs?page=0&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("returns paginated blogs for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockListAdminBlogs.mockResolvedValue({
      items: [{ id: 1, title: "post-1" }],
      total: 1,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/blogs?page=2&limit=10&search=abc&status=draft&username=witw&tag=ai&date_from=2026-02-01&date_to=2026-02-28&sort=created_at_desc"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListAdminBlogs).toHaveBeenCalledWith({
      page: 2,
      size: 10,
      search: "abc",
      status: "draft",
      username: "witw",
      tag: "ai",
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      sort: "created_at_desc",
    });
    expect(body.data.items).toEqual([{ id: 1, title: "post-1" }]);
  });
});
