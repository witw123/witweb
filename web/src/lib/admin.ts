import { getUsersDb, getBlogDb } from "./db";
import type { Category } from "@/types";

interface CountRow {
  cnt: number;
}

interface UserBasicRow {
  username: string;
  created_at: string;
}

interface BlogListRow {
  id: number;
  username: string;
  title: string;
  status: string;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  created_at: string;
  updated_at: string;
}

interface BlogDetailRow {
  id: number;
  username: string;
  title: string;
  content: string;
  tags: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UserDetailRow {
  username: string;
  created_at: string;
}

interface MaxSortRow {
  max_sort: number;
}

export function listUsers(page = 1, limit = 20, search = "", sort = "created_at_desc"): { users: UserBasicRow[]; total: number; page: number; limit: number } {
  const db = getUsersDb();
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  if (search) {
    where += " AND username LIKE ?";
    params.push(`%${search}%`);
  }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM users ${where}`).get(...params) as CountRow)?.cnt || 0;
  let orderBy = "created_at DESC";
  if (sort === "created_at_asc") orderBy = "created_at ASC";
  if (sort === "username_asc") orderBy = "username ASC";
  if (sort === "username_desc") orderBy = "username DESC";
  const users = db.prepare(`SELECT username, created_at FROM users ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as UserBasicRow[];
  return { users, total, page, limit };
}

export function getUserDetail(username: string): { username: string; created_at: string; status: string; last_login: null; blog_count: number } | null {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();
  const row = usersDb.prepare("SELECT username, created_at FROM users WHERE username = ?").get(username) as UserDetailRow | undefined;
  if (!row) return null;
  const blogCount = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE author = ?").get(username) as CountRow)?.cnt || 0;
  return { ...row, status: "active", last_login: null, blog_count: blogCount };
}

export function deleteUser(username: string): void {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();


  // Remove user content from blog db
  blogDb.prepare("DELETE FROM posts WHERE author = ?").run(username);
  blogDb.prepare("DELETE FROM comments WHERE author = ?").run(username);
  blogDb.prepare("DELETE FROM likes WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM dislikes WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM favorites WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM comment_votes WHERE username = ?").run(username);

  // Remove follow relations
  usersDb.prepare("DELETE FROM follows WHERE follower = ? OR following = ?").run(username, username);
  usersDb.prepare("DELETE FROM users WHERE username = ?").run(username);
}

export function listBlogs(
  page = 1, 
  limit = 20, 
  search = "", 
  status = "", 
  usernameFilter = "", 
  sort = "created_at_desc"
): { blogs: BlogListRow[]; total: number; page: number; limit: number } {
  const db = getBlogDb();
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  if (search) {
    where += " AND (p.title LIKE ? OR p.content LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND p.status = ?";
    params.push(status);
  }
  if (usernameFilter) {
    where += " AND p.author = ?";
    params.push(usernameFilter);
  }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM posts p ${where}`).get(...params) as CountRow)?.cnt || 0;
  let orderBy = "p.created_at DESC";
  if (sort === "created_at_asc") orderBy = "p.created_at ASC";
  if (sort === "updated_at_desc") orderBy = "p.updated_at DESC";
  if (sort === "updated_at_asc") orderBy = "p.updated_at ASC";
  if (sort === "title_asc") orderBy = "p.title ASC";
  if (sort === "title_desc") orderBy = "p.title DESC";
  const blogs = db.prepare(`
    SELECT
      p.id,
      p.author as username,
      p.title,
      COALESCE(p.status, 'published') as status,
      p.category_id,
      c.name as category_name,
      c.slug as category_slug,
      p.created_at,
      COALESCE(p.updated_at, p.created_at) as updated_at
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as BlogListRow[];
  return { blogs, total, page, limit };
}

export function getBlogDetail(id: number): BlogDetailRow | null {
  const db = getBlogDb();
  const row = db.prepare(`
    SELECT
      p.id,
      p.author as username,
      p.title,
      p.content,
      p.tags,
      p.category_id,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE(p.status, 'published') as status,
      p.created_at,
      COALESCE(p.updated_at, p.created_at) as updated_at
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id) as BlogDetailRow | undefined;
  return row || null;
}

interface UpdateBlogData {
  status?: string;
  title?: string;
  content?: string;
  tags?: string;
  category_id?: number;
}

export function updateBlog(id: number, data: UpdateBlogData): void {
  const db = getBlogDb();
  const fields: string[] = [];
  const params: (string | number | undefined)[] = [];
  if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
  if (data.title !== undefined) { fields.push("title = ?"); params.push(data.title); }
  if (data.content !== undefined) { fields.push("content = ?"); params.push(data.content); }
  if (data.tags !== undefined) { fields.push("tags = ?"); params.push(data.tags); }
  if (data.category_id !== undefined) { fields.push("category_id = ?"); params.push(data.category_id); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(id);
  db.prepare(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

export function deleteBlog(id: number): void {
  const db = getBlogDb();
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function statsOverview(): { total_users: number; total_blogs: number; total_published_blogs: number; total_draft_blogs: number } {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();

  const totalUsers = (usersDb.prepare("SELECT COUNT(*) AS cnt FROM users").get() as CountRow)?.cnt || 0;
  const totalBlogs = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts").get() as CountRow)?.cnt || 0;
  const totalPublished = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE status = 'published'").get() as CountRow)?.cnt || 0;
  const totalDraft = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE status = 'draft'").get() as CountRow)?.cnt || 0;

  return {
    total_users: totalUsers,
    total_blogs: totalBlogs,
    total_published_blogs: totalPublished,
    total_draft_blogs: totalDraft,
  };
}

export function listCategories(page = 1, limit = 100, search = ""): { categories: Category[]; total: number; page: number; limit: number } {
  const db = getBlogDb();
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  if (search) {
    where += " AND (c.name LIKE ? OR c.slug LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM categories c ${where}`).get(...params) as CountRow)?.cnt || 0;
  const categories = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.sort_order,
      c.is_active,
      c.created_at,
      c.updated_at,
      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.category_id = c.id
      ) AS post_count
    FROM categories c
    ${where}
    ORDER BY c.sort_order ASC, c.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Category[];
  return { categories, total, page, limit };
}

interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  is_active?: number;
}

export function createCategory(data: CreateCategoryData): number | bigint {
  const db = getBlogDb();
  const maxSort = (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM categories").get() as MaxSortRow)?.max_sort ?? -1;
  const stmt = db.prepare(`
    INSERT INTO categories (name, slug, description, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);
  const result = stmt.run(
    data.name.trim(),
    data.slug.trim(),
    (data.description || "").trim(),
    Number(maxSort) + 1,
    data.is_active === 0 ? 0 : 1,
  );
  return result.lastInsertRowid;
}

interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string;
  is_active?: number;
}

export function updateCategory(id: number, data: UpdateCategoryData): void {
  const db = getBlogDb();
  const fields: string[] = [];
  const params: (string | number | undefined)[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name.trim()); }
  if (data.slug !== undefined) { fields.push("slug = ?"); params.push(data.slug.trim()); }
  if (data.description !== undefined) { fields.push("description = ?"); params.push((data.description || "").trim()); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active === 0 ? 0 : 1); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(id);
  db.prepare(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

export function deleteCategory(id: number): void {
  const db = getBlogDb();
  const tx = db.transaction(() => {
    db.prepare("UPDATE posts SET category_id = NULL WHERE category_id = ?").run(id);
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  });
  tx();
}

// Type for better-sqlite3 transaction function with specific input type
type TransactionFn<T> = (fn: (input: T) => void) => (input: T) => void;

export function reorderCategories(ids: number[]): void {
  const db = getBlogDb();
  // Use double type assertion to handle better-sqlite3's complex transaction typing
  const tx = (db.transaction as unknown as TransactionFn<number[]>)((input: number[]) => {
    input.forEach((id, index) => {
      db.prepare("UPDATE categories SET sort_order = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(index, id);
    });
  });
  tx(ids);
}
