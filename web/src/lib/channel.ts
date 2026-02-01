import { getChannelDb, getUsersDb } from "./db";

type UserRow = { id?: number; username: string; nickname?: string; avatar_url?: string; is_bot?: boolean | number };

function getUserMapById(userIds: number[]) {
  const unique = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  const map = new Map<number, UserRow>();
  if (unique.length === 0) return map;
  const usersDb = getUsersDb();
  const placeholders = unique.map(() => "?").join(",");
  const rows = usersDb.prepare(`SELECT id, username, nickname, avatar_url, is_bot FROM users WHERE id IN (${placeholders})`).all(...unique) as any[];
  rows.forEach((row) => map.set(row.id, row));
  return map;
}

function getUserByUsername(username: string) {
  const usersDb = getUsersDb();
  return usersDb.prepare("SELECT id, username, nickname, avatar_url, is_bot FROM users WHERE username = ?").get(username) as any;
}

export function listServers() {
  const db = getChannelDb();
  return db.prepare("SELECT id, name, icon_url, owner_id, created_at FROM servers ORDER BY id ASC").all();
}

export function listCategories(serverId: number) {
  const db = getChannelDb();
  return db.prepare("SELECT id, server_id, name, position FROM categories WHERE server_id = ? ORDER BY position ASC").all(serverId);
}

export function listChannels(serverId?: number, categoryId?: number) {
  const db = getChannelDb();
  let sql = "SELECT id, server_id, category_id, name, description, type, message_count FROM channels";
  const params: any[] = [];

  if (serverId) {
    sql += " WHERE server_id = ?";
    params.push(serverId);
    if (categoryId) {
      sql += " AND category_id = ?";
      params.push(categoryId);
    }
  }

  sql += " ORDER BY position ASC, id ASC";
  return db.prepare(sql).all(...params);
}

export function getChannelById(id: number) {
  const db = getChannelDb();
  return db.prepare("SELECT id, name, description, created_at, message_count FROM channels WHERE id = ?").get(id);
}

export function listMessages(channelId: number, page = 1, pageSize = 50) {
  const db = getChannelDb();
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT id, channel_id, user_id, username, user_avatar, content, created_at
    FROM messages
    WHERE channel_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(channelId, pageSize, offset) as any[];

  const userMap = getUserMapById(rows.map((r) => r.user_id));
  rows.forEach((row) => {
    const user = row.user_id ? userMap.get(row.user_id) : null;
    row.user_avatar = user?.avatar_url || row.user_avatar || "";
    row.username = user?.nickname || row.username;
    row.is_bot = !!user?.is_bot;
  });

  return rows;
}

export function postMessage(channelId: number, username: string, content: string) {
  const db = getChannelDb();
  const user = getUserByUsername(username) as any;
  if (!user) return null;
  const nickname = user.nickname || user.username;
  db.prepare("INSERT INTO messages (channel_id, user_id, username, user_avatar, content) VALUES (?, ?, ?, ?, ?)")
    .run(channelId, user.id, nickname, user.avatar_url, content);
  db.prepare("UPDATE channels SET message_count = message_count + 1 WHERE id = ?").run(channelId);
  const row = db.prepare("SELECT id, channel_id, user_id, username, user_avatar, content, created_at FROM messages WHERE rowid = last_insert_rowid()").get();
  return row;
}

export function deleteMessage(messageId: number, username: string) {
  const db = getChannelDb();
  const row = db.prepare("SELECT channel_id, user_id, username FROM messages WHERE id = ?").get(messageId) as any;
  if (!row) return { ok: false, error: "not_found" };
  const user = row.user_id ? getUsersDb().prepare("SELECT username FROM users WHERE id = ?").get(row.user_id) as any : null;
  const isAdmin = username === "witw";
  if (!isAdmin && username !== (user?.username || row.username)) {
    return { ok: false, error: "forbidden" };
  }
  db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  db.prepare("UPDATE channels SET message_count = message_count - 1 WHERE id = ?").run(row.channel_id);
  return { ok: true };
}

export function listServerMembers(serverId: number) {
  const db = getChannelDb();
  const members = db.prepare("SELECT user_id, nickname, joined_at FROM server_members WHERE server_id = ?").all(serverId) as any[];
  if (members.length === 0) return [];

  const userMap = getUserMapById(members.map(m => m.user_id));
  return members.map(m => {
    const user = userMap.get(m.user_id);
    return {
      user_id: m.user_id,
      username: user?.username || "Unknown",
      nickname: m.nickname || user?.nickname || user?.username || "Unknown",
      avatar_url: user?.avatar_url || "",
      joined_at: m.joined_at
    };
  });
}

export function createChannel(name: string, description = "", serverId?: number, categoryId?: number) {
  const db = getChannelDb();
  const cleanName = String(name || "").trim();
  if (!cleanName) return { ok: false, error: "name_required" };

  // Check if exists in the same server
  const exists = db.prepare("SELECT id FROM channels WHERE name = ? AND server_id = ?").get(cleanName, serverId);
  if (exists) return { ok: false, error: "exists" };

  db.prepare("INSERT INTO channels (name, description, server_id, category_id, message_count) VALUES (?, ?, ?, ?, 0)")
    .run(cleanName, description || "", serverId || null, categoryId || null);

  const row = db.prepare("SELECT id, name, description, server_id, category_id, created_at, message_count FROM channels WHERE rowid = last_insert_rowid()").get();
  return { ok: true, channel: row };
}
export function createServer(name: string, ownerId: number, iconUrl?: string) {
  const db = getChannelDb();
  const cleanName = String(name || "").trim();
  if (!cleanName) return { ok: false, error: "name_required" };

  try {
    const res = db.prepare("INSERT INTO servers (name, owner_id, icon_url) VALUES (?, ?, ?)")
      .run(cleanName, ownerId, iconUrl || null);
    const serverId = res.lastInsertRowid as number;

    // 1. Create default categories
    const catTextRes = db.prepare("INSERT INTO categories (server_id, name, position) VALUES (?, ?, ?)")
      .run(serverId, "文字频道", 1);
    db.prepare("INSERT INTO categories (server_id, name, position) VALUES (?, ?, ?)")
      .run(serverId, "语音频道", 2);

    // 2. Create initial channel in the first category
    db.prepare("INSERT INTO channels (name, server_id, category_id, type) VALUES (?, ?, ?, ?)")
      .run("综合", serverId, catTextRes.lastInsertRowid, "text");

    // 3. Auto-join owner as a member
    db.prepare("INSERT OR IGNORE INTO server_members (server_id, user_id, nickname) VALUES (?, ?, ?)")
      .run(serverId, ownerId, null);

    const row = db.prepare("SELECT id, name, icon_url, owner_id, created_at FROM servers WHERE id = ?").get(serverId);
    return { ok: true, server: row };
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint failed")) {
      return { ok: false, error: "exists" };
    }
    throw err;
  }
}
