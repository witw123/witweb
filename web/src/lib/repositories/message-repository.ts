/**
 */

import type Database from "better-sqlite3";
import { BaseRepository, type QueryOptions, type PaginatedResult } from "./base-repository";
import { getMessagesDb, getUsersDb } from "@/lib/db";
import { ApiError, ErrorCode } from "@/lib/api-error";
import type { Conversation, PrivateMessage, ConversationListItem, ConversationOtherUser } from "@/types";

/**
 */
export interface SendMessageData {
  sender: string;
  receiver: string;
  content: string;
}

/**
 */
export interface CreateConversationData {
  user1: string;
  user2: string;
  last_message?: string;
}

/**
 */
export class MessageRepository extends BaseRepository<PrivateMessage, number> {
  protected readonly tableName = "private_messages";
  protected readonly primaryKey = "id";

  protected getDb(options?: QueryOptions): Database {
    return options?.db || getMessagesDb();
  }


  /**
   */
  getOrCreateConversation(user1: string, user2: string, options?: QueryOptions): { id: number; isNew: boolean } {
    const db = this.getDb(options);
    
    const normalizedUser1 = user1 < user2 ? user1 : user2;
    const normalizedUser2 = user1 < user2 ? user2 : user1;

    const existing = db.prepare("SELECT id FROM conversations WHERE user1 = ? AND user2 = ?")
      .get(normalizedUser1, normalizedUser2) as { id: number } | undefined;

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    const sql = `
      INSERT INTO conversations (user1, user2, last_message, last_time)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `;
    const result = db.prepare(sql).run(normalizedUser1, normalizedUser2, "");
    return { id: Number(result.lastInsertRowid), isNew: true };
  }

  /**
   */
  getConversationById(id: number, options?: QueryOptions): Conversation | null {
    const sql = `SELECT * FROM conversations WHERE id = ?`;
    return this.queryOne<Conversation>(sql, [id], options);
  }

  /**
   */
  canAccessConversation(conversationId: number, username: string, options?: QueryOptions): boolean {
    const sql = `SELECT 1 FROM conversations WHERE id = ? AND (user1 = ? OR user2 = ?)`;
    const result = this.queryOne<Record<string, unknown>>(sql, [conversationId, username, username], options);
    return !!result;
  }

  /**
   */
  getConversations(username: string, options?: QueryOptions): Conversation[] {
    const sql = `
      SELECT * FROM conversations 
      WHERE user1 = ? OR user2 = ? 
      ORDER BY last_time DESC
    `;
    return this.query<Conversation>(sql, [username, username], options);
  }

  /**
   */
  getConversationList(username: string, options?: QueryOptions): ConversationListItem[] {
    const db = this.getDb(options);
    const usersDb = getUsersDb();

    const convs = db.prepare(`
      SELECT * FROM conversations 
      WHERE user1 = ? OR user2 = ? 
      ORDER BY last_time DESC
    `).all(username, username) as Conversation[];

    return convs.map(conv => {
      const otherUsername = conv.user1 === username ? conv.user2 : conv.user1;
      const otherUser = usersDb.prepare("SELECT username, nickname, avatar_url FROM users WHERE username = ?")
        .get(otherUsername) as ConversationOtherUser | undefined;

      return {
        id: conv.id,
        user1: conv.user1,
        user2: conv.user2,
        last_message: conv.last_message || "",
        last_time: conv.last_time || "",
        unread_count: conv.user1 === username ? conv.unread_count_user1 : conv.unread_count_user2,
        other_user: {
          username: otherUser?.username || otherUsername,
          nickname: otherUser?.nickname || otherUsername,
          avatar_url: otherUser?.avatar_url || "",
        },
      };
    });
  }

  /**
   */
  updateLastMessage(conversationId: number, message: string, options?: QueryOptions): boolean {
    const sql = `
      UPDATE conversations 
      SET last_message = ?, last_time = datetime('now', 'localtime')
      WHERE id = ?
    `;
    const result = this.run(sql, [message, conversationId], options);
    return result.changes > 0;
  }

