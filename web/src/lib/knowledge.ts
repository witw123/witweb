import "server-only";

import { randomUUID } from "crypto";
import { invokeModelText } from "@/lib/model-runtime";
import { embedKnowledgeText, toVectorLiteral } from "@/lib/embeddings";
import {
  isLangChainRagEnabled,
  retrieveKnowledgeContextWithLangChain,
} from "@/lib/rag/langchain-rag";
import { agentPlatformRepository } from "@/lib/repositories";
import { createTtlCache } from "@/lib/ttl-cache";

const rewriteCache = createTtlCache<{ rewrittenQuery: string; strategy: string }>(128, 5 * 60 * 1000);

function nowIso() {
  return new Date().toISOString();
}

function chunkText(input: string, chunkSize = 600) {
  const cleaned = input.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const parts: string[] = [];
  let current = "";

  for (const paragraph of cleaned.split(/\n{2,}/)) {
    if ((current + "\n\n" + paragraph).trim().length > chunkSize && current.trim()) {
      parts.push(current.trim());
      current = paragraph;
      continue;
    }
    current = `${current}\n\n${paragraph}`.trim();
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
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
    if (combined.includes(token)) score += title.toLowerCase().includes(token) ? 3 : 1;
  }
  return score;
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
      systemPrompt: "Rewrite the search query for creator-focused knowledge retrieval. Return one short line only.",
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
    vectorRows,
    lexicalRows,
  };
}

function buildCitation(row: {
  document_id: string;
  chunk_index: number;
  document_title: string;
  document_source_type: string;
  metadata_json: string;
}) {
  const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
  return {
    document_id: row.document_id,
    chunk_index: row.chunk_index,
    title: row.document_title,
    source_type: row.document_source_type,
    slug: typeof metadata.slug === "string" ? metadata.slug : undefined,
    href: (() => {
      if (typeof metadata.url === "string" && metadata.url.trim()) return metadata.url.trim();
      if (row.document_source_type === "blog_post" && typeof metadata.slug === "string" && metadata.slug.trim()) {
        return `/post/${metadata.slug.trim()}`;
      }
      return undefined;
    })(),
  };
}

export async function indexKnowledgeDocument(
  username: string,
  input: {
    documentId?: string;
    sourceType: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }
) {
  const documentId = input.documentId || `doc_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();
  const chunks = chunkText(input.body).map((content, index) => ({
    index,
    content,
    metadataJson: JSON.stringify({
      title: input.title,
      sourceType: input.sourceType,
      ...input.metadata,
    }),
  }));

  if (
    !agentPlatformRepository ||
    typeof agentPlatformRepository.upsertKnowledgeDocument !== "function" ||
    typeof agentPlatformRepository.replaceKnowledgeChunks !== "function" ||
    typeof agentPlatformRepository.replaceKnowledgeChunkEmbeddings !== "function"
  ) {
    return {
      document_id: documentId,
      chunk_count: chunks.length,
      embedding_model: "unavailable",
      status: "skipped",
    };
  }

  await agentPlatformRepository.upsertKnowledgeDocument({
    id: documentId,
    username,
    sourceType: input.sourceType,
    title: input.title,
    body: input.body,
    metadataJson: JSON.stringify(input.metadata || {}),
    status: "indexed",
    ts,
  });

  const insertedChunks = await agentPlatformRepository.replaceKnowledgeChunks(documentId, chunks, ts);
  const embeddings = await Promise.all(
    insertedChunks.map(async (chunk) => {
      const embedded = await embedKnowledgeText(`${input.title}\n${chunk.content}`);
      return {
        chunkId: chunk.id,
        model: embedded.model,
        embedding: toVectorLiteral(embedded.embedding),
      };
    })
  );

  await agentPlatformRepository.replaceKnowledgeChunkEmbeddings(documentId, embeddings, ts);

  return {
    document_id: documentId,
    chunk_count: chunks.length,
    embedding_model: embeddings[0]?.model || "unknown",
    status: "indexed",
  };
}

export async function searchKnowledge(
  username: string,
  input: {
    query: string;
    limit?: number;
  }
) {
  if (isLangChainRagEnabled()) {
    const rag = await retrieveKnowledgeContextWithLangChain({
      username,
      query: input.query,
      limit: input.limit,
    });

    return {
      query: input.query,
      rewritten_query: rag.rewritten_query,
      retrieval_strategy: rag.retrieval_strategy,
      retrieval_confidence: rag.retrieval_confidence,
      filtered_count: rag.filtered_count,
      citations: rag.citations,
      retrieved_chunks: rag.retrieved_chunks,
      items: rag.retrieved_chunks.map((item) => ({
        id: item.id,
        document_id: item.document_id,
        title: item.title,
        source_type: item.source_type,
        content: item.content,
        metadata: item.metadata,
        score: item.score,
        retrieval_source: item.retrieval_source,
        citation: item.citation,
      })),
      rag_strategy: "langchain_hybrid",
      knowledge_hit_count: rag.retrieved_chunks.length,
      citation_count: rag.citations.length,
    };
  }

  const limit = Math.max(1, Math.min(10, input.limit || 5));
  let rewrittenQuery = input.query;
  let strategy = "fast_identity";
  let firstPass = await fetchHybridRows(username, rewrittenQuery, limit);

  if (firstPass.vectorRows.length === 0 && firstPass.lexicalRows.length === 0) {
    const rewritten = await rewriteQuery(input.query);
    if (rewritten.rewrittenQuery.trim() && rewritten.rewrittenQuery.trim() !== input.query.trim()) {
      rewrittenQuery = rewritten.rewrittenQuery;
      strategy = rewritten.strategy;
      firstPass = await fetchHybridRows(username, rewrittenQuery, limit);
    }
  }

  const { queryTokens, vectorRows, lexicalRows } = firstPass;

  const merged = new Map<number, {
    id: number;
    document_id: string;
    document_title: string;
    document_source_type: string;
    content: string;
    metadata_json: string;
    chunk_index: number;
    score: number;
    retrieval_source: "vector" | "lexical" | "hybrid";
  }>();

  for (const row of vectorRows) {
    merged.set(row.id, {
      id: row.id,
      document_id: row.document_id,
      document_title: row.document_title,
      document_source_type: row.document_source_type,
      content: row.content,
      metadata_json: row.metadata_json,
      chunk_index: row.chunk_index,
      score: Number((row.similarity * 100).toFixed(2)),
      retrieval_source: "vector",
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
    merged.set(row.id, {
      id: row.id,
      document_id: row.document_id,
      document_title: row.document_title,
      document_source_type: row.document_source_type,
      content: row.content,
      metadata_json: row.metadata_json,
      chunk_index: row.chunk_index,
      score: lexicalScore,
      retrieval_source: "lexical",
    });
  }

  const items = Array.from(merged.values())
    .sort((a, b) => b.score - a.score || b.id - a.id)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      document_id: row.document_id,
      title: row.document_title,
      source_type: row.document_source_type,
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      score: row.score,
      retrieval_source: row.retrieval_source,
      citation: buildCitation(row),
    }));

  return {
    query: input.query,
    rewritten_query: rewrittenQuery,
    retrieval_strategy: `${strategy}+pgvector`,
    retrieval_confidence: 0,
    filtered_count: 0,
    citations: items.map((item) => item.citation),
    retrieved_chunks: [],
    rag_strategy: "legacy_hybrid",
    knowledge_hit_count: items.length,
    citation_count: items.length,
    items,
  };
}
