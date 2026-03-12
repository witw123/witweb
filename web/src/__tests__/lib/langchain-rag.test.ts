import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSearchKnowledgeVector,
  mockSearchKnowledgeLexical,
  mockInvokeModelText,
} = vi.hoisted(() => ({
  mockSearchKnowledgeVector: vi.fn(),
  mockSearchKnowledgeLexical: vi.fn(),
  mockInvokeModelText: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      searchKnowledgeVector: mockSearchKnowledgeVector,
      searchKnowledgeLexical: mockSearchKnowledgeLexical,
    },
  };
});

vi.mock("@/lib/model-runtime", () => ({
  invokeModelText: mockInvokeModelText,
}));

vi.mock("@/lib/agent-memory", () => ({
  getRagMemoryContext: vi.fn().mockResolvedValue({
    conversationSummary: "summary",
    conversationKeyPoints: [],
    longTermMemories: [],
  }),
}));

import {
  isLangChainRagEnabled,
  retrieveKnowledgeContextWithLangChain,
  runLangChainRagReply,
} from "@/lib/rag/langchain-rag";

describe("langchain rag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AGENT_LANGCHAIN_RAG_ENABLED;
  });

  it("merges hybrid retrieval results and skips rewrite for short queries", async () => {
    mockSearchKnowledgeVector.mockResolvedValue([
      {
        id: 1,
        document_id: "doc_1",
        document_title: "AI doc",
        document_source_type: "blog_post",
        content: "AI content strategy",
        metadata_json: "{}",
        chunk_index: 0,
        similarity: 0.82,
      },
    ]);
    mockSearchKnowledgeLexical.mockResolvedValue([
      {
        id: 1,
        document_id: "doc_1",
        document_title: "AI doc",
        document_source_type: "blog_post",
        content: "AI content strategy",
        metadata_json: "{}",
        chunk_index: 0,
      },
    ]);

    const result = await retrieveKnowledgeContextWithLangChain({
      username: "alice",
      query: "AI strategy",
      limit: 3,
    });

    expect(result.retrieved_chunks.length).toBe(1);
    expect(result.citations[0].document_id).toBe("doc_1");
    expect(result.retrieval_confidence).toBeGreaterThan(0);
    expect(result.retrieval_strategy).toContain("fast_identity+langchain_hybrid_pgvector");
    expect(mockInvokeModelText).not.toHaveBeenCalled();
  });

  it("retries with rewritten query only after empty retrieval", async () => {
    mockInvokeModelText.mockResolvedValueOnce({ output: "openclaw github robotics tool" });
    mockSearchKnowledgeVector
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          document_id: "doc_2",
          document_title: "OpenClaw notes",
          document_source_type: "blog_post",
          content: "OpenClaw project overview",
          metadata_json: "{}",
          chunk_index: 0,
          similarity: 0.86,
        },
      ]);
    mockSearchKnowledgeLexical
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          document_id: "doc_2",
          document_title: "OpenClaw notes",
          document_source_type: "blog_post",
          content: "OpenClaw project overview",
          metadata_json: "{}",
          chunk_index: 0,
        },
      ]);

    const result = await retrieveKnowledgeContextWithLangChain({
      username: "alice",
      query: "openclaw latest trends for creator article",
      limit: 3,
    });

    expect(mockInvokeModelText).toHaveBeenCalledTimes(1);
    expect(result.retrieved_chunks[0].document_id).toBe("doc_2");
    expect(result.retrieval_strategy).toContain("llm_rewrite+langchain_hybrid_pgvector");
  });

  it("builds rag answer with citations", async () => {
    mockInvokeModelText.mockResolvedValueOnce({
      output: JSON.stringify({
        answer: "Focus on one vertical topic first.",
        citations: [{ document_id: "doc_1", chunk_index: 0, title: "AI doc" }],
      }),
    });
    mockSearchKnowledgeVector.mockResolvedValue([
      {
        id: 1,
        document_id: "doc_1",
        document_title: "AI doc",
        document_source_type: "blog_post",
        content: "Focus on one topic first.",
        metadata_json: "{}",
        chunk_index: 0,
        similarity: 0.9,
      },
    ]);
    mockSearchKnowledgeLexical.mockResolvedValue([]);

    const result = await runLangChainRagReply({
      username: "alice",
      query: "How to improve blog quality?",
      model: "gemini-3-pro",
    });

    expect(result.answer).toContain("Focus on one vertical topic first");
    expect(result.citation_count).toBeGreaterThan(0);
    expect(result.citations[0].document_id).toBe("doc_1");
    expect(result.rag_strategy).toBe("langchain_hybrid");
  });

  it("toggles feature flag from env", () => {
    expect(isLangChainRagEnabled()).toBe(true);
    process.env.AGENT_LANGCHAIN_RAG_ENABLED = "false";
    expect(isLangChainRagEnabled()).toBe(false);
  });
});
