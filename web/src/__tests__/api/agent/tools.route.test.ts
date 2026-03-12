// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { mockListAgentTools } = vi.hoisted(() => ({
  mockListAgentTools: vi.fn(),
}));

vi.mock("@/lib/agent-tools", () => ({
  listAgentTools: mockListAgentTools,
}));

import { GET } from "@/app/api/v1/agent/tools/route";

describe("Agent tools API", () => {
  it("returns tool registry", async () => {
    mockListAgentTools.mockReturnValue([
      { name: "blog.create_post", riskLevel: "publish_or_send" },
      { name: "profile.read", riskLevel: "read" },
    ]);

    const response = await GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items[0].name).toBe("blog.create_post");
  });
});
