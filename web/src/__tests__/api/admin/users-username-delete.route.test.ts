// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockFindByUsername,
  mockDeleteByUsername,
  mockUpdateRole,
  mockGetPostCountByAuthor,
  mockRecordAdminAudit,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockFindByUsername: vi.fn(),
  mockDeleteByUsername: vi.fn(),
  mockUpdateRole: vi.fn(),
  mockGetPostCountByAuthor: vi.fn(),
  mockRecordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  userRepository: {
    findByUsername: mockFindByUsername,
    deleteByUsername: mockDeleteByUsername,
    updateRole: mockUpdateRole,
  },
  postRepository: {
    getPostCountByAuthor: mockGetPostCountByAuthor,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: mockRecordAdminAudit,
}));

import { DELETE, PUT } from "@/app/api/admin/users/[username]/route";

describe("DELETE /api/admin/users/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthIdentity.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ username: "alice" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "alice", role: "user" });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ username: "bob" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns 404 when target user does not exist", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockFindByUsername.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ username: "unknown" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 403 when target user is admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockFindByUsername.mockResolvedValue({ username: "other_admin", role: "admin" });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ username: "other_admin" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(mockDeleteByUsername).not.toHaveBeenCalled();
  });

  it("deletes target user and returns success", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockFindByUsername.mockResolvedValue({ username: "alice", role: "user" });
    mockDeleteByUsername.mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ username: "alice" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteByUsername).toHaveBeenCalledWith("alice");
  });
});

describe("PUT /api/admin/users/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when trying to change own role", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ username: "witw" }) }
    );
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("updates role successfully for allowed target", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "admin" });
    mockFindByUsername.mockResolvedValue({ username: "alice", role: "user" });
    mockUpdateRole.mockResolvedValue(true);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "operator" }),
      }),
      { params: Promise.resolve({ username: "alice" }) }
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateRole).toHaveBeenCalledWith("alice", "operator");
  });

  it("returns 403 when admin tries to assign super_admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "admin" });
    mockFindByUsername.mockResolvedValue({ username: "alice", role: "user" });

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "super_admin" }),
      }),
      { params: Promise.resolve({ username: "alice" }) }
    );
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("allows super_admin to assign admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "witw", role: "super_admin" });
    mockFindByUsername.mockResolvedValue({ username: "alice", role: "user" });
    mockUpdateRole.mockResolvedValue(true);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ username: "alice" }) }
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateRole).toHaveBeenCalledWith("alice", "admin");
  });
});
