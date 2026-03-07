// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockCreateVideoTask,
  mockFinalizeVideo,
  mockVideoTaskCreate,
  mockVideoTaskUpdateStatus,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCreateVideoTask: vi.fn(),
  mockFinalizeVideo: vi.fn(),
  mockVideoTaskCreate: vi.fn(),
  mockVideoTaskUpdateStatus: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/studio", () => ({
  createVideoTask: mockCreateVideoTask,
  finalizeVideo: mockFinalizeVideo,
}));

vi.mock("@/lib/repositories", () => ({
  videoTaskRepository: {
    create: mockVideoTaskCreate,
    updateStatus: mockVideoTaskUpdateStatus,
  },
}));

import { POST as POST_GENERATE } from "@/app/api/v1/video/generate/route";
import { POST as POST_FINALIZE } from "@/app/api/v1/video/outputs/finalize/route";

describe("Video write APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockCreateVideoTask.mockResolvedValue("task_123");
    mockFinalizeVideo.mockResolvedValue({
      ok: true,
      file_name: "demo.mp4",
    });
  });

  it("POST /api/v1/video/generate returns 401 when unauthenticated", async () => {
    const response = await POST_GENERATE(
      new Request("http://localhost/api/v1/video/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "hello" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/video/generate returns 422 for invalid payload", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_GENERATE(
      new Request("http://localhost/api/v1/video/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/video/generate creates and persists a text2video task", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_GENERATE(
      new Request("http://localhost/api/v1/video/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: "A cinematic city sunrise",
          duration: 12,
        }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateVideoTask).toHaveBeenCalledWith({
      model: "sora-2",
      prompt: "A cinematic city sunrise",
      url: undefined,
      aspectRatio: "9:16",
      duration: 12,
      remixTargetId: undefined,
      size: "small",
      webHook: "-1",
      shutProgress: false,
    });
    expect(mockVideoTaskCreate).toHaveBeenCalledWith({
      id: "task_123",
      username: "alice",
      task_type: "text2video",
      prompt: "A cinematic city sunrise",
      model: "sora-2",
      url: undefined,
      aspect_ratio: "9:16",
      duration: 12,
      remix_target_id: undefined,
      size: "small",
    });
    expect(mockVideoTaskUpdateStatus).toHaveBeenCalledWith("task_123", {
      status: "running",
      progress: 0,
    });
  });

  it("POST /api/v1/video/outputs/finalize returns 401 when unauthenticated", async () => {
    const response = await POST_FINALIZE(
      new Request("http://localhost/api/v1/video/outputs/finalize", {
        method: "POST",
        body: JSON.stringify({ id: "task_123" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/video/outputs/finalize returns 422 for invalid payload", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_FINALIZE(
      new Request("http://localhost/api/v1/video/outputs/finalize", {
        method: "POST",
        body: JSON.stringify({ id: "" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/video/outputs/finalize finalizes a task for the current user", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_FINALIZE(
      new Request("http://localhost/api/v1/video/outputs/finalize", {
        method: "POST",
        body: JSON.stringify({ id: "task_123", prompt: "Sunrise" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFinalizeVideo).toHaveBeenCalledWith("task_123", "Sunrise");
    expect(body.data).toEqual({
      ok: true,
      file_name: "demo.mp4",
    });
  });
});
