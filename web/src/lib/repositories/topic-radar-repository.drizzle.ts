/**
 * 主题雷达仓储层 (Drizzle ORM 实现)
 *
 * 提供主题雷达相关数据的查询操作，使用 Drizzle ORM 进行数据库访问
 * 仅包含只读查询方法，写操作仍使用原生 SQL 的 topicRadarRepository
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/drizzle";
import {
  radarAlertLogs,
  radarAlertRules,
  radarNotifications,
  radarTopics,
  topicItems,
  topicSources,
} from "@/lib/db/schema";
import type { RadarSourceRecord } from "./topic-radar-repository";

/**
 * Drizzle ORM 主题雷达数据访问类
 *
 * 提供主题雷达相关的只读查询操作
 */
export class DrizzleTopicRadarRepository {
  async listSourceUrlsByUser(username: string): Promise<Array<{ url: string }>> {
    const db = getDb();
    return db
      .select({ url: topicSources.url })
      .from(topicSources)
      .where(eq(topicSources.createdBy, username));
  }

  async listSourcesByUser(username: string): Promise<RadarSourceRecord[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: topicSources.id,
        name: topicSources.name,
        url: topicSources.url,
        type: topicSources.type,
        parser_config_json: topicSources.parserConfigJson,
        enabled: topicSources.enabled,
        last_fetch_status: topicSources.lastFetchStatus,
        last_fetch_error: topicSources.lastFetchError,
        last_fetched_at: topicSources.lastFetchedAt,
        last_fetch_count: topicSources.lastFetchCount,
        created_by: topicSources.createdBy,
        created_at: topicSources.createdAt,
        updated_at: topicSources.updatedAt,
      })
      .from(topicSources)
      .where(eq(topicSources.createdBy, username))
      .orderBy(desc(topicSources.id));

    return rows as RadarSourceRecord[];
  }

  async listItemsByUser(
    username: string,
    options: { limit: number; q?: string; sourceId?: number }
  ): Promise<Array<Record<string, unknown>>> {
    const db = getDb();
    const conditions = [eq(topicSources.createdBy, username)];
    if (options.q?.trim()) {
      conditions.push(
        sql`(${topicItems.title} ILIKE ${`%${options.q.trim()}%`} OR ${topicItems.summary} ILIKE ${`%${options.q.trim()}%`})`
      );
    }
    if (options.sourceId) {
      conditions.push(eq(topicItems.sourceId, options.sourceId));
    }

    return db
      .select({
        id: topicItems.id,
        source_id: topicItems.sourceId,
        title: topicItems.title,
        url: topicItems.url,
        summary: topicItems.summary,
        published_at: topicItems.publishedAt,
        score: topicItems.score,
        raw_json: topicItems.rawJson,
        fetched_at: topicItems.fetchedAt,
        source_name: topicSources.name,
      })
      .from(topicItems)
      .innerJoin(topicSources, eq(topicSources.id, topicItems.sourceId))
      .where(and(...conditions))
      .orderBy(desc(topicItems.score), desc(topicItems.publishedAt))
      .limit(options.limit);
  }

  async listSavedTopicsByUser(
    username: string,
    options: { limit: number; q?: string; kind?: "item" | "analysis" }
  ): Promise<Array<Record<string, unknown>>> {
    const db = getDb();
    const conditions = [eq(radarTopics.createdBy, username)];
    if (options.q?.trim()) {
      const kw = `%${options.q.trim()}%`;
      conditions.push(
        sql`(${radarTopics.title} ILIKE ${kw} OR ${radarTopics.summary} ILIKE ${kw} OR ${radarTopics.content} ILIKE ${kw})`
      );
    }
    if (options.kind) {
      conditions.push(eq(radarTopics.kind, options.kind));
    }

    return db
      .select({
        id: radarTopics.id,
        created_by: radarTopics.createdBy,
        kind: radarTopics.kind,
        title: radarTopics.title,
        summary: radarTopics.summary,
        content: radarTopics.content,
        source_name: radarTopics.sourceName,
        source_url: radarTopics.sourceUrl,
        score: radarTopics.score,
        tags_json: radarTopics.tagsJson,
        created_at: radarTopics.createdAt,
        updated_at: radarTopics.updatedAt,
      })
      .from(radarTopics)
      .where(and(...conditions))
      .orderBy(desc(radarTopics.id))
      .limit(options.limit);
  }

  async listNotificationsByUser(username: string): Promise<Array<Record<string, unknown>>> {
    const db = getDb();
    return db
      .select({
        id: radarNotifications.id,
        created_by: radarNotifications.createdBy,
        type: radarNotifications.type,
        name: radarNotifications.name,
        webhook_url: radarNotifications.webhookUrl,
        secret: radarNotifications.secret,
        enabled: radarNotifications.enabled,
        created_at: radarNotifications.createdAt,
        updated_at: radarNotifications.updatedAt,
      })
      .from(radarNotifications)
      .where(eq(radarNotifications.createdBy, username))
      .orderBy(desc(radarNotifications.id));
  }

  async listAlertRulesByUser(username: string): Promise<Array<Record<string, unknown>>> {
    const db = getDb();
    return db
      .select({
        id: radarAlertRules.id,
        created_by: radarAlertRules.createdBy,
        name: radarAlertRules.name,
        rule_type: radarAlertRules.ruleType,
        keyword: radarAlertRules.keyword,
        source_id: radarAlertRules.sourceId,
        min_score: radarAlertRules.minScore,
        channel_id: radarAlertRules.channelId,
        enabled: radarAlertRules.enabled,
        created_at: radarAlertRules.createdAt,
        updated_at: radarAlertRules.updatedAt,
        channel_name: radarNotifications.name,
      })
      .from(radarAlertRules)
      .innerJoin(radarNotifications, eq(radarNotifications.id, radarAlertRules.channelId))
      .where(eq(radarAlertRules.createdBy, username))
      .orderBy(desc(radarAlertRules.id));
  }

  async listAlertLogsByUser(
    username: string,
    options: { limit: number; status?: "success" | "failed" }
  ): Promise<Array<Record<string, unknown>>> {
    const db = getDb();
    const conditions = [eq(radarAlertLogs.createdBy, username)];
    if (options.status) {
      conditions.push(eq(radarAlertLogs.status, options.status));
    }

    return db
      .select({
        id: radarAlertLogs.id,
        created_by: radarAlertLogs.createdBy,
        item_id: radarAlertLogs.itemId,
        channel_id: radarAlertLogs.channelId,
        rule_id: radarAlertLogs.ruleId,
        status: radarAlertLogs.status,
        response_text: radarAlertLogs.responseText,
        error_text: radarAlertLogs.errorText,
        sent_at: radarAlertLogs.sentAt,
        rule_name: radarAlertRules.name,
        channel_name: radarNotifications.name,
        item_title: topicItems.title,
      })
      .from(radarAlertLogs)
      .innerJoin(radarAlertRules, eq(radarAlertRules.id, radarAlertLogs.ruleId))
      .innerJoin(radarNotifications, eq(radarNotifications.id, radarAlertLogs.channelId))
      .innerJoin(topicItems, eq(topicItems.id, radarAlertLogs.itemId))
      .where(and(...conditions))
      .orderBy(desc(radarAlertLogs.sentAt))
      .limit(options.limit);
  }
}

export const drizzleTopicRadarRepository = new DrizzleTopicRadarRepository();
