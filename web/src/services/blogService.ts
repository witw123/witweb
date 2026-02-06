const API_BASE = "/api";

export async function getFavorites(page = 1, pageSize = 10) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}/favorites?page=${page}&size=${pageSize}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    throw new Error(data.error?.message || "Failed to fetch favorites");
  }
  return data.data;
}
