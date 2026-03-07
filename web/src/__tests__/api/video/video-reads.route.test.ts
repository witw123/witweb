// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockListCharacters,
  mockGetHistory,
  mockGetActiveTasks,
  mockGetResult,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockListCharacters: vi.fn(),
  mockGetHistory: vi.fn(),
  mockGetActiveTasks: vi.fn(),
  mockGetResult: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/repositories", () => ({
  videoTaskRepository: {
    listCharacters: mockListCharacters,
  },
}));

vi.mock("@/lib/studio", () => ({
  getHistory: mockGetHistory,
  getActiveTasks: mockGetActiveTasks,
  getResult: mockGetResult,
}));

import { GET as GET_CHARACTERS } from "@/app/api/v1/video/characters/route";
import { GET as GET_HISTORY } from "@/app/api/v1/video/history/route";
import { GET as GET_ACTIVE } from "@/app/api/v1/video/active/route";
import { POST as POST_RESULT } from "@/app/api/v1/video/result/route";

describe("Video read APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  // ---- Characters ----
  describe("GET /api/v1/video/characters", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await GET_CHARACTERS(
        new Request("http://localhost/api/v1/video/characters") as never
      );
      expect(response.status).toBe(401);
    });

    it("returns characters for authenticated user", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockListCharacters.mockResolvedValue([
        { id: 1, name: "Hero", image_url: "/img/hero.png" },
      ]);

      const response = await GET_CHARACTERS(
        new Request("http://localhost/api/v1/video/characters") as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockListCharacters).toHaveBeenCalledWith("alice");
      expect(body.data.characters).toEqual([
        { id: 1, name: "Hero", image_url: "/img/hero.png" },
      ]);
    });
  });

  // ---- History ----
  describe("GET /api/v1/video/history", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await GET_HISTORY(
        new Request("http://localhost/api/v1/video/history") as never
      );
      expect(response.status).toBe(401);
    });

    it("returns history for authenticated user", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockGetHistory.mockResolvedValue([
        { id: "task_1", prompt: "sunset clip" },
      ]);

      const response = await GET_HISTORY(
        new Request("http://localhost/api/v1/video/history") as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetHistory).toHaveBeenCalled();
    });
  });

  // ---- Active tasks ----
  describe("GET /api/v1/video/active", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await GET_ACTIVE(
        new Request("http://localhost/api/v1/video/active") as never
      );
      expect(response.status).toBe(401);
    });

    it("returns active tasks for authenticated user", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockGetActiveTasks.mockResolvedValue([
        { id: "task_2", status: "running" },
      ]);

      const response = await GET_ACTIVE(
        new Request("http://localhost/api/v1/video/active") as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetActiveTasks).toHaveBeenCalled();
    });
  });

  // ---- Result ----
  describe("POST /api/v1/video/result", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await POST_RESULT(
        new Request("http://localhost/api/v1/video/result", {
          method: "POST",
          body: JSON.stringify({ id: "task_1" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(401);
    });

    it("returns 422 for missing id", async () => {
      mockGetAuthUser.mockResolvedValue("alice");

      const response = await POST_RESULT(
        new Request("http://localhost/api/v1/video/result", {
          method: "POST",
          body: JSON.stringify({ id: "" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(422);
    });

    it("returns result for valid task id", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockGetResult.mockResolvedValue({
        id: "task_1",
        status: "succeeded",
        output_url: "https://cdn.example.com/video.mp4",
      });

      const response = await POST_RESULT(
        new Request("http://localhost/api/v1/video/result", {
          method: "POST",
          body: JSON.stringify({ id: "task_1" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetResult).toHaveBeenCalledWith("task_1");
    });
  });
});
