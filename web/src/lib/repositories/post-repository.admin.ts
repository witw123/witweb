import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Category, FriendLink, PostStatus } from "@/types";
import type { PaginatedResult } from "./types";
import { countPosts, normalizePagination } from "./post-repository.shared";
import type {
  AdminBlogDetail,
  AdminBlogListItem,
  AdminListBlogsParams,
  CategoryMutationData,
  FriendLinkMutationData,
} from "./post-repository.types";

export class PostAdminRepository {
  async listCategories(includeInactive = false): Promise<Category[]> {
    return await pgQuery<Category>(
      `SELECT c.id,c.name,c.slug,c.description,c.sort_order,c.is_active,c.created_at,c.updated_at,
              (SELECT COUNT(*)::int FROM posts p WHERE p.category_id = c.id AND p.status != 'deleted') AS post_count
       FROM categories c ${includeInactive ? "" : "WHERE c.is_active = 1"} ORDER BY c.sort_order ASC, c.id ASC`
    );
  }

  async createCategory(data: Required<Pick<CategoryMutationData, "name" | "slug">> & CategoryMutationData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO categories (name,slug,description,sort_order,is_active,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [data.name, data.slug, data.description || "", data.sort_order || 0, data.is_active !== false ? 1 : 0, now, now]
    );
    return Number(row?.id || 0);
  }

