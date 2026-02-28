// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthIdentity, mockListAdminCategories } = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockListAdminCategories: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    listAdminCategories: mockListAdminCategories,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: vi.fn(),
}));

import { GET } from "@/app/api/admin/categories/route";

describe("GET /api/admin/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/categories?page=1&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when role has no categories permission", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await GET(new Request("http://localhost/api/admin/categories?page=1&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns 422 for invalid query", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });

    const response = await GET(new Request("http://localhost/api/admin/categories?page=0&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("returns paginated categories for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockListAdminCategories.mockResolvedValue({
      items: [{ id: 1, name: "默认分类" }],
      total: 1,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/categories?page=2&limit=10&search=默认")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListAdminCategories).toHaveBeenCalledWith(2, 10, "默认");
    expect(body.data.items).toEqual([{ id: 1, name: "默认分类" }]);
  });
});
