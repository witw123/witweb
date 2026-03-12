/**
 * 私信消息仓储层
 *
 * 负责会话创建、消息收发、未读计数和消息统计。
 * 会话和消息存在强关联，因此多数写操作都在事务里完成，确保最后一条消息与未读数同步更新。
 */

import { ApiError, ErrorCode } from "@/lib/api-error";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Conversation, ConversationListItem, ConversationOtherUser, PrivateMessage } from "@/types";
import type { PaginatedResult } from "./types";

export interface SendMessageData {
  sender: string;
  receiver: string;
  content: string;
}

export interface CreateConversationData {
  user1: string;
  user2: string;
  last_message?: string;
}

/** 规范化分页参数，避免超大 size 直接打穿查询。 */
function normalizePagination(page = 1, size = 20): { page: number; size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}

export class MessageRepository {
  /**
   * 获取或创建会话
   *
   * 先对用户名排序，保证任意两人之间只会有一条会话记录。
   */
  async getOrCreateConversation(user1: string, user2: string): Promise<{ id: number; isNew: boolean }> {
    const normalizedUser1 = user1 < user2 ? user1 : user2;
    const normalizedUser2 = user1 < user2 ? user2 : user1;
    const existing = await pgQueryOne<{ id: number }>(
      "SELECT id FROM conversations WHERE user1 = ? AND user2 = ?",
      [normalizedUser1, normalizedUser2]
    );
    if (existing) return { id: existing.id, isNew: false };

    const row = await pgQueryOne<{ id: number }>(
      `
      INSERT INTO conversations (user1, user2, last_message, last_time)
      VALUES (?, ?, ?, NOW())
      RETURNING id
      `,
      [normalizedUser1, normalizedUser2, ""]
    );
    return { id: Number(row?.id || 0), isNew: true };
  }

