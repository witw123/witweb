// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockFetchAllEnabledSources,
  mockFetchRadarSourceNow,
  mockListRadarItems,
  mockGenerateRadarAnalysis,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockFetchAllEnabledSources: vi.fn(),
  mockFetchRadarSourceNow: vi.fn(),
  mockListRadarItems: vi.fn(),
  mockGenerateRadarAnalysis: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/topic-radar", () => ({
  fetchAllEnabledSources: mockFetchAllEnabledSources,
  fetchRadarSourceNow: mockFetchRadarSourceNow,
  listRadarItems: mockListRadarItems,
}));

vi.mock("@/lib/agent-llm", () => ({
  generateRadarAnalysis: mockGenerateRadarAnalysis,
}));

import { POST as POST_FETCH } from "@/app/api/v1/radar/fetch/route";
import { POST as POST_ANALYZE } from "@/app/api/v1/radar/analyze/route";

describe("Radar write APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockFetchAllEnabledSources.mockResolvedValue([{ id: 1, fetched: 2 }]);
    mockFetchRadarSourceNow.mockResolvedValue({ id: 2, fetched: 1 });
    mockListRadarItems.mockResolvedValue([
      {
        title: "AI chips surge",
        summary: "Semiconductor demand is rising",
        source_name: "TechNews",
        url: "https://example.com/1",
        score: 88,
        published_at: "2026-03-07T10:00:00.000Z",
      },
    ]);
    mockGenerateRadarAnalysis.mockResolvedValue("analysis result");
  });

  it("POST /api/v1/radar/fetch returns 401 when unauthenticated", async () => {
    const response = await POST_FETCH(
      new Request("http://localhost/api/v1/radar/fetch", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/radar/fetch fetches all enabled sources when no source_id is provided", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_FETCH(
      new Request("http://localhost/api/v1/radar/fetch", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFetchAllEnabledSources).toHaveBeenCalledWith("alice");
    expect(body.data.results).toEqual([{ id: 1, fetched: 2 }]);
  });

  it("POST /api/v1/radar/fetch fetches a specific source when source_id is provided", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_FETCH(
      new Request("http://localhost/api/v1/radar/fetch", {
        method: "POST",
        body: JSON.stringify({ source_id: 2 }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFetchRadarSourceNow).toHaveBeenCalledWith(2, "alice");
    expect(body.data.results).toEqual([{ id: 2, fetched: 1 }]);
  });

  it("POST /api/v1/radar/analyze returns 422 for invalid payload", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_ANALYZE(
      new Request("http://localhost/api/v1/radar/analyze", {
        method: "POST",
        body: JSON.stringify({ limit: 1 }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/radar/analyze returns analysis for filtered items", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST_ANALYZE(
      new Request("http://localhost/api/v1/radar/analyze", {
        method: "POST",
        body: JSON.stringify({ limit: 20, q: "AI", source_id: 3, focus: "芯片" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListRadarItems).toHaveBeenCalledWith("alice", {
      limit: 20,
      q: "AI",
      sourceId: 3,
    });
    expect(mockGenerateRadarAnalysis).toHaveBeenCalledWith(
      [
        {
          title: "AI chips surge",
          summary: "Semiconductor demand is rising",
          sourceName: "TechNews",
          url: "https://example.com/1",
          score: 88,
          publishedAt: "2026-03-07T10:00:00.000Z",
        },
      ],
      {
        focus: "芯片",
      }
    );
    expect(body.data).toEqual({
      analysis: "analysis result",
      item_count: 1,
    });
  });
});
