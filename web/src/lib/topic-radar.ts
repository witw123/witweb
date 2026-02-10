import "server-only";
import { getStudioDb } from "./db";

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
  let cursor: any = input;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
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

  const db = getStudioDb();
  const channels = db
    .prepare(
      `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
       FROM radar_notifications
       WHERE created_by = ? AND enabled = 1
       ORDER BY id DESC`
    )
    .all(username) as RadarNotification[];
  if (channels.length === 0) return;

  const rules = db
    .prepare(
      `SELECT id, created_by, name, rule_type, keyword, source_id, min_score, channel_id, enabled, created_at, updated_at
       FROM radar_alert_rules
       WHERE created_by = ? AND enabled = 1
       ORDER BY id DESC`
    )
    .all(username) as RadarAlertRule[];
  if (rules.length === 0) return;

  const channelById = new Map(channels.map((item) => [item.id, item]));

  const hasSent = db.prepare(
    "SELECT id FROM radar_alert_logs WHERE item_id = ? AND channel_id = ? AND rule_id = ? LIMIT 1"
  );
  const insertLog = db.prepare(
    `INSERT INTO radar_alert_logs
     (created_by,item_id,channel_id,rule_id,status,response_text,error_text,sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const item of items) {
    for (const rule of rules) {
      const channel = channelById.get(rule.channel_id);
      if (!channel || channel.enabled !== 1) continue;
      if (!shouldTriggerRule(rule, item)) continue;

      const existing = hasSent.get(item.id, channel.id, rule.id) as { id: number } | undefined;
      if (existing) continue;

      const sendResult = await sendWebhookNotification(channel, rule, item);
      insertLog.run(
        username,
        item.id,
        channel.id,
        rule.id,
        sendResult.ok ? "success" : "failed",
        sendResult.responseText || "",
        sendResult.errorText || "",
        nowIso()
      );
    }
  }
}

function ensureDefaultRadarSources(username: string) {
  const db = getStudioDb();
  const existing = db.prepare("SELECT url FROM topic_sources WHERE created_by = ?").all(username) as Array<{ url: string }>;
  const existingSet = new Set(existing.map((item) => item.url.trim().toLowerCase()));

  const insert = db.prepare(
    `INSERT INTO topic_sources (name,url,type,parser_config_json,enabled,created_by,created_at,updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ts = nowIso();

  const tx = db.transaction(() => {
    for (const source of DEFAULT_RADAR_SOURCES) {
      const key = source.url.trim().toLowerCase();
      if (existingSet.has(key)) continue;
      insert.run(
        source.name,
        source.url,
        source.type,
        JSON.stringify({ group: source.group, preset: true }),
        source.enabled === false ? 0 : 1,
        username,
        ts,
        ts
      );
      existingSet.add(key);
    }
  });

  tx();
}

export function listRadarSources(username: string): RadarSource[] {
  ensureDefaultRadarSources(username);
  const db = getStudioDb();
  return db
    .prepare(
      `SELECT id,name,url,type,parser_config_json,enabled,created_by,created_at,updated_at
              ,last_fetch_status,last_fetch_error,last_fetched_at,last_fetch_count
       FROM topic_sources
       WHERE created_by = ?
       ORDER BY id DESC`
    )
    .all(username) as RadarSource[];
}

export function createRadarSource(input: {
  username: string;
  name: string;
  url: string;
  type: RadarSourceType;
  parserConfigJson?: string;
  enabled?: boolean;
}) {
  const db = getStudioDb();
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO topic_sources (name,url,type,parser_config_json,enabled,created_by,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.url,
      input.type,
      input.parserConfigJson || "{}",
      input.enabled === false ? 0 : 1,
      input.username,
      ts,
      ts
    );

  return { id: Number(result.lastInsertRowid) };
}

export function updateRadarSource(
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
  const db = getStudioDb();
  const existing = db
    .prepare("SELECT id FROM topic_sources WHERE id = ? AND created_by = ?")
    .get(sourceId, username) as { id: number } | undefined;
  if (!existing) throw new Error("source_not_found");

  db.prepare(
    `UPDATE topic_sources
     SET name = COALESCE(?, name),
         url = COALESCE(?, url),
         type = COALESCE(?, type),
         parser_config_json = COALESCE(?, parser_config_json),
         enabled = COALESCE(?, enabled),
         updated_at = ?
     WHERE id = ? AND created_by = ?`
  ).run(
    patch.name ?? null,
    patch.url ?? null,
    patch.type ?? null,
    patch.parserConfigJson ?? null,
    patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
    nowIso(),
    sourceId,
    username
  );
}

export function deleteRadarSource(sourceId: number, username: string) {
  const db = getStudioDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM topic_items WHERE source_id = ?").run(sourceId);
    const r = db.prepare("DELETE FROM topic_sources WHERE id = ? AND created_by = ?").run(sourceId, username);
    if (r.changes === 0) throw new Error("source_not_found");
  });
  tx();
}

