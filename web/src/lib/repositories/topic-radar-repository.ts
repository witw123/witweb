import "server-only";
import { getStudioDb } from "@/lib/db";

export type RadarSourceRecord = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "html" | "api";
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

export type InsertedRadarItemRecord = {
  id: number;
  source_id: number;
  source_name: string;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  score: number;
};

type FetchCandidate = {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  score: number;
  rawJson: string;
};

class TopicRadarRepository {
  private db() {
    return getStudioDb();
  }

  listSourceUrlsByUser(username: string): Array<{ url: string }> {
    return this.db().prepare("SELECT url FROM topic_sources WHERE created_by = ?").all(username) as Array<{ url: string }>;
  }

  insertSource(input: {
    name: string;
    url: string;
    type: "rss" | "html" | "api";
    parserConfigJson: string;
    enabled: number;
    username: string;
    ts: string;
  }): number {
    const result = this.db()
      .prepare(
        `INSERT INTO topic_sources (name,url,type,parser_config_json,enabled,created_by,created_at,updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.url,
        input.type,
        input.parserConfigJson,
        input.enabled,
        input.username,
        input.ts,
        input.ts
      );
    return Number(result.lastInsertRowid);
  }

  listSourcesByUser(username: string): RadarSourceRecord[] {
    return this.db()
      .prepare(
        `SELECT id,name,url,type,parser_config_json,enabled,created_by,created_at,updated_at,
                last_fetch_status,last_fetch_error,last_fetched_at,last_fetch_count
         FROM topic_sources
         WHERE created_by = ?
         ORDER BY id DESC`
      )
      .all(username) as RadarSourceRecord[];
  }

  sourceExistsByIdAndUser(sourceId: number, username: string): boolean {
    const row = this.db().prepare("SELECT id FROM topic_sources WHERE id = ? AND created_by = ?").get(sourceId, username) as
      | { id: number }
      | undefined;
    return !!row;
  }

  updateSource(sourceId: number, username: string, patch: {
    name?: string;
    url?: string;
    type?: "rss" | "html" | "api";
    parserConfigJson?: string;
    enabled?: boolean;
    ts: string;
  }): void {
    this.db()
      .prepare(
        `UPDATE topic_sources
         SET name = COALESCE(?, name),
             url = COALESCE(?, url),
             type = COALESCE(?, type),
             parser_config_json = COALESCE(?, parser_config_json),
             enabled = COALESCE(?, enabled),
             updated_at = ?
         WHERE id = ? AND created_by = ?`
      )
      .run(
        patch.name ?? null,
        patch.url ?? null,
        patch.type ?? null,
        patch.parserConfigJson ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        sourceId,
        username
      );
  }

  deleteSourceWithItems(sourceId: number, username: string): boolean {
    const db = this.db();
    const result = db.transaction(() => {
      db.prepare("DELETE FROM topic_items WHERE source_id = ?").run(sourceId);
      return db.prepare("DELETE FROM topic_sources WHERE id = ? AND created_by = ?").run(sourceId, username);
    })();
    return result.changes > 0;
  }

  listItemsByUser(username: string, options: { limit: number; q?: string; sourceId?: number }) {
    const where: string[] = ["s.created_by = ?"];
    const args: unknown[] = [username];

    if (options.q?.trim()) {
      where.push("(i.title LIKE ? OR i.summary LIKE ?)");
      args.push(`%${options.q.trim()}%`, `%${options.q.trim()}%`);
    }
    if (options.sourceId) {
      where.push("i.source_id = ?");
      args.push(options.sourceId);
    }

    args.push(options.limit);

    return this.db()
      .prepare(
        `SELECT i.id, i.source_id, i.title, i.url, i.summary, i.published_at, i.score, i.raw_json, i.fetched_at,
                s.name AS source_name
         FROM topic_items i
         JOIN topic_sources s ON s.id = i.source_id
         WHERE ${where.join(" AND ")}
         ORDER BY i.score DESC, i.published_at DESC
         LIMIT ?`
      )
      .all(...args);
  }

  listNotificationsByUser(username: string) {
    return this.db()
      .prepare(
        `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
         FROM radar_notifications
         WHERE created_by = ?
         ORDER BY id DESC`
      )
      .all(username);
  }

  createNotification(input: {
    username: string;
    name: string;
    webhookUrl: string;
    secret: string;
    enabled: number;
    ts: string;
  }): number {
    const result = this.db()
      .prepare(
        `INSERT INTO radar_notifications
         (created_by,type,name,webhook_url,secret,enabled,created_at,updated_at)
         VALUES (?, 'webhook', ?, ?, ?, ?, ?, ?)`
      )
      .run(input.username, input.name, input.webhookUrl, input.secret, input.enabled, input.ts, input.ts);
    return Number(result.lastInsertRowid);
  }

  notificationExistsByIdAndUser(notificationId: number, username: string): boolean {
    const row = this.db()
      .prepare("SELECT id FROM radar_notifications WHERE id = ? AND created_by = ?")
      .get(notificationId, username) as { id: number } | undefined;
    return !!row;
  }

  updateNotification(notificationId: number, username: string, patch: {
    name?: string;
    webhookUrl?: string;
    secret?: string;
    enabled?: boolean;
    ts: string;
  }): void {
    this.db()
      .prepare(
        `UPDATE radar_notifications
         SET name = COALESCE(?, name),
             webhook_url = COALESCE(?, webhook_url),
             secret = COALESCE(?, secret),
             enabled = COALESCE(?, enabled),
             updated_at = ?
         WHERE id = ? AND created_by = ?`
      )
      .run(
        patch.name ?? null,
        patch.webhookUrl ?? null,
        patch.secret ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        notificationId,
        username
      );
  }

  deleteNotificationWithRules(notificationId: number, username: string): boolean {
    const db = this.db();
    const result = db.transaction(() => {
      db.prepare("DELETE FROM radar_alert_rules WHERE channel_id = ? AND created_by = ?").run(notificationId, username);
      return db.prepare("DELETE FROM radar_notifications WHERE id = ? AND created_by = ?").run(notificationId, username);
    })();
    return result.changes > 0;
  }

  listAlertRulesByUser(username: string) {
    return this.db()
      .prepare(
        `SELECT r.id, r.created_by, r.name, r.rule_type, r.keyword, r.source_id, r.min_score, r.channel_id, r.enabled, r.created_at, r.updated_at,
                n.name AS channel_name
         FROM radar_alert_rules r
         JOIN radar_notifications n ON n.id = r.channel_id
         WHERE r.created_by = ?
         ORDER BY r.id DESC`
      )
      .all(username);
  }

  createAlertRule(input: {
    username: string;
    name: string;
    ruleType: "new_item" | "keyword" | "source" | "min_score";
    keyword: string;
    sourceId: number | null;
    minScore: number;
    channelId: number;
    enabled: number;
    ts: string;
  }): number {
    const result = this.db()
      .prepare(
        `INSERT INTO radar_alert_rules
         (created_by,name,rule_type,keyword,source_id,min_score,channel_id,enabled,created_at,updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.username,
        input.name,
        input.ruleType,
        input.keyword,
        input.sourceId,
        input.minScore,
        input.channelId,
        input.enabled,
        input.ts,
        input.ts
      );
    return Number(result.lastInsertRowid);
  }

  alertRuleExistsByIdAndUser(ruleId: number, username: string): boolean {
    const row = this.db().prepare("SELECT id FROM radar_alert_rules WHERE id = ? AND created_by = ?").get(ruleId, username) as
      | { id: number }
      | undefined;
    return !!row;
  }

  updateAlertRule(ruleId: number, username: string, patch: {
    name?: string;
    ruleType?: "new_item" | "keyword" | "source" | "min_score";
    keyword?: string;
    sourceId?: number | null;
    minScore?: number;
    channelId?: number;
    enabled?: boolean;
    ts: string;
  }): void {
    this.db()
      .prepare(
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
      )
      .run(
        patch.name ?? null,
        patch.ruleType ?? null,
        patch.keyword ?? null,
        patch.sourceId === undefined ? null : patch.sourceId,
        patch.minScore ?? null,
        patch.channelId ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        ruleId,
        username
      );
  }

  deleteAlertRule(ruleId: number, username: string): boolean {
    const result = this.db().prepare("DELETE FROM radar_alert_rules WHERE id = ? AND created_by = ?").run(ruleId, username);
    return result.changes > 0;
  }

  listAlertLogsByUser(username: string, options: { limit: number; status?: "success" | "failed" }) {
    const where: string[] = ["l.created_by = ?"];
    const args: unknown[] = [username];

    if (options.status) {
      where.push("l.status = ?");
      args.push(options.status);
    }

    args.push(options.limit);

    return this.db()
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
      .all(...args);
  }

  clearItemsBySource(sourceId: number): number {
    return this.db().prepare("DELETE FROM topic_items WHERE source_id = ?").run(sourceId).changes;
  }

  clearItemsByUser(username: string): number {
    return this.db()
      .prepare(`DELETE FROM topic_items WHERE source_id IN (SELECT id FROM topic_sources WHERE created_by = ?)`)
      .run(username).changes;
  }

  listSavedTopicsByUser(username: string, options: { limit: number; q?: string; kind?: "item" | "analysis" }) {
    const where: string[] = ["created_by = ?"];
    const args: unknown[] = [username];

    if (options.q?.trim()) {
      where.push("(title LIKE ? OR summary LIKE ? OR content LIKE ?)");
      const kw = `%${options.q.trim()}%`;
      args.push(kw, kw, kw);
    }
    if (options.kind) {
      where.push("kind = ?");
      args.push(options.kind);
    }
    args.push(options.limit);

    return this.db()
      .prepare(
        `SELECT id, created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at
         FROM radar_topics
         WHERE ${where.join(" AND ")}
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(...args);
  }

  createSavedTopic(input: {
    username: string;
    kind: "item" | "analysis";
    title: string;
    summary: string;
    content: string;
    sourceName: string;
    sourceUrl: string;
    score: number;
    tagsJson: string;
    ts: string;
  }): number {
    const result = this.db()
      .prepare(
        `INSERT INTO radar_topics
         (created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.username,
        input.kind,
        input.title,
        input.summary,
        input.content,
        input.sourceName,
        input.sourceUrl,
        input.score,
        input.tagsJson,
        input.ts,
        input.ts
      );
    return Number(result.lastInsertRowid);
  }

  deleteSavedTopic(topicId: number, username: string): boolean {
    const result = this.db().prepare("DELETE FROM radar_topics WHERE id = ? AND created_by = ?").run(topicId, username);
    return result.changes > 0;
  }

  listEnabledNotificationsByUser(username: string) {
    return this.db()
      .prepare(
        `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
         FROM radar_notifications
         WHERE created_by = ? AND enabled = 1
         ORDER BY id DESC`
      )
      .all(username);
  }

  listEnabledAlertRulesByUser(username: string) {
    return this.db()
      .prepare(
        `SELECT id, created_by, name, rule_type, keyword, source_id, min_score, channel_id, enabled, created_at, updated_at
         FROM radar_alert_rules
         WHERE created_by = ? AND enabled = 1
         ORDER BY id DESC`
      )
      .all(username);
  }

  hasAlertLog(itemId: number, channelId: number, ruleId: number): boolean {
    const row = this.db()
      .prepare("SELECT id FROM radar_alert_logs WHERE item_id = ? AND channel_id = ? AND rule_id = ? LIMIT 1")
      .get(itemId, channelId, ruleId) as { id: number } | undefined;
    return !!row;
  }

  insertAlertLog(input: {
    username: string;
    itemId: number;
    channelId: number;
    ruleId: number;
    status: "success" | "failed";
    responseText: string;
    errorText: string;
    sentAt: string;
  }): void {
    this.db()
      .prepare(
        `INSERT INTO radar_alert_logs
         (created_by,item_id,channel_id,rule_id,status,response_text,error_text,sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.username,
        input.itemId,
        input.channelId,
        input.ruleId,
        input.status,
        input.responseText,
        input.errorText,
        input.sentAt
      );
  }

  getSourceByIdAndUser(sourceId: number, username: string): RadarSourceRecord | null {
    return (
      this.db().prepare("SELECT * FROM topic_sources WHERE id = ? AND created_by = ?").get(sourceId, username) as
        | RadarSourceRecord
        | undefined
    ) || null;
  }

  markSourceFetchFailed(sourceId: number, ts: string, errorMessage: string): void {
    this.db()
      .prepare(
        `UPDATE topic_sources
         SET updated_at = ?,
             last_fetch_status = 'failed',
             last_fetch_error = ?,
             last_fetched_at = ?,
             last_fetch_count = 0
         WHERE id = ?`
      )
      .run(ts, errorMessage, ts, sourceId);
  }

  saveFetchedItemsAndMarkSourceSuccess(
    source: { id: number; name: string },
    items: FetchCandidate[],
    ts: string
  ): { inserted: number; insertedItems: InsertedRadarItemRecord[] } {
    const db = this.db();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO topic_items
       (source_id,title,url,summary,published_at,score,raw_json,fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let inserted = 0;
    const insertedItems: InsertedRadarItemRecord[] = [];

    db.transaction(() => {
      for (const item of items) {
        const result = insert.run(
          source.id,
          item.title,
          item.url,
          item.summary,
          item.publishedAt,
          item.score,
          item.rawJson,
          ts
        );

        inserted += result.changes;
        if (result.changes > 0) {
          insertedItems.push({
            id: Number(result.lastInsertRowid),
            source_id: source.id,
            source_name: source.name,
            title: item.title,
            url: item.url,
            summary: item.summary,
            published_at: item.publishedAt,
            score: item.score,
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
    })();

    return { inserted, insertedItems };
  }

  listSourceIdsByUser(username: string): Array<{ id: number }> {
    return this.db().prepare("SELECT id FROM topic_sources WHERE created_by = ? ORDER BY id DESC").all(username) as Array<{ id: number }>;
  }
}

export const topicRadarRepository = new TopicRadarRepository();
