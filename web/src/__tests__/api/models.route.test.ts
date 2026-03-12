// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { mockListAvailableModels } = vi.hoisted(() => ({
  mockListAvailableModels: vi.fn(),
}));

vi.mock("@/lib/ai-models", () => ({
  listAvailableModels: mockListAvailableModels,
}));

import { GET } from "@/app/api/v1/models/route";

describe("Models API", () => {
  it("returns model registry", async () => {
    mockListAvailableModels.mockReturnValue([
      { id: "gemini-3-pro", status: "ready" },
      { id: "deepseek-chat", status: "missing_credentials" },
    ]);

    const response = await GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
  });
});
