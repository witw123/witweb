import "server-only";

import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { AGENT_INPUT_TEXT } from "@/features/agent/constants";
import { getRagMemoryContext } from "@/lib/agent-memory";
import { embedKnowledgeText, toVectorLiteral } from "@/lib/embeddings";
import { invokeModelText } from "@/lib/model-runtime";
import { agentPlatformRepository, postRepository } from "@/lib/repositories";
import { createTtlCache } from "@/lib/ttl-cache";

type RetrievalSource = "vector" | "lexical" | "hybrid" | "post_fallback";

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
    'Use the exact JSON keys "answer" and "citations".',
    "Do not wrap the JSON in markdown code fences.",
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
  const normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  const baseTokens = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
  const hanTokens: string[] = [];

  for (const match of normalized.matchAll(/[\p{Script=Han}]{2,}/gu)) {
    const segment = match[0].trim();
    if (!segment) continue;
    const maxGram = Math.min(4, segment.length);
    for (let gram = 2; gram <= maxGram; gram += 1) {
      for (let index = 0; index <= segment.length - gram; index += 1) {
        hanTokens.push(segment.slice(index, index + gram));
      }
    }
  }

  return Array.from(new Set([...baseTokens, ...hanTokens]));
}

function containsHan(value: string) {
  return /\p{Script=Han}/u.test(value);
}

function isBroadBlogCorpusQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /(所有|全部|整体|总体|汇总|总结|梳理|概括).*(博客|文章|内容|草稿)/.test(normalized) ||
    /(博客|文章|草稿).*(所有|全部|整体|总体|汇总|总结|梳理|概括)/.test(normalized) ||
    /(我写过什么|写过哪些|博客内容方向|文章内容方向)/.test(normalized)
  );
}

function shouldRewriteQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (containsHan(trimmed) && trimmed.length >= 12) {
    return true;
  }
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

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonString(raw: string): string {
  const cleaned = stripMarkdownCodeFence(stripThinkBlocks(raw));
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatStructuredScalar(value: unknown): string {
  if (typeof value === "string") return normalizeInlineText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function renderStructuredList(items: unknown[]): string {
  return items
    .map((item, index) => {
      const text = renderStructuredAnswer(item);
      if (!text) return "";
      return `${index + 1}. ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function renderStructuredObject(record: Record<string, unknown>): string {
  const titleKeys = ["title", "标题", "name", "名称"];
  const summaryKeys = ["summary", "摘要", "主要内容概要", "content", "内容", "description", "说明"];
  const statusKeys = ["status", "状态"];
  const sizeKeys = ["length", "字数"];
  const skipKeys = new Set(["answer", "citations", "question", "用户问题"]);

  const pickText = (keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        const rendered = value
          .map((item) => renderStructuredAnswer(item))
          .filter(Boolean)
          .join("；");
        if (rendered) return rendered;
      }
      const text = formatStructuredScalar(value);
      if (text) return text;
    }
    return "";
  };

  const lines: string[] = [];
  const title = pickText(titleKeys);
  const summary = pickText(summaryKeys);
  const status = pickText(statusKeys);
  const size = pickText(sizeKeys);

  if (title) lines.push(title);
  if (summary) lines.push(summary);
  if (size) lines.push(`字数：${size}`);
  if (status) lines.push(`状态：${status}`);

  for (const [key, value] of Object.entries(record)) {
    if (skipKeys.has(key) || titleKeys.includes(key) || summaryKeys.includes(key) || statusKeys.includes(key) || sizeKeys.includes(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      const rendered = value
        .map((item) => renderStructuredAnswer(item))
        .filter(Boolean)
        .join("；");
      if (rendered) lines.push(`${key}：${rendered}`);
      continue;
    }
    const scalar = formatStructuredScalar(value);
    if (scalar) {
      lines.push(`${key}：${scalar}`);
    }
  }

  return lines.join("\n").trim();
}

function renderStructuredAnswer(value: unknown): string {
  if (typeof value === "string") return normalizeInlineText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return renderStructuredList(value);
  if (isPlainObject(value)) return renderStructuredObject(value);
  return "";
}

function extractStructuredAnswer(parsed: unknown): string {
  if (!isPlainObject(parsed)) {
    return renderStructuredAnswer(parsed);
  }

  const answerLikeKeys = ["answer", "response", "reply", "content", "summary", "回复", "回答"];
  const supplementalTextKeys = ["说明", "总结", "结论", "备注", "note"];
  const sections: string[] = [];
  const consumedKeys = new Set<string>(["question", "用户问题", "citations"]);

  for (const key of answerLikeKeys) {
    const value = parsed[key];
    const rendered = renderStructuredAnswer(value);
    if (rendered) {
      sections.push(rendered);
      consumedKeys.add(key);
      break;
    }
  }

  for (const key of supplementalTextKeys) {
    const value = parsed[key];
    const rendered = renderStructuredAnswer(value);
    if (rendered) {
      sections.push(rendered);
      consumedKeys.add(key);
    }
  }

  const extraSections: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (consumedKeys.has(key)) continue;
    const rendered = renderStructuredAnswer(value);
    if (!rendered) continue;
    if (Array.isArray(value)) {
      extraSections.push(`${key}：\n${rendered}`);
    } else if (isPlainObject(value)) {
      extraSections.push(`${key}：\n${rendered}`);
    } else {
      extraSections.push(rendered);
    }
  }

  return [...sections, ...extraSections].join("\n\n").trim();
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
      systemPrompt:
        "Rewrite the search query for creator-focused retrieval. Return one short line of concise search keywords only. No punctuation. No quotes.",
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

function buildBlogDocumentId(username: string, slug: string) {
  return `blog_${username}_${slug}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function toSortableTs(value: string | undefined) {
  const ts = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ts) ? ts : 0;
}

async function fetchCreatorPostFallbackRows(username: string, query: string, limit: number) {
  const posts = await postRepository.listKnowledgeSourcePosts(username, 500, 0).catch(() => []);
  if (!posts.length) return [];

  const queryTokens = tokenize(query);
  const normalizedQuery = query.trim().toLowerCase();
  const broadCorpusQuery = isBroadBlogCorpusQuery(query);
  const fallbackRows: Array<{
    id: number;
    document_id: string;
    document_title: string;
    document_source_type: string;
    content: string;
    metadata_json: string;
    chunk_index: number;
    fallback_score: number;
    updated_at: string;
  }> = [];

  for (const post of posts) {
    const metadata = {
      post_id: post.id,
      slug: post.slug,
      excerpt: post.excerpt || "",
      tags: String(post.tags || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: post.status,
      category_id: post.category_id || null,
      cover_image_url: post.cover_image_url || "",
      reference_label: post.title,
    };
    const documentId = buildBlogDocumentId(username, post.slug);
    const titleLower = post.title.toLowerCase();
    const excerptLower = String(post.excerpt || "").toLowerCase();
    const tagsLower = String(post.tags || "").toLowerCase();
    const contentChunks = chunkText(post.content || "");
    const candidateChunks = contentChunks.length > 0 ? contentChunks : [String(post.excerpt || post.content || "").trim()].filter(Boolean);
    const scoredChunks = candidateChunks
      .map((content, chunkIndex) => {
        const chunkLower = content.toLowerCase();
        const titleMatch = normalizedQuery && titleLower.includes(normalizedQuery) ? 28 : 0;
        const excerptMatch = normalizedQuery && excerptLower.includes(normalizedQuery) ? 14 : 0;
        const tagMatch = normalizedQuery && tagsLower.includes(normalizedQuery) ? 12 : 0;
        const chunkMatch = normalizedQuery && chunkLower.includes(normalizedQuery) ? 20 : 0;
        const lexicalScore = scoreChunk(queryTokens, content, post.title) * 10;
        const score = titleMatch + excerptMatch + tagMatch + chunkMatch + lexicalScore;
        return {
          content,
          chunkIndex,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);

    const selected = scoredChunks.filter((item) => item.score > 0).slice(0, 2);
    if (selected.length === 0) {
      if (!broadCorpusQuery) continue;
      const fallbackContent = candidateChunks[0];
      if (!fallbackContent) continue;
      fallbackRows.push({
        id: -(post.id * 1000 + 1),
        document_id: documentId,
        document_title: post.title,
        document_source_type: "blog_post",
        content: fallbackContent,
        metadata_json: JSON.stringify(metadata),
        chunk_index: 0,
        fallback_score: 16,
        updated_at: post.updated_at,
      });
      continue;
    }

    for (const item of selected) {
      fallbackRows.push({
        id: -(post.id * 1000 + item.chunkIndex + 1),
        document_id: documentId,
        document_title: post.title,
        document_source_type: "blog_post",
        content: item.content,
        metadata_json: JSON.stringify(metadata),
        chunk_index: item.chunkIndex,
        fallback_score: item.score,
        updated_at: post.updated_at,
      });
    }
  }

  return fallbackRows
    .sort((a, b) => b.fallback_score - a.fallback_score || toSortableTs(b.updated_at) - toSortableTs(a.updated_at) || b.id - a.id)
    .slice(0, Math.max(limit, 8));
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
    const answer =
      typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : extractStructuredAnswer(parsed);
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
      answer: answer || stripMarkdownCodeFence(stripThinkBlocks(raw)),
      citations,
      parseFailed: !Boolean(typeof parsed.answer === "string" && parsed.answer.trim()),
    };
  } catch {
    return {
      answer: stripMarkdownCodeFence(stripThinkBlocks(raw)),
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
    const merged = new Map<string, RagRetrievedChunk>();
    const { queryTokens, queryEmbedding, vectorRows, lexicalRows } = firstPass;
    let usedPostFallback = false;

    for (const row of vectorRows) {
      const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
      merged.set(`${row.document_id}:${row.chunk_index}`, {
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
      const existing = merged.get(`${row.document_id}:${row.chunk_index}`);
      if (existing) {
        existing.score += lexicalScore;
        existing.retrieval_source = "hybrid";
        continue;
      }
      const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
      merged.set(`${row.document_id}:${row.chunk_index}`, {
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

    if (merged.size < limit || isBroadBlogCorpusQuery(input.query)) {
      const postFallbackRows = await fetchCreatorPostFallbackRows(input.username, rewrittenQuery, Math.max(limit * 2, 8));
      for (const row of postFallbackRows) {
        const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
        const key = `${row.document_id}:${row.chunk_index}`;
        const existing = merged.get(key);
        if (existing) {
          existing.score = Math.max(existing.score, row.fallback_score);
          continue;
        }
        usedPostFallback = true;
        merged.set(key, {
          id: row.id,
          document_id: row.document_id,
          title: row.document_title,
          source_type: row.document_source_type,
          content: row.content,
          metadata,
          score: row.fallback_score,
          retrieval_source: "post_fallback",
          citation: buildCitation({
            documentId: row.document_id,
            chunkIndex: row.chunk_index,
            title: row.document_title,
            sourceType: row.document_source_type,
            metadata,
          }),
        });
      }
    }

    const reranked = Array.from(merged.values()).sort((a, b) => b.score - a.score || b.id - a.id);
    const filtered = reranked.filter((item) => item.score >= minScore).slice(0, limit);
    const finalChunks = filtered.length > 0 ? filtered : reranked.slice(0, limit);
    const rerankMs = nowMs() - rerankStartedAt;
    const citations = finalChunks.map((item) => item.citation);

    const result = {
      query: input.query,
      rewritten_query: rewrittenQuery,
      retrieval_strategy: `${strategy}+langchain_hybrid_pgvector${usedPostFallback ? "+posts_fallback" : ""}`,
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
