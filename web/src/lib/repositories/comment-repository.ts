/**
 * 评论仓储层
 *
 * 负责博客评论的查询、写入、投票和通知相关数据访问。
 * 评论属于高频交互数据，因此这里把列表查询、投票计数和提醒查询都集中在一个仓储里，
 * 便于统一维护 SQL 和事务边界。
 */

import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Comment, CommentListItem } from "@/types";

export interface CreateCommentData {
  post_id: number;
  author: string;
  content: string;
  parent_id?: number | null;
  ip_address?: string;
}

export interface UpdateCommentData {
  content: string;
}

/** 用户收到的回复或提及通知项。 */
export interface NotificationFeedItem {
  sender: string;
  content: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

/**
 * 规范化分页参数
 *
 * @param {number} [page=1] - 页码
 * @param {number} [size=10] - 每页大小
 * @returns {{ size: number; offset: number }} SQL 分页参数
 */
function normalizePagination(page = 1, size = 10): { size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { size: validSize, offset };
}

export class CommentRepository {
  /** 按 ID 查询单条评论。 */
  async findById(id: number): Promise<Comment | null> {
    return await pgQueryOne<Comment>("SELECT * FROM comments WHERE id = ?", [id]);
  }

  /** 按文章 ID 获取评论列表，并附带点赞/点踩计数。 */
  async findByPostId(postId: number): Promise<CommentListItem[]> {
    const sql = `
      SELECT
        c.id,
        c.post_id,
        c.author,
        c.content,
        c.created_at,
        c.parent_id,
        c.ip_address,
        (SELECT COUNT(*)::int FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
        (SELECT COUNT(*)::int FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
      FROM comments c
      WHERE c.post_id = ?
      ORDER BY c.id DESC
    `;
    return await pgQuery<CommentListItem>(sql, [postId]);
  }

  /** 按文章 slug 获取评论列表，供详情页直接消费。 */
  async findByPostSlug(slug: string): Promise<CommentListItem[]> {
    const sql = `
      SELECT
        c.id,
        c.post_id,
        c.author,
        c.content,
        c.created_at,
        c.parent_id,
        c.ip_address,
        (SELECT COUNT(*)::int FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
        (SELECT COUNT(*)::int FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.slug = ?
      ORDER BY c.id DESC
    `;
    return await pgQuery<CommentListItem>(sql, [slug]);
  }

  /** 创建评论并返回新评论 ID。 */
  async create(data: CreateCommentData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(
      `
      INSERT INTO comments (post_id, author, content, created_at, parent_id, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
      `,
      [data.post_id, data.author, data.content, now, data.parent_id || null, data.ip_address || null]
    );
    return Number(row?.id || 0);
  }

  /** 仅更新评论正文内容。 */
  async updateContent(id: number, content: string): Promise<boolean> {
    const result = await pgRun("UPDATE comments SET content = ? WHERE id = ?", [content, id]);
    return result.changes > 0;
  }

  /**
   * 删除评论
   *
   * 先删投票再删评论，避免外键约束中断操作。
   */
  async delete(id: number): Promise<boolean> {
    return await withPgTransaction<boolean>(async (client) => {
      await pgRun("DELETE FROM comment_votes WHERE comment_id = ?", [id], client);
      const result = await pgRun("DELETE FROM comments WHERE id = ?", [id], client);
      return result.changes > 0;
    });
  }

  /** 根据评论 ID 反查所属文章 slug。 */
  async getPostSlugForComment(commentId: number): Promise<string> {
    const row = await pgQueryOne<{ slug: string }>(
      `
      SELECT p.slug
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE c.id = ?
      `,
      [commentId]
    );
    return row?.slug || "";
  }

  /**
   * 记录评论投票
   *
   * 用户已投过票时直接覆盖旧值，实现“切换赞/踩”的幂等体验。
   */
  async vote(commentId: number, username: string, value: 1 | -1): Promise<boolean> {
    const existing = await pgQueryOne<{ id: number }>(
      "SELECT id FROM comment_votes WHERE comment_id = ? AND username = ?",
      [commentId, username]
    );
    if (existing) {
      await pgRun("UPDATE comment_votes SET value = ?, created_at = ? WHERE id = ?", [
        value,
        new Date().toISOString(),
        existing.id,
      ]);
      return true;
    }
    await pgRun("INSERT INTO comment_votes (comment_id, username, value, created_at) VALUES (?, ?, ?, ?)", [
      commentId,
      username,
      value,
      new Date().toISOString(),
    ]);
    return true;
  }

