import "server-only";

import { invokeModelEmbedding } from "@/lib/model-runtime";
import { createTtlCache } from "@/lib/ttl-cache";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 64;
export const KNOWLEDGE_EMBEDDING_MODEL_FALLBACK = "local-hash-64";
const embeddingCache = createTtlCache<{
  model: string;
  embedding: number[];
  source: "model" | "fallback_hash";
}>(256, 5 * 60 * 1000);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function buildHashEmbeddingVector(value: string, dimensions = KNOWLEDGE_EMBEDDING_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenize(value);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vector.map((item) => Number((item / magnitude).toFixed(6)));
}

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, item) => sum + item * item, 0)) || 1;
  return values.map((item) => Number((item / magnitude).toFixed(6)));
}

export function reduceEmbeddingDimensions(values: number[], targetDimensions = KNOWLEDGE_EMBEDDING_DIMENSIONS) {
  if (values.length === targetDimensions) {
    return normalizeVector(values);
  }

  const reduced = Array.from({ length: targetDimensions }, () => 0);
  for (let index = 0; index < values.length; index += 1) {
    const bucket = index % targetDimensions;
    const sign = index % 2 === 0 ? 1 : -1;
    reduced[bucket] += values[index] * sign;
  }
  return normalizeVector(reduced);
}

export function toVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export async function embedKnowledgeText(value: string) {
  const cacheKey = value.trim();
  if (cacheKey) {
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let result: {
    model: string;
    embedding: number[];
    source: "model" | "fallback_hash";
  };
  try {
    const response = await invokeModelEmbedding({
      capability: "embedding",
      input: value,
    });
    result = {
      model: `${response.model.id}-reduced-${KNOWLEDGE_EMBEDDING_DIMENSIONS}`,
      embedding: reduceEmbeddingDimensions(response.embedding, KNOWLEDGE_EMBEDDING_DIMENSIONS),
      source: "model" as const,
    };
  } catch {
    result = {
      model: KNOWLEDGE_EMBEDDING_MODEL_FALLBACK,
      embedding: buildHashEmbeddingVector(value, KNOWLEDGE_EMBEDDING_DIMENSIONS),
      source: "fallback_hash" as const,
    };
  }

  if (cacheKey) {
    embeddingCache.set(cacheKey, result);
  }
  return result;
}
