import { getMessagesDb, getUsersDb } from "./db";

export interface Conversation {
  id: number;
  user1: string;
  user2: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  other_user: {
    username: string;
    nickname: string;
    avatar_url: string;
  };
}

export interface PrivateMessage {
  id: number;
  conversation_id: number;
  sender: string;
  receiver: string;
  content: string;
  is_read: number;
  created_at: string;
}

export function sendMessage(sender: string, receiver: string, content: string) {
  const db = getMessagesDb();
  const usersDb = getUsersDb();

  // Validate receiver
  const receiverData = usersDb.prepare("SELECT username FROM users WHERE username = ?").get(receiver);
  if (!receiverData) throw new Error("Receiver not found");

  // Ensure conversation exists
  const u1 = sender < receiver ? sender : receiver;
  const u2 = sender < receiver ? receiver : sender;

  db.prepare(`
    INSERT INTO conversations (user1, user2, last_message, last_time)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(user1, user2) DO UPDATE SET
      last_message = excluded.last_message,
      last_time = excluded.last_time
  `).run(u1, u2, content);

  const conv = db.prepare("SELECT id FROM conversations WHERE user1 = ? AND user2 = ?").get(u1, u2) as { id: number };

  // Increment unread count for receiver
  if (u1 === receiver) {
    db.prepare("UPDATE conversations SET unread_count_user1 = unread_count_user1 + 1 WHERE id = ?").run(conv.id);
  } else {
    db.prepare("UPDATE conversations SET unread_count_user2 = unread_count_user2 + 1 WHERE id = ?").run(conv.id);
  }

  // Insert message
  db.prepare(`
    INSERT INTO private_messages (conversation_id, sender, receiver, content)
    VALUES (?, ?, ?, ?)
  `).run(conv.id, sender, receiver, content);

  return { conversation_id: conv.id };
}

export function getConversations(username: string): Conversation[] {
  const db = getMessagesDb();
  const usersDb = getUsersDb();

  const convs = db.prepare(`
    SELECT * FROM conversations 
    WHERE user1 = ? OR user2 = ? 
    ORDER BY last_time DESC
  `).all(username, username) as any[];

  return convs.map(c => {
    const otherUsername = c.user1 === username ? c.user2 : c.user1;
    const otherUser = usersDb.prepare("SELECT username, nickname, avatar_url FROM users WHERE username = ?").get(otherUsername) as any;

    return {
      id: c.id,
      user1: c.user1,
      user2: c.user2,
      last_message: c.last_message,
      last_time: c.last_time,
      unread_count: c.user1 === username ? c.unread_count_user1 : c.unread_count_user2,
      other_user: {
        username: otherUser?.username || otherUsername,
        nickname: otherUser?.nickname || otherUsername,
        avatar_url: otherUser?.avatar_url || ""
      }
    };
  });
}

export function getMessages(conversationId: number, username: string): PrivateMessage[] {
  const db = getMessagesDb();

  // Verify ownership
  const conv = db.prepare("SELECT user1, user2 FROM conversations WHERE id = ?").get(conversationId) as any;
  if (!conv || (conv.user1 !== username && conv.user2 !== username)) {
    throw new Error("Access denied");
  }

  // Mark as read when fetching
  db.prepare(`
    UPDATE private_messages 
    SET is_read = 1 
    WHERE conversation_id = ? AND receiver = ?
  `).run(conversationId, username);

  // Reset unread count
  if (conv.user1 === username) {
    db.prepare("UPDATE conversations SET unread_count_user1 = 0 WHERE id = ?").run(conversationId);
  } else {
    db.prepare("UPDATE conversations SET unread_count_user2 = 0 WHERE id = ?").run(conversationId);
  }

  return db.prepare(`
    SELECT * FROM private_messages 
    WHERE conversation_id = ? 
    ORDER BY created_at ASC
  `).all(conversationId) as PrivateMessage[];
}

export function getUnreadTotal(username: string): number {
  const db = getMessagesDb();
  const row = db.prepare(`
    SELECT SUM(CASE WHEN user1 = ? THEN unread_count_user1 ELSE unread_count_user2 END) as total
    FROM conversations
    WHERE user1 = ? OR user2 = ?
  `).get(username, username, username) as { total: number };
  return row?.total || 0;
}
