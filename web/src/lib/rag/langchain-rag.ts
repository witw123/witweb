import "server-only";

import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { AGENT_INPUT_TEXT } from "@/features/agent/constants";
import { getRagMemoryContext } from "@/lib/agent-memory";
import { embedKnowledgeText, toVectorLiteral } from "@/lib/embeddings";
import { invokeModelText } from "@/lib/model-runtime";
import { agentPlatformRepository } from "@/lib/repositories";
import { createTtlCache } from "@/lib/ttl-cache";

type RetrievalSource = "vector" | "lexical" | "hybrid";

export type RagCitation = {
  document_id: string;
  chunk_index: number;
  title: string;
  source_type?: string;
  slug?: string;
  href?: string;
};

export type RagRetrievedChunk = {
  id: number;
  document_id: string;
  title: string;
  source_type: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  retrieval_source: RetrievalSource;
  citation: RagCitation;
};

export type RagRetrievalResult = {
  query: string;
  rewritten_query: string;
  retrieval_strategy: string;
  retrieval_confidence: number;
  filtered_count: number;
  citations: RagCitation[];
  retrieved_chunks: RagRetrievedChunk[];
  timings: {
    retrieve_ms: number;
    rerank_ms: number;
  };
  context_token_estimate: number;
};

export type RagAnswerResult = RagRetrievalResult & {
  answer: string;
  rag_strategy: "langchain_hybrid";
  knowledge_hit_count: number;
  citation_count: number;
  memory_used: {
    conversation_summary: string;
    long_term_memory_count: number;
  };
  fallback_reason?: "low_confidence" | "empty_retrieval" | "parse_failed";
};

type RetrieveInput = {
  username: string;
  query: string;
  conversationId?: string | null;
  limit?: number;
  minScore?: number;
};

const LOW_CONFIDENCE_THRESHOLD = 0.15;
const rewriteCache = createTtlCache<{ rewrittenQuery: string; strategy: string }>(128, 5 * 60 * 1000);

const SYSTEM_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    "You are a Chinese assistant for creators.",
    "Answer in Chinese with concise and accurate wording.",
    "If knowledge snippets are insufficient, explicitly say uncertainty instead of fabricating facts.",
    "Return JSON only with fields:",
    '{{{{ "answer": "string", "citations": [{{{{"document_id":"string","chunk_index":0,"title":"string"}}}}] }}}}',
    "Only use citations from provided snippets.",
  ].join("\n")
);

const USER_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    "Question:",
    "{question}",
    "",
    "Conversation memory:",
    "{conversation_memory}",
    "",
    "Long-term memory:",
    "{long_term_memory}",
    "",
    "Knowledge snippets:",
    "{context}",
    "",
    "Now output JSON only.",
  ].join("\n")
);

function nowMs() {
  return Date.now();
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

function shouldRewriteQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.length <= 32 && tokenize(trimmed).length <= 4) {
    return false;
  }
  return true;
}

function scoreChunk(queryTokens: string[], content: string, title: string) {
  const combined = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (combined.includes(token)) {
      score += title.toLowerCase().includes(token) ? 3 : 1;
    }
  }
  return score;
}

