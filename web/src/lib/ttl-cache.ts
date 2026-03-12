import "server-only";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createTtlCache<T>(maxEntries: number, ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();

  function prune(now = Date.now()) {
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }

    while (store.size > maxEntries) {
      const oldestKey = store.keys().next().value;
      if (!oldestKey) break;
      store.delete(oldestKey);
    }
  }

  return {
    get(key: string) {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      const now = Date.now();
      store.set(key, {
        value,
        expiresAt: now + ttlMs,
      });
      prune(now);
      return value;
    },
  };
}
