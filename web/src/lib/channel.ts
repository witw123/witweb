import { getChannelDb, getUsersDb } from "./db";

type UserRow = { id?: number; username: string; nickname?: string; avatar_url?: string };

function getUserMapById(userIds: number[]) {
  const unique = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  const map = new Map<number, UserRow>();
  if (unique.length === 0) return map;
  const usersDb = getUsersDb();
  const placeholders = unique.map(() => "?").join(",");
  const rows = usersDb.prepare(`SELECT id, username, nickname, avatar_url FROM users WHERE id IN (${placeholders})`).all(...unique) as any[];
  rows.forEach((row) => map.set(row.id, row));
  return map;
}

function getUserByUsername(username: string) {
  const usersDb = getUsersDb();
  return usersDb.prepare("SELECT id, username, nickname, avatar_url FROM users WHERE username = ?").get(username) as any;
}

export function listChannels() {
  const db = getChannelDb();
  return db.prepare("SELECT id, name, description, created_at, message_count FROM channels ORDER BY id ASC").all();
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

export function createChannel(name: string, description = "") {
  const db = getChannelDb();
  const cleanName = String(name || "").trim();
  if (!cleanName) return { ok: false, error: "name_required" };
  const exists = db.prepare("SELECT id FROM channels WHERE name = ?").get(cleanName);
  if (exists) return { ok: false, error: "exists" };
  db.prepare("INSERT INTO channels (name, description, message_count) VALUES (?, ?, 0)")
    .run(cleanName, description || "");
  const row = db.prepare("SELECT id, name, description, created_at, message_count FROM channels WHERE rowid = last_insert_rowid()").get();
  return { ok: true, channel: row };
}