function stripThinkBlocks(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJsonString(raw: string): string {
  const cleaned = stripThinkBlocks(raw);
  const trimmed = cleaned.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function buildCitation(params: {
  documentId: string;
  chunkIndex: number;
  title: string;
  sourceType: string;
  metadata: Record<string, unknown>;
}): RagCitation {
  const slug = typeof params.metadata.slug === "string" ? params.metadata.slug.trim() : "";
  const href =
    typeof params.metadata.url === "string" && params.metadata.url.trim()
      ? params.metadata.url.trim()
      : params.sourceType === "blog_post" && slug
        ? `/post/${slug}`
        : undefined;

  return {
    document_id: params.documentId,
    chunk_index: params.chunkIndex,
    title: params.title,
    source_type: params.sourceType,
    slug: slug || undefined,
    href,
  };
}

function normalizeConfidence(chunks: RagRetrievedChunk[]) {
  if (chunks.length === 0) return 0;
  const top = chunks.slice(0, 3);
  const avgScore = top.reduce((sum, item) => sum + item.score, 0) / top.length;
  return Number(Math.max(0, Math.min(1, avgScore / 120)).toFixed(4));
}

function formatContext(chunks: RagRetrievedChunk[]) {
  if (chunks.length === 0) return "No trusted snippets retrieved.";
  return chunks
    .map(
      (item, index) =>
        `[#${index + 1}] title=${item.title}\ndocument_id=${item.document_id}\nchunk_index=${item.citation.chunk_index}\ncontent=${item.content}`
    )
    .join("\n\n");
}

async function rewriteQuery(query: string) {
  const cacheKey = query.trim();
  if (cacheKey) {
    const cached = rewriteCache.get(cacheKey);
    if (cached) return cached;
  }
  if (!shouldRewriteQuery(query)) {
    const result = {
      rewrittenQuery: query,
      strategy: "fast_identity",
    };
    if (cacheKey) rewriteCache.set(cacheKey, result);
    return result;
  }
  try {
    const response = await invokeModelText({
      capability: "agent_llm",
      systemPrompt: "Rewrite the search query for creator-focused retrieval. Return one short line.",
      userPrompt: query,
    });
    const result = {
      rewrittenQuery: response.output.split(/\r?\n/)[0].trim() || query,
      strategy: "llm_rewrite",
    };
    if (cacheKey) rewriteCache.set(cacheKey, result);
    return result;
  } catch {
    const result = {
      rewrittenQuery: query,
      strategy: "fallback_identity",
    };
    if (cacheKey) rewriteCache.set(cacheKey, result);
    return result;
  }
}

async function fetchHybridRows(username: string, query: string, limit: number) {
  const queryTokens = tokenize(query);
  const queryEmbedding = await embedKnowledgeText(query);
  const vectorQuery = toVectorLiteral(queryEmbedding.embedding);
  const [vectorRows, lexicalRows] = await Promise.all([
    agentPlatformRepository.searchKnowledgeVector(username, vectorQuery, Math.max(limit * 2, 6)).catch(() => []),
    agentPlatformRepository.searchKnowledgeLexical(username, query, Math.max(limit * 2, 6)),
  ]);

  return {
    queryTokens,
    queryEmbedding,
    vectorRows,
    lexicalRows,
  };
}

function parseRagAnswer(
  raw: string,
  allowedCitations: RagCitation[]
): { answer: string; citations: RagCitation[]; parseFailed: boolean } {
  const allowedMap = new Map<string, RagCitation>(
    allowedCitations.map((item) => [`${item.document_id}:${item.chunk_index}`, item] as const)
  );
  const jsonText = extractJsonString(raw);

  try {
    const parsed = JSON.parse(jsonText) as {
      answer?: unknown;
      citations?: Array<{
        document_id?: unknown;
        chunk_index?: unknown;
        title?: unknown;
      }>;
    };
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    const citations = Array.isArray(parsed.citations)
      ? parsed.citations
          .map((item) => {
            const documentId = typeof item.document_id === "string" ? item.document_id.trim() : "";
            const chunkIndex = Number(item.chunk_index);
            if (!documentId || !Number.isInteger(chunkIndex)) return null;
            const key = `${documentId}:${chunkIndex}`;
            const matchedCitation = allowedMap.get(key);
            if (!matchedCitation) return null;
            return {
              ...matchedCitation,
              title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : matchedCitation.title,
            } as RagCitation;
          })
          .filter((item): item is RagCitation => Boolean(item))
      : [];

    return {
      answer: answer || stripThinkBlocks(raw),
      citations,
      parseFailed: false,
    };
  } catch {
    return {
      answer: stripThinkBlocks(raw),
      citations: [],
      parseFailed: true,
    };
  }
}

function emitRagTrace(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[agent.rag] ${event}`, payload);
}

class HybridRetriever {
  async retrieve(input: RetrieveInput): Promise<RagRetrievalResult> {
    const limit = Math.max(1, Math.min(10, input.limit || 5));
    const minScore = input.minScore ?? 8;
    const fetchStartedAt = nowMs();
    let rewrittenQuery = input.query;
    let strategy = "fast_identity";
    let firstPass = await fetchHybridRows(input.username, rewrittenQuery, limit);

    if (firstPass.vectorRows.length === 0 && firstPass.lexicalRows.length === 0) {
      const rewritten = await rewriteQuery(input.query);
      if (rewritten.rewrittenQuery.trim() && rewritten.rewrittenQuery.trim() !== input.query.trim()) {
        rewrittenQuery = rewritten.rewrittenQuery;
        strategy = rewritten.strategy;
        firstPass = await fetchHybridRows(input.username, rewrittenQuery, limit);
      }
    }

    const retrieveMs = nowMs() - fetchStartedAt;
    const rerankStartedAt = nowMs();
    const merged = new Map<number, RagRetrievedChunk>();
    const { queryTokens, queryEmbedding, vectorRows, lexicalRows } = firstPass;

    for (const row of vectorRows) {
      const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
      merged.set(row.id, {
        id: row.id,
        document_id: row.document_id,
        title: row.document_title,
        source_type: row.document_source_type,
        content: row.content,
        metadata,
        score: Number((Math.max(0, row.similarity) * 100).toFixed(2)),
        retrieval_source: "vector",
        citation: buildCitation({
          documentId: row.document_id,
          chunkIndex: row.chunk_index,
          title: row.document_title,
          sourceType: row.document_source_type,
          metadata,
        }),
      });
    }

    for (const row of lexicalRows) {
      const lexicalScore = scoreChunk(queryTokens, row.content, row.document_title) * 10;
      const existing = merged.get(row.id);
      if (existing) {
        existing.score += lexicalScore;
        existing.retrieval_source = "hybrid";
        continue;
      }
      const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
      merged.set(row.id, {
        id: row.id,
        document_id: row.document_id,
        title: row.document_title,
        source_type: row.document_source_type,
        content: row.content,
        metadata,
        score: lexicalScore,
        retrieval_source: "lexical",
        citation: buildCitation({
          documentId: row.document_id,
          chunkIndex: row.chunk_index,
          title: row.document_title,
          sourceType: row.document_source_type,
          metadata,
        }),
      });
    }

    const reranked = Array.from(merged.values()).sort((a, b) => b.score - a.score || b.id - a.id);
    const filtered = reranked.filter((item) => item.score >= minScore).slice(0, limit);
    const finalChunks = filtered.length > 0 ? filtered : reranked.slice(0, limit);
    const rerankMs = nowMs() - rerankStartedAt;
    const citations = finalChunks.map((item) => item.citation);

    const result = {
      query: input.query,
      rewritten_query: rewrittenQuery,
      retrieval_strategy: `${strategy}+langchain_hybrid_pgvector`,
      retrieval_confidence: normalizeConfidence(finalChunks),
      filtered_count: Math.max(0, reranked.length - finalChunks.length),
      citations,
      retrieved_chunks: finalChunks,
      timings: {
        retrieve_ms: retrieveMs,
        rerank_ms: rerankMs,
      },
      context_token_estimate: estimateTokens(formatContext(finalChunks)),
    };

    emitRagTrace("retrieval", {
      query: input.query,
      retrieval_strategy: result.retrieval_strategy,
      knowledge_hit_count: result.retrieved_chunks.length,
      citation_count: result.citations.length,
      retrieval_confidence: result.retrieval_confidence,
      filtered_count: result.filtered_count,
      retrieve_ms: result.timings.retrieve_ms,
      rerank_ms: result.timings.rerank_ms,
      context_token_estimate: result.context_token_estimate,
      embedding_source: queryEmbedding.source,
      conversation_id: input.conversationId || null,
    });

    return result;
  }
}

const hybridRetriever = new HybridRetriever();

export function isLangChainRagEnabled() {
  const raw = process.env.AGENT_LANGCHAIN_RAG_ENABLED;
  if (raw === undefined || raw === "") return true;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function retrieveKnowledgeContextWithLangChain(input: RetrieveInput) {
  return hybridRetriever.retrieve(input);
}

export async function runLangChainRagReply(input: {
  username: string;
  query: string;
  conversationId?: string | null;
  model?: string;
  limit?: number;
  minScore?: number;
  onChunk?: (chunk: string) => void;
  streamAnswer?: boolean;
}) {
  if (input.streamAnswer) {
    const [retrieval, memoryContext] = await Promise.all([
      hybridRetriever.retrieve({
        username: input.username,
        query: input.query,
        conversationId: input.conversationId,
        limit: input.limit,
        minScore: input.minScore,
      }),
      getRagMemoryContext(input.username, input.conversationId),
    ]);

    const confidence = retrieval.retrieval_confidence;
    const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
    const fallbackReason =
      retrieval.retrieved_chunks.length === 0 ? "empty_retrieval" : lowConfidence ? "low_confidence" : undefined;
    const fallbackCitations = retrieval.citations.slice(0, 2);

    if (retrieval.retrieved_chunks.length === 0) {
      return {
        ...retrieval,
        answer: AGENT_INPUT_TEXT.emptyRetrievalAnswer,
        citations: [],
        rag_strategy: "langchain_hybrid" as const,
        knowledge_hit_count: retrieval.retrieved_chunks.length,
        citation_count: 0,
        memory_used: {
          conversation_summary: memoryContext.conversationSummary,
          long_term_memory_count: memoryContext.longTermMemories.length,
        },
        fallback_reason: fallbackReason,
      };
    }

    const [systemPrompt, userPrompt] = await Promise.all([
      PromptTemplate.fromTemplate(
        [
          "You are a Chinese assistant for creators.",
          "Answer in Chinese with concise and accurate wording.",
          "Use the provided knowledge snippets when relevant.",
          "If knowledge is insufficient, state uncertainty instead of fabricating facts.",
          "Do not output JSON.",
        ].join("\n")
      ).format({}),
      USER_PROMPT_TEMPLATE.format({
        question: input.query,
        conversation_memory: memoryContext.conversationSummary || "No conversation summary.",
        long_term_memory:
          memoryContext.longTermMemories.length > 0
            ? memoryContext.longTermMemories
                .map((item: { key: string; value: string; confidence: number }) =>
                  `${item.key}: ${item.value} (confidence=${item.confidence.toFixed(2)})`
                )
                .join("\n")
            : "No stored long-term memory.",
        context: formatContext(retrieval.retrieved_chunks),
      }),
    ]);

    const response = await invokeModelText({
      model: input.model,
      capability: "agent_llm",
      systemPrompt,
      userPrompt,
      onChunk: input.onChunk,
    });

    const result = {
      ...retrieval,
      answer: response.output.trim() || (lowConfidence ? AGENT_INPUT_TEXT.lowConfidenceAnswer : AGENT_INPUT_TEXT.emptyRetrievalAnswer),
      citations: fallbackCitations,
      rag_strategy: "langchain_hybrid" as const,
      knowledge_hit_count: retrieval.retrieved_chunks.length,
      citation_count: fallbackCitations.length,
      memory_used: {
        conversation_summary: memoryContext.conversationSummary,
        long_term_memory_count: memoryContext.longTermMemories.length,
      },
      fallback_reason: fallbackReason,
    };

    emitRagTrace("answer", {
      conversation_id: input.conversationId || null,
      rag_strategy: result.rag_strategy,
      knowledge_hit_count: result.knowledge_hit_count,
      citation_count: result.citation_count,
      retrieval_confidence: result.retrieval_confidence,
      fallback_reason: result.fallback_reason || null,
      memory_summary_used: Boolean(result.memory_used.conversation_summary),
      long_term_memory_count: result.memory_used.long_term_memory_count,
    });

    return result;
  }

  const chain = RunnableSequence.from<
    { username: string; query: string; conversationId?: string | null; model?: string; limit?: number; minScore?: number },
    RagAnswerResult
  >([
    RunnableLambda.from(async (value) => {
      const [retrieval, memoryContext] = await Promise.all([
        hybridRetriever.retrieve({
          username: value.username,
          query: value.query,
          conversationId: value.conversationId,
          limit: value.limit,
          minScore: value.minScore,
        }),
        getRagMemoryContext(value.username, value.conversationId),
      ]);
      return {
        ...value,
        retrieval,
        memoryContext,
        context: formatContext(retrieval.retrieved_chunks),
      };
    }),
    RunnableLambda.from(async (state) => {
      if (state.retrieval.retrieved_chunks.length === 0) {
        return {
          ...state,
          raw_output: JSON.stringify({
            answer: AGENT_INPUT_TEXT.emptyRetrievalAnswer,
            citations: [],
          }),
          skipped: true,
        };
      }

      const [systemPrompt, userPrompt] = await Promise.all([
        SYSTEM_PROMPT_TEMPLATE.format({}),
        USER_PROMPT_TEMPLATE.format({
          question: state.query,
          conversation_memory: state.memoryContext.conversationSummary || "No conversation summary.",
          long_term_memory:
            state.memoryContext.longTermMemories.length > 0
              ? state.memoryContext.longTermMemories
                  .map((item: { key: string; value: string; confidence: number }) =>
                    `${item.key}: ${item.value} (confidence=${item.confidence.toFixed(2)})`
                  )
                  .join("\n")
              : "No stored long-term memory.",
          context: state.context,
        }),
      ]);

      const response = await invokeModelText({
        model: state.model,
        capability: "agent_llm",
        systemPrompt,
        userPrompt,
      });

      return {
        ...state,
        raw_output: response.output,
        skipped: false,
      };
    }),
    RunnableLambda.from((state) => {
      const parsed = parseRagAnswer(state.raw_output, state.retrieval.citations);
      const confidence = state.retrieval.retrieval_confidence;
      const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
      const fallbackReason =
        state.retrieval.retrieved_chunks.length === 0
          ? "empty_retrieval"
          : lowConfidence
            ? "low_confidence"
            : parsed.parseFailed
              ? "parse_failed"
              : undefined;
      const fallbackCitations = state.retrieval.citations.slice(0, 2);
      const citations = parsed.citations.length > 0 ? parsed.citations : fallbackCitations;
      const answer = state.retrieval.retrieved_chunks.length === 0
        ? AGENT_INPUT_TEXT.emptyRetrievalAnswer
        : lowConfidence
          ? parsed.answer || AGENT_INPUT_TEXT.lowConfidenceAnswer
          : parsed.answer;

      const result = {
        ...state.retrieval,
        answer,
        citations,
        rag_strategy: "langchain_hybrid" as const,
        knowledge_hit_count: state.retrieval.retrieved_chunks.length,
        citation_count: citations.length,
        memory_used: {
          conversation_summary: state.memoryContext.conversationSummary,
          long_term_memory_count: state.memoryContext.longTermMemories.length,
        },
        fallback_reason: fallbackReason,
      };

      emitRagTrace("answer", {
        conversation_id: state.conversationId || null,
        rag_strategy: result.rag_strategy,
        knowledge_hit_count: result.knowledge_hit_count,
        citation_count: result.citation_count,
        retrieval_confidence: result.retrieval_confidence,
        fallback_reason: result.fallback_reason || null,
        memory_summary_used: Boolean(result.memory_used.conversation_summary),
        long_term_memory_count: result.memory_used.long_term_memory_count,
      });

      return result;
    }),
  ]);

  return chain.invoke(input);
}
