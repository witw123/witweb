import { getDb } from "./db";

export function listPosts(page = 1, size = 10, query = "", author = "", tag = "", username = "") {
  const db = getDb();
  page = Math.max(1, page);
  size = Math.max(1, Math.min(50, size));
  const filters = [] as string[];
  const params: any[] = [];
  if (query) {
    filters.push("p.title LIKE ?");
    params.push(`%${query}%`);
  }
  if (author) {
    filters.push("p.author = ?");
    params.push(author);
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
      COALESCE(u.nickname, p.author) AS author_name,
      COALESCE(u.avatar_url, '') AS author_avatar,
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
    LEFT JOIN users u ON u.username = p.author
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, username || "", username || "", size, offset) as any[];
  return { items: rows, total, page, size };
}

export function getPost(slug: string, username = "") {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.content,
      p.created_at,
      p.author,
      p.tags,
      COALESCE(u.nickname, p.author) AS author_name,
      COALESCE(u.avatar_url, '') AS author_avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count
    FROM posts p
    LEFT JOIN users u ON u.username = p.author
    WHERE p.slug = ?
  `).get(slug) as any;
  if (!row) return null;
  if (username) {
    const liked = db.prepare("SELECT id FROM likes WHERE post_id = ? AND username = ?").get(row.id, username);
    const favorited = db.prepare("SELECT id FROM favorites WHERE post_id = ? AND username = ?").get(row.id, username);
    row.liked_by_me = !!liked;
    row.favorited_by_me = !!favorited;
  }
  return row;
}

export function createPost(title: string, slug: string | null, content: string, author: string, tags = "") {
  const db = getDb();
  const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(title);
  const unique = ensureUniqueSlug(db, finalSlug);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO posts (title, slug, content, created_at, updated_at, author, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(title, unique, content, now, now, author, tags, "published");
  return unique;
}

export function updatePost(slug: string, title: string, content: string, tags: string, username: string) {
  const db = getDb();
  const row = db.prepare("SELECT author FROM posts WHERE slug = ?").get(slug) as any;
  if (!row) return { ok: false, error: "not_found" };
  if (row.author !== username) return { ok: false, error: "forbidden" };
  db.prepare("UPDATE posts SET title = ?, content = ?, tags = ?, updated_at = ? WHERE slug = ?")
    .run(title, content, tags, new Date().toISOString(), slug);
  return { ok: true };
}

export function deletePost(slug: string, username: string, adminUsername: string) {
  const db = getDb();
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
  const db = getDb();
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
      COALESCE(u.nickname, c.author) AS author_name,
      COALESCE(u.avatar_url, '') AS author_avatar,
      (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
      (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
    FROM comments c
    LEFT JOIN users u ON u.username = c.author
    WHERE c.post_id = ?
    ORDER BY c.id DESC
  `).all(post.id) as any[];
  return rows;
}

export function addComment(slug: string, author: string, content: string, parentId: number | null, ip: string) {
  const db = getDb();
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as any;
  if (!post) return { ok: false, error: "not_found" };
  db.prepare("INSERT INTO comments (post_id, author, content, created_at, parent_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)")
    .run(post.id, author, content, new Date().toISOString(), parentId, ip);
  return { ok: true };
}

export function toggleLike(slug: string, username: string, value: 1 | -1) {
  const db = getDb();
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
  const db = getDb();
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
  const db = getDb();
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
      COALESCE(u.nickname, p.author) AS author_name,
      COALESCE(u.avatar_url, '') AS author_avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorite_count,
      1 AS favorited_by_me
    FROM favorites fav
    JOIN posts p ON p.id = fav.post_id
    LEFT JOIN users u ON u.username = p.author
    WHERE fav.username = ?
    ORDER BY fav.created_at DESC
    LIMIT ? OFFSET ?
  `).all(username, size, offset) as any[];
  return { items: rows, total, page, size };
}

export function voteComment(commentId: number, username: string, value: 1 | -1) {
  const db = getDb();
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
  const db = getDb();
  const row = db.prepare("SELECT post_id FROM comments WHERE id = ?").get(commentId) as any;
  if (!row) return "";
  const post = db.prepare("SELECT slug FROM posts WHERE id = ?").get(row.post_id) as any;
  return post?.slug || "";
}

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureUniqueSlug(db: ReturnType<typeof getDb>, base: string) {
  let slug = base || "post";
  let i = 1;
  while (db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}
