/**
 */

import type Database from "better-sqlite3";
import { BaseRepository, type QueryOptions, type PaginatedResult } from "./base-repository";
import { getBlogDb } from "@/lib/db";
import { ApiError, ErrorCode } from "@/lib/api-error";
import type { Post, PostListItem, PostDetail, Category, FriendLink, PostStatus } from "@/types";

/**
 */
export interface CreatePostData {
  title: string;
  slug: string;
  content: string;
  author: string;
  tags?: string;
  category_id?: number | null;
  status?: PostStatus;
}

/**
 */
export interface UpdatePostData {
  title?: string;
  content?: string;
  tags?: string;
  category_id?: number | null;
  status?: PostStatus;
}

/**
 */
export interface ListPostsParams {
  page?: number;
  size?: number;
  query?: string;
  author?: string;
  tag?: string;
  category?: string;
  username?: string;
}

/**
 */
export class PostRepository extends BaseRepository<Post, number> {
  protected readonly tableName = "posts";
  protected readonly primaryKey = "id";

  protected getDb(options?: QueryOptions): Database {
    return options?.db || getBlogDb();
  }


  /**
   */
  findBySlug(slug: string, options?: QueryOptions): Post | null {
    return this.findOne("slug = ?", [slug], options);
  }

  /**
   */
  getPostDetail(slug: string, username?: string, options?: QueryOptions): PostDetail | null {
    const db = this.getDb(options);
    
    const sql = `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.content,
        p.created_at,
        p.updated_at,
        p.author,
        p.tags,
        p.status,
        p.category_id,
        COALESCE(p.view_count, 0) AS view_count,
        c.name AS category_name,
        c.slug AS category_slug,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
        (SELECT COUNT(*) FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ?
    `;
    
    const row = db.prepare(sql).get(slug) as PostDetail | undefined;
    if (!row) return null;

    if (username) {
      const liked = db.prepare("SELECT id FROM likes WHERE post_id = ? AND username = ?")
        .get(row.id, username);
      const favorited = db.prepare("SELECT id FROM favorites WHERE post_id = ? AND username = ?")
        .get(row.id, username);
      row.liked_by_me = !!liked;
      row.favorited_by_me = !!favorited;
    } else {
      row.liked_by_me = false;
      row.favorited_by_me = false;
    }

    return row;
  }

