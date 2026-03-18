// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetConversationMemory,
  mockListUserMemories,
} = vi.hoisted(() => ({
  mockGetConversationMemory: vi.fn(),
  mockListUserMemories: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      getConversationMemory: mockGetConversationMemory,
      listUserMemories: mockListUserMemories,
    },
  };
});

vi.mock("@/lib/model-runtime", () => ({
  invokeModelJson: vi.fn(),
  invokeModelText: vi.fn(),
}));

import { getRagMemoryContext } from "@/lib/agent-memory";

describe("agent memory context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies confidence threshold, dedupe and recall budget to long-term memories", async () => {
    mockGetConversationMemory.mockResolvedValue({
      conversation_id: "conv_1",
      username: "alice",
      summary: "这是一个非常长的总结。".repeat(40),
      key_points_json: JSON.stringify(["点 1", "点 2", "点 3", "点 4", "点 5"]),
      turn_count: 10,
      last_message_id: "msg_1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockListUserMemories.mockResolvedValue([
      { memory_key: "tone", memory_value: "专业冷静", confidence: 0.95, source: "explicit" },
      { memory_key: "tone", memory_value: "专业冷静", confidence: 0.93, source: "explicit" },
      { memory_key: "audience", memory_value: "开发者", confidence: 0.9, source: "explicit" },
      { memory_key: "format", memory_value: "长文", confidence: 0.88, source: "explicit" },
      { memory_key: "channel", memory_value: "博客", confidence: 0.84, source: "explicit" },
      { memory_key: "topic", memory_value: "AI Agent", confidence: 0.8, source: "explicit" },
      { memory_key: "low_confidence", memory_value: "忽略", confidence: 0.4, source: "explicit" },
    ]);

    const result = await getRagMemoryContext("alice", "conv_1");

    expect(result.longTermMemories).toHaveLength(5);
    expect(result.longTermMemories.map((item) => `${item.key}:${item.value}`)).toEqual([
      "tone:专业冷静",
      "audience:开发者",
      "format:长文",
      "channel:博客",
      "topic:AI Agent",
    ]);
    expect(result.conversationKeyPoints).toHaveLength(4);
    expect(result.conversationSummary.length).toBeLessThanOrEqual(323);
    expect(mockListUserMemories).toHaveBeenCalledWith("alice", 12);
  });
});
