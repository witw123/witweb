import { ApiError, ErrorCode } from "@/lib/api-error";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Category, FriendLink, Post, PostDetail, PostListItem, PostStatus } from "@/types";
import type { PaginatedResult } from "./types";

export interface CreatePostData { title: string; slug: string; content: string; author: string; tags?: string; category_id?: number | null; status?: PostStatus; }
export interface UpdatePostData { title?: string; content?: string; tags?: string; category_id?: number | null; status?: PostStatus; }
export interface ListPostsParams { page?: number; size?: number; query?: string; author?: string; authorAliases?: string[]; tag?: string; category?: string; username?: string; }
export interface AdminListBlogsParams { page?: number; size?: number; search?: string; status?: string; username?: string; sort?: string; }
export interface AdminBlogListItem { id: number; username: string; title: string; status: string; category_id: number | null; category_name: string | null; category_slug: string | null; created_at: string; updated_at: string; }
export interface AdminBlogDetail extends AdminBlogListItem { content: string; tags: string | null; }
export interface SitemapPostItem { slug: string; updated_at?: string | null; created_at?: string | null; }

const normalizePagination = (page = 1, size = 10) => {
  const p = Math.max(1, page);
  const s = Math.max(1, Math.min(50, size));
  return { page: p, size: s, offset: (p - 1) * s };
};

export class PostRepository {
  private async count(where?: string, params: unknown[] = []): Promise<number> {
    const sql = where ? `SELECT COUNT(*)::int AS cnt FROM posts WHERE ${where}` : "SELECT COUNT(*)::int AS cnt FROM posts";
    return (await pgQueryOne<{ cnt: number }>(sql, params))?.cnt || 0;
  }

