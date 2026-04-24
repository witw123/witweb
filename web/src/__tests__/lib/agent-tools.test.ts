// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockReadAgentAttachments,
  mockSearchPublicWeb,
  mockFindBySlug,
  mockCreatePost,
  mockSendMessage,
} = vi.hoisted(() => ({
  mockReadAgentAttachments: vi.fn(),
  mockSearchPublicWeb: vi.fn(),
  mockFindBySlug: vi.fn(),
  mockCreatePost: vi.fn(),
  mockSendMessage: vi.fn(),
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
  syncPostContentLifecycle: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/user", () => ({
  publicProfile: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  drizzlePostRepository: { findBySlug: mockFindBySlug },
  messageRepository: { sendMessage: mockSendMessage },
  postRepository: { create: mockCreatePost },
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
    mockFindBySlug.mockResolvedValue(null);
    mockCreatePost.mockResolvedValue(42);
    mockSendMessage.mockResolvedValue({ conversationId: 1, messageId: 2 });
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

  it("rejects blog.create_post when title or content is empty", async () => {
    await expect(
      executeAgentTool("alice", "blog.create_post", {
        title: "",
        content: "body",
      })
    ).rejects.toThrow();

    await expect(
      executeAgentTool("alice", "blog.create_post", {
        title: "title",
        content: "",
      })
    ).rejects.toThrow();

    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it("creates a validated blog draft", async () => {
    const result = await executeAgentTool("alice", "blog.create_post", {
      title: "AI Agent",
      content: "draft body",
      tags: "AI,Agent",
      status: "draft",
    });

    expect(mockCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "AI Agent",
        content: "draft body",
        status: "draft",
      })
    );
    expect(result).toEqual({ id: 42, slug: "ai-agent", status: "draft" });
  });

  it("rejects messages.send when receiver or content is empty", async () => {
    await expect(
      executeAgentTool("alice", "messages.send", {
        receiver: "",
        content: "hello",
      })
    ).rejects.toThrow();

    await expect(
      executeAgentTool("alice", "messages.send", {
        receiver: "bob",
        content: "",
      })
    ).rejects.toThrow();

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
