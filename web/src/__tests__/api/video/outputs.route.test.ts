// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockGetLocalVideos,
  mockFinalizeVideo,
  mockDeleteVideo,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockGetLocalVideos: vi.fn(),
  mockFinalizeVideo: vi.fn(),
  mockDeleteVideo: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/studio", () => ({
  getLocalVideos: mockGetLocalVideos,
  finalizeVideo: mockFinalizeVideo,
  deleteVideo: mockDeleteVideo,
}));

import { GET } from "@/app/api/v1/video/outputs/route";
import { POST } from "@/app/api/v1/video/outputs/finalize/route";
import { DELETE } from "@/app/api/v1/video/outputs/[name]/route";

describe("Video outputs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("GET /api/v1/video/outputs returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/v1/video/outputs") as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockGetLocalVideos).not.toHaveBeenCalled();
  });

  it("GET /api/v1/video/outputs returns finalized outputs including task_id", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetLocalVideos.mockResolvedValue([
      {
        name: "sora_1.mp4",
        size: 1024,
        mtime: 1741000000,
        url: "/downloads/sora_1.mp4",
        task_id: "task_123",
        generated_time: 1741000000,
        duration_seconds: 42,
        prompt: "A flying robot",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/video/outputs") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      expect.objectContaining({
        name: "sora_1.mp4",
        task_id: "task_123",
        prompt: "A flying robot",
      }),
    ]);
  });

  it("POST /api/v1/video/outputs/finalize finalizes a succeeded task", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockFinalizeVideo.mockResolvedValue({
      id: "task_123",
      file: "D:/code/downloads/sora_1.mp4",
      url: "https://cdn.example.com/sora_1.mp4",
      pid: "pid_1",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/video/outputs/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "task_123",
          prompt: "A flying robot",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFinalizeVideo).toHaveBeenCalledWith("task_123", "A flying robot");
    expect(body.data).toEqual(
      expect.objectContaining({
        id: "task_123",
        file: "D:/code/downloads/sora_1.mp4",
      })
    );
  });

  it("DELETE /api/v1/video/outputs/[name] deletes a finalized output", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await DELETE(
      new Request("http://localhost/api/v1/video/outputs/sora_1.mp4", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({ name: "sora_1.mp4" }),
      } as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteVideo).toHaveBeenCalledWith("sora_1.mp4");
  });
});
