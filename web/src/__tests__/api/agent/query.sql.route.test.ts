// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser, mockExecuteNaturalLanguageSql } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockExecuteNaturalLanguageSql: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/agent-sql", () => ({
  executeNaturalLanguageSql: mockExecuteNaturalLanguageSql,
}));

import { POST } from "@/app/api/v1/agent/query/sql/route";

describe("Agent SQL query API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue("alice");
  });

  it("validates request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/agent/query/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "短",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("returns SQL result for allowed question", async () => {
    mockExecuteNaturalLanguageSql.mockResolvedValue({
      intent: "top_posts_30d",
      sql: "SELECT 1",
      rows: [{ title: "A" }],
      summary: "ok",
      safe_mode: "whitelist_only",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/agent/query/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "最近 30 天最受欢迎的 AI 文章是什么？",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.safe_mode).toBe("whitelist_only");
    expect(mockExecuteNaturalLanguageSql).toHaveBeenCalledWith("最近 30 天最受欢迎的 AI 文章是什么？");
  });
});
