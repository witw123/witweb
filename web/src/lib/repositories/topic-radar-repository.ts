/**
 * 主题雷达仓储层 (PostgreSQL 原生实现)
 *
 * 负责主题雷达功能的数据持久化，包括：
 * - 数据源管理（RSS、HTML、API）
 * - 主题项存储与查询
 * - 告警通知渠道配置
 * - 告警规则管理
 * - 告警日志记录
 */

import "server-only";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";

/** 雷达数据源记录 */
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

/** 已入库的雷达主题项 */
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

/** 待抓取的候选主题项 */
type FetchCandidate = {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  score: number;
  rawJson: string;
};

/**
 * 主题雷达数据访问类
 *
 * 提供数据源、主题项、通知渠道、告警规则的完整 CRUD 操作
 */
class TopicRadarRepository {
  async listSourceUrlsByUser(username: string): Promise<Array<{ url: string }>> {
    return await pgQuery<{ url: string }>("SELECT url FROM topic_sources WHERE created_by = ?", [username]);
  }

  async insertSource(input: {
    name: string;
    url: string;
    type: "rss" | "html" | "api";
    parserConfigJson: string;
    enabled: number;
    username: string;
    ts: string;
  }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO topic_sources (name,url,type,parser_config_json,enabled,created_by,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.name, input.url, input.type, input.parserConfigJson, input.enabled, input.username, input.ts, input.ts]
    );
    return Number(row?.id || 0);
  }

  async listSourcesByUser(username: string): Promise<RadarSourceRecord[]> {
    return await pgQuery<RadarSourceRecord>(
      `SELECT id,name,url,type,parser_config_json,enabled,created_by,created_at,updated_at,
              last_fetch_status,last_fetch_error,last_fetched_at,last_fetch_count
       FROM topic_sources
       WHERE created_by = ?
       ORDER BY id DESC`,
      [username]
    );
  }

  async sourceExistsByIdAndUser(sourceId: number, username: string): Promise<boolean> {
    const row = await pgQueryOne<{ id: number }>("SELECT id FROM topic_sources WHERE id = ? AND created_by = ?", [sourceId, username]);
    return !!row;
  }

  async updateSource(sourceId: number, username: string, patch: {
    name?: string;
    url?: string;
    type?: "rss" | "html" | "api";
    parserConfigJson?: string;
    enabled?: boolean;
    ts: string;
  }): Promise<void> {
    await pgRun(
      `UPDATE topic_sources
       SET name = COALESCE(?, name),
           url = COALESCE(?, url),
           type = COALESCE(?, type),
           parser_config_json = COALESCE(?, parser_config_json),
           enabled = COALESCE(?, enabled),
           updated_at = ?
       WHERE id = ? AND created_by = ?`,
      [
        patch.name ?? null,
        patch.url ?? null,
        patch.type ?? null,
        patch.parserConfigJson ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        sourceId,
        username,
      ]
    );
  }

  async deleteSourceWithItems(sourceId: number, username: string): Promise<boolean> {
    return await withPgTransaction<boolean>(async (client) => {
      await pgRun("DELETE FROM topic_items WHERE source_id = ?", [sourceId], client);
      const result = await pgRun("DELETE FROM topic_sources WHERE id = ? AND created_by = ?", [sourceId, username], client);
      return result.changes > 0;
    });
  }

  async listItemsByUser(username: string, options: { limit: number; q?: string; sourceId?: number }): Promise<Array<Record<string, unknown>>> {
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

    return await pgQuery(
      `SELECT i.id, i.source_id, i.title, i.url, i.summary, i.published_at, i.score, i.raw_json, i.fetched_at,
              s.name AS source_name
       FROM topic_items i
       JOIN topic_sources s ON s.id = i.source_id
       WHERE ${where.join(" AND ")}
       ORDER BY i.score DESC, i.published_at DESC
       LIMIT ?`,
      args
    );
  }

  async listNotificationsByUser(username: string): Promise<Array<Record<string, unknown>>> {
    return await pgQuery(
      `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
       FROM radar_notifications
       WHERE created_by = ?
       ORDER BY id DESC`,
      [username]
    );
  }

  async createNotification(input: {
    username: string;
    name: string;
    webhookUrl: string;
    secret: string;
    enabled: number;
    ts: string;
  }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO radar_notifications
       (created_by,type,name,webhook_url,secret,enabled,created_at,updated_at)
       VALUES (?, 'webhook', ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.username, input.name, input.webhookUrl, input.secret, input.enabled, input.ts, input.ts]
    );
    return Number(row?.id || 0);
  }

  async notificationExistsByIdAndUser(notificationId: number, username: string): Promise<boolean> {
    const row = await pgQueryOne<{ id: number }>("SELECT id FROM radar_notifications WHERE id = ? AND created_by = ?", [notificationId, username]);
    return !!row;
  }

  async updateNotification(notificationId: number, username: string, patch: {
    name?: string;
    webhookUrl?: string;
    secret?: string;
    enabled?: boolean;
    ts: string;
  }): Promise<void> {
    await pgRun(
      `UPDATE radar_notifications
       SET name = COALESCE(?, name),
           webhook_url = COALESCE(?, webhook_url),
           secret = COALESCE(?, secret),
           enabled = COALESCE(?, enabled),
           updated_at = ?
       WHERE id = ? AND created_by = ?`,
      [
        patch.name ?? null,
        patch.webhookUrl ?? null,
        patch.secret ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        notificationId,
        username,
      ]
    );
  }

  async deleteNotificationWithRules(notificationId: number, username: string): Promise<boolean> {
    return await withPgTransaction<boolean>(async (client) => {
      await pgRun("DELETE FROM radar_alert_rules WHERE channel_id = ? AND created_by = ?", [notificationId, username], client);
      const result = await pgRun("DELETE FROM radar_notifications WHERE id = ? AND created_by = ?", [notificationId, username], client);
      return result.changes > 0;
    });
  }

  async listAlertRulesByUser(username: string): Promise<Array<Record<string, unknown>>> {
    return await pgQuery(
      `SELECT r.id, r.created_by, r.name, r.rule_type, r.keyword, r.source_id, r.min_score, r.channel_id, r.enabled, r.created_at, r.updated_at,
              n.name AS channel_name
       FROM radar_alert_rules r
       JOIN radar_notifications n ON n.id = r.channel_id
       WHERE r.created_by = ?
       ORDER BY r.id DESC`,
      [username]
    );
  }

  async createAlertRule(input: {
    username: string;
    name: string;
    ruleType: "new_item" | "keyword" | "source" | "min_score";
    keyword: string;
    sourceId: number | null;
    minScore: number;
    channelId: number;
    enabled: number;
    ts: string;
  }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO radar_alert_rules
       (created_by,name,rule_type,keyword,source_id,min_score,channel_id,enabled,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.username, input.name, input.ruleType, input.keyword, input.sourceId, input.minScore, input.channelId, input.enabled, input.ts, input.ts]
    );
    return Number(row?.id || 0);
  }

  async alertRuleExistsByIdAndUser(ruleId: number, username: string): Promise<boolean> {
    const row = await pgQueryOne<{ id: number }>("SELECT id FROM radar_alert_rules WHERE id = ? AND created_by = ?", [ruleId, username]);
    return !!row;
  }

  async updateAlertRule(ruleId: number, username: string, patch: {
    name?: string;
    ruleType?: "new_item" | "keyword" | "source" | "min_score";
    keyword?: string;
    sourceId?: number | null;
    minScore?: number;
    channelId?: number;
    enabled?: boolean;
    ts: string;
  }): Promise<void> {
    await pgRun(
      `UPDATE radar_alert_rules
       SET name = COALESCE(?, name),
           rule_type = COALESCE(?, rule_type),
           keyword = COALESCE(?, keyword),
           source_id = COALESCE(?, source_id),
           min_score = COALESCE(?, min_score),
           channel_id = COALESCE(?, channel_id),
           enabled = COALESCE(?, enabled),
           updated_at = ?
       WHERE id = ? AND created_by = ?`,
      [
        patch.name ?? null,
        patch.ruleType ?? null,
        patch.keyword ?? null,
        patch.sourceId === undefined ? null : patch.sourceId,
        patch.minScore ?? null,
        patch.channelId ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.ts,
        ruleId,
        username,
      ]
    );
  }

  async deleteAlertRule(ruleId: number, username: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM radar_alert_rules WHERE id = ? AND created_by = ?", [ruleId, username]);
    return result.changes > 0;
  }

  async listAlertLogsByUser(username: string, options: { limit: number; status?: "success" | "failed" }): Promise<Array<Record<string, unknown>>> {
    const where: string[] = ["l.created_by = ?"];
    const args: unknown[] = [username];

    if (options.status) {
      where.push("l.status = ?");
      args.push(options.status);
    }

    args.push(options.limit);

    return await pgQuery(
      `SELECT l.id, l.created_by, l.item_id, l.channel_id, l.rule_id, l.status, l.response_text, l.error_text, l.sent_at,
              r.name AS rule_name, n.name AS channel_name, i.title AS item_title
       FROM radar_alert_logs l
       JOIN radar_alert_rules r ON r.id = l.rule_id
       JOIN radar_notifications n ON n.id = l.channel_id
       JOIN topic_items i ON i.id = l.item_id
       WHERE ${where.join(" AND ")}
       ORDER BY l.sent_at DESC
       LIMIT ?`,
      args
    );
  }

  async clearItemsBySource(sourceId: number): Promise<number> {
    return (await pgRun("DELETE FROM topic_items WHERE source_id = ?", [sourceId])).changes;
  }

  async clearItemsByUser(username: string): Promise<number> {
    return (
      await pgRun("DELETE FROM topic_items WHERE source_id IN (SELECT id FROM topic_sources WHERE created_by = ?)", [username])
    ).changes;
  }

  async listSavedTopicsByUser(username: string, options: { limit: number; q?: string; kind?: "item" | "analysis" }): Promise<Array<Record<string, unknown>>> {
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

    return await pgQuery(
      `SELECT id, created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at
       FROM radar_topics
       WHERE ${where.join(" AND ")}
       ORDER BY id DESC
       LIMIT ?`,
      args
    );
  }

  async createSavedTopic(input: {
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
  }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO radar_topics
       (created_by, kind, title, summary, content, source_name, source_url, score, tags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.username, input.kind, input.title, input.summary, input.content, input.sourceName, input.sourceUrl, input.score, input.tagsJson, input.ts, input.ts]
    );
    return Number(row?.id || 0);
  }

  async deleteSavedTopic(topicId: number, username: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM radar_topics WHERE id = ? AND created_by = ?", [topicId, username]);
    return result.changes > 0;
  }

  async listEnabledNotificationsByUser(username: string): Promise<Array<Record<string, unknown>>> {
    return await pgQuery(
      `SELECT id, created_by, type, name, webhook_url, secret, enabled, created_at, updated_at
       FROM radar_notifications
       WHERE created_by = ? AND enabled = 1
       ORDER BY id DESC`,
      [username]
    );
  }

  async listEnabledAlertRulesByUser(username: string): Promise<Array<Record<string, unknown>>> {
    return await pgQuery(
      `SELECT id, created_by, name, rule_type, keyword, source_id, min_score, channel_id, enabled, created_at, updated_at
       FROM radar_alert_rules
       WHERE created_by = ? AND enabled = 1
       ORDER BY id DESC`,
      [username]
    );
  }

  async hasAlertLog(itemId: number, channelId: number, ruleId: number): Promise<boolean> {
    const row = await pgQueryOne<{ id: number }>(
      "SELECT id FROM radar_alert_logs WHERE item_id = ? AND channel_id = ? AND rule_id = ? LIMIT 1",
      [itemId, channelId, ruleId]
    );
    return !!row;
  }

  async insertAlertLog(input: {
    username: string;
    itemId: number;
    channelId: number;
    ruleId: number;
    status: "success" | "failed";
    responseText: string;
    errorText: string;
    sentAt: string;
  }): Promise<void> {
    await pgRun(
      `INSERT INTO radar_alert_logs
       (created_by,item_id,channel_id,rule_id,status,response_text,error_text,sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.username, input.itemId, input.channelId, input.ruleId, input.status, input.responseText, input.errorText, input.sentAt]
    );
  }

  async getSourceByIdAndUser(sourceId: number, username: string): Promise<RadarSourceRecord | null> {
    return await pgQueryOne<RadarSourceRecord>("SELECT * FROM topic_sources WHERE id = ? AND created_by = ?", [sourceId, username]);
  }

  async markSourceFetchFailed(sourceId: number, ts: string, errorMessage: string): Promise<void> {
    await pgRun(
      `UPDATE topic_sources
       SET updated_at = ?,
           last_fetch_status = 'failed',
           last_fetch_error = ?,
           last_fetched_at = ?,
           last_fetch_count = 0
       WHERE id = ?`,
      [ts, errorMessage, ts, sourceId]
    );
  }

  async saveFetchedItemsAndMarkSourceSuccess(
    source: { id: number; name: string },
    items: FetchCandidate[],
    ts: string
  ): Promise<{ inserted: number; insertedItems: InsertedRadarItemRecord[] }> {
    return await withPgTransaction(async (client) => {
      let inserted = 0;
      const insertedItems: InsertedRadarItemRecord[] = [];

      for (const item of items) {
        const row = await pgQueryOne<{ id: number }>(
          `INSERT INTO topic_items
           (source_id,title,url,summary,published_at,score,raw_json,fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (source_id, url) DO NOTHING
           RETURNING id`,
          [source.id, item.title, item.url, item.summary, item.publishedAt, item.score, item.rawJson, ts],
          client
        );

        if (row?.id) {
          inserted += 1;
          insertedItems.push({
            id: row.id,
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

      await pgRun(
        `UPDATE topic_sources
         SET updated_at = ?,
             last_fetch_status = 'ok',
             last_fetch_error = '',
             last_fetched_at = ?,
             last_fetch_count = ?
         WHERE id = ?`,
        [ts, ts, items.length, source.id],
        client
      );

      return { inserted, insertedItems };
    });
  }

  async listSourceIdsByUser(username: string): Promise<Array<{ id: number }>> {
    return await pgQuery<{ id: number }>("SELECT id FROM topic_sources WHERE created_by = ? ORDER BY id DESC", [username]);
  }
}

export const topicRadarRepository = new TopicRadarRepository();
