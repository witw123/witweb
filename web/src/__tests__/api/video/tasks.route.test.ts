// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockListByUser } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockListByUser: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  videoTaskRepository: {
    listByUser: mockListByUser,
  },
}));

import { GET } from "@/app/api/v1/video/tasks/route";

describe("GET /api/v1/video/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/v1/video/tasks?page=1&limit=20") as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 422 for invalid query", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await GET(new Request("http://localhost/api/v1/video/tasks?page=0&limit=20") as never);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("returns paginated tasks for authenticated user", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListByUser.mockResolvedValue({
      items: [{ id: "task_1", task_type: "text2video" }],
      total: 1,
      page: 2,
      size: 10,
    });

    const response = await GET(
      new Request("http://localhost/api/v1/video/tasks?page=2&limit=10&task_type=text2video") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListByUser).toHaveBeenCalledWith("alice", 2, 10, "text2video");
    expect(body.data.items).toEqual([{ id: "task_1", task_type: "text2video" }]);
  });
});
