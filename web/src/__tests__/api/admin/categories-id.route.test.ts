// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockUpdateCategory,
  mockDeleteCategory,
  mockRecordAdminAudit,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockUpdateCategory: vi.fn(),
  mockDeleteCategory: vi.fn(),
  mockRecordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    updateCategory: mockUpdateCategory,
    deleteCategory: mockDeleteCategory,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: mockRecordAdminAudit,
}));

import { PUT, DELETE } from "@/app/api/admin/categories/[id]/route";

describe("Admin Category Detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT returns 401 when unauthenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      }),
      { params: Promise.resolve({ id: "1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("PUT returns 403 when non-admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      }),
      { params: Promise.resolve({ id: "1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("PUT returns 400 when no updatable fields provided", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("PUT updates category and records audit log", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockUpdateCategory.mockResolvedValue(true);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name", slug: "new-name", is_active: 1 }),
      }),
      { params: Promise.resolve({ id: "6" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateCategory).toHaveBeenCalledWith(6, {
      name: "New Name",
      slug: "new-name",
      is_active: true,
    });
    expect(mockRecordAdminAudit).toHaveBeenCalled();
  });

  it("DELETE removes category and records audit log", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockDeleteCategory.mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "6" }),
    });

    expect(response.status).toBe(204);
    expect(mockDeleteCategory).toHaveBeenCalledWith(6);
    expect(mockRecordAdminAudit).toHaveBeenCalled();
  });
});