  async getConversationById(id: number): Promise<Conversation | null> {
    return await pgQueryOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [id]);
  }

  /** 校验当前用户是否有权访问指定会话。 */
  async canAccessConversation(conversationId: number, username: string): Promise<boolean> {
    const row = await pgQueryOne<{ id: number }>(
      "SELECT id FROM conversations WHERE id = ? AND (user1 = ? OR user2 = ?) LIMIT 1",
      [conversationId, username, username]
    );
    return !!row;
  }

  async getConversations(username: string): Promise<Conversation[]> {
    return await pgQuery<Conversation>(
      "SELECT * FROM conversations WHERE user1 = ? OR user2 = ? ORDER BY last_time DESC",
      [username, username]
    );
  }

  /** 查询会话列表，并补齐对方用户资料供前端直接展示。 */
  async getConversationList(username: string): Promise<ConversationListItem[]> {
    const rows = await pgQuery<
      Conversation & {
        other_username: string;
        other_nickname: string | null;
        other_avatar_url: string | null;
      }
    >(
      `
      SELECT
        c.*, 
        CASE WHEN c.user1 = ? THEN c.user2 ELSE c.user1 END AS other_username,
        u.nickname AS other_nickname,
        u.avatar_url AS other_avatar_url
      FROM conversations c
      LEFT JOIN users u ON u.username = CASE WHEN c.user1 = ? THEN c.user2 ELSE c.user1 END
      WHERE c.user1 = ? OR c.user2 = ?
      ORDER BY c.last_time DESC
      `,
      [username, username, username, username]
    );

    return rows.map((conv) => {
      const otherUser: ConversationOtherUser = {
        username: conv.other_username,
        nickname: conv.other_nickname || conv.other_username,
        avatar_url: conv.other_avatar_url || "",
      };
      return {
        id: conv.id,
        user1: conv.user1,
        user2: conv.user2,
        last_message: conv.last_message || "",
        last_time: conv.last_time || "",
        unread_count: conv.user1 === username ? conv.unread_count_user1 : conv.unread_count_user2,
        other_user: otherUser,
      };
    });
  }

  async updateLastMessage(conversationId: number, message: string): Promise<boolean> {
    const result = await pgRun(
      "UPDATE conversations SET last_message = ?, last_time = NOW() WHERE id = ?",
      [message, conversationId]
    );
    return result.changes > 0;
  }

  async incrementUnread(conversationId: number, forUser: string): Promise<boolean> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return false;
    const field = conv.user1 === forUser ? "unread_count_user1" : "unread_count_user2";
    const result = await pgRun(`UPDATE conversations SET ${field} = ${field} + 1 WHERE id = ?`, [conversationId]);
    return result.changes > 0;
  }

  async resetUnread(conversationId: number, forUser: string): Promise<boolean> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return false;
    const field = conv.user1 === forUser ? "unread_count_user1" : "unread_count_user2";
    const result = await pgRun(`UPDATE conversations SET ${field} = 0 WHERE id = ?`, [conversationId]);
    return result.changes > 0;
  }

  /** 删除会话时同步删除其消息，保持数据完整。 */
  async deleteConversation(id: number): Promise<boolean> {
    return await withPgTransaction<boolean>(async (client) => {
      await pgRun("DELETE FROM private_messages WHERE conversation_id = ?", [id], client);
      const result = await pgRun("DELETE FROM conversations WHERE id = ?", [id], client);
      return result.changes > 0;
    });
  }

  /**
   * 发送私信
   *
   * 会在同一事务中完成：校验接收者、创建/获取会话、写入消息、更新最后消息和未读数。
   */
  async sendMessage(data: SendMessageData): Promise<{ conversationId: number; messageId: number }> {
    return await withPgTransaction(async (client) => {
      const receiverExists = await pgQueryOne<{ username: string }>("SELECT username FROM users WHERE username = ?", [data.receiver], client);
      if (!receiverExists) {
        throw new ApiError(ErrorCode.USER_NOT_FOUND, "接收者不存在");
      }

      const normalizedUser1 = data.sender < data.receiver ? data.sender : data.receiver;
      const normalizedUser2 = data.sender < data.receiver ? data.receiver : data.sender;
      let conversationId =
        (await pgQueryOne<{ id: number }>("SELECT id FROM conversations WHERE user1 = ? AND user2 = ?", [normalizedUser1, normalizedUser2], client))
          ?.id || 0;
      if (!conversationId) {
        conversationId =
          (
            await pgQueryOne<{ id: number }>(
              "INSERT INTO conversations (user1, user2, last_message, last_time) VALUES (?, ?, ?, NOW()) RETURNING id",
              [normalizedUser1, normalizedUser2, ""],
              client
            )
          )?.id || 0;
      }

      await pgRun("UPDATE conversations SET last_message = ?, last_time = NOW() WHERE id = ?", [data.content, conversationId], client);

      const conv = await pgQueryOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId], client);
      if (conv) {
        const unreadField = conv.user1 === data.receiver ? "unread_count_user1" : "unread_count_user2";
        await pgRun(`UPDATE conversations SET ${unreadField} = ${unreadField} + 1 WHERE id = ?`, [conversationId], client);
      }

      const messageId =
        (
          await pgQueryOne<{ id: number }>(
            `
            INSERT INTO private_messages (conversation_id, sender, receiver, content, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())
            RETURNING id
            `,
            [conversationId, data.sender, data.receiver, data.content],
            client
          )
        )?.id || 0;

      return { conversationId, messageId };
    });
  }

  async getMessagesByConversation(conversationId: number): Promise<PrivateMessage[]> {
    return await pgQuery<PrivateMessage>(
      "SELECT * FROM private_messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conversationId]
    );
  }

  /** 读取会话消息并顺手把当前用户收到的消息标记为已读。 */
  async getMessagesAndMarkAsRead(conversationId: number, username: string): Promise<PrivateMessage[]> {
    return await withPgTransaction(async (client) => {
      const canAccess = await this.canAccessConversation(conversationId, username);
      if (!canAccess) {
        throw new ApiError(ErrorCode.FORBIDDEN, "forbidden");
      }

      await pgRun(
        "UPDATE private_messages SET is_read = 1 WHERE conversation_id = ? AND receiver = ?",
        [conversationId, username],
        client
      );

      const conv = await pgQueryOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId], client);
      if (conv) {
        const field = conv.user1 === username ? "unread_count_user1" : "unread_count_user2";
        await pgRun(`UPDATE conversations SET ${field} = 0 WHERE id = ?`, [conversationId], client);
      }

      return await pgQuery<PrivateMessage>(
        "SELECT * FROM private_messages WHERE conversation_id = ? ORDER BY created_at ASC",
        [conversationId],
        client
      );
    });
  }

  /** 分页获取会话消息，并在返回前恢复为时间正序。 */
  async getMessagesPaginated(conversationId: number, page = 1, size = 20): Promise<PaginatedResult<PrivateMessage>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM private_messages WHERE conversation_id = ?", [conversationId]))
      ?.cnt || 0;
    const items = await pgQuery<PrivateMessage>(
      `
      SELECT * FROM private_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [conversationId, validSize, offset]
    );
    items.reverse();
    return { items, total, page: validPage, size: validSize };
  }

  async markAsRead(messageId: number): Promise<boolean> {
    const result = await pgRun("UPDATE private_messages SET is_read = 1 WHERE id = ?", [messageId]);
    return result.changes > 0;
  }

  async markConversationAsRead(conversationId: number, username: string): Promise<number> {
    const result = await pgRun(
      "UPDATE private_messages SET is_read = 1 WHERE conversation_id = ? AND receiver = ?",
      [conversationId, username]
    );
    return result.changes;
  }

  async deleteMessage(messageId: number, username: string): Promise<boolean> {
    const result = await pgRun(
      "DELETE FROM private_messages WHERE id = ? AND (sender = ? OR receiver = ?)",
      [messageId, username, username]
    );
    return result.changes > 0;
  }

  /** 汇总当前用户在所有会话中的未读总数。 */
  async getTotalUnread(username: string): Promise<number> {
    const row = await pgQueryOne<{ total: number }>(
      `
      SELECT COALESCE(SUM(CASE WHEN user1 = ? THEN unread_count_user1 ELSE unread_count_user2 END), 0)::int as total
      FROM conversations
      WHERE user1 = ? OR user2 = ?
      `,
      [username, username, username]
    );
    return row?.total || 0;
  }

  async getUnreadInConversation(conversationId: number, username: string): Promise<number> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return 0;
    return conv.user1 === username ? conv.unread_count_user1 : conv.unread_count_user2;
  }

  async getUnreadMessages(username: string): Promise<PrivateMessage[]> {
    return await pgQuery<PrivateMessage>(
      "SELECT * FROM private_messages WHERE receiver = ? AND is_read = 0 ORDER BY created_at DESC",
      [username]
    );
  }

  /** 提供个人中心所需的私信统计汇总。 */
  async getUserStats(
    username: string
  ): Promise<{ total_sent: number; total_received: number; unread: number; conversations: number }> {
    const totalSent = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM private_messages WHERE sender = ?", [username]))?.cnt || 0;
    const totalReceived =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM private_messages WHERE receiver = ?", [username]))?.cnt || 0;
    const unread =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM private_messages WHERE receiver = ? AND is_read = 0", [username]))?.cnt || 0;
    const conversations =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM conversations WHERE user1 = ? OR user2 = ?", [username, username]))?.cnt || 0;
    return { total_sent: totalSent, total_received: totalReceived, unread, conversations };
  }

  async getRecentMessages(username: string, limit = 10): Promise<PrivateMessage[]> {
    return await pgQuery<PrivateMessage>(
      "SELECT * FROM private_messages WHERE sender = ? OR receiver = ? ORDER BY created_at DESC LIMIT ?",
      [username, username, limit]
    );
  }

  /** 获取与指定用户最近的一条消息。 */
  async getLastMessageWith(otherUser: string, currentUser: string): Promise<PrivateMessage | null> {
    return await pgQueryOne<PrivateMessage>(
      `
      SELECT pm.* FROM private_messages pm
      INNER JOIN conversations c ON pm.conversation_id = c.id
      WHERE ((c.user1 = ? AND c.user2 = ?) OR (c.user1 = ? AND c.user2 = ?))
        AND (pm.sender = ? OR pm.receiver = ?)
      ORDER BY pm.created_at DESC
      LIMIT 1
      `,
      [currentUser, otherUser, otherUser, currentUser, currentUser, otherUser]
    );
  }
}

export const messageRepository = new MessageRepository();
