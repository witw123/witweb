export const CACHE_TTL_MS = 10 * 60 * 1000;

export function getCachedJson<T = unknown>(key: string, ttlMs: number = CACHE_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as { ts?: number; value?: T };
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

export function setCachedJson<T = unknown>(key: string, value: T) {
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
