export function normalizeVideoPagination(page = 1, size = 20) {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}
