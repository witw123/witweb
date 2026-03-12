import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsertPromptTestRun, mockInvokeModelText, mockGetModelDescriptor } = vi.hoisted(() => ({
  mockInsertPromptTestRun: vi.fn(),
  mockInvokeModelText: vi.fn(),
  mockGetModelDescriptor: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    agentPlatformRepository: {
      ...actual.agentPlatformRepository,
      insertPromptTestRun: mockInsertPromptTestRun,
    },
  };
});

vi.mock("@/lib/model-runtime", () => ({
  invokeModelText: mockInvokeModelText,
}));

vi.mock("@/lib/ai-models", () => ({
  getModelDescriptor: mockGetModelDescriptor,
}));

import { runPromptTest } from "@/lib/prompt-eval";

describe("runPromptTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelDescriptor.mockReturnValue({
      id: "gemini-3-pro",
      label: "Gemini",
      configured: true,
    });
  });

  it("uses real model output when available", async () => {
    mockInvokeModelText.mockResolvedValue({
      model: {
        id: "gemini-3-pro",
        label: "Gemini",
      },
      output: JSON.stringify({
        title: "AI Agent",
        summary: "workflow",
      }),
    });

    const result = await runPromptTest("alice", {
      testInput: "写一个摘要",
      taskPrompt: "返回摘要 JSON",
      requiredFields: ["title", "summary"],
      expectedKeywords: ["AI", "workflow"],
    });

    expect(result.schema_passed).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.keyword_hits).toEqual(["AI", "workflow"]);
    expect(mockInsertPromptTestRun).toHaveBeenCalled();
  });

  it("degrades gracefully when model invocation fails", async () => {
    mockInvokeModelText.mockRejectedValue(new Error("provider down"));

    const result = await runPromptTest("alice", {
      testInput: "测试输入",
      taskPrompt: "测试任务",
    });

    expect(result.degraded).toBe(true);
    expect(result.degrade_reason).toBe("provider down");
    expect(result.output).toContain("测试任务");
  });
});
