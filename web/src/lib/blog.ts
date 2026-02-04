import { getBlogDb, getUsersDb } from "./db";

type UserRow = { username: string; nickname?: string; avatar_url?: string };

function getUserMap(usernames: string[]) {
  const unique = Array.from(new Set(usernames.filter(Boolean)));
  const map = new Map<string, UserRow>();
  if (unique.length === 0) return map;
  const usersDb = getUsersDb();
  const placeholders = unique.map(() => "?").join(",");
  const rows = usersDb.prepare(`SELECT username, nickname, avatar_url FROM users WHERE username IN (${placeholders})`).all(...unique) as any[];
  rows.forEach((row) => map.set(row.username, row));
  return map;
}

export function getUnreadNotificationCount(username: string): number {
  const blogDb = getBlogDb();
  const usersDb = getUsersDb();

  const user = usersDb.prepare("SELECT last_read_notifications_at FROM users WHERE username = ?").get(username) as { last_read_notifications_at: string };
  if (!user) return 0;

  const lastRead = user.last_read_notifications_at || "1970-01-01T00:00:00.000Z";

  // Count new comments on user's posts
  const newComments = blogDb.prepare(`
    SELECT COUNT(*) as cnt 
    FROM comments c
    INNER JOIN posts p ON c.post_id = p.id
    WHERE p.author = ? AND c.author != ? AND c.created_at > ?
  `).get(username, username, lastRead) as { cnt: number };

  // Count new likes on user's posts
  const newLikes = blogDb.prepare(`
    SELECT COUNT(*) as cnt 
    FROM likes l
    INNER JOIN posts p ON l.post_id = p.id
    WHERE p.author = ? AND l.username != ? AND l.created_at > ?
  `).get(username, username, lastRead) as { cnt: number };

  return (newComments?.cnt || 0) + (newLikes?.cnt || 0);
}

export function markNotificationsAsRead(username: string) {
  const usersDb = getUsersDb();
  const now = new Date().toISOString();
  usersDb.prepare("UPDATE users SET last_read_notifications_at = ? WHERE username = ?").run(now, username);
}

// ... imports

export interface ActivityItem {
  type: 'post' | 'like' | 'comment';
  title: string;
  slug: string;
  created_at: string;
  content?: string; // for comments
  target_user?: string; // for likes/comments (post author)
}

export function getActivities(username: string, page = 1, size = 10): { items: ActivityItem[], total: number } {
  const db = getBlogDb();
  const offset = (page - 1) * size;

  // Count total
  const countSql = `
    SELECT SUM(cnt) as total FROM (
      SELECT COUNT(*) as cnt FROM posts WHERE author = ?
      UNION ALL
      SELECT COUNT(*) as cnt FROM likes WHERE username = ?
      UNION ALL
      SELECT COUNT(*) as cnt FROM comments WHERE author = ?
    )
  `;
  const total = db.prepare(countSql).get(username, username, username) as { total: number };

  const sql = `
    SELECT 'post' as type, title, slug, created_at, NULL as content, NULL as target_user 
    FROM posts 
    WHERE author = ?
    
    UNION ALL
    
    SELECT 'like' as type, p.title, p.slug, l.created_at, NULL as content, p.author as target_user 
    FROM likes l 
    INNER JOIN posts p ON l.post_id = p.id 
    WHERE l.username = ?
    
    UNION ALL
    
    SELECT 'comment' as type, p.title, p.slug, c.created_at, c.content, p.author as target_user 
    FROM comments c 
    INNER JOIN posts p ON c.post_id = p.id 
    WHERE c.author = ?
    
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const items = db.prepare(sql).all(username, username, username, size, offset) as ActivityItem[];

  return {
    items,
    total: total?.total || 0
  };
}

export function getUserLikesReceived(username: string): number {
  const db = getBlogDb();
  const row = db.prepare(`
    SELECT COUNT(*) as total 
    FROM likes l 
    INNER JOIN posts p ON l.post_id = p.id 
    WHERE p.author = ?
  `).get(username) as { total: number };
  return row?.total || 0;
}

export function getPostCount(username: string): number {
  const db = getBlogDb();
  const row = db.prepare("SELECT COUNT(*) as total FROM posts WHERE author = ?").get(username) as { total: number };
  return row?.total || 0;
}

export function getRepliesToUser(username: string, page = 1, size = 10) {
  const db = getBlogDb();
  const offset = (page - 1) * size;
  const rows = db.prepare(`
    SELECT 
      c.id, c.author as sender, c.content, c.created_at, 
      p.title as post_title, p.slug as post_slug
    FROM comments c
    INNER JOIN posts p ON c.post_id = p.id
    WHERE p.author = ? AND c.author != ?
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(username, username, size, offset) as any[];

  const userMap = getUserMap(rows.map(r => r.sender));
  rows.forEach(r => {
    const u = userMap.get(r.sender);
    r.sender_nickname = u?.nickname || r.sender;
    r.sender_avatar = u?.avatar_url || "";
  });
  return rows;
}

