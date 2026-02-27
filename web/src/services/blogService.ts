import type { SuccessResponse } from "@/lib/api-response";
import type { PostListItem } from "@/types/blog";

const API_BASE = "/api";

type FavoritesData = {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export async function getFavorites(page = 1, pageSize = 10): Promise<FavoritesData> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/favorites?page=${page}&size=${pageSize}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await res.json().catch(() => ({}))) as Partial<
    SuccessResponse<FavoritesData> & { error?: { message?: string } }
  >;

  if (payload.success !== true || !payload.data) {
    throw new Error(payload.error?.message || "Failed to fetch favorites");
  }

  return payload.data;
}
