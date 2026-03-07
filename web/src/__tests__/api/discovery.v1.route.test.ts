// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListCategories, mockListTagStats } = vi.hoisted(() => ({
  mockListCategories: vi.fn(),
  mockListTagStats: vi.fn(),
}));

vi.mock("@/lib/repositories/category-repository.drizzle", () => ({
  drizzleCategoryRepository: {
    listCategories: mockListCategories,
  },
}));

vi.mock("@/lib/repositories", () => ({
  postRepository: {
    listTagStats: mockListTagStats,
  },
}));

import { GET as GET_CATEGORIES } from "@/app/api/v1/categories/route";
import { GET as GET_TAGS } from "@/app/api/v1/tags/route";

describe("Discovery v1 APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCategories.mockResolvedValue([]);
    mockListTagStats.mockResolvedValue([]);
  });

  it("GET /api/v1/categories returns category list", async () => {
    mockListCategories.mockResolvedValue([{ id: 1, name: "AI" }]);

    const response = await GET_CATEGORIES(new Request("http://localhost/api/v1/categories") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListCategories).toHaveBeenCalledWith(false);
    expect(body.data.items).toEqual([{ id: 1, name: "AI" }]);
  });

  it("GET /api/v1/tags returns tag stats", async () => {
    mockListTagStats.mockResolvedValue([{ tag: "ai", count: 3 }]);

    const response = await GET_TAGS(new Request("http://localhost/api/v1/tags") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tags).toEqual([{ tag: "ai", count: 3 }]);
    expect(body.data.total).toBe(1);
  });
});