export function listRadarItems(username: string, options: { limit?: number; q?: string; sourceId?: number } = {}) {
  ensureDefaultRadarSources(username);
  const db = getStudioDb();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const where: string[] = ["s.created_by = ?"];
  const args: any[] = [username];

  if (options.q?.trim()) {
    where.push("(i.title LIKE ? OR i.summary LIKE ?)");
    args.push(`%${options.q.trim()}%`, `%${options.q.trim()}%`);
  }
  if (options.sourceId) {
    where.push("i.source_id = ?");
    args.push(options.sourceId);
  }

  args.push(limit);

  return db
    .prepare(
      `SELECT i.id, i.source_id, i.title, i.url, i.summary, i.published_at, i.score, i.raw_json, i.fetched_at,
              s.name AS source_name
       FROM topic_items i
       JOIN topic_sources s ON s.id = i.source_id
       WHERE ${where.join(" AND ")}
       ORDER BY i.score DESC, i.published_at DESC
       LIMIT ?`
    )
    .all(...args) as Array<RadarItem & { source_name: string }>;
}

export function listRadarNotifications(username: string): RadarNotification[] {
  const db = getStudioDb();
  return db
    .prepare(
      `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
       FROM radar_notifications
       WHERE created_by = ?
       ORDER BY id DESC`
    )
    .all(username) as RadarNotification[];
}

