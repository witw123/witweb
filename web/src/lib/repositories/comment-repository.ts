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

export interface NotificationFeedItem {
  sender: string;
  content: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

function normalizePagination(page = 1, size = 10): { size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { size: validSize, offset };
}

export class CommentRepository {
  async findById(id: number): Promise<Comment | null> {
    return await pgQueryOne<Comment>("SELECT * FROM comments WHERE id = ?", [id]);
  }

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

  async updateContent(id: number, content: string): Promise<boolean> {
    const result = await pgRun("UPDATE comments SET content = ? WHERE id = ?", [content, id]);
    return result.changes > 0;
  }

  async delete(id: number): Promise<boolean> {
    return await withPgTransaction<boolean>(async (client) => {
      await pgRun("DELETE FROM comment_votes WHERE comment_id = ?", [id], client);
      const result = await pgRun("DELETE FROM comments WHERE id = ?", [id], client);
      return result.changes > 0;
    });
  }

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

  async removeVote(commentId: number, username: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM comment_votes WHERE comment_id = ? AND username = ?", [commentId, username]);
    return result.changes > 0;
  }

  async getUserVote(commentId: number, username: string): Promise<1 | -1 | null> {
    const result = await pgQueryOne<{ value: 1 | -1 }>(
      "SELECT value FROM comment_votes WHERE comment_id = ? AND username = ?",
      [commentId, username]
    );
    return result?.value || null;
  }

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
