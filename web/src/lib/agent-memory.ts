import "server-only";

import { invokeModelJson, invokeModelText } from "@/lib/model-runtime";
import { agentPlatformRepository } from "@/lib/repositories";
import { z } from "@/lib/validate";

const MEMORY_WRITE_MIN_CONFIDENCE = 0.6;
const MEMORY_RECALL_MIN_CONFIDENCE = 0.72;
const MEMORY_RECALL_LIMIT = 5;
const MEMORY_RECALL_FETCH_LIMIT = 12;
const MEMORY_SUMMARY_CHAR_BUDGET = 320;

const memoryExtractionSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().trim().min(1),
      value: z.string().trim().min(1),
      confidence: z.number().min(0).max(1).default(0.8),
    })
  ).default([]),
});

type MemoryContext = {
  conversationSummary: string;
  conversationKeyPoints: string[];
  longTermMemories: Array<{
    key: string;
    value: string;
    confidence: number;
    source: string;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeMemoryKey(key: string) {
  return key.trim().toLowerCase();
}

function normalizeMemoryValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function truncateMemoryText(value: string, max = MEMORY_SUMMARY_CHAR_BUDGET) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function fallbackExtractMemories(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const patterns: Array<[RegExp, string]> = [
    [/记住我喜欢(.+)/, "user_preference"],
    [/记住我偏好(.+)/, "user_preference"],
    [/我喜欢(.+)/, "user_preference"],
    [/我偏好(.+)/, "user_preference"],
    [/以后请用(.+)/, "preferred_tone"],
  ];

  for (const [pattern, key] of patterns) {
    const matched = trimmed.match(pattern);
    if (matched?.[1]) {
      return [
        {
          key,
          value: matched[1].trim().replace(/[。？！!?,，；;]+$/, ""),
          confidence: 0.75,
        },
      ];
    }
  }

  return [];
}

export function shouldExtractExplicitMemory(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return false;

  return [
    /记住我喜欢.+/,
    /记住我偏好.+/,
    /我喜欢.+/,
    /我偏好.+/,
    /以后请用.+/,
  ].some((pattern) => pattern.test(trimmed));
}

export async function extractAndPersistUserMemories(username: string, content: string) {
  if (!content.trim()) return [];

  let items: Array<{ key: string; value: string; confidence: number }> = [];
  try {
    const result = await invokeModelJson(
      {
        capability: "agent_llm",
        systemPrompt: [
          "Extract only stable user preferences explicitly stated in the message.",
          "Do not infer facts not directly stated.",
          "Return JSON only: { items: [{ key, value, confidence }] }",
          "Use concise keys like writing_style, preferred_topics, preferred_tone, target_audience, user_preference.",
        ].join("\n"),
        userPrompt: content,
      },
      (value) => memoryExtractionSchema.parse(value)
    );
    items = result.parsed.items;
  } catch {
    items = fallbackExtractMemories(content);
  }

  const deduped = items
    .map((item) => ({
      key: item.key.trim().slice(0, 64),
      value: item.value.trim().slice(0, 300),
      confidence: Math.max(0, Math.min(1, item.confidence)),
    }))
    .filter((item) => item.key && item.value && item.confidence >= MEMORY_WRITE_MIN_CONFIDENCE)
    .filter((item, index, list) => {
      const signature = `${normalizeMemoryKey(item.key)}::${normalizeMemoryValue(item.value)}`;
      return list.findIndex((candidate) => `${normalizeMemoryKey(candidate.key)}::${normalizeMemoryValue(candidate.value)}` === signature) === index;
    });

  const ts = nowIso();
  for (const item of deduped) {
    await agentPlatformRepository.upsertUserMemory({
      username,
      memoryKey: item.key,
      memoryValue: item.value,
      source: "explicit_user_preference",
      confidence: item.confidence,
      ts,
    });
  }

  return deduped;
}

export async function updateConversationMemory(username: string, conversationId: string) {
  const messages = await agentPlatformRepository.listMessages(conversationId);
  const recentMessages = messages.slice(-12);
  const turnCount = recentMessages.filter((item) => item.role === "user").length;
  if (recentMessages.length === 0) {
    return null;
  }

  const transcript = recentMessages
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`)
    .join("\n");

  let summary = "";
  let keyPoints: string[] = [];
  try {
    const response = await invokeModelText({
      capability: "agent_llm",
      systemPrompt: [
        "Summarize the conversation for future context injection.",
        "Output plain text only.",
        "First line: one-sentence summary.",
        "Following lines: up to 4 bullet-like key points without markdown bullets.",
      ].join("\n"),
      userPrompt: transcript,
    });

    const lines = response.output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    summary = lines[0] || recentMessages.slice(-3).map((item) => item.content).join(" ").slice(0, 200);
    keyPoints = lines.slice(1, 5);
  } catch {
    summary = recentMessages.slice(-3).map((item) => item.content).join(" ").slice(0, 200);
    keyPoints = [];
  }

  const lastMessage = messages[messages.length - 1];
  const ts = nowIso();
  await agentPlatformRepository.upsertConversationMemory({
    conversationId,
    username,
    summary,
    keyPointsJson: JSON.stringify(keyPoints),
    turnCount,
    lastMessageId: lastMessage?.id || null,
    ts,
  });

  return {
    summary,
    key_points: keyPoints,
    turn_count: turnCount,
  };
}

export async function getRagMemoryContext(username: string, conversationId?: string | null): Promise<MemoryContext> {
  const [conversationMemory, userMemories] = await Promise.all([
    conversationId ? agentPlatformRepository.getConversationMemory(conversationId, username) : Promise.resolve(null),
    agentPlatformRepository.listUserMemories(username, MEMORY_RECALL_FETCH_LIMIT),
  ]);

  const longTermMemories = userMemories
    .filter((item) => item.confidence >= MEMORY_RECALL_MIN_CONFIDENCE)
    .filter((item, index, list) => {
      const signature = `${normalizeMemoryKey(item.memory_key)}::${normalizeMemoryValue(item.memory_value)}`;
      return list.findIndex((candidate) => `${normalizeMemoryKey(candidate.memory_key)}::${normalizeMemoryValue(candidate.memory_value)}` === signature) === index;
    })
    .slice(0, MEMORY_RECALL_LIMIT)
    .map((item) => ({
      key: item.memory_key,
      value: truncateMemoryText(item.memory_value, 180),
      confidence: item.confidence,
      source: item.source,
    }));

  return {
    conversationSummary: truncateMemoryText(conversationMemory?.summary || ""),
    conversationKeyPoints: (() => {
      try {
        return (JSON.parse(conversationMemory?.key_points_json || "[]") as string[])
          .map((item) => truncateMemoryText(String(item), 120))
          .filter(Boolean)
          .slice(0, 4);
      } catch {
        return [];
      }
    })(),
    longTermMemories,
  };
}
