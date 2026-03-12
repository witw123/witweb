/**
 * 内容格式化工具
 *
 * 提供 HTML 转义、Markdown 检测、纯文本渲染等功能
 */

/**
 * 转义 HTML 特殊字符
 *
 * @param {string} content - 原始内容
 * @returns {string} 转义后的内容
 */
export function escapeHtml(content: string) {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 检测内容是否包含 Markdown 语法
 *
 * @param {string} content - 待检测内容
 * @returns {boolean} 是否包含 Markdown 语法
 */
export function hasMarkdownSyntax(content: string) {
  const markdownPattern =
    /(^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~)|\[[^\]]+\]\([^)]+\)|!\[[^\]]*]\([^)]+\)|`[^`]+`|^\s*([-*_]\s*){3,}$)/m;
  return markdownPattern.test(content);
}

/**
 * 将纯文本渲染为 HTML（保留换行）
 *
 * @param {string} content - 原始内容
 * @returns {string} 渲染后的 HTML
 */
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
