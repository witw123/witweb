import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSearchKnowledgeVector,
  mockSearchKnowledgeLexical,
  mockListKnowledgeSourcePosts,
  mockInvokeModelText,
} = vi.hoisted(() => ({
  mockSearchKnowledgeVector: vi.fn(),
  mockSearchKnowledgeLexical: vi.fn(),
  mockListKnowledgeSourcePosts: vi.fn(),
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
    postRepository: {
      ...actual.postRepository,
      listKnowledgeSourcePosts: mockListKnowledgeSourcePosts,
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
    mockListKnowledgeSourcePosts.mockResolvedValue([]);
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

  it("converts schema-mismatched json into readable text instead of leaking raw json", async () => {
    mockInvokeModelText.mockResolvedValueOnce({
      output: [
        "```json",
        JSON.stringify({
          用户问题: "我要知道我所有的博客内容",
          可获取的博客内容: [
            {
              标题: "如何将文章草稿扩写成完整佳作：实用技巧与步骤指南",
              主要内容概要: ["为什么扩写比新建更有效", "梳理原有草稿", "结构扩展"],
              字数: "较长",
              状态: "已发布",
            },
          ],
          说明: "目前只找到一篇相关博客内容。",
        }),
        "```",
      ].join("\n"),
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
      query: "我要知道我所有的博客内容",
      model: "gemini-3-pro",
    });

    expect(result.answer).toContain("目前只找到一篇相关博客内容");
    expect(result.answer).toContain("如何将文章草稿扩写成完整佳作");
    expect(result.answer).not.toContain("```json");
    expect(result.answer).not.toContain('"用户问题"');
    expect(result.fallback_reason).toBe("parse_failed");
  });

  it("toggles feature flag from env", () => {
    expect(isLangChainRagEnabled()).toBe(true);
    process.env.AGENT_LANGCHAIN_RAG_ENABLED = "false";
    expect(isLangChainRagEnabled()).toBe(false);
  });

  it("falls back to creator posts when knowledge index misses historical blog content", async () => {
    mockSearchKnowledgeVector.mockResolvedValue([]);
    mockSearchKnowledgeLexical.mockResolvedValue([]);
    mockListKnowledgeSourcePosts.mockResolvedValue([
      {
        id: 11,
        slug: "draft-expansion-guide",
        title: "如何将文章草稿扩写成完整佳作：实用技巧与步骤指南",
        content: "扩写不是简单加字，而是先梳理核心观点，再补结构、案例和过渡，让草稿成长为成稿。",
        excerpt: "扩写草稿的步骤方法",
        tags: "写作技巧,内容创作",
        status: "draft",
        category_id: null,
        cover_image_url: null,
        created_at: "2026-03-11T00:00:00.000Z",
        updated_at: "2026-03-13T00:00:00.000Z",
      },
      {
        id: 12,
        slug: "cad-workflow-notes",
        title: "如何实现草图转 cad",
        content: "整理草图特征、拆分几何约束，再映射到 cad 命令流。",
        excerpt: "草图到 cad 的实现步骤",
        tags: "项目日志",
        status: "published",
        category_id: null,
        cover_image_url: null,
        created_at: "2026-03-10T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
    ]);

    const result = await retrieveKnowledgeContextWithLangChain({
      username: "alice",
      query: "我写过哪些关于草稿扩写的内容",
      limit: 3,
    });

    expect(result.retrieved_chunks.length).toBeGreaterThan(0);
    expect(result.retrieved_chunks[0].title).toContain("草稿扩写");
    expect(result.retrieval_strategy).toContain("posts_fallback");
    expect(result.citations[0].href).toBe("/post/draft-expansion-guide");
  });
});