  async updateCategory(id: number, data: CategoryMutationData): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); params.push(data.slug); }
    if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active ? 1 : 0); }
    if (!fields.length) return false;
    fields.push("updated_at = ?");
    params.push(new Date().toISOString(), id);
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
    const sql = includeInactive
      ? "SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM friend_links WHERE is_active = 1 ORDER BY sort_order ASC, id ASC";
    return await pgQuery<FriendLink>(sql);
  }

  async createFriendLink(data: { name: string; url: string } & FriendLinkMutationData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO friend_links (name,url,description,avatar_url,sort_order,is_active,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [data.name, data.url, data.description || "", data.avatar_url || "", data.sort_order || 0, data.is_active !== false ? 1 : 0, now, now]
    );
    return Number(row?.id || 0);
  }

  async updateFriendLink(id: number, data: FriendLinkMutationData): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.url !== undefined) { fields.push("url = ?"); params.push(data.url); }
    if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
    if (data.avatar_url !== undefined) { fields.push("avatar_url = ?"); params.push(data.avatar_url); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active); }
    if (!fields.length) return false;
    fields.push("updated_at = ?");
    params.push(new Date().toISOString(), id);
    return (await pgRun(`UPDATE friend_links SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async deleteFriendLink(id: number): Promise<boolean> {
    return (await pgRun("DELETE FROM friend_links WHERE id = ?", [id])).changes > 0;
  }

  async listTagStats(): Promise<Array<{ tag: string; count: number }>> {
    const rows = await pgQuery<{ tags: string }>("SELECT tags FROM posts WHERE status = 'published' AND tags IS NOT NULL AND tags != ''");
    const counter = new Map<string, number>();
    for (const row of rows) {
      for (const tag of String(row.tags || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean)) {
        counter.set(tag, (counter.get(tag) || 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getSiteStats(): Promise<{ totalPosts: number; totalVisits: number; totalVisitors: number }> {
    const totalPosts = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM posts"))?.count || 0;
    let totalVisits = 0;
    let totalVisitors = 0;
    try { totalVisits = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM site_visits"))?.count || 0; } catch {}
    try { totalVisitors = (await pgQueryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM unique_visitors"))?.count || 0; } catch {}
    return { totalPosts, totalVisits, totalVisitors };
  }

  async recordSiteVisit(visitorId: string, pageUrl: string, userAgent: string, ipAddress: string): Promise<void> {
    await withPgTransaction(async (client) => {
      await pgRun("INSERT INTO site_visits (visitor_id,page_url,user_agent,ip_address) VALUES (?, ?, ?, ?)", [visitorId, pageUrl, userAgent, ipAddress], client);
      await pgRun(
        `INSERT INTO unique_visitors (visitor_id,last_visit,visit_count) VALUES (?, CURRENT_TIMESTAMP, 1)
         ON CONFLICT (visitor_id) DO UPDATE SET last_visit = CURRENT_TIMESTAMP, visit_count = unique_visitors.visit_count + 1`,
        [visitorId],
        client
      );
    });
  }

  async listAdminBlogs(params: AdminListBlogsParams): Promise<PaginatedResult<AdminBlogListItem>> {
    const {
      page = 1,
      size = 20,
      search = "",
      status = "",
      username = "",
      tag = "",
      dateFrom = "",
      dateTo = "",
      sort = "created_at_desc",
    } = params;
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    let where = "WHERE 1=1";
    const queryParams: unknown[] = [];
    if (search.trim()) {
      where += " AND (p.title LIKE ? OR p.content LIKE ?)";
      queryParams.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (status.trim()) {
      where += " AND COALESCE(p.status, 'published') = ?";
      queryParams.push(status.trim());
    } else {
      where += " AND COALESCE(p.status, 'published') <> 'deleted'";
    }
    if (username.trim()) { where += " AND p.author = ?"; queryParams.push(username.trim()); }
    if (tag.trim()) { where += " AND COALESCE(p.tags, '') LIKE ?"; queryParams.push(`%${tag.trim()}%`); }
    if (dateFrom.trim()) { where += " AND p.created_at >= ?"; queryParams.push(dateFrom.trim()); }
    if (dateTo.trim()) { where += " AND p.created_at <= ?"; queryParams.push(dateTo.trim()); }
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM posts p ${where}`, queryParams))?.cnt || 0;
    let orderBy = "p.created_at DESC";
    if (sort === "created_at_asc") orderBy = "p.created_at ASC";
    if (sort === "updated_at_desc") orderBy = "p.updated_at DESC";
    if (sort === "updated_at_asc") orderBy = "p.updated_at ASC";
    if (sort === "title_asc") orderBy = "p.title ASC";
    if (sort === "title_desc") orderBy = "p.title DESC";
    const items = await pgQuery<AdminBlogListItem>(
      `SELECT p.id,p.author AS username,p.title,COALESCE(p.status,'published') AS status,p.category_id,
              c.name AS category_name,c.slug AS category_slug,p.created_at,COALESCE(p.updated_at,p.created_at) AS updated_at
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id ${where}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...queryParams, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }

  async getAdminBlogDetail(id: number): Promise<AdminBlogDetail | null> {
    return await pgQueryOne<AdminBlogDetail>(
      `SELECT p.id,p.author AS username,p.title,p.content,p.tags,p.category_id,c.name AS category_name,c.slug AS category_slug,
              COALESCE(p.status,'published') AS status,p.created_at,COALESCE(p.updated_at,p.created_at) AS updated_at
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [id]
    );
  }

  async updateById(id: number, data: { status?: PostStatus; title?: string; content?: string; tags?: string; category_id?: number | null }): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (data.title !== undefined) { fields.push("title = ?"); params.push(data.title); }
    if (data.content !== undefined) { fields.push("content = ?"); params.push(data.content); }
    if (data.tags !== undefined) { fields.push("tags = ?"); params.push(data.tags); }
    if (data.category_id !== undefined) { fields.push("category_id = ?"); params.push(data.category_id); }
    if (!fields.length) return false;
    fields.push("updated_at = NOW()");
    params.push(id);
    return (await pgRun(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async bulkUpdateStatusByIds(ids: number[], status: PostStatus): Promise<number> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return 0;
    const placeholders = uniqueIds.map(() => "?").join(", ");
    return (await pgRun(`UPDATE posts SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`, [status, ...uniqueIds])).changes;
  }

  async bulkDeleteByIds(ids: number[]): Promise<number> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return 0;
    const placeholders = uniqueIds.map(() => "?").join(", ");
    return (await pgRun(`DELETE FROM posts WHERE id IN (${placeholders})`, uniqueIds)).changes;
  }

  async softDeleteById(id: number): Promise<boolean> {
    return (await pgRun("UPDATE posts SET status = 'deleted', updated_at = NOW() WHERE id = ?", [id])).changes > 0;
  }

  async restoreById(id: number, status: "published" | "draft" = "draft"): Promise<boolean> {
    return (await pgRun("UPDATE posts SET status = ?, updated_at = NOW() WHERE id = ?", [status, id])).changes > 0;
  }

  async hardDeleteById(id: number): Promise<boolean> {
    return (await pgRun("DELETE FROM posts WHERE id = ?", [id])).changes > 0;
  }

  async deleteByAuthor(author: string): Promise<number> {
    return (await pgRun("DELETE FROM posts WHERE author = ?", [author])).changes;
  }

  async deleteLikesByUsername(username: string): Promise<number> {
    return (await pgRun("DELETE FROM likes WHERE username = ?", [username])).changes;
  }

  async deleteDislikesByUsername(username: string): Promise<number> {
    return (await pgRun("DELETE FROM dislikes WHERE username = ?", [username])).changes;
  }

  async deleteFavoritesByUsername(username: string): Promise<number> {
    return (await pgRun("DELETE FROM favorites WHERE username = ?", [username])).changes;
  }

  async countAll(): Promise<number> {
    return await countPosts();
  }

  async countByStatus(status: string): Promise<number> {
    return await countPosts("status = ?", [status]);
  }

  async listAdminCategories(page = 1, size = 100, search = ""): Promise<PaginatedResult<Category>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const keyword = search.trim();
    let where = "";
    const params: unknown[] = [];
    if (keyword) {
      where = "WHERE (c.name LIKE ? OR c.slug LIKE ?)";
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM categories c ${where}`, params))?.cnt || 0;
    const items = await pgQuery<Category>(
      `SELECT c.id,c.name,c.slug,c.description,c.sort_order,c.is_active,c.created_at,c.updated_at,
              (SELECT COUNT(*)::int FROM posts p WHERE p.category_id = c.id) AS post_count
       FROM categories c ${where}
       ORDER BY c.sort_order ASC, c.id ASC LIMIT ? OFFSET ?`,
      [...params, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }
}
