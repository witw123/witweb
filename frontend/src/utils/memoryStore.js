const TTL_MS = 10 * 60 * 1000;

function getCache(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(map, key, value) {
  map.set(key, { ts: Date.now(), value });
}

const postCache = new Map();
const commentsCache = new Map();
const favoritesCache = new Map();
const listCache = new Map();

function deleteBySuffix(map, suffix) {
  Array.from(map.keys()).forEach((key) => {
    if (key.endsWith(suffix)) {
      map.delete(key);
    }
  });
}

export function getPostCache(key) {
  return getCache(postCache, key);
}

export function setPostCache(key, value) {
  setCache(postCache, key, value);
}

export function getCommentsCache(key) {
  return getCache(commentsCache, key);
}

export function setCommentsCache(key, value) {
  setCache(commentsCache, key, value);
}

export function getFavoritesCache(key) {
  return getCache(favoritesCache, key);
}

export function setFavoritesCache(key, value) {
  setCache(favoritesCache, key, value);
}

export function clearPostCache(slug) {
  deleteBySuffix(postCache, `:${slug}`);
}

export function clearCommentsCache(slug) {
  deleteBySuffix(commentsCache, `:${slug}`);
}

export function getListCache(key) {
  return getCache(listCache, key);
}

export function setListCache(key, value) {
  setCache(listCache, key, value);
}

export function clearListCache(key) {
  listCache.delete(key);
}

