// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockBackfillCreatorKnowledge } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockBackfillCreatorKnowledge: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/knowledge-backfill", () => ({
  backfillCreatorKnowledge: mockBackfillCreatorKnowledge,
}));

import { POST } from "@/app/api/v1/knowledge/backfill/route";

describe("Knowledge backfill API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
    mockBackfillCreatorKnowledge.mockResolvedValue({
      username: "alice",
      posts_indexed: 2,
      about_indexed: 1,
      total_documents: 3,
      document_ids: ["a", "b", "c"],
    });
  });

  it("POST backfills current user content", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/knowledge/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_posts: true,
          include_about: true,
          limit: 50,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockBackfillCreatorKnowledge).toHaveBeenCalledWith("alice", {
      includePosts: true,
      includeAbout: true,
      limit: 50,
    });
    expect(body.data.total_documents).toBe(3);
  });
});
