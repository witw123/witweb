import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListKnowledgeDocuments, mockIndexKnowledgeDocument } = vi.hoisted(() => ({
  mockListKnowledgeDocuments: vi.fn(),
  mockIndexKnowledgeDocument: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      listKnowledgeDocuments: mockListKnowledgeDocuments,
    },
  };
});

vi.mock("@/lib/knowledge", () => ({
  indexKnowledgeDocument: mockIndexKnowledgeDocument,
}));

import { rebuildKnowledgeEmbeddings } from "@/lib/knowledge-rebuild";

describe("rebuildKnowledgeEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-indexes existing knowledge documents with preserved document ids", async () => {
    mockListKnowledgeDocuments.mockResolvedValue([
      {
        id: "blog_alice_ai",
        username: "alice",
        source_type: "blog_post",
        title: "AI",
        body: "content",
        metadata_json: '{"slug":"ai"}',
        status: "indexed",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
    ]);
    mockIndexKnowledgeDocument.mockResolvedValue({
      document_id: "blog_alice_ai",
      chunk_count: 2,
      embedding_model: "text-embedding-3-small-reduced-64",
      status: "indexed",
    });

    const result = await rebuildKnowledgeEmbeddings("alice", { limit: 10 });

    expect(mockIndexKnowledgeDocument).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({
        documentId: "blog_alice_ai",
        sourceType: "blog_post",
        title: "AI",
      })
    );
    expect(result.rebuilt_count).toBe(1);
    expect(result.embedding_models).toContain("text-embedding-3-small-reduced-64");
  });
});
