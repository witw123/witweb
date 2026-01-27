export function getThumbnailUrl(originalUrl, width = 480) {
  if (!originalUrl) return "";
  if (originalUrl.startsWith("/uploads/")) {
    return `/api/thumbnail?url=${encodeURIComponent(originalUrl)}&width=${width}`;
  }
  return originalUrl;
}