  /** 取消用户对评论的投票。 */
  async removeVote(commentId: number, username: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM comment_votes WHERE comment_id = ? AND username = ?", [commentId, username]);
    return result.changes > 0;
  }

  /** 查询用户当前对评论的投票状态。 */
  async getUserVote(commentId: number, username: string): Promise<1 | -1 | null> {
    const result = await pgQueryOne<{ value: 1 | -1 }>(
      "SELECT value FROM comment_votes WHERE comment_id = ? AND username = ?",
      [commentId, username]
    );
    return result?.value || null;
  }

  /** 汇总评论的点赞和点踩数。 */
  async getVoteCounts(commentId: number): Promise<{ like_count: number; dislike_count: number }> {
    const likes =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM comment_votes WHERE comment_id = ? AND value = 1", [
        commentId,
      ]))?.cnt || 0;
    const dislikes =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM comment_votes WHERE comment_id = ? AND value = -1", [
        commentId,
      ]))?.cnt || 0;
    return { like_count: likes, dislike_count: dislikes };
  }

  /** 获取别人回复当前用户文章产生的通知流。 */
  async getRepliesToUser(username: string, page = 1, size = 10): Promise<NotificationFeedItem[]> {
    const { size: validSize, offset } = normalizePagination(page, size);
    const sql = `
      SELECT
        c.author AS sender,
        c.content,
        c.created_at,
        p.title AS post_title,
        p.slug AS post_slug
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.author = ? AND c.author != ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await pgQuery<NotificationFeedItem>(sql, [username, username, validSize, offset]);
  }

  /** 获取正文里 @ 提及当前用户的通知流。 */
  async getMentionsToUser(username: string, page = 1, size = 10): Promise<NotificationFeedItem[]> {
    const { size: validSize, offset } = normalizePagination(page, size);
    const sql = `
      SELECT
        c.author AS sender,
        c.content,
        c.created_at,
        p.title AS post_title,
        p.slug AS post_slug
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE c.content LIKE ? AND c.author != ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await pgQuery<NotificationFeedItem>(sql, [`%@${username}%`, username, validSize, offset]);
  }

  /** 查询指定时间点之后新增的评论数。 */
  async getNewCommentsCount(username: string, since: string): Promise<number> {
    const row = await pgQueryOne<{ cnt: number }>(
      `
      SELECT COUNT(*)::int AS cnt
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.author = ? AND c.author != ? AND c.created_at > ?
      `,
      [username, username, since]
    );
    return row?.cnt || 0;
  }

  async getCommentCountByPostId(postId: number): Promise<number> {
    const row = await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM comments WHERE post_id = ?", [postId]);
    return row?.cnt || 0;
  }

  async getCommentCountByAuthor(author: string): Promise<number> {
    const row = await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM comments WHERE author = ?", [author]);
    return row?.cnt || 0;
  }

  /** 提供后台概览所需的评论总量、今日量和近七日量。 */
  async getStats(): Promise<{ total: number; today: number; week: number }> {
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM comments"))?.cnt || 0;
    const today =
      (await pgQueryOne<{ cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM comments WHERE created_at::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date"
      ))?.cnt || 0;
    const week =
      (await pgQueryOne<{ cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM comments WHERE created_at >= ((NOW() AT TIME ZONE 'Asia/Shanghai') - interval '7 days')"
      ))?.cnt || 0;
    return { total, today, week };
  }

  async deleteByAuthor(author: string): Promise<number> {
    const result = await pgRun("DELETE FROM comments WHERE author = ?", [author]);
    return result.changes;
  }

  async deleteVotesByUsername(username: string): Promise<number> {
    const result = await pgRun("DELETE FROM comment_votes WHERE username = ?", [username]);
    return result.changes;
  }
}

export const commentRepository = new CommentRepository();
