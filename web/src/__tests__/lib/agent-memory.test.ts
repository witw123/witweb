import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvokeModelJson, mockUpsertUserMemory } = vi.hoisted(() => ({
  mockInvokeModelJson: vi.fn(),
  mockUpsertUserMemory: vi.fn(),
}));

vi.mock("@/lib/model-runtime", () => ({
  invokeModelJson: mockInvokeModelJson,
  invokeModelText: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      upsertUserMemory: mockUpsertUserMemory,
    },
  };
});

import { extractAndPersistUserMemories, shouldExtractExplicitMemory } from "@/lib/agent-memory";

describe("agent memory fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeModelJson.mockRejectedValue(new Error("model unavailable"));
  });

  it("extracts explicit Chinese preference patterns without model support", async () => {
    const result = await extractAndPersistUserMemories("alice", "\u8bb0\u4f4f\u6211\u559c\u6b22\u51b7\u9759\u3001\u4e13\u4e1a\u7684\u5199\u4f5c\u98ce\u683c\u3002");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      key: "user_preference",
      value: "\u51b7\u9759\u3001\u4e13\u4e1a\u7684\u5199\u4f5c\u98ce\u683c",
    });
    expect(mockUpsertUserMemory).toHaveBeenCalledTimes(1);
  });

  it("only flags explicit preference messages for extraction", () => {
    expect(shouldExtractExplicitMemory("\u4ee5\u540e\u8bf7\u7528\u51b7\u9759\u4e13\u4e1a\u7684\u8bed\u6c14")).toBe(true);
    expect(shouldExtractExplicitMemory("\u5e2e\u6211\u5199\u4e00\u7bc7 openclaw \u6587\u7ae0")).toBe(false);
  });
});
