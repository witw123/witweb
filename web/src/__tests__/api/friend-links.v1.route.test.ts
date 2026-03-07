// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockListFriendLinks,
  mockCreateFriendLink,
  mockUpdateFriendLink,
  mockDeleteFriendLink,
  mockDetectFriendLinkIcon,
  mockRecordAdminAudit,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockListFriendLinks: vi.fn(),
  mockCreateFriendLink: vi.fn(),
  mockUpdateFriendLink: vi.fn(),
  mockDeleteFriendLink: vi.fn(),
  mockDetectFriendLinkIcon: vi.fn(),
  mockRecordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    listFriendLinks: mockListFriendLinks,
    createFriendLink: mockCreateFriendLink,
    updateFriendLink: mockUpdateFriendLink,
    deleteFriendLink: mockDeleteFriendLink,
  },
}));

vi.mock("@/lib/friend-link-icon", () => ({
  detectFriendLinkIcon: mockDetectFriendLinkIcon,
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAudit: mockRecordAdminAudit,
}));

import { GET, POST } from "@/app/api/v1/friend-links/route";
import { PUT, DELETE } from "@/app/api/v1/friend-links/[id]/route";

describe("Friend links v1 APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthIdentity.mockResolvedValue(null);
    mockListFriendLinks.mockResolvedValue([]);
    mockCreateFriendLink.mockResolvedValue(1);
    mockDetectFriendLinkIcon.mockResolvedValue("https://cdn.test/icon.png");
  });

  it("GET /api/v1/friend-links returns public links", async () => {
    mockListFriendLinks.mockResolvedValue([{ id: 1, name: "OpenAI" }]);

    const response = await GET(new Request("http://localhost/api/v1/friend-links") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListFriendLinks).toHaveBeenCalledWith(false);
    expect(body.data.links).toEqual([{ id: 1, name: "OpenAI" }]);
  });

  it("POST /api/v1/friend-links returns 401 when unauthenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "OpenAI", url: "https://openai.com" }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/friend-links creates link for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "admin", role: "admin" });

    const response = await POST(
      new Request("http://localhost/api/v1/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "OpenAI", url: "https://openai.com" }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockCreateFriendLink).toHaveBeenCalled();
    expect(mockRecordAdminAudit).toHaveBeenCalled();
  });

  it("PUT /api/v1/friend-links/[id] updates link for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "admin", role: "admin" });

    const response = await PUT(
      new Request("http://localhost/api/v1/friend-links/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "OpenAI", url: "https://openai.com", is_active: 1 }),
      }) as never,
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateFriendLink).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "OpenAI", url: "https://openai.com", is_active: true })
    );
  });

  it("DELETE /api/v1/friend-links/[id] deletes link for admin", async () => {
    mockGetAuthIdentity.mockResolvedValue({ username: "admin", role: "admin" });

    const response = await DELETE(new Request("http://localhost/api/v1/friend-links/1") as never, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);
    expect(mockDeleteFriendLink).toHaveBeenCalledWith(1);
  });
});
