// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockGetAdminBlogDetail,
  mockUpdateById,
  mockSoftDeleteById,
  mockHardDeleteById,
  mockRecordAdminAudit,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockGetAdminBlogDetail: vi.fn(),
  mockUpdateById: vi.fn(),
  mockSoftDeleteById: vi.fn(),
  mockHardDeleteById: vi.fn(),
  mockRecordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    getAdminBlogDetail: mockGetAdminBlogDetail,
    updateById: mockUpdateById,
    softDeleteById: mockSoftDeleteById,
    hardDeleteById: mockHardDeleteById,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: mockRecordAdminAudit,
}));

import { GET, PUT, DELETE } from "@/app/api/admin/blogs/[id]/route";

describe("Admin Blog Detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET returns 403 when non-admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("GET returns 404 when blog not found", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockGetAdminBlogDetail.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "404" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("PUT updates blog and supports category_id = null", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockUpdateById.mockResolvedValue(true);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "updated",
          status: "draft",
          category_id: null,
        }),
      }),
      { params: Promise.resolve({ id: "7" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateById).toHaveBeenCalledWith(7, {
      status: "draft",
      title: "updated",
      content: undefined,
      tags: undefined,
      category_id: null,
    });
    expect(mockRecordAdminAudit).toHaveBeenCalled();
  });

  it("PUT returns 404 when target blog does not exist", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockUpdateById.mockResolvedValue(false);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "missing" }),
      }),
      { params: Promise.resolve({ id: "999" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("DELETE returns 404 when target blog does not exist", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockSoftDeleteById.mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "999" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});
