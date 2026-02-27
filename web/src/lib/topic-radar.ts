import "server-only";
import { topicRadarRepository } from "./repositories";

export type RadarSourceType = "rss" | "html" | "api";

export type RadarSource = {
  id: number;
  name: string;
  url: string;
  type: RadarSourceType;
  parser_config_json: string;
  enabled: number;
  last_fetch_status: "idle" | "ok" | "failed";
  last_fetch_error: string;
  last_fetched_at: string | null;
  last_fetch_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RadarItem = {
  id: number;
  source_id: number;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  score: number;
  raw_json: string;
  fetched_at: string;
};

export type RadarSavedTopic = {
  id: number;
  created_by: string;
  kind: "item" | "analysis";
  title: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string;
  score: number;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

export type RadarNotification = {
  id: number;
  created_by: string;
  type: "webhook";
  name: string;
  webhook_url: string;
  secret: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type RadarAlertRuleType = "new_item" | "keyword" | "source" | "min_score";

export type RadarAlertRule = {
  id: number;
  created_by: string;
  name: string;
  rule_type: RadarAlertRuleType;
  keyword: string;
  source_id: number | null;
  min_score: number;
  channel_id: number;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type RadarAlertLog = {
  id: number;
  created_by: string;
  item_id: number;
  channel_id: number;
  rule_id: number;
  status: "success" | "failed";
  response_text: string;
  error_text: string;
  sent_at: string;
};

const DEFAULT_RADAR_SOURCES: Array<{
  name: string;
  url: string;
  type: RadarSourceType;
  group: string;
  enabled?: boolean;
}> = [
  { name: "Hacker News", url: "https://hnrss.org/frontpage", type: "rss", group: "国际技术", enabled: true },
  { name: "Product Hunt", url: "https://www.producthunt.com/feed", type: "rss", group: "国际技术", enabled: true },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", type: "rss", group: "国际技术", enabled: true },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", type: "rss", group: "国际技术", enabled: true },
  { name: "Wired", url: "https://www.wired.com/feed/rss", type: "rss", group: "国际技术", enabled: true },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", type: "rss", group: "国际技术", enabled: true },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", type: "rss", group: "国际技术", enabled: true },
  { name: "InfoQ", url: "https://feed.infoq.com/", type: "rss", group: "国际技术", enabled: true },
  { name: "掘金热门", url: "https://juejin.cn/rss", type: "rss", group: "中文科技", enabled: true },
  { name: "少数派", url: "https://sspai.com/feed", type: "rss", group: "中文科技", enabled: true },
  { name: "36氪快讯", url: "https://36kr.com/feed", type: "rss", group: "中文科技", enabled: true },
  { name: "虎嗅", url: "https://www.huxiu.com/rss/0.xml", type: "rss", group: "中文科技", enabled: true },
  { name: "机器之心", url: "https://www.jiqizhixin.com/rss", type: "rss", group: "中文科技", enabled: true },
  { name: "爱范儿", url: "https://www.ifanr.com/feed", type: "rss", group: "中文科技", enabled: true },
  { name: "V2EX 热门", url: "https://www.v2ex.com/index.xml", type: "rss", group: "社交热榜", enabled: true },
  { name: "Solidot", url: "https://www.solidot.org/index.rss", type: "rss", group: "社交热榜", enabled: true },
];

type NormalizedSourceItem = {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  raw: Record<string, unknown>;
};

type ParserConfig = {
  group?: string;
  base_url?: string;
  link_pattern?: string;
  items_path?: string;
  title_key?: string;
  url_key?: string;
  summary_key?: string;
  time_key?: string;
};

type InsertedRadarItem = {
  id: number;
  source_id: number;
  source_name: string;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  score: number;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHtml(text: string): string {
  return decodeXml(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function pickTagAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function toIsoDate(value: string): string {
  if (!value) return nowIso();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return nowIso();
  return d.toISOString();
}

function scoreByFreshness(publishedAt: string): number {
  const now = Date.now();
  const ts = new Date(publishedAt).getTime();
  if (!Number.isFinite(ts)) return 20;
  const hours = Math.max(0, (now - ts) / 3600000);
  if (hours <= 6) return 100;
  if (hours <= 24) return 85;
  if (hours <= 72) return 70;
  if (hours <= 168) return 55;
  return 35;
}

function parseParserConfig(raw: string): ParserConfig {
  try {
    const obj = JSON.parse(raw || "{}");
    if (!obj || typeof obj !== "object") return {};
    return obj as ParserConfig;
  } catch {
    return {};
  }
}

function resolveUrl(baseUrl: string, inputUrl: string): string {
  try {
    return new URL(inputUrl, baseUrl).toString();
  } catch {
    return inputUrl;
  }
}

function getByPath(input: unknown, path: string): unknown {
  if (!path) return input;
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = input;
  for (const part of parts) {
    const record = toRecord(cursor);
    if (!record) return undefined;
    cursor = record[part];
  }
  return cursor;
}

function totalScore(publishedAt: string): number {
  return Math.min(220, scoreByFreshness(publishedAt));
}

function includesKeyword(text: string, keyword: string): boolean {
  const target = text.trim().toLowerCase();
  const term = keyword.trim().toLowerCase();
  if (!target || !term) return false;
  return target.includes(term);
}

function shouldTriggerRule(rule: RadarAlertRule, item: InsertedRadarItem): boolean {
  if (rule.enabled !== 1) return false;
  if (rule.source_id && rule.source_id !== item.source_id) return false;
  if (rule.rule_type === "source") return true;
  if (rule.rule_type === "min_score") return item.score >= Number(rule.min_score || 0);
  if (rule.rule_type === "keyword") {
    return includesKeyword(`${item.title}\n${item.summary}`, rule.keyword || "");
  }
  return true;
}

async function sendWebhookNotification(
  channel: RadarNotification,
  rule: RadarAlertRule,
  item: InsertedRadarItem
): Promise<{ ok: boolean; responseText?: string; errorText?: string }> {
  try {
    const body = {
      event: "radar_item_matched",
      item: {
        id: item.id,
        title: item.title,
        url: item.url,
        summary: item.summary,
        score: item.score,
        published_at: item.published_at,
      },
      source: {
        id: item.source_id,
        name: item.source_name,
      },
      rule: {
        id: rule.id,
        name: rule.name,
        type: rule.rule_type,
      },
      timestamp: nowIso(),
    };

    const response = await fetch(channel.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(channel.secret ? { "X-Radar-Secret": channel.secret } : {}),
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        responseText: responseText.slice(0, 1000),
        errorText: `webhook_http_${response.status}`,
      };
    }
    return { ok: true, responseText: responseText.slice(0, 1000) };
  } catch (error) {
    return {
      ok: false,
      errorText: error instanceof Error ? error.message : "webhook_request_failed",
    };
  }
}

async function dispatchAlertsForItems(username: string, items: InsertedRadarItem[]) {
  if (items.length === 0) return;

  const channels = (await topicRadarRepository.listEnabledNotificationsByUser(username)) as RadarNotification[];
  if (channels.length === 0) return;

  const rules = (await topicRadarRepository.listEnabledAlertRulesByUser(username)) as RadarAlertRule[];
  if (rules.length === 0) return;

  const channelById = new Map(channels.map((item) => [item.id, item]));

  for (const item of items) {
    for (const rule of rules) {
      const channel = channelById.get(rule.channel_id);
      if (!channel || channel.enabled !== 1) continue;
      if (!shouldTriggerRule(rule, item)) continue;

      if (await topicRadarRepository.hasAlertLog(item.id, channel.id, rule.id)) continue;

      const sendResult = await sendWebhookNotification(channel, rule, item);
      await topicRadarRepository.insertAlertLog({
        username,
        itemId: item.id,
        channelId: channel.id,
        ruleId: rule.id,
        status: sendResult.ok ? "success" : "failed",
        responseText: sendResult.responseText || "",
        errorText: sendResult.errorText || "",
        sentAt: nowIso(),
      });
    }
  }
}

async function ensureDefaultRadarSources(username: string) {
  const existing = await topicRadarRepository.listSourceUrlsByUser(username);
  const existingSet = new Set(existing.map((item) => item.url.trim().toLowerCase()));
  const ts = nowIso();

  for (const source of DEFAULT_RADAR_SOURCES) {
    const key = source.url.trim().toLowerCase();
    if (existingSet.has(key)) continue;
    await topicRadarRepository.insertSource({
      name: source.name,
      url: source.url,
      type: source.type,
      parserConfigJson: JSON.stringify({ group: source.group, preset: true }),
      enabled: source.enabled === false ? 0 : 1,
      username,
      ts,
    });
    existingSet.add(key);
  }
}

export async function listRadarSources(username: string): Promise<RadarSource[]> {
  await ensureDefaultRadarSources(username);
  return (await topicRadarRepository.listSourcesByUser(username)) as RadarSource[];
}

export async function createRadarSource(input: {
  username: string;
  name: string;
  url: string;
  type: RadarSourceType;
  parserConfigJson?: string;
  enabled?: boolean;
}) {
  const ts = nowIso();
  return {
    id: await topicRadarRepository.insertSource({
      name: input.name,
      url: input.url,
      type: input.type,
      parserConfigJson: input.parserConfigJson || "{}",
      enabled: input.enabled === false ? 0 : 1,
      username: input.username,
      ts,
    }),
  };
}

export async function updateRadarSource(
  sourceId: number,
  username: string,
  patch: {
    name?: string;
    url?: string;
    type?: RadarSourceType;
    parserConfigJson?: string;
    enabled?: boolean;
  }
) {
  if (!(await topicRadarRepository.sourceExistsByIdAndUser(sourceId, username))) throw new Error("source_not_found");

  await topicRadarRepository.updateSource(sourceId, username, {
    ...patch,
    ts: nowIso(),
  });
}

export async function deleteRadarSource(sourceId: number, username: string) {
  const deleted = await topicRadarRepository.deleteSourceWithItems(sourceId, username);
  if (!deleted) throw new Error("source_not_found");
}

export async function listRadarItems(username: string, options: { limit?: number; q?: string; sourceId?: number } = {}) {
  await ensureDefaultRadarSources(username);
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  return (await topicRadarRepository.listItemsByUser(username, {
    limit,
    q: options.q,
    sourceId: options.sourceId,
  })) as Array<RadarItem & { source_name: string }>;
}

export async function listRadarNotifications(username: string): Promise<RadarNotification[]> {
  return (await topicRadarRepository.listNotificationsByUser(username)) as RadarNotification[];
}

export async function createRadarNotification(input: {
  username: string;
  name: string;
  webhookUrl: string;
  secret?: string;
  enabled?: boolean;
}) {
  const ts = nowIso();
  return {
    id: await topicRadarRepository.createNotification({
      username: input.username,
      name: input.name,
      webhookUrl: input.webhookUrl,
      secret: input.secret || "",
      enabled: input.enabled === false ? 0 : 1,
      ts,
    }),
  };
}

export async function updateRadarNotification(
  notificationId: number,
  username: string,
  patch: { name?: string; webhookUrl?: string; secret?: string; enabled?: boolean }
) {
  if (!(await topicRadarRepository.notificationExistsByIdAndUser(notificationId, username))) {
    throw new Error("notification_not_found");
  }
  await topicRadarRepository.updateNotification(notificationId, username, {
    ...patch,
    ts: nowIso(),
  });
}

export async function deleteRadarNotification(notificationId: number, username: string) {
  const deleted = await topicRadarRepository.deleteNotificationWithRules(notificationId, username);
  if (!deleted) throw new Error("notification_not_found");
}

export async function listRadarAlertRules(username: string): Promise<Array<RadarAlertRule & { channel_name: string }>> {
  return (await topicRadarRepository.listAlertRulesByUser(username)) as Array<RadarAlertRule & { channel_name: string }>;
}

export async function createRadarAlertRule(input: {
  username: string;
  name: string;
  ruleType: RadarAlertRuleType;
  keyword?: string;
  sourceId?: number;
  minScore?: number;
  channelId: number;
  enabled?: boolean;
}) {
  const channel = await topicRadarRepository.notificationExistsByIdAndUser(input.channelId, input.username);
  if (!channel) throw new Error("notification_not_found");

  const ts = nowIso();
  return {
    id: await topicRadarRepository.createAlertRule({
      username: input.username,
      name: input.name,
      ruleType: input.ruleType,
      keyword: input.keyword || "",
      sourceId: input.sourceId ?? null,
      minScore: input.minScore ?? 0,
      channelId: input.channelId,
      enabled: input.enabled === false ? 0 : 1,
      ts,
    }),
  };
}

export async function updateRadarAlertRule(
  ruleId: number,
  username: string,
  patch: {
    name?: string;
    ruleType?: RadarAlertRuleType;
    keyword?: string;
    sourceId?: number | null;
    minScore?: number;
    channelId?: number;
    enabled?: boolean;
  }
) {
  if (!(await topicRadarRepository.alertRuleExistsByIdAndUser(ruleId, username))) throw new Error("rule_not_found");

  if (patch.channelId) {
    if (!(await topicRadarRepository.notificationExistsByIdAndUser(patch.channelId, username))) {
      throw new Error("notification_not_found");
    }
  }

  await topicRadarRepository.updateAlertRule(ruleId, username, {
    ...patch,
    ts: nowIso(),
  });
}

export async function deleteRadarAlertRule(ruleId: number, username: string) {
  const deleted = await topicRadarRepository.deleteAlertRule(ruleId, username);
  if (!deleted) throw new Error("rule_not_found");
}

export async function listRadarAlertLogs(
  username: string,
  options: { limit?: number; status?: "success" | "failed" } = {}
): Promise<Array<RadarAlertLog & { rule_name: string; channel_name: string; item_title: string }>> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  return (await topicRadarRepository.listAlertLogsByUser(username, {
    limit,
    status: options.status,
  })) as Array<RadarAlertLog & { rule_name: string; channel_name: string; item_title: string }>;
}

export async function clearRadarItems(username: string, options: { sourceId?: number } = {}) {
  await ensureDefaultRadarSources(username);

  if (options.sourceId) {
    if (!(await topicRadarRepository.sourceExistsByIdAndUser(options.sourceId, username))) {
      throw new Error("source_not_found");
    }
    return { deleted: await topicRadarRepository.clearItemsBySource(options.sourceId) };
  }

  return { deleted: await topicRadarRepository.clearItemsByUser(username) };
}

export async function listRadarSavedTopics(
  username: string,
  options: { limit?: number; q?: string; kind?: "item" | "analysis" } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const rows = (await topicRadarRepository.listSavedTopicsByUser(username, {
    limit,
    q: options.q,
    kind: options.kind,
  })) as RadarSavedTopic[];

  return rows.map((row) => ({
    ...row,
    tags: (() => {
      try {
        const parsed = JSON.parse(row.tags_json || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    })(),
  }));
}

export async function createRadarSavedTopic(input: {
  username: string;
  kind: "item" | "analysis";
  title: string;
  summary?: string;
  content?: string;
  sourceName?: string;
  sourceUrl?: string;
  score?: number;
  tags?: string[];
}) {
  const ts = nowIso();
  return {
    id: await topicRadarRepository.createSavedTopic({
      username: input.username,
      kind: input.kind,
      title: input.title,
      summary: input.summary || "",
      content: input.content || "",
      sourceName: input.sourceName || "",
      sourceUrl: input.sourceUrl || "",
      score: input.score ?? 0,
      tagsJson: JSON.stringify((input.tags || []).map((item) => item.trim()).filter(Boolean).slice(0, 20)),
      ts,
    }),
  };
}

export async function deleteRadarSavedTopic(topicId: number, username: string) {
  const deleted = await topicRadarRepository.deleteSavedTopic(topicId, username);
  if (!deleted) throw new Error("topic_not_found");
  return { id: topicId, deleted: true };
}

async function fetchRssItems(feedUrl: string): Promise<NormalizedSourceItem[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);

  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "WitWeb-Radar/1.0" },
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new Error(`fetch_failed_${res.status}`);
    }

    const xml = await res.text();
    const rssItems = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
    const atomItems = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
    const blocks = rssItems.length ? rssItems : atomItems;

    return blocks
      .slice(0, 40)
      .map((block) => {
        const title = stripHtml(pickTag(block, "title"));
        const link = pickTag(block, "link") || pickTagAttr(block, "link", "href");
        const summary = stripHtml(pickTag(block, "description") || pickTag(block, "summary") || pickTag(block, "content"));
        const publishedAt = toIsoDate(
          pickTag(block, "pubDate") || pickTag(block, "published") || pickTag(block, "updated") || ""
        );
        return {
          title,
          url: link,
          summary,
          publishedAt,
          raw: { title, link, summary, publishedAt },
        };
      })
      .filter((item) => item.title && item.url);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlItems(sourceUrl: string, parser: ParserConfig): Promise<NormalizedSourceItem[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);

  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "WitWeb-Radar/1.0" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`fetch_failed_${res.status}`);

    const html = await res.text();
    const baseUrl = parser.base_url || sourceUrl;
    const linkPattern = parser.link_pattern ? new RegExp(parser.link_pattern, "i") : null;

    const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => {
        const href = decodeXml(m[1]);
        const title = stripHtml(m[2]);
        return { href, title };
      })
      .filter((item) => item.title.length >= 8 && item.title.length <= 120)
      .filter((item) => !item.href.startsWith("#") && !item.href.startsWith("javascript:"))
      .filter((item) => (linkPattern ? linkPattern.test(item.href) || linkPattern.test(item.title) : true));

    const dedup = new Set<string>();
    const items: NormalizedSourceItem[] = [];

    for (const anchor of anchors) {
      const url = resolveUrl(baseUrl, anchor.href);
      if (!/^https?:\/\//i.test(url)) continue;
      if (dedup.has(url)) continue;
      dedup.add(url);

      items.push({
        title: anchor.title,
        url,
        summary: "",
        publishedAt: nowIso(),
        raw: { title: anchor.title, href: anchor.href, url },
      });

      if (items.length >= 40) break;
    }

    return items;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApiItems(sourceUrl: string, parser: ParserConfig): Promise<NormalizedSourceItem[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);

  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "WitWeb-Radar/1.0", Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`fetch_failed_${res.status}`);

    const payload = await res.json();
    const rawItems = getByPath(payload, parser.items_path || "items");
    const arr = Array.isArray(rawItems) ? rawItems : Array.isArray(payload) ? payload : [];

    const titleKey = parser.title_key || "title";
    const urlKey = parser.url_key || "url";
    const summaryKey = parser.summary_key || "summary";
    const timeKey = parser.time_key || "published_at";

    return arr
      .slice(0, 80)
      .map((item: unknown) => {
        const title = stripHtml(String(getByPath(item, titleKey) || ""));
        const link = String(getByPath(item, urlKey) || "");
        const summary = stripHtml(String(getByPath(item, summaryKey) || ""));
        const publishedAt = toIsoDate(String(getByPath(item, timeKey) || ""));
        const url = resolveUrl(parser.base_url || sourceUrl, link);
        return {
          title,
          url,
          summary,
          publishedAt,
          raw: toRecord(item) ?? { value: item },
        };
      })
      .filter((item) => item.title && /^https?:\/\//i.test(item.url));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRadarSourceNow(sourceId: number, username: string) {
  await ensureDefaultRadarSources(username);

  const source = (await topicRadarRepository.getSourceByIdAndUser(sourceId, username)) as RadarSource | null;
  if (!source) throw new Error("source_not_found");

  const parser = parseParserConfig(source.parser_config_json || "{}");
  let items: NormalizedSourceItem[] = [];
  const ts = nowIso();

  try {
    if (source.type === "rss") {
      items = await fetchRssItems(source.url);
    } else if (source.type === "html") {
      items = await fetchHtmlItems(source.url, parser);
    } else if (source.type === "api") {
      items = await fetchApiItems(source.url, parser);
    } else {
      throw new Error("source_type_not_supported");
    }
  } catch (error) {
    await topicRadarRepository.markSourceFetchFailed(
      source.id,
      ts,
      error instanceof Error ? error.message : "fetch_failed"
    );
    throw error;
  }

  const persisted = await topicRadarRepository.saveFetchedItemsAndMarkSourceSuccess(
    { id: source.id, name: source.name },
    items.map((item) => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
      publishedAt: item.publishedAt,
      score: totalScore(item.publishedAt),
      rawJson: JSON.stringify(item.raw),
    })),
    ts
  );

  await dispatchAlertsForItems(username, persisted.insertedItems as InsertedRadarItem[]);

  return { sourceId: source.id, fetched: items.length, inserted: persisted.inserted };
}

export async function fetchAllEnabledSources(username: string) {
  await ensureDefaultRadarSources(username);

  const sources = await topicRadarRepository.listSourceIdsByUser(username);

  const results: Array<{ sourceId: number; fetched: number; inserted: number; error?: string }> = [];
  for (const source of sources) {
    try {
      const result = await fetchRadarSourceNow(source.id, username);
      results.push(result);
    } catch (error) {
      results.push({
        sourceId: source.id,
        fetched: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return results;
}
