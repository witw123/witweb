import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockListRunsByUser,
  mockGetRunByIdAndUser,
  mockGetRunSteps,
  mockGetRunArtifacts,
  mockGetLatestArtifact,
  mockGetArtifactContentById,
  mockGetLatestArtifactContent,
  mockGenerateAgentDraft,
  mockInsertStepDone,
  mockInsertArtifact,
  mockMarkRunDone,
} = vi.hoisted(() => ({
  mockListRunsByUser: vi.fn(),
  mockGetRunByIdAndUser: vi.fn(),
  mockGetRunSteps: vi.fn(),
  mockGetRunArtifacts: vi.fn(),
  mockGetLatestArtifact: vi.fn(),
  mockGetArtifactContentById: vi.fn(),
  mockGetLatestArtifactContent: vi.fn(),
  mockGenerateAgentDraft: vi.fn(),
  mockInsertStepDone: vi.fn(),
  mockInsertArtifact: vi.fn(),
  mockMarkRunDone: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    drizzleAgentRepository: {
      listRunsByUser: mockListRunsByUser,
      getRunByIdAndUser: mockGetRunByIdAndUser,
      getRunSteps: mockGetRunSteps,
      getRunArtifacts: mockGetRunArtifacts,
      getLatestArtifact: mockGetLatestArtifact,
      getArtifactContentById: mockGetArtifactContentById,
      getLatestArtifactContent: mockGetLatestArtifactContent,
    },
    agentRepository: {
      ...actual.agentRepository,
      insertStepDone: mockInsertStepDone,
      insertArtifact: mockInsertArtifact,
      markRunDone: mockMarkRunDone,
    },
  };
});

vi.mock("@/lib/agent-llm", () => ({
  AGENT_MODELS: ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"],
  generateAgentDraft: mockGenerateAgentDraft,
}));

import { continueRun, exportToPublish, getRunDetail, listRuns } from "@/lib/agent";

describe("agent read chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listRuns delegates to drizzle agent repository", async () => {
    mockListRunsByUser.mockResolvedValue({
      items: [{ id: "run_1", goal: "goal", agent_type: "writing", status: "done", model: "gemini-3-pro", error_message: "", created_at: "2026-03-01T00:00:00.000Z", updated_at: "2026-03-01T00:00:00.000Z" }],
      total: 1,
      page: 1,
      size: 20,
    });

    const result = await listRuns("alice", 1, 20);

    expect(mockListRunsByUser).toHaveBeenCalledWith("alice", 1, 20);
    expect(result.total).toBe(1);
  });

  it("getRunDetail reads run, steps and artifacts from drizzle repository", async () => {
    mockGetRunByIdAndUser.mockResolvedValue({
      id: "run_1",
      username: "alice",
      goal: "Write a post",
      agent_type: "writing",
      status: "done",
      model: "gemini-3-pro",
      error_message: "",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    mockGetRunSteps.mockResolvedValue([
      {
        id: 1,
        run_id: "run_1",
        step_key: "draft",
        step_title: "正文生成",
        status: "done",
        input_json: "{\"goal\":\"Write a post\"}",
        output_json: "{\"title\":\"Hello\"}",
        started_at: "2026-03-01T00:00:00.000Z",
        finished_at: "2026-03-01T00:00:01.000Z",
      },
    ]);
    mockGetRunArtifacts.mockResolvedValue([
      {
        id: 2,
        run_id: "run_1",
        kind: "content",
        content: "Body",
        meta_json: "{\"source\":\"agent\"}",
        created_at: "2026-03-01T00:00:02.000Z",
      },
    ]);

    const result = await getRunDetail("run_1", "alice");

    expect(mockGetRunByIdAndUser).toHaveBeenCalledWith("run_1", "alice");
    expect(mockGetRunSteps).toHaveBeenCalledWith("run_1");
    expect(mockGetRunArtifacts).toHaveBeenCalledWith("run_1");
    expect(result.steps[0].input).toEqual({ goal: "Write a post" });
    expect(result.artifacts[0].meta).toEqual({ source: "agent" });
  });

  it("continueRun reads latest content from drizzle repository", async () => {
    mockGetRunByIdAndUser.mockResolvedValue({
      id: "run_1",
      username: "alice",
      goal: "Write a post",
      agent_type: "writing",
      status: "done",
      model: "gemini-3-pro",
      error_message: "",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    mockGetLatestArtifact.mockResolvedValue({ id: 9, content: "Base content" });
    mockGenerateAgentDraft.mockResolvedValue({
      title: "Refined title",
      content: "Refined content",
      tags: "ai,tools",
      seo: { description: "desc" },
      coverPrompt: "cover",
      keywords: ["ai"],
      outline: ["intro"],
    });

    const result = await continueRun("run_1", "alice", "Add examples");

    expect(mockGetLatestArtifact).toHaveBeenCalledWith("run_1", "content");
    expect(result).toEqual({ runId: "run_1", status: "done" });
    expect(mockInsertStepDone).toHaveBeenCalled();
    expect(mockInsertArtifact).toHaveBeenCalled();
    expect(mockMarkRunDone).toHaveBeenCalled();
  });

  it("exportToPublish reads selected and latest artifacts from drizzle repository", async () => {
    mockGetRunByIdAndUser.mockResolvedValue({
      id: "run_1",
      username: "alice",
      goal: "Write a post",
      agent_type: "writing",
      status: "done",
      model: "gemini-3-pro",
      error_message: "",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    mockGetArtifactContentById.mockResolvedValueOnce("Chosen title");
    mockGetArtifactContentById.mockResolvedValueOnce("Chosen content");
    mockGetArtifactContentById.mockResolvedValueOnce(null);
    mockGetLatestArtifactContent.mockResolvedValueOnce("Latest tags");

    const result = await exportToPublish("run_1", "alice", {
      titleArtifactId: 1,
      contentArtifactId: 2,
      tagsArtifactId: 3,
    });

    expect(mockGetArtifactContentById).toHaveBeenCalledWith("run_1", "title", 1);
    expect(mockGetArtifactContentById).toHaveBeenCalledWith("run_1", "content", 2);
    expect(mockGetArtifactContentById).toHaveBeenCalledWith("run_1", "tags", 3);
    expect(mockGetLatestArtifactContent).toHaveBeenCalledWith("run_1", "tags");
    expect(result.title).toBe("Chosen title");
    expect(result.content).toBe("Chosen content");
    expect(result.tags).toBe("Latest tags");
  });
});
