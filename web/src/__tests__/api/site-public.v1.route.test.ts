// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthIdentity,
  mockHeaders,
  mockAboutGet,
  mockPostList,
  mockGetSiteStats,
  mockRecordSiteVisit,
} = vi.hoisted(() => ({
  mockGetAuthIdentity: vi.fn(),
  mockHeaders: vi.fn(),
  mockAboutGet: vi.fn(),
  mockPostList: vi.fn(),
  mockGetSiteStats: vi.fn(),
  mockRecordSiteVisit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/http", () => ({
  getAuthIdentity: mockGetAuthIdentity,
}));

vi.mock("@/lib/repositories", () => ({
  aboutRepository: {
    get: mockAboutGet,
  },
  postRepository: {
    list: mockPostList,
    getSiteStats: mockGetSiteStats,
    recordSiteVisit: mockRecordSiteVisit,
  },
}));

import { GET as ABOUT_GET } from "@/app/api/v1/about/route";
import { GET as STATS_GET } from "@/app/api/v1/stats/route";
import { POST as TRACK_VISIT_POST } from "@/app/api/v1/track-visit/route";

describe("Site public v1 APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthIdentity.mockResolvedValue(null);
    mockHeaders.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "127.0.0.1",
      })
    );
    mockAboutGet.mockResolvedValue({
      title: "About",
      subtitle: "",
      content: "Hello",
      links: [],
      skills: [],
    });
    mockPostList.mockResolvedValue({ items: [] });
    mockGetSiteStats.mockResolvedValue({
      totalPosts: 10,
      totalVisits: 20,
      totalVisitors: 5,
    });
    mockRecordSiteVisit.mockResolvedValue(undefined);
  });

  it("GET /api/v1/about returns about content with recent posts", async () => {
    const response = await ABOUT_GET(new Request("http://localhost/api/v1/about") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("About");
    expect(body.data.recentPosts).toEqual([]);
  });

  it("GET /api/v1/stats returns site stats", async () => {
    const response = await STATS_GET(new Request("http://localhost/api/v1/stats") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      totalPosts: 10,
      totalVisits: 20,
      totalVisitors: 5,
    });
  });

  it("POST /api/v1/track-visit records a visit", async () => {
    const response = await TRACK_VISIT_POST(
      new Request("http://localhost/api/v1/track-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "visitor_1", pageUrl: "/hello" }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRecordSiteVisit).toHaveBeenCalledWith("visitor_1", "/hello", "Vitest", "127.0.0.1");
  });
});
