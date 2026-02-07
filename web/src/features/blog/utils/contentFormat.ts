export function escapeHtml(content: string) {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hasMarkdownSyntax(content: string) {
  const markdownPattern =
    /(^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~)|\[[^\]]+\]\([^)]+\)|!\[[^\]]*]\([^)]+\)|`[^`]+`|^\s*([-*_]\s*){3,}$)/m;
  return markdownPattern.test(content);
}

export function renderPlainTextHtml(content: string) {
  const normalized = String(content || "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return "";
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/^\n+|\n+$/g, ""))
    .filter((chunk) => chunk.trim().length > 0);
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}
