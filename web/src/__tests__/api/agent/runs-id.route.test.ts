// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockGetRunDetail,
  mockDeleteRun,
  mockContinueRun,
  mockExportToPublish,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockGetRunDetail: vi.fn(),
  mockDeleteRun: vi.fn(),
  mockContinueRun: vi.fn(),
  mockExportToPublish: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent", () => ({
  getRunDetail: mockGetRunDetail,
  deleteRun: mockDeleteRun,
  continueRun: mockContinueRun,
  exportToPublish: mockExportToPublish,
}));

vi.mock("@/lib/agent-llm", () => ({
  AGENT_MODELS: ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"],
}));

import { GET, DELETE } from "@/app/api/v1/agent/runs/[id]/route";
import { POST as CONTINUE_POST } from "@/app/api/v1/agent/runs/[id]/continue/route";
import { POST as EXPORT_POST } from "@/app/api/v1/agent/runs/[id]/export-to-publish/route";

describe("Agent run detail APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
  });

  it("GET /api/v1/agent/runs/[id] returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "run_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/agent/runs/[id] returns detail for owner", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetRunDetail.mockResolvedValue({
      run: { id: "run_1" },
      steps: [],
      artifacts: [],
    });

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "run_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetRunDetail).toHaveBeenCalledWith("run_1", "alice");
  });

  it("GET /api/v1/agent/runs/[id] returns 404 when run is missing", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockGetRunDetail.mockRejectedValue(new Error("run_not_found"));

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "run_404" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/agent/runs/[id]/continue continues a run", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockContinueRun.mockResolvedValue({
      runId: "run_1",
      status: "done",
    });

    const response = await CONTINUE_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: "Add more examples",
          model: "gemini-2.5-pro",
          assistant_name: "Editor",
          custom_system_prompt: "Be concise",
        }),
      }) as never,
      { params: Promise.resolve({ id: "run_1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockContinueRun).toHaveBeenCalledWith("run_1", "alice", "Add more examples", "gemini-2.5-pro", {
      assistantName: "Editor",
      customSystemPrompt: "Be concise",
    });
  });

  it("POST /api/v1/agent/runs/[id]/continue returns 422 for invalid body", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await CONTINUE_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: "a",
        }),
      }) as never,
      { params: Promise.resolve({ id: "run_1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(mockContinueRun).not.toHaveBeenCalled();
  });

  it("POST /api/v1/agent/runs/[id]/continue returns 404 when run is missing", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockContinueRun.mockRejectedValue(new Error("run_not_found"));

    const response = await CONTINUE_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: "Add more examples",
        }),
      }) as never,
      { params: Promise.resolve({ id: "run_missing" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/agent/runs/[id]/export-to-publish exports selected artifacts", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockExportToPublish.mockResolvedValue({
      run_id: "run_1",
      title: "Draft",
      content: "Body",
      tags: "ai",
      redirect: "/publish?from_agent=1",
    });

    const response = await EXPORT_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_artifact_id: 1,
          content_artifact_id: 2,
          tags_artifact_id: 3,
        }),
      }) as never,
      { params: Promise.resolve({ id: "run_1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExportToPublish).toHaveBeenCalledWith("run_1", "alice", {
      titleArtifactId: 1,
      contentArtifactId: 2,
      tagsArtifactId: 3,
    });
  });

  it("POST /api/v1/agent/runs/[id]/export-to-publish returns 422 for invalid ids", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await EXPORT_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_artifact_id: 0,
        }),
      }) as never,
      { params: Promise.resolve({ id: "run_1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(mockExportToPublish).not.toHaveBeenCalled();
  });

  it("POST /api/v1/agent/runs/[id]/export-to-publish returns 404 when run is missing", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockExportToPublish.mockRejectedValue(new Error("run_not_found"));

    const response = await EXPORT_POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ id: "run_missing" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("DELETE /api/v1/agent/runs/[id] deletes run", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockDeleteRun.mockResolvedValue({ runId: "run_1", deleted: true });

    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "run_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteRun).toHaveBeenCalledWith("run_1", "alice");
  });

  it("DELETE /api/v1/agent/runs/[id] returns 404 when run is missing", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockDeleteRun.mockRejectedValue(new Error("run_not_found"));

    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "run_missing" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});
