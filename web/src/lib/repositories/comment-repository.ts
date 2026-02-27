/**
 */

import type Database from "better-sqlite3";
import { BaseRepository, type QueryOptions } from "./base-repository";
import { getBlogDb } from "@/lib/db";
import type { Comment, CommentListItem, NotificationItem } from "@/types";

/**
 */
export interface CreateCommentData {
  post_id: number;
  author: string;
  content: string;
  parent_id?: number | null;
  ip_address?: string;
}

/**
 */
export interface UpdateCommentData {
  content: string;
}

/**
 */
export class CommentRepository extends BaseRepository<Comment, number> {
  protected readonly tableName = "comments";
  protected readonly primaryKey = "id";

  protected getDb(options?: QueryOptions): Database {
    return options?.db || getBlogDb();
  }


  /**
   */
  findByPostId(postId: number, options?: QueryOptions): CommentListItem[] {
    const db = this.getDb(options);
    
    const sql = `
      SELECT
        c.id,
        c.post_id,
        c.author,
        c.content,
        c.created_at,
        c.parent_id,
        c.ip_address,
        (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
        (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
      FROM comments c
      WHERE c.post_id = ?
      ORDER BY c.id DESC
    `;
    
    return db.prepare(sql).all(postId) as CommentListItem[];
  }

  /**
   */
  findByPostSlug(slug: string, options?: QueryOptions): CommentListItem[] {
    const db = this.getDb(options);
    
    const sql = `
      SELECT
        c.id,
        c.post_id,
        c.author,
        c.content,
        c.created_at,
        c.parent_id,
        c.ip_address,
        (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
        (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.slug = ?
      ORDER BY c.id DESC
    `;
    
    return db.prepare(sql).all(slug) as CommentListItem[];
  }

  /**
   */
  create(data: CreateCommentData, options?: QueryOptions): number {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO comments (post_id, author, content, created_at, parent_id, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.post_id,
      data.author,
      data.content,
      now,
      data.parent_id || null,
      data.ip_address || null,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  updateContent(id: number, content: string, options?: QueryOptions): boolean {
    const sql = `UPDATE comments SET content = ? WHERE id = ?`;
    const result = this.run(sql, [content, id], options);
    return result.changes > 0;
  }

  /**
   */
  delete(id: number, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    return db.transaction(() => {
      db.prepare("DELETE FROM comment_votes WHERE comment_id = ?").run(id);
      const result = db.prepare("DELETE FROM comments WHERE id = ?").run(id);
      return result.changes > 0;
    })();
  }

  /**
   */
  getPostSlugForComment(commentId: number, options?: QueryOptions): string {
    const db = this.getDb(options);
    
    const row = db.prepare(`
      SELECT p.slug 
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE c.id = ?
    `).get(commentId) as { slug: string } | undefined;
    
    return row?.slug || "";
  }


  /**
   */
  vote(commentId: number, username: string, value: 1 | -1, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    const existing = db.prepare("SELECT id FROM comment_votes WHERE comment_id = ? AND username = ?")
      .get(commentId, username) as { id: number } | undefined;
    
    if (existing) {
      db.prepare("UPDATE comment_votes SET value = ?, created_at = ? WHERE id = ?")
        .run(value, new Date().toISOString(), existing.id);
    } else {
      db.prepare("INSERT INTO comment_votes (comment_id, username, value, created_at) VALUES (?, ?, ?, ?)")
        .run(commentId, username, value, new Date().toISOString());
    }
    
    return true;
  }

  /**
   */
  removeVote(commentId: number, username: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM comment_votes WHERE comment_id = ? AND username = ?`;
    const result = this.run(sql, [commentId, username], options);
    return result.changes > 0;
  }

  /**
   */
  getUserVote(commentId: number, username: string, options?: QueryOptions): 1 | -1 | null {
    const sql = `SELECT value FROM comment_votes WHERE comment_id = ? AND username = ?`;
    const result = this.queryOne<{ value: 1 | -1 }>(sql, [commentId, username], options);
    return result?.value || null;
  }

  /**
   */
  getVoteCounts(commentId: number, options?: QueryOptions): { like_count: number; dislike_count: number } {
    const db = this.getDb(options);
    
    const likes = db.prepare("SELECT COUNT(*) AS cnt FROM comment_votes WHERE comment_id = ? AND value = 1")
      .get(commentId) as { cnt: number };
    const dislikes = db.prepare("SELECT COUNT(*) AS cnt FROM comment_votes WHERE comment_id = ? AND value = -1")
      .get(commentId) as { cnt: number };
    
    return {
      like_count: likes?.cnt || 0,
      dislike_count: dislikes?.cnt || 0,
    };
  }


  /**
   */
  getRepliesToUser(username: string, page = 1, size = 10, options?: QueryOptions): NotificationItem[] {
    const { size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);
    
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
    
    return db.prepare(sql).all(username, username, validSize, offset) as NotificationItem[];
  }

  /**
   */
  getMentionsToUser(username: string, page = 1, size = 10, options?: QueryOptions): NotificationItem[] {
    const { size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);
    
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
    
    return db.prepare(sql).all(`%@${username}%`, username, validSize, offset) as NotificationItem[];
  }

  /**
   */
  getNewCommentsCount(username: string, since: string, options?: QueryOptions): number {
    const db = this.getDb(options);
    
    const sql = `
      SELECT COUNT(*) AS cnt 
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.author = ? AND c.author != ? AND c.created_at > ?
    `;
    
    const result = db.prepare(sql).get(username, username, since) as { cnt: number };
    return result?.cnt || 0;
  }

  /**
   */
  getCommentCountByPostId(postId: number, options?: QueryOptions): number {
    return this.count("post_id = ?", [postId], options);
  }

  /**
   */
  getCommentCountByAuthor(author: string, options?: QueryOptions): number {
    return this.count("author = ?", [author], options);
  }

  /**
   */
  getStats(options?: QueryOptions): { total: number; today: number; week: number } {
    const db = this.getDb(options);
    
    const total = (db.prepare("SELECT COUNT(*) AS cnt FROM comments").get() as { cnt: number })?.cnt || 0;
    const today = (db.prepare("SELECT COUNT(*) AS cnt FROM comments WHERE date(created_at) = date('now', 'localtime')").get() as { cnt: number })?.cnt || 0;
    const week = (db.prepare("SELECT COUNT(*) AS cnt FROM comments WHERE created_at >= datetime('now', 'localtime', '-7 days')").get() as { cnt: number })?.cnt || 0;
    
    return { total, today, week };
  }

  deleteByAuthor(author: string, options?: QueryOptions): number {
    const sql = `DELETE FROM comments WHERE author = ?`;
    const result = this.run(sql, [author], options);
    return result.changes;
  }

  deleteVotesByUsername(username: string, options?: QueryOptions): number {
    const sql = `DELETE FROM comment_votes WHERE username = ?`;
    const result = this.run(sql, [username], options);
    return result.changes;
  }
}

export const commentRepository = new CommentRepository();
