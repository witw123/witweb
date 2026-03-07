// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockListRadarSources,
  mockCreateRadarSource,
  mockListRadarSavedTopics,
  mockCreateRadarSavedTopic,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockListRadarSources: vi.fn(),
  mockCreateRadarSource: vi.fn(),
  mockListRadarSavedTopics: vi.fn(),
  mockCreateRadarSavedTopic: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/topic-radar", () => ({
  listRadarSources: mockListRadarSources,
  createRadarSource: mockCreateRadarSource,
  listRadarSavedTopics: mockListRadarSavedTopics,
  createRadarSavedTopic: mockCreateRadarSavedTopic,
}));

import { GET as GET_SOURCES, POST as POST_SOURCES } from "@/app/api/v1/radar/sources/route";
import { GET as GET_TOPICS, POST as POST_TOPICS } from "@/app/api/v1/radar/topics/route";

describe("Radar CRUD APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockListRadarSources.mockResolvedValue([]);
    mockCreateRadarSource.mockResolvedValue({ id: 1 });
    mockListRadarSavedTopics.mockResolvedValue([]);
    mockCreateRadarSavedTopic.mockResolvedValue({ id: 1 });
  });

  // ---- Sources ----
  describe("GET /api/v1/radar/sources", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await GET_SOURCES(
        new Request("http://localhost/api/v1/radar/sources") as never
      );
      expect(response.status).toBe(401);
    });

    it("returns sources for authenticated user", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockListRadarSources.mockResolvedValue([
        { id: 1, name: "TechCrunch", url: "https://techcrunch.com/feed" },
      ]);

      const response = await GET_SOURCES(
        new Request("http://localhost/api/v1/radar/sources") as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockListRadarSources).toHaveBeenCalledWith("alice");
      expect(body.data.items).toEqual([
        { id: 1, name: "TechCrunch", url: "https://techcrunch.com/feed" },
      ]);
    });
  });

  describe("POST /api/v1/radar/sources", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await POST_SOURCES(
        new Request("http://localhost/api/v1/radar/sources", {
          method: "POST",
          body: JSON.stringify({ name: "Test", url: "https://example.com/rss" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(401);
    });

    it("returns 422 for invalid payload", async () => {
      mockGetAuthUser.mockResolvedValue("alice");

      const response = await POST_SOURCES(
        new Request("http://localhost/api/v1/radar/sources", {
          method: "POST",
          body: JSON.stringify({ name: "", url: "not-a-url" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(422);
    });

    it("creates a radar source", async () => {
      mockGetAuthUser.mockResolvedValue("alice");

      const response = await POST_SOURCES(
        new Request("http://localhost/api/v1/radar/sources", {
          method: "POST",
          body: JSON.stringify({
            name: "Hacker News",
            url: "https://hnrss.org/newest",
            type: "rss",
          }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateRadarSource).toHaveBeenCalledWith({
        username: "alice",
        name: "Hacker News",
        url: "https://hnrss.org/newest",
        type: "rss",
        parserConfigJson: undefined,
        enabled: undefined,
      });
      expect(body.data.id).toBe(1);
    });
  });

  // ---- Topics ----
  describe("GET /api/v1/radar/topics", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await GET_TOPICS(
        new Request("http://localhost/api/v1/radar/topics") as never
      );
      expect(response.status).toBe(401);
    });

    it("returns saved topics for authenticated user", async () => {
      mockGetAuthUser.mockResolvedValue("alice");
      mockListRadarSavedTopics.mockResolvedValue([
        { id: 1, title: "AI Trends", kind: "analysis" },
      ]);

      const response = await GET_TOPICS(
        new Request("http://localhost/api/v1/radar/topics?limit=20&kind=analysis") as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockListRadarSavedTopics).toHaveBeenCalledWith("alice", {
        limit: 20,
        q: undefined,
        kind: "analysis",
      });
      expect(body.data.items).toEqual([
        { id: 1, title: "AI Trends", kind: "analysis" },
      ]);
    });
  });

  describe("POST /api/v1/radar/topics", () => {
    it("returns 401 when unauthenticated", async () => {
      const response = await POST_TOPICS(
        new Request("http://localhost/api/v1/radar/topics", {
          method: "POST",
          body: JSON.stringify({ title: "Test" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(401);
    });

    it("returns 422 for invalid payload", async () => {
      mockGetAuthUser.mockResolvedValue("alice");

      const response = await POST_TOPICS(
        new Request("http://localhost/api/v1/radar/topics", {
          method: "POST",
          body: JSON.stringify({ title: "" }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      expect(response.status).toBe(422);
    });

    it("creates a saved topic", async () => {
      mockGetAuthUser.mockResolvedValue("alice");

      const response = await POST_TOPICS(
        new Request("http://localhost/api/v1/radar/topics", {
          method: "POST",
          body: JSON.stringify({
            kind: "item",
            title: "Semiconductor demand spikes",
            summary: "Global chip shortage continues",
            source_name: "Reuters",
            source_url: "https://reuters.com/article/1",
            score: 92,
            tags: ["semiconductor", "supply-chain"],
          }),
          headers: { "Content-Type": "application/json" },
        }) as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateRadarSavedTopic).toHaveBeenCalledWith({
        username: "alice",
        kind: "item",
        title: "Semiconductor demand spikes",
        summary: "Global chip shortage continues",
        content: undefined,
        sourceName: "Reuters",
        sourceUrl: "https://reuters.com/article/1",
        score: 92,
        tags: ["semiconductor", "supply-chain"],
      });
      expect(body.data.id).toBe(1);
    });
  });
});
