// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockIsAdminUser,
  mockFindById,
  mockUpdateContent,
  mockDelete,
  mockVote,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockIsAdminUser: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdateContent: vi.fn(),
  mockDelete: vi.fn(),
  mockVote: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
  isAdminUser: mockIsAdminUser,
}));

vi.mock("@/lib/repositories", () => ({
  drizzleCommentRepository: {
    findById: mockFindById,
    updateContent: mockUpdateContent,
    delete: mockDelete,
    vote: mockVote,
  },
}));

import { PUT, DELETE } from "@/app/api/v1/comments/[id]/route";
import { POST as LIKE_POST } from "@/app/api/v1/comments/[id]/like/route";
import { POST as DISLIKE_POST } from "@/app/api/v1/comments/[id]/dislike/route";

describe("Comment APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockIsAdminUser.mockReturnValue(false);
    mockFindById.mockResolvedValue({ id: 12, content: "hello" });
  });

  it("POST /api/v1/comments/[id]/like returns 401 when unauthenticated", async () => {
    const response = await LIKE_POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it("POST /api/v1/comments/[id]/like records an upvote", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await LIKE_POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockVote).toHaveBeenCalledWith(12, "alice", 1);
  });

  it("POST /api/v1/comments/[id]/dislike records a downvote", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await DISLIKE_POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "12" }),
    });

    expect(response.status).toBe(200);
    expect(mockVote).toHaveBeenCalledWith(12, "alice", -1);
  });

  it("PUT /api/v1/comments/[id] updates comment for admin", async () => {
    mockGetAuthUser.mockResolvedValue("admin");
    mockIsAdminUser.mockReturnValue(true);

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      }) as never,
      { params: Promise.resolve({ id: "12" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateContent).toHaveBeenCalledWith(12, "updated");
  });

  it("DELETE /api/v1/comments/[id] returns 403 for non-admin", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockIsAdminUser.mockReturnValue(false);

    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("DELETE /api/v1/comments/[id] deletes comment for admin", async () => {
    mockGetAuthUser.mockResolvedValue("admin");
    mockIsAdminUser.mockReturnValue(true);

    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(12);
  });
});
