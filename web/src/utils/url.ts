export function getThumbnailUrl(originalUrl: string, width = 480) {
  if (!originalUrl) return "";
  if (originalUrl.startsWith("/uploads/")) {
    return originalUrl;
  }
  return originalUrl;
}
