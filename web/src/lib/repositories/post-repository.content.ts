/**
 * 博客文章内容仓储
 *
 * 负责前台文章展示侧的数据访问，包括详情、列表、互动指标、收藏和用户动态。
 * 与后台管理仓储分离后，这里只保留读多写少、面向公开站点的内容能力。
 */

import { ApiError, ErrorCode } from "@/lib/api-error";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Post, PostDetail, PostListItem } from "@/types";
import type { PaginatedResult } from "./types";
import { normalizePagination } from "./post-repository.shared";
import type {
  CreatePostData,
  LikesToUserItem,
  ListPostsParams,
  PostActivityItem,
  UpdatePostData,
} from "./post-repository.types";

export class PostContentRepository {
  async listKnowledgeSourcePosts(author: string, limit = 200, offset = 0): Promise<Array<{
    id: number;
    slug: string;
    title: string;
    content: string;
    excerpt: string | null;
    tags: string | null;
    status: string;
    category_id: number | null;
    cover_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>> {
    return await pgQuery(
      `SELECT id, slug, title, content, excerpt, tags, status, category_id, cover_image_url, created_at, updated_at
       FROM posts
       WHERE author = ? AND COALESCE(status, 'published') <> 'deleted'
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [author, limit, offset]
    );
  }

  /** 按 slug 查询文章原始记录。 */
  async findBySlug(slug: string): Promise<Post | null> {
    return await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug]);
  }

  /**
   * 获取文章详情
   *
   * 如果传入用户名，会额外补齐“我是否点赞/收藏”的用户态字段。
   */
  async getPostDetail(slug: string, username?: string): Promise<PostDetail | null> {
    const row = await pgQueryOne<PostDetail>(
      `SELECT p.id,p.title,p.slug,p.content,p.excerpt,p.cover_image_url,p.created_at,p.updated_at,p.author,p.tags,p.status,p.category_id,
              COALESCE(p.view_count,0) AS view_count,c.name AS category_name,c.slug AS category_slug,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
              (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
              (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
              (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ?`,
      [slug]
    );
    if (!row) return null;
    if (!username) return { ...row, liked_by_me: false, favorited_by_me: false };
    const liked = await pgQueryOne<{ id: number }>("SELECT id FROM likes WHERE post_id = ? AND username = ?", [row.id, username]);
    const fav = await pgQueryOne<{ id: number }>("SELECT id FROM favorites WHERE post_id = ? AND username = ?", [row.id, username]);
    return { ...row, liked_by_me: !!liked, favorited_by_me: !!fav };
  }

  /** 创建文章并返回新文章 ID。 */
  async create(data: CreatePostData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO posts (title,slug,content,excerpt,cover_image_url,created_at,updated_at,author,tags,status,category_id,view_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING id`,
      [data.title, data.slug, data.content, data.excerpt || null, data.cover_image_url || null, now, now, data.author, data.tags || "", data.status || "published", data.category_id || null]
    );
    return Number(row?.id || 0);
  }

  /** 动态构造更新字段，仅更新调用方显式传入的列。 */
  async updateBySlug(slug: string, data: UpdatePostData): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (data.title !== undefined) { fields.push("title = ?"); params.push(data.title); }
    if (data.content !== undefined) { fields.push("content = ?"); params.push(data.content); }
    if (data.excerpt !== undefined) { fields.push("excerpt = ?"); params.push(data.excerpt); }
    if (data.cover_image_url !== undefined) { fields.push("cover_image_url = ?"); params.push(data.cover_image_url); }
    if (data.tags !== undefined) { fields.push("tags = ?"); params.push(data.tags); }
    if (data.category_id !== undefined) { fields.push("category_id = ?"); params.push(data.category_id); }
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (!fields.length) return false;
    fields.push("updated_at = ?");
    params.push(new Date().toISOString(), slug);
    return (await pgRun(`UPDATE posts SET ${fields.join(", ")} WHERE slug = ?`, params)).changes > 0;
  }

  /** 硬删除文章及其关联互动数据。 */
  async hardDelete(slug: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      const post = await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug], client);
      if (!post) return false;
      await pgRun("DELETE FROM comments WHERE post_id = ?", [post.id], client);
      await pgRun("DELETE FROM likes WHERE post_id = ?", [post.id], client);
      await pgRun("DELETE FROM dislikes WHERE post_id = ?", [post.id], client);
      await pgRun("DELETE FROM favorites WHERE post_id = ?", [post.id], client);
      return (await pgRun("DELETE FROM posts WHERE id = ?", [post.id], client)).changes > 0;
    });
  }

  async incrementViewCount(slug: string): Promise<number> {
    await pgRun("UPDATE posts SET view_count = COALESCE(view_count, 0) + 1 WHERE slug = ?", [slug]);
    return (await pgQueryOne<{ view_count: number }>("SELECT COALESCE(view_count, 0) AS view_count FROM posts WHERE slug = ?", [slug]))?.view_count || 0;
  }

  /**
   * 获取文章列表
   *
   * 支持关键词、作者别名、标签、分类和当前用户收藏态查询。
   */
  async list(params: ListPostsParams): Promise<PaginatedResult<PostListItem>> {
    const { page = 1, size = 10, query, author, authorAliases, tag, category, username } = params;
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const filters: string[] = ["p.status != 'deleted'"];
    const queryParams: unknown[] = [];
    if (query?.trim()) {
      filters.push("p.title LIKE ?");
      queryParams.push(`%${query.trim()}%`);
    }
    const aliases = Array.from(new Set((authorAliases || []).map((item) => item.trim()).filter(Boolean)));
    if (aliases.length) {
      filters.push(`p.author IN (${aliases.map(() => "?").join(", ")})`);
      queryParams.push(...aliases);
    } else if (author) {
      filters.push("p.author = ?");
      queryParams.push(author);
    }
    if (tag) {
      filters.push("p.tags LIKE ?");
      queryParams.push(`%${tag}%`);
    }
    if (category) {
      filters.push("c.slug = ?");
      queryParams.push(category);
    }
    const where = filters.join(" AND ");
    const total = (
      await pgQueryOne<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where}`,
        queryParams
      )
    )?.cnt || 0;
    const items = await pgQuery<PostListItem>(
      `SELECT p.title,p.slug,p.content,p.excerpt,p.cover_image_url,p.created_at,p.author,p.tags,p.category_id,COALESCE(p.view_count,0) AS view_count,
              c.name AS category_name,c.slug AS category_slug,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
              (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
              (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
              (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
              CASE WHEN ? = '' THEN false ELSE EXISTS(SELECT 1 FROM favorites f2 WHERE f2.post_id = p.id AND f2.username = ?) END AS favorited_by_me
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [username || "", username || "", ...queryParams, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }

  /** 聚合用户的发文、点赞和评论行为，供个人动态页展示。 */
  async getActivities(username: string, page = 1, size = 10): Promise<PaginatedResult<PostActivityItem>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const total = (
      await pgQueryOne<{ total: number }>(
        `SELECT COALESCE(SUM(cnt),0)::int AS total FROM (
           SELECT COUNT(*) AS cnt FROM posts WHERE author = ?
           UNION ALL
           SELECT COUNT(*) AS cnt FROM likes WHERE username = ?
           UNION ALL
           SELECT COUNT(*) AS cnt FROM comments WHERE author = ?
         ) t`,
        [username, username, username]
      )
    )?.total || 0;
    const items = await pgQuery<PostActivityItem>(
      `SELECT 'post' AS type,title,slug,created_at,substring(trim(replace(replace(content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,NULL AS target_user FROM posts WHERE author = ?
       UNION ALL
       SELECT 'like' AS type,p.title,p.slug,l.created_at,substring(trim(replace(replace(p.content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,p.author AS target_user
       FROM likes l JOIN posts p ON l.post_id = p.id WHERE l.username = ?
       UNION ALL
       SELECT 'comment' AS type,p.title,p.slug,c.created_at,c.content,p.author AS target_user
       FROM comments c JOIN posts p ON c.post_id = p.id WHERE c.author = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [username, username, username, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }

  async getActivityCount(username: string): Promise<number> {
    return (
      await pgQueryOne<{ total: number }>(
        `SELECT COALESCE(SUM(cnt),0)::int AS total FROM (
           SELECT COUNT(*) AS cnt FROM posts WHERE author = ?
           UNION ALL
           SELECT COUNT(*) AS cnt FROM likes WHERE username = ?
           UNION ALL
           SELECT COUNT(*) AS cnt FROM comments WHERE author = ?
         ) t`,
        [username, username, username]
      )
    )?.total || 0;
  }

  /** 获取别人给当前用户文章点赞的通知流。 */
  async getLikesToUser(username: string, page = 1, size = 10): Promise<LikesToUserItem[]> {
    const { size: validSize, offset } = normalizePagination(page, size);
    return await pgQuery<LikesToUserItem>(
      `SELECT l.username AS sender,l.created_at,p.title AS post_title,p.slug AS post_slug
       FROM likes l JOIN posts p ON l.post_id = p.id
       WHERE p.author = ? AND l.username != ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [username, username, validSize, offset]
    );
  }

  async getNewLikesCount(username: string, since: string): Promise<number> {
    return (
      await pgQueryOne<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM likes l JOIN posts p ON l.post_id = p.id
         WHERE p.author = ? AND l.username != ? AND l.created_at > ?`,
        [username, username, since]
      )
    )?.cnt || 0;
  }

  /**
   * 切换点赞或点踩状态
   *
   * 点赞和点踩走不同表，各自独立切换；调用方负责决定要触发哪一种。
   */
  async toggleLike(slug: string, username: string, value: 1 | -1): Promise<{ liked?: boolean; disliked?: boolean }> {
    return await withPgTransaction(async (client) => {
      const post = await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug], client);
      if (!post) throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      if (value === 1) {
        const exists = await pgQueryOne<{ id: number }>("SELECT id FROM likes WHERE post_id = ? AND username = ?", [post.id, username], client);
        if (exists) {
          await pgRun("DELETE FROM likes WHERE post_id = ? AND username = ?", [post.id, username], client);
          return { liked: false };
        }
        await pgRun("INSERT INTO likes (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
        return { liked: true };
      }
      const exists = await pgQueryOne<{ id: number }>("SELECT id FROM dislikes WHERE post_id = ? AND username = ?", [post.id, username], client);
      if (exists) {
        await pgRun("DELETE FROM dislikes WHERE post_id = ? AND username = ?", [post.id, username], client);
        return { disliked: false };
      }
      await pgRun("INSERT INTO dislikes (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
      return { disliked: true };
    });
  }

  async getUserLikesReceived(username: string): Promise<number> {
    return (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author = ?", [username]))?.cnt || 0;
  }

  /** 切换收藏状态，返回切换后的是否已收藏。 */
  async toggleFavorite(slug: string, username: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      const post = await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug], client);
      if (!post) throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      const exists = await pgQueryOne<{ id: number }>("SELECT id FROM favorites WHERE post_id = ? AND username = ?", [post.id, username], client);
      if (exists) {
        await pgRun("DELETE FROM favorites WHERE post_id = ? AND username = ?", [post.id, username], client);
        return false;
      }
      await pgRun("INSERT INTO favorites (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
      return true;
    });
  }

  /** 查询用户收藏列表。 */
  async listFavorites(username: string, page = 1, size = 10): Promise<PaginatedResult<PostListItem>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM favorites WHERE username = ?", [username]))?.cnt || 0;
    const items = await pgQuery<PostListItem>(
      `SELECT p.title,p.slug,p.content,p.excerpt,p.cover_image_url,p.created_at,p.author,p.tags,p.category_id,COALESCE(p.view_count,0) AS view_count,
              NULL::text AS category_name,NULL::text AS category_slug,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
              (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
              (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
              (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
              true AS favorited_by_me
       FROM favorites fav JOIN posts p ON p.id = fav.post_id
       WHERE fav.username = ? ORDER BY fav.created_at DESC LIMIT ? OFFSET ?`,
      [username, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }

  /** 为 sitemap 生成文章路由数据。 */
  async listSitemapPosts() {
    return await pgQuery("SELECT slug,updated_at,created_at FROM posts WHERE slug IS NOT NULL AND trim(slug) <> '' AND (status IS NULL OR status <> 'deleted') ORDER BY id DESC");
  }
}
