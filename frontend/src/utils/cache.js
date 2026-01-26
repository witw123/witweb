export const CACHE_TTL_MS = 10 * 60 * 1000;

export function getCachedJson(key, ttlMs = CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object") return null;
    const ts = payload.ts;
    if (!ts || Date.now() - ts > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return payload.value ?? null;
  } catch {
    return null;
  }
}

export function setCachedJson(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        value,
      }),
    );
  } catch {}
}