export function getLikesToUser(username: string, page = 1, size = 10) {
  const db = getBlogDb();
  const offset = (page - 1) * size;
  const rows = db.prepare(`
    SELECT 
      l.username as sender, l.created_at, 
      p.title as post_title, p.slug as post_slug
    FROM likes l
    INNER JOIN posts p ON l.post_id = p.id
    WHERE p.author = ? AND l.username != ?
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(username, username, size, offset) as any[];

  const userMap = getUserMap(rows.map(r => r.sender));
  rows.forEach(r => {
    const u = userMap.get(r.sender);
    r.sender_nickname = u?.nickname || r.sender;
    r.sender_avatar = u?.avatar_url || "";
  });
  return rows;
}

export function getMentionsToUser(username: string, page = 1, size = 10) {
  const db = getBlogDb();
  const offset = (page - 1) * size;
  // Look for "@username" in comments
  const rows = db.prepare(`
    SELECT 
      c.id, c.author as sender, c.content, c.created_at, 
      p.title as post_title, p.slug as post_slug
    FROM comments c
    INNER JOIN posts p ON c.post_id = p.id
    WHERE c.content LIKE ? AND c.author != ?
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(`%@${username}%`, username, size, offset) as any[];

  const userMap = getUserMap(rows.map(r => r.sender));
  rows.forEach(r => {
    const u = userMap.get(r.sender);
    r.sender_nickname = u?.nickname || r.sender;
    r.sender_avatar = u?.avatar_url || "";
  });
  return rows;
}

export function getSystemNotifications(username: string) {
  // Mock system notification for new users or general announcements
  const now = new Date().toISOString();
  return [
    {
      sender: "system",
      sender_nickname: "系统通知",
      sender_avatar: "",
      content: `欢迎来到 witweb，${username}！在这里你可以分享你的故事。`,
      created_at: now,
      post_title: "站点公告",
      post_slug: "#"
    }
  ];
}

export function listPosts(page = 1, size = 10, query = "", author = "", tag = "", username = "") {
  const db = getBlogDb();
  page = Math.max(1, page);
  size = Math.max(1, Math.min(50, size));
  const filters: string[] = [];
  const params: any[] = [];
  if (query) {
    filters.push("p.title LIKE ?");
    params.push(`%${query}%`);
  }
  if (author) {
    const userRow = getUsersDb().prepare("SELECT id FROM users WHERE username = ?").get(author) as any;
    if (userRow?.id) {
      filters.push("(p.author = ? OR p.author = ?)");
      params.push(author, String(userRow.id));
    } else {
      filters.push("p.author = ?");
      params.push(author);
    }
  }
  if (tag) {
    filters.push("p.tags LIKE ?");
    params.push(`%${tag}%`);
  }
  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM posts p ${whereSql}`).get(...params) as any;
  const total = totalRow?.cnt || 0;
  const offset = (page - 1) * size;
  const rows = db.prepare(`
    SELECT
      p.title,
      p.slug,
      p.content,
      p.created_at,
      p.author,
      p.tags,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
      CASE
        WHEN ? = '' THEN 0
        ELSE EXISTS(
          SELECT 1 FROM favorites f2 WHERE f2.post_id = p.id AND f2.username = ?
        )
      END AS favorited_by_me
    FROM posts p
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(username || "", username || "", ...params, size, offset) as any[];

  const userMap = getUserMap(rows.map((r) => r.author));
  rows.forEach((row) => {
    const user = userMap.get(row.author);
    row.author_name = user?.nickname || row.author;
    row.author_avatar = user?.avatar_url || "";
  });

  return { items: rows, total, page, size };
}

export function getPost(slug: string, username = "") {
  const db = getBlogDb();
  const row = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.content,
      p.created_at,
      p.author,
      p.tags,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count
    FROM posts p
    WHERE p.slug = ?
  `).get(slug) as any;
  if (!row) return null;

  const userMap = getUserMap([row.author]);
  const user = userMap.get(row.author);
  row.author_name = user?.nickname || row.author;
  row.author_avatar = user?.avatar_url || "";

  if (username) {
    const liked = db.prepare("SELECT id FROM likes WHERE post_id = ? AND username = ?").get(row.id, username);
    const favorited = db.prepare("SELECT id FROM favorites WHERE post_id = ? AND username = ?").get(row.id, username);
    row.liked_by_me = !!liked;
    row.favorited_by_me = !!favorited;
  }
  return row;
}

export function createPost(title: string, slug: string | null, content: string, author: string, tags = "") {
  const db = getBlogDb();
  const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(title);
  const unique = ensureUniqueSlug(db, finalSlug);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO posts (title, slug, content, created_at, updated_at, author, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(title, unique, content, now, now, author, tags, "published");
  return unique;
}

export function updatePost(slug: string, title: string, content: string, tags: string, username: string) {
  const db = getBlogDb();
  const row = db.prepare("SELECT author FROM posts WHERE slug = ?").get(slug) as any;
  if (!row) return { ok: false, error: "not_found" };
  if (row.author !== username) return { ok: false, error: "forbidden" };
  db.prepare("UPDATE posts SET title = ?, content = ?, tags = ?, updated_at = ? WHERE slug = ?")
    .run(title, content, tags, new Date().toISOString(), slug);
  return { ok: true };
}

export function deletePost(slug: string, username: string, adminUsername: string) {
  const db = getBlogDb();
  const row = db.prepare("SELECT id, author FROM posts WHERE slug = ?").get(slug) as any;
  if (!row) return { ok: false, error: "not_found" };
  if (row.author !== username && username !== adminUsername) return { ok: false, error: "forbidden" };
  db.prepare("DELETE FROM posts WHERE id = ?").run(row.id);
  db.prepare("DELETE FROM comments WHERE post_id = ?").run(row.id);
  db.prepare("DELETE FROM likes WHERE post_id = ?").run(row.id);
  db.prepare("DELETE FROM dislikes WHERE post_id = ?").run(row.id);
  db.prepare("DELETE FROM favorites WHERE post_id = ?").run(row.id);
  return { ok: true };
}

export function listComments(slug: string) {
  const db = getBlogDb();
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as any;
  if (!post) return [];
  const rows = db.prepare(`
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
  `).all(post.id) as any[];

  const userMap = getUserMap(rows.map((r) => r.author));
  rows.forEach((row) => {
    const user = userMap.get(row.author);
    row.author_name = user?.nickname || row.author;
    row.author_avatar = user?.avatar_url || "";
  });

  return rows;
}

export function addComment(slug: string, author: string, content: string, parentId: number | null, ip: string) {
  const db = getBlogDb();
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as any;
  if (!post) return { ok: false, error: "not_found" };
  db.prepare("INSERT INTO comments (post_id, author, content, created_at, parent_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)")
    .run(post.id, author, content, new Date().toISOString(), parentId, ip);
  return { ok: true };
}

export function toggleLike(slug: string, username: string, value: 1 | -1) {
  const db = getBlogDb();
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as any;
  if (!post) return { ok: false, error: "not_found" };
  if (value === 1) {
    const exists = db.prepare("SELECT id FROM likes WHERE post_id = ? AND username = ?").get(post.id, username);
    if (exists) {
      db.prepare("DELETE FROM likes WHERE post_id = ? AND username = ?").run(post.id, username);
      return { ok: true, liked: false };
    }
    db.prepare("INSERT INTO likes (post_id, username, created_at) VALUES (?, ?, ?)").run(post.id, username, new Date().toISOString());
    return { ok: true, liked: true };
  }
  const exists = db.prepare("SELECT id FROM dislikes WHERE post_id = ? AND username = ?").get(post.id, username);
  if (exists) {
    db.prepare("DELETE FROM dislikes WHERE post_id = ? AND username = ?").run(post.id, username);
    return { ok: true, disliked: false };
  }
  db.prepare("INSERT INTO dislikes (post_id, username, created_at) VALUES (?, ?, ?)").run(post.id, username, new Date().toISOString());
  return { ok: true, disliked: true };
}

export function toggleFavorite(slug: string, username: string) {
  const db = getBlogDb();
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as any;
  if (!post) return { ok: false, error: "not_found" };
  const exists = db.prepare("SELECT id FROM favorites WHERE post_id = ? AND username = ?").get(post.id, username);
  if (exists) {
    db.prepare("DELETE FROM favorites WHERE post_id = ? AND username = ?").run(post.id, username);
    return { ok: true, favorited: false };
  }
  db.prepare("INSERT INTO favorites (post_id, username, created_at) VALUES (?, ?, ?)").run(post.id, username, new Date().toISOString());
  return { ok: true, favorited: true };
}

export function listFavorites(username: string, page = 1, size = 10) {
  const db = getBlogDb();
  page = Math.max(1, page);
  size = Math.max(1, Math.min(50, size));
  const offset = (page - 1) * size;
  const totalRow = db.prepare("SELECT COUNT(*) AS cnt FROM favorites WHERE username = ?").get(username) as any;
  const total = totalRow?.cnt || 0;
  const rows = db.prepare(`
    SELECT
      p.title,
      p.slug,
      p.content,
      p.created_at,
      p.author,
      p.tags,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
      1 AS favorited_by_me
    FROM favorites fav
    JOIN posts p ON p.id = fav.post_id
    WHERE fav.username = ?
    ORDER BY fav.created_at DESC
    LIMIT ? OFFSET ?
  `).all(username, size, offset) as any[];

  const userMap = getUserMap(rows.map((r) => r.author));
  rows.forEach((row) => {
    const user = userMap.get(row.author);
    row.author_name = user?.nickname || row.author;
    row.author_avatar = user?.avatar_url || "";
  });

  return { items: rows, total, page, size };
}

export function voteComment(commentId: number, username: string, value: 1 | -1) {
  const db = getBlogDb();
  const existing = db.prepare("SELECT id FROM comment_votes WHERE comment_id = ? AND username = ?").get(commentId, username) as any;
  if (existing) {
    db.prepare("UPDATE comment_votes SET value = ?, created_at = ? WHERE id = ?")
      .run(value, new Date().toISOString(), existing.id);
  } else {
    db.prepare("INSERT INTO comment_votes (comment_id, username, value, created_at) VALUES (?, ?, ?, ?)")
      .run(commentId, username, value, new Date().toISOString());
  }
}

export function getPostSlugForComment(commentId: number) {
  const db = getBlogDb();
  const row = db.prepare("SELECT post_id FROM comments WHERE id = ?").get(commentId) as any;
  if (!row) return "";
  const post = db.prepare("SELECT slug FROM posts WHERE id = ?").get(row.post_id) as any;
  return post?.slug || "";
}

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureUniqueSlug(db: any, base: string) {
  let slug = base || "post";
  let i = 1;
  while (db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export function updateComment(commentId: number, content: string, username: string, adminUsername: string) {
  const db = getBlogDb();
  const comment = db.prepare("SELECT author FROM comments WHERE id = ?").get(commentId) as any;
  if (!comment) return { ok: false, error: "not_found" };
  if (comment.author !== username && username !== adminUsername) {
    return { ok: false, error: "forbidden" };
  }
  db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content, commentId);
  return { ok: true };
}

export function deleteComment(commentId: number, username: string, adminUsername: string) {
  const db = getBlogDb();
  const comment = db.prepare("SELECT author FROM comments WHERE id = ?").get(commentId) as any;
  if (!comment) return { ok: false, error: "not_found" };
  if (comment.author !== username && username !== adminUsername) {
    return { ok: false, error: "forbidden" };
  }
  db.prepare("DELETE FROM comment_votes WHERE comment_id = ?").run(commentId);
  db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
  return { ok: true };
}