  async findBySlug(slug: string): Promise<Post | null> {
    return await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug]);
  }

  async getPostDetail(slug: string, username?: string): Promise<PostDetail | null> {
    const row = await pgQueryOne<PostDetail>(`
      SELECT p.id,p.title,p.slug,p.content,p.created_at,p.updated_at,p.author,p.tags,p.status,p.category_id,
             COALESCE(p.view_count,0) AS view_count,c.name AS category_name,c.slug AS category_slug,
             (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
             (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
             (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
             (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ?`, [slug]);
    if (!row) return null;
    if (!username) return { ...row, liked_by_me: false, favorited_by_me: false };
    const liked = await pgQueryOne<{ id: number }>("SELECT id FROM likes WHERE post_id = ? AND username = ?", [row.id, username]);
    const fav = await pgQueryOne<{ id: number }>("SELECT id FROM favorites WHERE post_id = ? AND username = ?", [row.id, username]);
    return { ...row, liked_by_me: !!liked, favorited_by_me: !!fav };
  }

  async create(data: CreatePostData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(`INSERT INTO posts (title,slug,content,created_at,updated_at,author,tags,status,category_id,view_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING id`, [data.title, data.slug, data.content, now, now, data.author, data.tags || "", data.status || "published", data.category_id || null]);
    return Number(row?.id || 0);
  }

  async updateBySlug(slug: string, data: UpdatePostData): Promise<boolean> {
    const fields: string[] = []; const params: unknown[] = [];
    if (data.title !== undefined) { fields.push("title = ?"); params.push(data.title); }
    if (data.content !== undefined) { fields.push("content = ?"); params.push(data.content); }
    if (data.tags !== undefined) { fields.push("tags = ?"); params.push(data.tags); }
    if (data.category_id !== undefined) { fields.push("category_id = ?"); params.push(data.category_id); }
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (!fields.length) return false;
    fields.push("updated_at = ?"); params.push(new Date().toISOString(), slug);
    return (await pgRun(`UPDATE posts SET ${fields.join(", ")} WHERE slug = ?`, params)).changes > 0;
  }

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

  async list(params: ListPostsParams): Promise<PaginatedResult<PostListItem>> {
    const { page = 1, size = 10, query, author, authorAliases, tag, category, username } = params;
    const { page: p, size: s, offset } = normalizePagination(page, size);
    const filters: string[] = ["p.status != 'deleted'"]; const fp: unknown[] = [];
    if (query?.trim()) { filters.push("p.title LIKE ?"); fp.push(`%${query.trim()}%`); }
    const aliases = Array.from(new Set((authorAliases || []).map((i) => i.trim()).filter(Boolean)));
    if (aliases.length) { filters.push(`p.author IN (${aliases.map(() => "?").join(", ")})`); fp.push(...aliases); }
    else if (author) { filters.push("p.author = ?"); fp.push(author); }
    if (tag) { filters.push("p.tags LIKE ?"); fp.push(`%${tag}%`); }
    if (category) { filters.push("c.slug = ?"); fp.push(category); }
    const where = filters.join(" AND ");
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where}`, fp))?.cnt || 0;
    const items = await pgQuery<PostListItem>(`SELECT p.title,p.slug,p.content,p.created_at,p.author,p.tags,p.category_id,COALESCE(p.view_count,0) AS view_count,
      c.name AS category_name,c.slug AS category_slug,
      (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
      (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
      CASE WHEN ? = '' THEN false ELSE EXISTS(SELECT 1 FROM favorites f2 WHERE f2.post_id = p.id AND f2.username = ?) END AS favorited_by_me
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [username || "", username || "", ...fp, s, offset]);
    return { items, total, page: p, size: s };
  }
  async getPostCountByAuthor(author: string): Promise<number> { return await this.count("author = ? AND status != 'deleted'", [author]); }

  async getActivities(username: string, page = 1, size = 10): Promise<PaginatedResult<{ type: "post" | "like" | "comment"; title: string; slug: string; created_at: string; content?: string; target_user?: string }>> {
    const { page: p, size: s, offset } = normalizePagination(page, size);
    const total = (await pgQueryOne<{ total: number }>(`SELECT COALESCE(SUM(cnt),0)::int AS total FROM (
      SELECT COUNT(*) AS cnt FROM posts WHERE author = ? UNION ALL
      SELECT COUNT(*) AS cnt FROM likes WHERE username = ? UNION ALL
      SELECT COUNT(*) AS cnt FROM comments WHERE author = ?) t`, [username, username, username]))?.total || 0;
    const items = await pgQuery<{ type: "post" | "like" | "comment"; title: string; slug: string; created_at: string; content?: string; target_user?: string }>(`
      SELECT 'post' AS type,title,slug,created_at,substring(trim(replace(replace(content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,NULL AS target_user FROM posts WHERE author = ?
      UNION ALL
      SELECT 'like' AS type,p.title,p.slug,l.created_at,substring(trim(replace(replace(p.content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,p.author AS target_user FROM likes l JOIN posts p ON l.post_id = p.id WHERE l.username = ?
      UNION ALL
      SELECT 'comment' AS type,p.title,p.slug,c.created_at,c.content,p.author AS target_user FROM comments c JOIN posts p ON c.post_id = p.id WHERE c.author = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?`, [username, username, username, s, offset]);
    return { items, total, page: p, size: s };
  }

  async getActivityCount(username: string): Promise<number> {
    return (await pgQueryOne<{ total: number }>(`SELECT COALESCE(SUM(cnt),0)::int AS total FROM (
      SELECT COUNT(*) AS cnt FROM posts WHERE author = ? UNION ALL
      SELECT COUNT(*) AS cnt FROM likes WHERE username = ? UNION ALL
      SELECT COUNT(*) AS cnt FROM comments WHERE author = ?) t`, [username, username, username]))?.total || 0;
  }

  async getLikesToUser(username: string, page = 1, size = 10): Promise<Array<{ sender: string; created_at: string; post_title: string; post_slug: string }>> {
    const { size: s, offset } = normalizePagination(page, size);
    return await pgQuery(`SELECT l.username AS sender,l.created_at,p.title AS post_title,p.slug AS post_slug
      FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author = ? AND l.username != ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, [username, username, s, offset]);
  }

  async getNewLikesCount(username: string, since: string): Promise<number> {
    return (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM likes l JOIN posts p ON l.post_id = p.id
      WHERE p.author = ? AND l.username != ? AND l.created_at > ?`, [username, username, since]))?.cnt || 0;
  }

  async toggleLike(slug: string, username: string, value: 1 | -1): Promise<{ liked?: boolean; disliked?: boolean }> {
    return await withPgTransaction(async (client) => {
      const post = await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug], client);
      if (!post) throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      if (value === 1) {
        const exists = await pgQueryOne<{ id: number }>("SELECT id FROM likes WHERE post_id = ? AND username = ?", [post.id, username], client);
        if (exists) { await pgRun("DELETE FROM likes WHERE post_id = ? AND username = ?", [post.id, username], client); return { liked: false }; }
        await pgRun("INSERT INTO likes (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
        return { liked: true };
      }
      const exists = await pgQueryOne<{ id: number }>("SELECT id FROM dislikes WHERE post_id = ? AND username = ?", [post.id, username], client);
      if (exists) { await pgRun("DELETE FROM dislikes WHERE post_id = ? AND username = ?", [post.id, username], client); return { disliked: false }; }
      await pgRun("INSERT INTO dislikes (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
      return { disliked: true };
    });
  }

  async getUserLikesReceived(username: string): Promise<number> {
    return (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author = ?", [username]))?.cnt || 0;
  }

  async toggleFavorite(slug: string, username: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      const post = await pgQueryOne<Post>("SELECT * FROM posts WHERE slug = ?", [slug], client);
      if (!post) throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      const exists = await pgQueryOne<{ id: number }>("SELECT id FROM favorites WHERE post_id = ? AND username = ?", [post.id, username], client);
      if (exists) { await pgRun("DELETE FROM favorites WHERE post_id = ? AND username = ?", [post.id, username], client); return false; }
      await pgRun("INSERT INTO favorites (post_id, username, created_at) VALUES (?, ?, ?)", [post.id, username, new Date().toISOString()], client);
      return true;
    });
  }

  async listFavorites(username: string, page = 1, size = 10): Promise<PaginatedResult<PostListItem>> {
    const { page: p, size: s, offset } = normalizePagination(page, size);
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM favorites WHERE username = ?", [username]))?.cnt || 0;
    const items = await pgQuery<PostListItem>(`SELECT p.title,p.slug,p.content,p.created_at,p.author,p.tags,p.category_id,COALESCE(p.view_count,0) AS view_count,
      NULL::text AS category_name,NULL::text AS category_slug,
      (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = p.id) AS comment_count,
      (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
      true AS favorited_by_me
      FROM favorites fav JOIN posts p ON p.id = fav.post_id WHERE fav.username = ? ORDER BY fav.created_at DESC LIMIT ? OFFSET ?`, [username, s, offset]);
    return { items, total, page: p, size: s };
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    return await pgQuery<Category>(`SELECT c.id,c.name,c.slug,c.description,c.sort_order,c.is_active,c.created_at,c.updated_at,
      (SELECT COUNT(*)::int FROM posts p WHERE p.category_id = c.id AND p.status != 'deleted') AS post_count
      FROM categories c ${includeInactive ? "" : "WHERE c.is_active = 1"} ORDER BY c.sort_order ASC, c.id ASC`);
  }

  async createCategory(data: { name: string; slug: string; description?: string; sort_order?: number; is_active?: boolean }): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(`INSERT INTO categories (name,slug,description,sort_order,is_active,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`, [data.name, data.slug, data.description || "", data.sort_order || 0, data.is_active !== false ? 1 : 0, now, now]);
    return Number(row?.id || 0);
  }

  async updateCategory(id: number, data: { name?: string; slug?: string; description?: string; sort_order?: number; is_active?: boolean }): Promise<boolean> {
    const fields: string[] = []; const params: unknown[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); params.push(data.slug); }
    if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active ? 1 : 0); }
    if (!fields.length) return false;
    fields.push("updated_at = ?"); params.push(new Date().toISOString(), id);
    return (await pgRun(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async deleteCategory(id: number): Promise<boolean> {
    await pgRun("UPDATE posts SET category_id = NULL WHERE category_id = ?", [id]);
    return (await pgRun("DELETE FROM categories WHERE id = ?", [id])).changes > 0;
  }
  async getNextCategorySortOrder(): Promise<number> {
    const row = await pgQueryOne<{ max_sort: number }>("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM categories");
    return Number(row?.max_sort ?? -1) + 1;
  }

  async reorderCategories(ids: number[]): Promise<void> {
    await withPgTransaction(async (client) => {
      for (let i = 0; i < ids.length; i += 1) {
        await pgRun("UPDATE categories SET sort_order = ?, updated_at = NOW() WHERE id = ?", [i, ids[i]], client);
      }
    });
  }

  async listFriendLinks(includeInactive = false): Promise<FriendLink[]> {
    const sql = includeInactive ? "SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC" : "SELECT * FROM friend_links WHERE is_active = 1 ORDER BY sort_order ASC, id ASC";
    return await pgQuery<FriendLink>(sql);
  }

  async createFriendLink(data: { name: string; url: string; description?: string; avatar_url?: string; sort_order?: number; is_active?: boolean }): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(`INSERT INTO friend_links (name,url,description,avatar_url,sort_order,is_active,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`, [data.name, data.url, data.description || "", data.avatar_url || "", data.sort_order || 0, data.is_active !== false ? 1 : 0, now, now]);
    return Number(row?.id || 0);
  }

  async updateFriendLink(id: number, data: Partial<Omit<FriendLink, "id" | "created_at" | "updated_at">>): Promise<boolean> {
    const fields: string[] = []; const params: unknown[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.url !== undefined) { fields.push("url = ?"); params.push(data.url); }
    if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
    if (data.avatar_url !== undefined) { fields.push("avatar_url = ?"); params.push(data.avatar_url); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active); }
    if (!fields.length) return false;
    fields.push("updated_at = ?"); params.push(new Date().toISOString(), id);
    return (await pgRun(`UPDATE friend_links SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async deleteFriendLink(id: number): Promise<boolean> { return (await pgRun("DELETE FROM friend_links WHERE id = ?", [id])).changes > 0; }

  async listTagStats(): Promise<Array<{ tag: string; count: number }>> {
    const rows = await pgQuery<{ tags: string }>("SELECT tags FROM posts WHERE status = 'published' AND tags IS NOT NULL AND tags != ''");
    const counter = new Map<string, number>();
    for (const row of rows) for (const tag of String(row.tags || "").split(/[,，]/).map((i) => i.trim()).filter(Boolean)) counter.set(tag, (counter.get(tag) || 0) + 1);
    return Array.from(counter.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }

  async getSiteStats(): Promise<{ totalPosts: number; totalVisits: number; totalVisitors: number }> {
    const totalPosts = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM posts"))?.count || 0;
    let totalVisits = 0; let totalVisitors = 0;
    try { totalVisits = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM site_visits"))?.count || 0; } catch {}
    try { totalVisitors = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM unique_visitors"))?.count || 0; } catch {}
    return { totalPosts, totalVisits, totalVisitors };
  }

  async recordSiteVisit(visitorId: string, pageUrl: string, userAgent: string, ipAddress: string): Promise<void> {
    await withPgTransaction(async (client) => {
      await pgRun("INSERT INTO site_visits (visitor_id,page_url,user_agent,ip_address) VALUES (?, ?, ?, ?)", [visitorId, pageUrl, userAgent, ipAddress], client);
      await pgRun(`INSERT INTO unique_visitors (visitor_id,last_visit,visit_count) VALUES (?, CURRENT_TIMESTAMP, 1)
        ON CONFLICT (visitor_id) DO UPDATE SET last_visit = CURRENT_TIMESTAMP, visit_count = unique_visitors.visit_count + 1`, [visitorId], client);
    });
  }

  async listAdminBlogs(params: AdminListBlogsParams): Promise<PaginatedResult<AdminBlogListItem>> {
    const { page = 1, size = 20, search = "", status = "", username = "", sort = "created_at_desc" } = params;
    const { page: p, size: s, offset } = normalizePagination(page, size);
    let where = "WHERE 1=1"; const fp: unknown[] = [];
    if (search.trim()) { where += " AND (p.title LIKE ? OR p.content LIKE ?)"; fp.push(`%${search.trim()}%`, `%${search.trim()}%`); }
    if (status.trim()) { where += " AND p.status = ?"; fp.push(status.trim()); }
    if (username.trim()) { where += " AND p.author = ?"; fp.push(username.trim()); }
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM posts p ${where}`, fp))?.cnt || 0;
    let orderBy = "p.created_at DESC";
    if (sort === "created_at_asc") orderBy = "p.created_at ASC";
    if (sort === "updated_at_desc") orderBy = "p.updated_at DESC";
    if (sort === "updated_at_asc") orderBy = "p.updated_at ASC";
    if (sort === "title_asc") orderBy = "p.title ASC";
    if (sort === "title_desc") orderBy = "p.title DESC";
    const items = await pgQuery<AdminBlogListItem>(`SELECT p.id,p.author AS username,p.title,COALESCE(p.status,'published') AS status,p.category_id,
      c.name AS category_name,c.slug AS category_slug,p.created_at,COALESCE(p.updated_at,p.created_at) AS updated_at
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...fp, s, offset]);
    return { items, total, page: p, size: s };
  }

  async getAdminBlogDetail(id: number): Promise<AdminBlogDetail | null> {
    return await pgQueryOne<AdminBlogDetail>(`SELECT p.id,p.author AS username,p.title,p.content,p.tags,p.category_id,c.name AS category_name,c.slug AS category_slug,
      COALESCE(p.status,'published') AS status,p.created_at,COALESCE(p.updated_at,p.created_at) AS updated_at
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [id]);
  }

  async listSitemapPosts(): Promise<SitemapPostItem[]> {
    return await pgQuery<SitemapPostItem>("SELECT slug,updated_at,created_at FROM posts WHERE slug IS NOT NULL AND trim(slug) <> '' AND (status IS NULL OR status <> 'deleted') ORDER BY id DESC");
  }

  async updateById(id: number, data: { status?: string; title?: string; content?: string; tags?: string; category_id?: number }): Promise<boolean> {
    const fields: string[] = []; const params: unknown[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (data.title !== undefined) { fields.push("title = ?"); params.push(data.title); }
    if (data.content !== undefined) { fields.push("content = ?"); params.push(data.content); }
    if (data.tags !== undefined) { fields.push("tags = ?"); params.push(data.tags); }
    if (data.category_id !== undefined) { fields.push("category_id = ?"); params.push(data.category_id); }
    if (!fields.length) return false;
    fields.push("updated_at = NOW()"); params.push(id);
    return (await pgRun(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async delete(id: number): Promise<boolean> { return (await pgRun("DELETE FROM posts WHERE id = ?", [id])).changes > 0; }
  async deleteByAuthor(author: string): Promise<number> { return (await pgRun("DELETE FROM posts WHERE author = ?", [author])).changes; }
  async deleteLikesByUsername(username: string): Promise<number> { return (await pgRun("DELETE FROM likes WHERE username = ?", [username])).changes; }
  async deleteDislikesByUsername(username: string): Promise<number> { return (await pgRun("DELETE FROM dislikes WHERE username = ?", [username])).changes; }
  async deleteFavoritesByUsername(username: string): Promise<number> { return (await pgRun("DELETE FROM favorites WHERE username = ?", [username])).changes; }
  async countAll(): Promise<number> { return await this.count(); }
  async countByStatus(status: string): Promise<number> { return await this.count("status = ?", [status]); }

  async listAdminCategories(page = 1, size = 100, search = ""): Promise<PaginatedResult<Category>> {
    const { page: p, size: s, offset } = normalizePagination(page, size);
    const kw = search.trim(); let where = ""; const params: unknown[] = [];
    if (kw) { where = "WHERE (c.name LIKE ? OR c.slug LIKE ?)"; params.push(`%${kw}%`, `%${kw}%`); }
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM categories c ${where}`, params))?.cnt || 0;
    const items = await pgQuery<Category>(`SELECT c.id,c.name,c.slug,c.description,c.sort_order,c.is_active,c.created_at,c.updated_at,
      (SELECT COUNT(*)::int FROM posts p WHERE p.category_id = c.id) AS post_count FROM categories c ${where}
      ORDER BY c.sort_order ASC, c.id ASC LIMIT ? OFFSET ?`, [...params, s, offset]);
    return { items, total, page: p, size: s };
  }
}

export const postRepository = new PostRepository();