  /**
   */
  incrementUnread(conversationId: number, forUser: string, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    const conv = this.getConversationById(conversationId, options);
    if (!conv) return false;

    const field = conv.user1 === forUser ? "unread_count_user1" : "unread_count_user2";
    const sql = `UPDATE conversations SET ${field} = ${field} + 1 WHERE id = ?`;
    const result = db.prepare(sql).run(conversationId);
    return result.changes > 0;
  }

  /**
   */
  resetUnread(conversationId: number, forUser: string, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    const conv = this.getConversationById(conversationId, options);
    if (!conv) return false;

    const field = conv.user1 === forUser ? "unread_count_user1" : "unread_count_user2";
    const sql = `UPDATE conversations SET ${field} = 0 WHERE id = ?`;
    const result = db.prepare(sql).run(conversationId);
    return result.changes > 0;
  }

  /**
   */
  deleteConversation(id: number, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    return db.transaction(() => {
      db.prepare("DELETE FROM private_messages WHERE conversation_id = ?").run(id);
      const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
      return result.changes > 0;
    })();
  }


  /**
   */
  sendMessage(data: SendMessageData, options?: QueryOptions): { conversationId: number; messageId: number } {
    const db = this.getDb(options);
    const usersDb = getUsersDb();

    return db.transaction(() => {
      const receiverExists = usersDb.prepare("SELECT 1 FROM users WHERE username = ?").get(data.receiver);
      if (!receiverExists) {
        throw new ApiError(ErrorCode.USER_NOT_FOUND, "鎺ユ敹鑰呬笉瀛樺湪");
      }

      const { id: conversationId } = this.getOrCreateConversation(data.sender, data.receiver, { db });

      this.updateLastMessage(conversationId, data.content, { db });

      this.incrementUnread(conversationId, data.receiver, { db });

      const sql = `
        INSERT INTO private_messages (conversation_id, sender, receiver, content, is_read, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now', 'localtime'))
      `;
      const result = db.prepare(sql).run(conversationId, data.sender, data.receiver, data.content);
      const messageId = Number(result.lastInsertRowid);

      return { conversationId, messageId };
    })();
  }

  /**
   */
  getMessagesByConversation(conversationId: number, options?: QueryOptions): PrivateMessage[] {
    const sql = `
      SELECT * FROM private_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `;
    return this.query<PrivateMessage>(sql, [conversationId], options);
  }

  /**
   */
  getMessagesAndMarkAsRead(
    conversationId: number,
    username: string,
    options?: QueryOptions
  ): PrivateMessage[] {
    const db = this.getDb(options);

    return db.transaction(() => {
      if (!this.canAccessConversation(conversationId, username, { db })) {
        throw new ApiError(ErrorCode.FORBIDDEN, "无权访问此对话");
      }

      db.prepare(`
        UPDATE private_messages 
        SET is_read = 1 
        WHERE conversation_id = ? AND receiver = ?
      `).run(conversationId, username);

      this.resetUnread(conversationId, username, { db });

      return db.prepare(`
        SELECT * FROM private_messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
      `).all(conversationId) as PrivateMessage[];
    })();
  }

