// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockSaveAgentAttachmentFile } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSaveAgentAttachmentFile: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-attachments", () => ({
  saveAgentAttachmentFile: mockSaveAgentAttachmentFile,
}));

import { POST } from "@/app/api/v1/agent/attachments/route";

describe("agent attachments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("uploads an attachment and returns metadata", async () => {
    mockSaveAgentAttachmentFile.mockResolvedValue({
      id: "att_1",
      name: "brief.md",
      mime_type: "text/markdown",
      url: "/uploads/brief.md",
      size: 128,
      kind: "document",
    });

    const form = new FormData();
    form.append("file", new File(["# brief"], "brief.md", { type: "text/markdown" }));

    const response = await POST(
      new Request("http://localhost/api/v1/agent/attachments", {
        method: "POST",
        body: form,
      }) as never
    );

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: "att_1",
        name: "brief.md",
      })
    );
    expect(mockSaveAgentAttachmentFile).toHaveBeenCalledTimes(1);
  });

  it("rejects requests without file", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/agent/attachments", {
        method: "POST",
        body: new FormData(),
      }) as never
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(mockSaveAgentAttachmentFile).not.toHaveBeenCalled();
  });
});
