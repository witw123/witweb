const API_BASE = "/api";

export async function getFavorites(page = 1, pageSize = 10) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}/favorites?page=${page}&size=${pageSize}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch favorites");
  }
  return res.json();
}