  /**
   */
  getMessagesPaginated(
    conversationId: number,
    page = 1,
    size = 20,
    options?: QueryOptions
  ): PaginatedResult<PrivateMessage> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);

    const total = (db.prepare("SELECT COUNT(*) AS cnt FROM private_messages WHERE conversation_id = ?")
      .get(conversationId) as { cnt: number })?.cnt || 0;

    const sql = `
      SELECT * FROM private_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(sql).all(conversationId, validSize, offset) as PrivateMessage[];

    items.reverse();

    return { items, total, page: validPage, size: validSize };
  }

  /**
   */
  markAsRead(messageId: number, options?: QueryOptions): boolean {
    const sql = `UPDATE private_messages SET is_read = 1 WHERE id = ?`;
    const result = this.run(sql, [messageId], options);
    return result.changes > 0;
  }

  /**
   */
  markConversationAsRead(conversationId: number, username: string, options?: QueryOptions): number {
    const sql = `
      UPDATE private_messages 
      SET is_read = 1 
      WHERE conversation_id = ? AND receiver = ?
    `;
    const result = this.run(sql, [conversationId, username], options);
    return result.changes;
  }

  /**
   */
  deleteMessage(messageId: number, username: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM private_messages WHERE id = ? AND (sender = ? OR receiver = ?)`;
    const result = this.run(sql, [messageId, username, username], options);
    return result.changes > 0;
  }


  /**
   */
  getTotalUnread(username: string, options?: QueryOptions): number {
    const db = this.getDb(options);
    
    const sql = `
      SELECT SUM(CASE WHEN user1 = ? THEN unread_count_user1 ELSE unread_count_user2 END) as total
      FROM conversations
      WHERE user1 = ? OR user2 = ?
    `;
    const result = db.prepare(sql).get(username, username, username) as { total: number };
    return result?.total || 0;
  }

  /**
   */
  getUnreadInConversation(conversationId: number, username: string, options?: QueryOptions): number {
    const conv = this.getConversationById(conversationId, options);
    if (!conv) return 0;
    
    return conv.user1 === username ? conv.unread_count_user1 : conv.unread_count_user2;
  }

  /**
   */
  getUnreadMessages(username: string, options?: QueryOptions): PrivateMessage[] {
    const sql = `
      SELECT * FROM private_messages 
      WHERE receiver = ? AND is_read = 0
      ORDER BY created_at DESC
    `;
    return this.query<PrivateMessage>(sql, [username], options);
  }


  /**
   */
  getUserStats(username: string, options?: QueryOptions): {
    total_sent: number;
    total_received: number;
    unread: number;
    conversations: number;
  } {
    const db = this.getDb(options);

    const totalSent = (db.prepare("SELECT COUNT(*) AS cnt FROM private_messages WHERE sender = ?")
      .get(username) as { cnt: number })?.cnt || 0;
    const totalReceived = (db.prepare("SELECT COUNT(*) AS cnt FROM private_messages WHERE receiver = ?")
      .get(username) as { cnt: number })?.cnt || 0;
    const unread = (db.prepare("SELECT COUNT(*) AS cnt FROM private_messages WHERE receiver = ? AND is_read = 0")
      .get(username) as { cnt: number })?.cnt || 0;
    const conversations = (db.prepare("SELECT COUNT(*) AS cnt FROM conversations WHERE user1 = ? OR user2 = ?")
      .get(username, username) as { cnt: number })?.cnt || 0;

    return {
      total_sent: totalSent,
      total_received: totalReceived,
      unread,
      conversations,
    };
  }

  /**
   */
  getRecentMessages(username: string, limit = 10, options?: QueryOptions): PrivateMessage[] {
    const sql = `
      SELECT * FROM private_messages 
      WHERE sender = ? OR receiver = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return this.query<PrivateMessage>(sql, [username, username, limit], options);
  }

  /**
   */
  getLastMessageWith(otherUser: string, currentUser: string, options?: QueryOptions): PrivateMessage | null {
    const db = this.getDb(options);
    
    const sql = `
      SELECT pm.* FROM private_messages pm
      INNER JOIN conversations c ON pm.conversation_id = c.id
      WHERE ((c.user1 = ? AND c.user2 = ?) OR (c.user1 = ? AND c.user2 = ?))
      AND (pm.sender = ? OR pm.receiver = ?)
      ORDER BY pm.created_at DESC
      LIMIT 1
    `;
    return db.prepare(sql).get(currentUser, otherUser, otherUser, currentUser, currentUser, otherUser) as PrivateMessage | null;
  }
}

export const messageRepository = new MessageRepository();
