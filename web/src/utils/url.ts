export function getThumbnailUrl(originalUrl: string, width = 480) {
  void width;
  if (!originalUrl) return "";
  if (originalUrl.startsWith("/uploads/")) {
    return originalUrl;
  }
  return originalUrl;
}

export function shouldBypassImageOptimization(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return true;
  if (src.startsWith("/")) return false;

  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return true;
  }
}
