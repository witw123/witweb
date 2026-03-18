import "server-only";

import { listRadarItems } from "@/lib/topic-radar";

export interface PublicWebSearchItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(input: string) {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeSearchHref(href: string) {
  try {
    const decodedHref = decodeURIComponent(href);
    if (decodedHref.includes("duckduckgo.com/l/?")) {
      const redirectUrl = new URL(decodedHref);
      const target = redirectUrl.searchParams.get("uddg");
      return target ? decodeURIComponent(target) : decodedHref;
    }
    return decodedHref;
  } catch {
    return href;
  }
}

function parseDuckDuckGoHtml(html: string, limit: number) {
  const anchorRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  const matches = [...html.matchAll(anchorRegex)];
  const items: PublicWebSearchItem[] = [];

  for (let index = 0; index < matches.length && items.length < limit; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const href = normalizeSearchHref(match[1] || "");
    const title = stripHtml(match[2] || "");
    if (!href || !title) continue;

    const start = (match.index || 0) + match[0].length;
    const end = nextMatch?.index || start + 1200;
    const region = html.slice(start, end);
    const snippetMatch = region.match(/class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/(?:a|div|span)>/i);
    const snippet = stripHtml(snippetMatch?.[1] || "");

    items.push({
      title,
      url: href,
      snippet,
      source: "duckduckgo_html",
    });
  }

  return items;
}

async function fallbackRadarSearch(username: string, query: string, limit: number) {
  const items = await listRadarItems(username, {
    q: query,
    limit: Math.max(1, Math.min(10, limit)),
  }).catch(() => []);

  return items.slice(0, limit).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.summary || "",
    source: item.source_name || "topic_radar",
  }));
}

export async function searchPublicWeb(
  username: string,
  input: {
    query: string;
    limit?: number;
  }
) {
  const query = input.query.trim();
  const limit = Math.max(1, Math.min(8, input.limit || 5));
  if (!query) {
    return {
      query,
      items: [] as PublicWebSearchItem[],
      source: "empty_query",
    };
  }

  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "WitWebAgent/1.0 (+https://witweb.local)",
      },
      cache: "no-store",
    });
    if (response.ok) {
      const html = await response.text();
      const items = parseDuckDuckGoHtml(html, limit);
      if (items.length > 0) {
        return {
          query,
          items,
          source: "duckduckgo_html",
        };
      }
    }
  } catch {
    // Fall through to radar-backed fallback.
  }

  return {
    query,
    items: await fallbackRadarSearch(username, query, limit),
    source: "topic_radar_fallback",
  };
}
