const TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = {
  ts: number;
  value: T;
};

function getCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { ts: Date.now(), value });
}

const postCache = new Map<string, CacheEntry<unknown>>();
const commentsCache = new Map<string, CacheEntry<unknown>>();
const favoritesCache = new Map<string, CacheEntry<unknown>>();
const listCache = new Map<string, CacheEntry<unknown>>();

function deleteBySuffix(map: Map<string, CacheEntry<unknown>>, suffix: string) {
  Array.from(map.keys()).forEach((key) => {
    if (key.endsWith(suffix)) {
      map.delete(key);
    }
  });
}

export function getPostCache<T = unknown>(key: string): T | null {
  return getCache(postCache as Map<string, CacheEntry<T>>, key);
}

export function setPostCache<T = unknown>(key: string, value: T) {
  setCache(postCache as Map<string, CacheEntry<T>>, key, value);
}

export function getCommentsCache<T = unknown>(key: string): T | null {
  return getCache(commentsCache as Map<string, CacheEntry<T>>, key);
}

export function setCommentsCache<T = unknown>(key: string, value: T) {
  setCache(commentsCache as Map<string, CacheEntry<T>>, key, value);
}

export function getFavoritesCache<T = unknown>(key: string): T | null {
  return getCache(favoritesCache as Map<string, CacheEntry<T>>, key);
}

export function setFavoritesCache<T = unknown>(key: string, value: T) {
  setCache(favoritesCache as Map<string, CacheEntry<T>>, key, value);
}

export function clearPostCache(slug: string) {
  deleteBySuffix(postCache, `:${slug}`);
}

export function clearCommentsCache(slug: string) {
  deleteBySuffix(commentsCache, `:${slug}`);
}

export function getListCache<T = unknown>(key: string): T | null {
  return getCache(listCache as Map<string, CacheEntry<T>>, key);
}

export function setListCache<T = unknown>(key: string, value: T) {
  setCache(listCache as Map<string, CacheEntry<T>>, key, value);
}

export function clearListCache(key: string) {
  listCache.delete(key);
}

export function clearAllListCache() {
  listCache.clear();
}
