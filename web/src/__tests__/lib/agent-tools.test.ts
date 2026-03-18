// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockReadAgentAttachments,
  mockSearchPublicWeb,
} = vi.hoisted(() => ({
  mockReadAgentAttachments: vi.fn(),
  mockSearchPublicWeb: vi.fn(),
}));

vi.mock("@/lib/agent-attachments", () => ({
  readAgentAttachments: mockReadAgentAttachments,
}));

vi.mock("@/lib/public-web-search", () => ({
  searchPublicWeb: mockSearchPublicWeb,
}));

vi.mock("@/lib/studio", () => ({
  createVideoTask: vi.fn(),
}));

vi.mock("@/lib/content-sync", () => ({
  syncPostContentLifecycle: vi.fn(),
}));

vi.mock("@/lib/user", () => ({
  publicProfile: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: { findBySlug: vi.fn() },
  messageRepository: { sendMessage: vi.fn() },
  postRepository: { create: vi.fn() },
  videoTaskRepository: { create: vi.fn(), updateStatus: vi.fn() },
}));

vi.mock("@/lib/agent-llm", () => ({
  generateRadarAnalysis: vi.fn(),
}));

vi.mock("@/lib/integrations/n8n", () => ({
  dispatchContentEvent: vi.fn(),
}));

vi.mock("@/lib/knowledge", () => ({
  searchKnowledge: vi.fn(),
}));

vi.mock("@/lib/topic-radar", () => ({
  listRadarItems: vi.fn(),
}));

import { executeAgentTool, listAgentTools } from "@/lib/agent-tools";

describe("agent tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers web.search and file.read as read-only tools", () => {
    const tools = listAgentTools();

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "web.search",
          riskLevel: "read",
        }),
        expect.objectContaining({
          name: "file.read",
          riskLevel: "read",
        }),
      ])
    );
  });

  it("executes web.search through the public web search helper", async () => {
    mockSearchPublicWeb.mockResolvedValue({
      query: "latest ai news",
      source: "duckduckgo_html",
      items: [{ title: "AI News", url: "https://example.com", snippet: "fresh", source: "duckduckgo_html" }],
    });

    const result = await executeAgentTool("alice", "web.search", {
      query: "latest ai news",
      limit: 3,
    });

    expect(mockSearchPublicWeb).toHaveBeenCalledWith("alice", {
      query: "latest ai news",
      limit: 3,
    });
    expect(result).toEqual(
      expect.objectContaining({
        query: "latest ai news",
      })
    );
  });

  it("executes file.read through the attachment reader", async () => {
    mockReadAgentAttachments.mockResolvedValue([
      {
        id: "att_1",
        name: "brief.md",
        mime_type: "text/markdown",
        url: "/uploads/brief.md",
        size: 128,
        kind: "document",
        access: "full_text",
        content_excerpt: "brief content",
      },
    ]);

    const attachments = [
      {
        id: "att_1",
        name: "brief.md",
        mime_type: "text/markdown",
        url: "/uploads/brief.md",
        size: 128,
        kind: "document" as const,
      },
    ];

    const result = await executeAgentTool("alice", "file.read", {
      attachments,
      limit: 2,
    });

    expect(mockReadAgentAttachments).toHaveBeenCalledWith(attachments, { limit: 2 });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "att_1",
          content_excerpt: "brief content",
        }),
      ],
    });
  });
});
