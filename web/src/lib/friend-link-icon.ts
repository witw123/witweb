/**
 * 友链图标检测工具
 *
 * 自动检测网站 favicon 图标，用于友链展示
 * 支持从网页中提取图标链接和常见的默认图标路径
 */
import "server-only";

/**
 * 规范化 URL
 *
 * 确保 URL 格式正确，添加 https:// 前缀（如果缺失）
 *
 * @param input - 原始输入 URL
 * @returns 规范化后的 URL 字符串
 */
function normalizeUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

/**
 * 数组去重
 *
 * 过滤空字符串并返回去重后的数组
 *
 * @param items - 字符串数组
 * @returns 去重后的字符串数组
 */
function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

/**
 * 从 HTML 中提取图标链接
 *
 * 解析 HTML 中的 <link> 标签，提取 rel 包含 icon 的 href 属性
 *
 * @param html - 网页 HTML 内容
 * @returns 图标 URL 数组
 */
function extractIconHrefs(html: string) {
  const result: string[] = [];
  const linkRegex = /<link\s+[^>]*>/gi;
  const relRegex = /\brel\s*=\s*["']?([^"' >]+(?:\s+[^"' >]+)*)["']?/i;
  const hrefRegex = /\bhref\s*=\s*["']([^"']+)["']/i;
  const links = html.match(linkRegex) || [];
  for (const tag of links) {
    const relMatch = tag.match(relRegex);
    const hrefMatch = tag.match(hrefRegex);
    if (!relMatch || !hrefMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (rel.includes("icon")) {
      result.push(hrefMatch[1]);
    }
  }
  return result;
}

/**
 * 获取网页文本内容
 *
 * 带超时控制的 HTTP GET 请求，用于获取网页 HTML
 *
 * @param url - 目标 URL
 * @param timeoutMs - 超时时间（毫秒），默认 5000ms
 * @returns 请求结果对象，包含 ok、text、finalUrl 字段
 */
async function fetchText(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WitWebBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { ok: false, text: "", finalUrl: url };
    const text = await res.text();
    return { ok: true, text, finalUrl: res.url || url };
  } catch {
    return { ok: false, text: "", finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 检查图片是否可加载
 *
 * 发送 HEAD 请求验证图片 URL 是否可访问
 *
 * @param url - 图片 URL
 * @param timeoutMs - 超时时间（毫秒），默认 4000ms
 * @returns 是否可加载
 */
async function canLoadImage(url: string, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WitWebBot/1.0)" },
    });
    if (!res.ok) return false;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    return type.includes("image") || url.toLowerCase().includes(".ico");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 检测友链网站图标
 *
 * 自动检测网站的 favicon 图标：
 * 1. 首先从网页 HTML 中提取 <link rel="icon"> 标签
 * 2. 然后尝试常见的默认图标路径（/favicon.ico、/apple-touch-icon.png 等）
 * 3. 验证图标是否可加载
 *
 * @param targetUrl - 目标网站 URL
 * @returns 可用的图标 URL，检测失败返回 null
 * @example
 * const icon = await detectFriendLinkIcon('https://example.com');
 */
export async function detectFriendLinkIcon(targetUrl: string) {
  const normalized = normalizeUrl(targetUrl);
  if (!normalized) return null;
  let origin = "";
  try {
    origin = new URL(normalized).origin;
  } catch {
    return null;
  }

  const page = await fetchText(normalized);
  const baseUrl = page.finalUrl || normalized;
  const candidates: string[] = [];

  if (page.ok && page.text) {
    const hrefs = extractIconHrefs(page.text);
    for (const href of hrefs) {
      try {
        candidates.push(new URL(href, baseUrl).toString());
      } catch {
        // ignore bad href
      }
    }
  }

  candidates.push(`${origin}/favicon.ico`);
  candidates.push(`${origin}/apple-touch-icon.png`);
  candidates.push(`${origin}/apple-touch-icon-precomposed.png`);

  const urls = unique(candidates);
  for (const url of urls) {
    if (await canLoadImage(url)) {
      return url;
    }
  }
  return null;
}

/**
 * 构建备用 favicon URL
 *
 * 直接使用网站的 /favicon.ico 作为备选方案
 *
 * @param targetUrl - 目标网站 URL
 * @returns favicon.ico 的完整 URL，无效 URL 返回空字符串
 * @example
 * const favicon = buildFallbackFaviconUrl('https://example.com');
 * // 返回: 'https://example.com/favicon.ico'
 */
export function buildFallbackFaviconUrl(targetUrl: string) {
  try {
    return `${new URL(normalizeUrl(targetUrl)).origin}/favicon.ico`;
  } catch {
    return "";
  }
}

