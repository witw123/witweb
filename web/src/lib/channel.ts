import { getDb } from "./db";

export function listChannels() {
  const db = getDb();
  return db.prepare("SELECT id, name, description, created_at, message_count FROM channels ORDER BY id ASC").all();
}

export function getChannelById(id: number) {
  const db = getDb();
  return db.prepare("SELECT id, name, description, created_at, message_count FROM channels WHERE id = ?").get(id);
}

export function listMessages(channelId: number, page = 1, pageSize = 50) {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  return db.prepare(`
    SELECT id, channel_id, user_id, username, user_avatar, content, created_at
    FROM messages
    WHERE channel_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(channelId, pageSize, offset);
}

export function postMessage(channelId: number, username: string, content: string) {
  const db = getDb();
  const user = db.prepare("SELECT id, username, nickname, avatar_url FROM users WHERE username = ?").get(username) as any;
  if (!user) return null;
  const nickname = user.nickname || user.username;
  db.prepare("INSERT INTO messages (channel_id, user_id, username, user_avatar, content) VALUES (?, ?, ?, ?, ?)")
    .run(channelId, user.id, nickname, user.avatar_url, content);
  db.prepare("UPDATE channels SET message_count = message_count + 1 WHERE id = ?").run(channelId);
  const row = db.prepare("SELECT id, channel_id, user_id, username, user_avatar, content, created_at FROM messages WHERE rowid = last_insert_rowid()").get();
  return row;
}

export function deleteMessage(messageId: number, username: string) {
  const db = getDb();
  const row = db.prepare("SELECT channel_id, user_id, username FROM messages WHERE id = ?").get(messageId) as any;
  if (!row) return { ok: false, error: "not_found" };
  const author = db.prepare("SELECT username FROM users WHERE id = ?").get(row.user_id) as any;
  const isAdmin = username === "witw";
  if (!isAdmin && username !== (author?.username || row.username)) {
    return { ok: false, error: "forbidden" };
  }
  db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  db.prepare("UPDATE channels SET message_count = message_count - 1 WHERE id = ?").run(row.channel_id);
  return { ok: true };
}