export function createRadarNotification(input: {
  username: string;
  name: string;
  webhookUrl: string;
  secret?: string;
  enabled?: boolean;
}) {
  const db = getStudioDb();
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO radar_notifications
       (created_by,type,name,webhook_url,secret,enabled,created_at,updated_at)
       VALUES (?, 'webhook', ?, ?, ?, ?, ?, ?)`
    )
    .run(input.username, input.name, input.webhookUrl, input.secret || "", input.enabled === false ? 0 : 1, ts, ts);
  return { id: Number(result.lastInsertRowid) };
}

export function updateRadarNotification(
  notificationId: number,
  username: string,
  patch: { name?: string; webhookUrl?: string; secret?: string; enabled?: boolean }
) {
  const db = getStudioDb();
  const existing = db
    .prepare("SELECT id FROM radar_notifications WHERE id = ? AND created_by = ?")
    .get(notificationId, username) as { id: number } | undefined;
  if (!existing) throw new Error("notification_not_found");

  db.prepare(
    `UPDATE radar_notifications
     SET name = COALESCE(?, name),
         webhook_url = COALESCE(?, webhook_url),
         secret = COALESCE(?, secret),
         enabled = COALESCE(?, enabled),
         updated_at = ?
     WHERE id = ? AND created_by = ?`
  ).run(
    patch.name ?? null,
    patch.webhookUrl ?? null,
    patch.secret ?? null,
    patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
    nowIso(),
    notificationId,
    username
  );
}

export function deleteRadarNotification(notificationId: number, username: string) {
  const db = getStudioDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM radar_alert_rules WHERE channel_id = ? AND created_by = ?").run(notificationId, username);
    const result = db.prepare("DELETE FROM radar_notifications WHERE id = ? AND created_by = ?").run(notificationId, username);
    if (result.changes === 0) throw new Error("notification_not_found");
  });
  tx();
}

export function listRadarAlertRules(username: string): Array<RadarAlertRule & { channel_name: string }> {
  const db = getStudioDb();
  return db
    .prepare(
      `SELECT r.id, r.created_by, r.name, r.rule_type, r.keyword, r.source_id, r.min_score, r.channel_id, r.enabled, r.created_at, r.updated_at,
              n.name AS channel_name
       FROM radar_alert_rules r
       JOIN radar_notifications n ON n.id = r.channel_id
       WHERE r.created_by = ?
       ORDER BY r.id DESC`
    )
    .all(username) as Array<RadarAlertRule & { channel_name: string }>;
}

export function createRadarAlertRule(input: {
  username: string;
  name: string;
  ruleType: RadarAlertRuleType;
  keyword?: string;
  sourceId?: number;
  minScore?: number;
  channelId: number;
  enabled?: boolean;
}) {
  const db = getStudioDb();
  const channel = db
    .prepare("SELECT id FROM radar_notifications WHERE id = ? AND created_by = ?")
    .get(input.channelId, input.username) as { id: number } | undefined;
  if (!channel) throw new Error("notification_not_found");

  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO radar_alert_rules
       (created_by,name,rule_type,keyword,source_id,min_score,channel_id,enabled,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.username,
      input.name,
      input.ruleType,
      input.keyword || "",
      input.sourceId ?? null,
      input.minScore ?? 0,
      input.channelId,
      input.enabled === false ? 0 : 1,
      ts,
      ts
    );
  return { id: Number(result.lastInsertRowid) };
}

export function updateRadarAlertRule(
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
  const db = getStudioDb();
  const existing = db
    .prepare("SELECT id FROM radar_alert_rules WHERE id = ? AND created_by = ?")
    .get(ruleId, username) as { id: number } | undefined;
  if (!existing) throw new Error("rule_not_found");

  if (patch.channelId) {
    const channel = db
      .prepare("SELECT id FROM radar_notifications WHERE id = ? AND created_by = ?")
      .get(patch.channelId, username) as { id: number } | undefined;
    if (!channel) throw new Error("notification_not_found");
  }

  db.prepare(
    `UPDATE radar_alert_rules
     SET name = COALESCE(?, name),
         rule_type = COALESCE(?, rule_type),
         keyword = COALESCE(?, keyword),
         source_id = COALESCE(?, source_id),
         min_score = COALESCE(?, min_score),
         channel_id = COALESCE(?, channel_id),
         enabled = COALESCE(?, enabled),
         updated_at = ?
     WHERE id = ? AND created_by = ?`
  ).run(
    patch.name ?? null,
    patch.ruleType ?? null,
    patch.keyword ?? null,
    patch.sourceId === undefined ? null : patch.sourceId,
    patch.minScore ?? null,
    patch.channelId ?? null,
    patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
    nowIso(),
    ruleId,
    username
  );
}

export function deleteRadarAlertRule(ruleId: number, username: string) {
  const db = getStudioDb();
  const result = db.prepare("DELETE FROM radar_alert_rules WHERE id = ? AND created_by = ?").run(ruleId, username);
  if (result.changes === 0) throw new Error("rule_not_found");
}

export function listRadarAlertLogs(
  username: string,
  options: { limit?: number; status?: "success" | "failed" } = {}
): Array<RadarAlertLog & { rule_name: string; channel_name: string; item_title: string }> {
  const db = getStudioDb();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const where: string[] = ["l.created_by = ?"];
  const args: any[] = [username];

  if (options.status) {
    where.push("l.status = ?");
    args.push(options.status);
  }

  args.push(limit);

  return db
    .prepare(
      `SELECT l.id, l.created_by, l.item_id, l.channel_id, l.rule_id, l.status, l.response_text, l.error_text, l.sent_at,
              r.name AS rule_name, n.name AS channel_name, i.title AS item_title
       FROM radar_alert_logs l
       JOIN radar_alert_rules r ON r.id = l.rule_id
       JOIN radar_notifications n ON n.id = l.channel_id
       JOIN topic_items i ON i.id = l.item_id
       WHERE ${where.join(" AND ")}
       ORDER BY l.sent_at DESC
       LIMIT ?`
    )
    .all(...args) as Array<RadarAlertLog & { rule_name: string; channel_name: string; item_title: string }>;
}

export function clearRadarItems(username: string, options: { sourceId?: number } = {}) {
  ensureDefaultRadarSources(username);
  const db = getStudioDb();

  if (options.sourceId) {
    const source = db
      .prepare("SELECT id FROM topic_sources WHERE id = ? AND created_by = ?")
      .get(options.sourceId, username) as { id: number } | undefined;
    if (!source) throw new Error("source_not_found");
    const result = db.prepare("DELETE FROM topic_items WHERE source_id = ?").run(options.sourceId);
    return { deleted: result.changes };
  }

  const result = db
    .prepare(
      `DELETE FROM topic_items
       WHERE source_id IN (SELECT id FROM topic_sources WHERE created_by = ?)`
    )
    .run(username);
  return { deleted: result.changes };
}

export function listRadarSavedTopics(
  username: string,
  options: { limit?: number; q?: string; kind?: "item" | "analysis" } = {}
) {
  const db = getStudioDb();
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const where: string[] = ["created_by = ?"];
  const args: any[] = [username];

  if (options.q?.trim()) {
    where.push("(title LIKE ? OR summary LIKE ? OR content LIKE ?)");
    const kw = `%${options.q.trim()}%`;
    args.push(kw, kw, kw);
  }
  if (options.kind) {
    where.push("kind = ?");
    args.push(options.kind);
  }
  args.push(limit);

  const rows = db
    .prepare(
      `SELECT id, created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at
       FROM radar_topics
       WHERE ${where.join(" AND ")}
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(...args) as RadarSavedTopic[];

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

export function createRadarSavedTopic(input: {
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
  const db = getStudioDb();
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO radar_topics
       (created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.username,
      input.kind,
      input.title,
      input.summary || "",
      input.content || "",
      input.sourceName || "",
      input.sourceUrl || "",
      input.score ?? 0,
      JSON.stringify((input.tags || []).map((item) => item.trim()).filter(Boolean).slice(0, 20)),
      ts,
      ts
    );

  return { id: Number(result.lastInsertRowid) };
}

export function deleteRadarSavedTopic(topicId: number, username: string) {
  const db = getStudioDb();
  const result = db.prepare("DELETE FROM radar_topics WHERE id = ? AND created_by = ?").run(topicId, username);
  if (result.changes === 0) throw new Error("topic_not_found");
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
      .map((item: any) => {
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
          raw: item,
        };
      })
      .filter((item) => item.title && /^https?:\/\//i.test(item.url));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRadarSourceNow(sourceId: number, username: string) {
  ensureDefaultRadarSources(username);

  const db = getStudioDb();
  const source = db.prepare("SELECT * FROM topic_sources WHERE id = ? AND created_by = ?").get(sourceId, username) as RadarSource | undefined;
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
    db.prepare(
      `UPDATE topic_sources
       SET updated_at = ?,
           last_fetch_status = 'failed',
           last_fetch_error = ?,
           last_fetched_at = ?,
           last_fetch_count = 0
       WHERE id = ?`
    ).run(ts, error instanceof Error ? error.message : "fetch_failed", ts, source.id);
    throw error;
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO topic_items
     (source_id,title,url,summary,published_at,score,raw_json,fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  const insertedItems: InsertedRadarItem[] = [];
  const tx = db.transaction(() => {
    for (const item of items) {
      const score = totalScore(item.publishedAt);
      const r = insert.run(
        source.id,
        item.title,
        item.url,
        item.summary,
        item.publishedAt,
        score,
        JSON.stringify(item.raw),
        ts
      );
      inserted += r.changes;
      if (r.changes > 0) {
        insertedItems.push({
          id: Number(r.lastInsertRowid),
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          url: item.url,
          summary: item.summary,
          published_at: item.publishedAt,
          score,
        });
      }
    }
    db.prepare(
      `UPDATE topic_sources
       SET updated_at = ?,
           last_fetch_status = 'ok',
           last_fetch_error = '',
           last_fetched_at = ?,
           last_fetch_count = ?
       WHERE id = ?`
    ).run(ts, ts, items.length, source.id);
  });
  tx();

  await dispatchAlertsForItems(username, insertedItems);

  return { sourceId: source.id, fetched: items.length, inserted };
}

export async function fetchAllEnabledSources(username: string) {
  ensureDefaultRadarSources(username);

  const db = getStudioDb();
  const sources = db
    .prepare("SELECT id FROM topic_sources WHERE created_by = ? ORDER BY id DESC")
    .all(username) as Array<{ id: number }>;

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
