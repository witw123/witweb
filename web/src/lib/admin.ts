import { getUsersDb, getBlogDb, getChannelDb } from "./db";

export function listUsers(page = 1, limit = 20, search = "", sort = "created_at_desc") {
  const db = getUsersDb();
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (search) {
    where += " AND username LIKE ?";
    params.push(`%${search}%`);
  }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM users ${where}`).get(...params) as any)?.cnt || 0;
  let orderBy = "created_at DESC";
  if (sort === "created_at_asc") orderBy = "created_at ASC";
  if (sort === "username_asc") orderBy = "username ASC";
  if (sort === "username_desc") orderBy = "username DESC";
  const users = db.prepare(`SELECT username, created_at FROM users ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return { users, total, page, limit };
}

export function getUserDetail(username: string) {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();
  const row = usersDb.prepare("SELECT username, created_at FROM users WHERE username = ?").get(username) as any;
  if (!row) return null;
  const blogCount = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE author = ?").get(username) as any)?.cnt || 0;
  return { ...row, status: "active", last_login: null, blog_count: blogCount };
}

export function deleteUser(username: string) {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();
  const channelDb = getChannelDb();

  const user = usersDb.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;

  // Remove user content from blog db
  blogDb.prepare("DELETE FROM posts WHERE author = ?").run(username);
  blogDb.prepare("DELETE FROM comments WHERE author = ?").run(username);
  blogDb.prepare("DELETE FROM likes WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM dislikes WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM favorites WHERE username = ?").run(username);
  blogDb.prepare("DELETE FROM comment_votes WHERE username = ?").run(username);

  // Remove user messages from channel db
  if (user?.id) {
    channelDb.prepare("DELETE FROM messages WHERE user_id = ?").run(user.id);
  }

  // Remove follow relations
  usersDb.prepare("DELETE FROM follows WHERE follower = ? OR following = ?").run(username, username);
  usersDb.prepare("DELETE FROM users WHERE username = ?").run(username);
}

export function listBlogs(page = 1, limit = 20, search = "", status = "", usernameFilter = "", sort = "created_at_desc") {
  const db = getBlogDb();
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (search) {
    where += " AND (title LIKE ? OR content LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (usernameFilter) {
    where += " AND author = ?";
    params.push(usernameFilter);
  }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM posts ${where}`).get(...params) as any)?.cnt || 0;
  let orderBy = "created_at DESC";
  if (sort === "created_at_asc") orderBy = "created_at ASC";
  if (sort === "updated_at_desc") orderBy = "updated_at DESC";
  if (sort === "updated_at_asc") orderBy = "updated_at ASC";
  if (sort === "title_asc") orderBy = "title ASC";
  if (sort === "title_desc") orderBy = "title DESC";
  const blogs = db.prepare(`
    SELECT id, author as username, title, COALESCE(status, 'published') as status,
      created_at, COALESCE(updated_at, created_at) as updated_at
    FROM posts
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { blogs, total, page, limit };
}

export function getBlogDetail(id: number) {
  const db = getBlogDb();
  const row = db.prepare(`
    SELECT id, author as username, title, content,
      COALESCE(status, 'published') as status,
      created_at, COALESCE(updated_at, created_at) as updated_at
    FROM posts WHERE id = ?
  `).get(id);
  return row || null;
}

export function updateBlog(id: number, data: any) {
  const db = getBlogDb();
  const fields: string[] = [];
  const params: any[] = [];
  if (data.status) { fields.push("status = ?"); params.push(data.status); }
  if (data.title) { fields.push("title = ?"); params.push(data.title); }
  if (data.content) { fields.push("content = ?"); params.push(data.content); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(id);
  db.prepare(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

export function deleteBlog(id: number) {
  const db = getBlogDb();
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function statsOverview() {
  const usersDb = getUsersDb();
  const blogDb = getBlogDb();
  const channelDb = getChannelDb();
  const totalUsers = (usersDb.prepare("SELECT COUNT(*) AS cnt FROM users").get() as any)?.cnt || 0;
  const totalBlogs = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts").get() as any)?.cnt || 0;
  const totalPublished = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE status = 'published'").get() as any)?.cnt || 0;
  const totalDraft = (blogDb.prepare("SELECT COUNT(*) AS cnt FROM posts WHERE status = 'draft'").get() as any)?.cnt || 0;
  const totalChannels = (channelDb.prepare("SELECT COUNT(*) AS cnt FROM channels").get() as any)?.cnt || 0;
  const totalMessages = (channelDb.prepare("SELECT COUNT(*) AS cnt FROM messages").get() as any)?.cnt || 0;
  return {
    total_users: totalUsers,
    total_blogs: totalBlogs,
    total_published_blogs: totalPublished,
    total_draft_blogs: totalDraft,
    total_channels: totalChannels,
    total_messages: totalMessages,
  };
}
