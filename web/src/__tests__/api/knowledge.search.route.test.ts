// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockSearchKnowledge } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSearchKnowledge: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/knowledge", () => ({
  searchKnowledge: mockSearchKnowledge,
}));

import { POST } from "@/app/api/v1/knowledge/search/route";

describe("knowledge search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("returns extended rag metadata fields", async () => {
    mockSearchKnowledge.mockResolvedValue({
      query: "AI",
      rewritten_query: "AI 内容",
      retrieval_strategy: "llm_rewrite+langchain_hybrid_pgvector",
      retrieval_confidence: 0.82,
      filtered_count: 2,
      citations: [{ document_id: "doc_1", chunk_index: 0, title: "AI 文档" }],
      items: [],
    });

    const response = await POST(
      new Request("http://localhost/api/v1/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "AI", limit: 3 }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.retrieval_confidence).toBe(0.82);
    expect(body.data.filtered_count).toBe(2);
    expect(body.data.citations[0].document_id).toBe("doc_1");
  });
});

