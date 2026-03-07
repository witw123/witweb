// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockMarkNotificationsAsRead } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockMarkNotificationsAsRead: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  userRepository: {
    markNotificationsAsRead: mockMarkNotificationsAsRead,
  },
}));

import { POST } from "@/app/api/v1/messages/read-notifications/route";

describe("Message read-notifications API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("POST /api/v1/messages/read-notifications returns 401 when unauthenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/messages/read-notifications") as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockMarkNotificationsAsRead).not.toHaveBeenCalled();
  });

  it("POST /api/v1/messages/read-notifications marks notifications as read", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST(
      new Request("http://localhost/api/v1/messages/read-notifications") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockMarkNotificationsAsRead).toHaveBeenCalledWith("alice");
    expect(body.data).toEqual({ ok: true });
  });
});
