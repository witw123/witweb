import "server-only";

function normalizeUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

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

export function buildFallbackFaviconUrl(targetUrl: string) {
  try {
    return `${new URL(normalizeUrl(targetUrl)).origin}/favicon.ico`;
  } catch {
    return "";
  }
}

