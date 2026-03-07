// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockCreateRun, mockListRuns } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCreateRun: vi.fn(),
  mockListRuns: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent", () => ({
  createRun: mockCreateRun,
  listRuns: mockListRuns,
}));

vi.mock("@/lib/agent-llm", () => ({
  AGENT_MODELS: ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"],
}));

import { GET, POST } from "@/app/api/v1/agent/runs/route";

describe("Agent runs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("GET /api/v1/agent/runs returns 401 when unauthenticated", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/agent/runs?page=1&size=20") as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it("GET /api/v1/agent/runs returns 422 for invalid query", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await GET(
      new Request("http://localhost/api/v1/agent/runs?page=0&size=20") as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it("GET /api/v1/agent/runs returns paginated runs for owner", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListRuns.mockResolvedValue({
      items: [
        {
          id: "run_1",
          goal: "Write a post",
          agent_type: "writing",
          status: "done",
          model: "gemini-3-pro",
          error_message: "",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:05:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      size: 10,
    });

    const response = await GET(
      new Request("http://localhost/api/v1/agent/runs?page=2&size=10") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListRuns).toHaveBeenCalledWith("alice", 2, 10);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: "writing",
          goal: "Write a post",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockCreateRun).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid body", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await POST(
      new Request("http://localhost/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: "writing",
          goal: "go",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(mockCreateRun).not.toHaveBeenCalled();
  });

  it("creates a run and returns run id and status", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockCreateRun.mockResolvedValue({
      runId: "run_123",
      status: "done",
    });

    const response = await POST(
      new Request("http://localhost/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: "writing",
          model: "gemini-2.5-pro",
          goal: "Write a long-form article about AI tooling",
          assistant_name: "Editor",
          custom_system_prompt: "Focus on clarity.",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateRun).toHaveBeenCalledWith(
      "alice",
      "Write a long-form article about AI tooling",
      "writing",
      "gemini-2.5-pro",
      {
        assistantName: "Editor",
        customSystemPrompt: "Focus on clarity.",
      }
    );
    expect(body.data).toEqual({
      run_id: "run_123",
      status: "done",
    });
  });

  it("uses default model when model is omitted", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockCreateRun.mockResolvedValue({
      runId: "run_456",
      status: "done",
    });

    const response = await POST(
      new Request("http://localhost/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: "topic",
          goal: "Find 10 content angles for AI video workflows",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mockCreateRun).toHaveBeenCalledWith(
      "alice",
      "Find 10 content angles for AI video workflows",
      "topic",
      "gemini-3-pro",
      {
        assistantName: undefined,
        customSystemPrompt: undefined,
      }
    );
  });
});