  /**
   */
  create(data: CreatePostData, options?: QueryOptions): number {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO posts (title, slug, content, created_at, updated_at, author, tags, status, category_id, view_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;
    const result = this.run(sql, [
      data.title,
      data.slug,
      data.content,
      now,
      now,
      data.author,
      data.tags || "",
      data.status || "published",
      data.category_id || null,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  updateBySlug(slug: string, data: UpdatePostData, options?: QueryOptions): boolean {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      fields.push("title = ?");
      params.push(data.title);
    }
    if (data.content !== undefined) {
      fields.push("content = ?");
      params.push(data.content);
    }
    if (data.tags !== undefined) {
      fields.push("tags = ?");
      params.push(data.tags);
    }
    if (data.category_id !== undefined) {
      fields.push("category_id = ?");
      params.push(data.category_id);
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(slug);

    const sql = `UPDATE posts SET ${fields.join(", ")} WHERE slug = ?`;
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }

  /**
   */
  updateAuthor(slug: string, author: string, options?: QueryOptions): boolean {
    const sql = `UPDATE posts SET author = ?, updated_at = ? WHERE slug = ?`;
    const result = this.run(sql, [author, new Date().toISOString(), slug], options);
    return result.changes > 0;
  }

  /**
   */
  softDelete(slug: string, options?: QueryOptions): boolean {
    const sql = `UPDATE posts SET status = 'deleted', updated_at = ? WHERE slug = ?`;
    const result = this.run(sql, [new Date().toISOString(), slug], options);
    return result.changes > 0;
  }

  /**
   */
  hardDelete(slug: string, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    return db.transaction(() => {
      const post = this.findBySlug(slug, { db });
      if (!post) return false;

      db.prepare("DELETE FROM comments WHERE post_id = ?").run(post.id);
      db.prepare("DELETE FROM likes WHERE post_id = ?").run(post.id);
      db.prepare("DELETE FROM dislikes WHERE post_id = ?").run(post.id);
      db.prepare("DELETE FROM favorites WHERE post_id = ?").run(post.id);
      
      const result = db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
      return result.changes > 0;
    })();
  }

  /**
   */
  incrementViewCount(slug: string, options?: QueryOptions): number {
    const sql = `UPDATE posts SET view_count = COALESCE(view_count, 0) + 1 WHERE slug = ?`;
    this.run(sql, [slug], options);
    
    const selectSql = `SELECT COALESCE(view_count, 0) AS view_count FROM posts WHERE slug = ?`;
    const result = this.queryOne<{ view_count: number }>(selectSql, [slug], options);
    return result?.view_count ?? 0;
  }

  /**
   */
  getPostCountByAuthor(author: string, options?: QueryOptions): number {
    return this.count("author = ? AND status != 'deleted'", [author], options);
  }

  /**
   */
  search(query: string, page = 1, size = 10, options?: QueryOptions): PaginatedResult<PostListItem> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);

    const searchPattern = `%${query}%`;
    const total = this.count("title LIKE ? AND status != 'deleted'", [searchPattern], options);

    const sql = `
      SELECT
        p.title,
        p.slug,
        p.content,
        p.created_at,
        p.author,
        p.tags,
        p.category_id,
        COALESCE(p.view_count, 0) AS view_count,
        c.name AS category_name,
        c.slug AS category_slug,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
        (SELECT COUNT(*) FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
        0 AS favorited_by_me
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.title LIKE ? AND p.status != 'deleted'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(sql).all(searchPattern, validSize, offset) as PostListItem[];
    return { items, total, page: validPage, size: validSize };
  }

  /**
   */
  list(params: ListPostsParams, options?: QueryOptions): PaginatedResult<PostListItem> {
    const { page = 1, size = 10, query, author, tag, category, username } = params;
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);

    const filters: string[] = ["p.status != 'deleted'"];
    const filterParams: unknown[] = [];

    if (query?.trim()) {
      filters.push("p.title LIKE ?");
      filterParams.push(`%${query.trim()}%`);
    }
    if (author) {
      filters.push("p.author = ?");
      filterParams.push(author);
    }
    if (tag) {
      filters.push("p.tags LIKE ?");
      filterParams.push(`%${tag}%`);
    }
    if (category) {
      filters.push("c.slug = ?");
      filterParams.push(category);
    }

    const whereClause = filters.join(" AND ");
    
    const countSql = `SELECT COUNT(*) AS cnt FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereClause}`;
    const totalResult = db.prepare(countSql).get(...filterParams) as { cnt: number };
    const total = totalResult?.cnt || 0;

    const sql = `
      SELECT
        p.title,
        p.slug,
        p.content,
        p.created_at,
        p.author,
        p.tags,
        p.category_id,
        COALESCE(p.view_count, 0) AS view_count,
        c.name AS category_name,
        c.slug AS category_slug,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
        (SELECT COUNT(*) FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
        CASE
          WHEN ? = '' THEN 0
          ELSE EXISTS(SELECT 1 FROM favorites f2 WHERE f2.post_id = p.id AND f2.username = ?)
        END AS favorited_by_me
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(sql).all(username || "", username || "", ...filterParams, validSize, offset) as PostListItem[];

    return { items, total, page: validPage, size: validSize };
  }


  /**
   */
  toggleLike(slug: string, username: string, value: 1 | -1, options?: QueryOptions): { liked?: boolean; disliked?: boolean } {
    const db = this.getDb(options);

    return db.transaction(() => {
      const post = this.findBySlug(slug, { db });
      if (!post) {
        throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      }

      if (value === 1) {
        const exists = db.prepare("SELECT id FROM likes WHERE post_id = ? AND username = ?")
          .get(post.id, username);
        if (exists) {
          db.prepare("DELETE FROM likes WHERE post_id = ? AND username = ?").run(post.id, username);
          return { liked: false };
        }
        db.prepare("INSERT INTO likes (post_id, username, created_at) VALUES (?, ?, ?)")
          .run(post.id, username, new Date().toISOString());
        return { liked: true };
      } else {
        const exists = db.prepare("SELECT id FROM dislikes WHERE post_id = ? AND username = ?")
          .get(post.id, username);
        if (exists) {
          db.prepare("DELETE FROM dislikes WHERE post_id = ? AND username = ?").run(post.id, username);
          return { disliked: false };
        }
        db.prepare("INSERT INTO dislikes (post_id, username, created_at) VALUES (?, ?, ?)")
          .run(post.id, username, new Date().toISOString());
        return { disliked: true };
      }
    })();
  }

  /**
   */
  isLiked(postId: number, username: string, options?: QueryOptions): boolean {
    const sql = `SELECT 1 FROM likes WHERE post_id = ? AND username = ?`;
    const result = this.queryOne<Record<string, unknown>>(sql, [postId, username], options);
    return !!result;
  }

  /**
   */
  getLikeCount(postId: number, options?: QueryOptions): number {
    const sql = `SELECT COUNT(*) AS cnt FROM likes WHERE post_id = ?`;
    const result = this.queryOne<{ cnt: number }>(sql, [postId], options);
    return result?.cnt || 0;
  }

  /**
   */
  getUserLikesReceived(username: string, options?: QueryOptions): number {
    const db = this.getDb(options);
    const sql = `
      SELECT COUNT(*) AS cnt 
      FROM likes l 
      INNER JOIN posts p ON l.post_id = p.id 
      WHERE p.author = ?
    `;
    const result = db.prepare(sql).get(username) as { cnt: number };
    return result?.cnt || 0;
  }


  /**
   */
  toggleFavorite(slug: string, username: string, options?: QueryOptions): boolean {
    const db = this.getDb(options);

    return db.transaction(() => {
      const post = this.findBySlug(slug, { db });
      if (!post) {
        throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      }

      const exists = db.prepare("SELECT id FROM favorites WHERE post_id = ? AND username = ?")
        .get(post.id, username);
      
      if (exists) {
        db.prepare("DELETE FROM favorites WHERE post_id = ? AND username = ?").run(post.id, username);
        return false;
      }
      
      db.prepare("INSERT INTO favorites (post_id, username, created_at) VALUES (?, ?, ?)")
        .run(post.id, username, new Date().toISOString());
      return true;
    })();
  }

  /**
   */
  isFavorited(postId: number, username: string, options?: QueryOptions): boolean {
    const sql = `SELECT 1 FROM favorites WHERE post_id = ? AND username = ?`;
    const result = this.queryOne<Record<string, unknown>>(sql, [postId, username], options);
    return !!result;
  }

  /**
   */
  getFavoriteCount(postId: number, options?: QueryOptions): number {
    const sql = `SELECT COUNT(*) AS cnt FROM favorites WHERE post_id = ?`;
    const result = this.queryOne<{ cnt: number }>(sql, [postId], options);
    return result?.cnt || 0;
  }

  /**
   */
  listFavorites(username: string, page = 1, size = 10, options?: QueryOptions): PaginatedResult<PostListItem> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);

    const total = (db.prepare("SELECT COUNT(*) AS cnt FROM favorites WHERE username = ?")
      .get(username) as { cnt: number })?.cnt || 0;

    const sql = `
      SELECT
        p.title,
        p.slug,
        p.content,
        p.created_at,
        p.author,
        p.tags,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
        (SELECT COUNT(*) FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
        1 AS favorited_by_me
      FROM favorites fav
      JOIN posts p ON p.id = fav.post_id
      WHERE fav.username = ?
      ORDER BY fav.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(sql).all(username, validSize, offset) as PostListItem[];

    return { items, total, page: validPage, size: validSize };
  }


  /**
   */
  listCategories(includeInactive = false, options?: QueryOptions): Category[] {
    const db = this.getDb(options);
    
    const sql = `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.sort_order,
        c.is_active,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status != 'deleted') AS post_count
      FROM categories c
      ${includeInactive ? "" : "WHERE c.is_active = 1"}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    return db.prepare(sql).all() as Category[];
  }

  /**
   */
  getCategoryById(id: number, options?: QueryOptions): Category | null {
    const db = this.getDb(options);
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status != 'deleted') AS post_count
      FROM categories c
      WHERE c.id = ?
    `;
    return db.prepare(sql).get(id) as Category | null;
  }

  /**
   */
  getCategoryBySlug(slug: string, options?: QueryOptions): Category | null {
    const db = this.getDb(options);
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status != 'deleted') AS post_count
      FROM categories c
      WHERE c.slug = ?
    `;
    return db.prepare(sql).get(slug) as Category | null;
  }

  /**
   */
  createCategory(data: { name: string; slug: string; description?: string; sort_order?: number; is_active?: boolean }, options?: QueryOptions): number {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO categories (name, slug, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.name,
      data.slug,
      data.description || "",
      data.sort_order || 0,
      data.is_active !== false ? 1 : 0,
      now,
      now,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  updateCategory(id: number, data: { name?: string; slug?: string; description?: string; sort_order?: number; is_active?: boolean }, options?: QueryOptions): boolean {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push("slug = ?");
      params.push(data.slug);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      params.push(data.description);
    }
    if (data.sort_order !== undefined) {
      fields.push("sort_order = ?");
      params.push(data.sort_order);
    }
    if (data.is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(data.is_active ? 1 : 0);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }

  /**
   */
  deleteCategory(id: number, options?: QueryOptions): boolean {
    this.run("UPDATE posts SET category_id = NULL WHERE category_id = ?", [id], options);
    return this.delete(id, options);
  }


  /**
   */
  listFriendLinks(includeInactive = false, options?: QueryOptions): FriendLink[] {
    const sql = includeInactive
      ? `SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC`
      : `SELECT * FROM friend_links WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`;
    return this.query<FriendLink>(sql, [], options);
  }

  /**
   */
  createFriendLink(data: { name: string; url: string; description?: string; avatar_url?: string; sort_order?: number; is_active?: boolean }, options?: QueryOptions): number {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO friend_links (name, url, description, avatar_url, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.name,
      data.url,
      data.description || "",
      data.avatar_url || "",
      data.sort_order || 0,
      data.is_active !== false ? 1 : 0,
      now,
      now,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  updateFriendLink(id: number, data: Partial<Omit<FriendLink, "id" | "created_at" | "updated_at">>, options?: QueryOptions): boolean {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name);
    }
    if (data.url !== undefined) {
      fields.push("url = ?");
      params.push(data.url);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      params.push(data.description);
    }
    if (data.avatar_url !== undefined) {
      fields.push("avatar_url = ?");
      params.push(data.avatar_url);
    }
    if (data.sort_order !== undefined) {
      fields.push("sort_order = ?");
      params.push(data.sort_order);
    }
    if (data.is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(data.is_active);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE friend_links SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }

  /**
   */
  deleteFriendLink(id: number, options?: QueryOptions): boolean {
    const sql = `DELETE FROM friend_links WHERE id = ?`;
    const result = this.run(sql, [id], options);
    return result.changes > 0;
  }
}

export const postRepository = new PostRepository();
