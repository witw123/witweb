/**
 * 私信消息数据仓库（Drizzle 实现）
 *
 * 负责私信和会话的数据库操作
 */

import { and, asc, eq, or, sql } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { getDb } from "@/lib/db/drizzle";
import { conversations, privateMessages, users } from "@/lib/db/schema";
import type {
  Conversation,
  ConversationListItem,
  ConversationOtherUser,
  PrivateMessage,
} from "@/types";

/**
 * 私信消息数据仓库（Drizzle 实现）
 */
export class DrizzleMessageRepository {
  /**
   * 获取用户的会话列表
   *
   * @param {string} username - 用户名
   * @returns {Promise<ConversationListItem[]>} 会话列表
   */
  async getConversationList(username: string): Promise<ConversationListItem[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: conversations.id,
        user1: conversations.user1,
        user2: conversations.user2,
        last_message: conversations.lastMessage,
        last_time: conversations.lastTime,
        unread_count_user1: conversations.unreadCountUser1,
        unread_count_user2: conversations.unreadCountUser2,
        other_username: users.username,
        other_nickname: users.nickname,
        other_avatar_url: users.avatarUrl,
      })
      .from(conversations)
      .leftJoin(
        users,
        or(
          and(eq(conversations.user1, username), eq(users.username, conversations.user2)),
          and(eq(conversations.user2, username), eq(users.username, conversations.user1))
        )
      )
      .where(or(eq(conversations.user1, username), eq(conversations.user2, username)))
      .orderBy(conversations.lastTime);

    return [...rows]
      .reverse()
      .map((conv) => {
        const otherUser: ConversationOtherUser = {
          username: conv.other_username || (conv.user1 === username ? conv.user2 : conv.user1),
          nickname:
            conv.other_nickname ||
            conv.other_username ||
            (conv.user1 === username ? conv.user2 : conv.user1),
          avatar_url: conv.other_avatar_url || "",
        };

        return {
          id: conv.id,
          user1: conv.user1,
          user2: conv.user2,
          last_message: conv.last_message || "",
          last_time: conv.last_time || "",
          unread_count:
            conv.user1 === username ? conv.unread_count_user1 : conv.unread_count_user2,
          other_user: otherUser,
        };
      });
  }

  async getConversationById(id: number): Promise<Conversation | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: conversations.id,
        user1: conversations.user1,
        user2: conversations.user2,
        last_message: conversations.lastMessage,
        last_time: conversations.lastTime,
        unread_count_user1: conversations.unreadCountUser1,
        unread_count_user2: conversations.unreadCountUser2,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async canAccessConversation(conversationId: number, username: string): Promise<boolean> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return false;
    return conversation.user1 === username || conversation.user2 === username;
  }

  async getMessagesAndMarkAsRead(conversationId: number, username: string): Promise<PrivateMessage[]> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const conversationRows = await tx
        .select({
          id: conversations.id,
          user1: conversations.user1,
          user2: conversations.user2,
          unread_count_user1: conversations.unreadCountUser1,
          unread_count_user2: conversations.unreadCountUser2,
        })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const conversation = conversationRows[0];
      if (!conversation || (conversation.user1 !== username && conversation.user2 !== username)) {
        throw new ApiError(ErrorCode.FORBIDDEN, "forbidden");
      }

      await tx
        .update(privateMessages)
        .set({ isRead: 1 })
        .where(
          and(
            eq(privateMessages.conversationId, conversationId),
            eq(privateMessages.receiver, username)
          )
        );

      if (conversation.user1 === username) {
        await tx
          .update(conversations)
          .set({ unreadCountUser1: 0 })
          .where(eq(conversations.id, conversationId));
      } else {
        await tx
          .update(conversations)
          .set({ unreadCountUser2: 0 })
          .where(eq(conversations.id, conversationId));
      }

      return tx
        .select({
          id: privateMessages.id,
          conversation_id: privateMessages.conversationId,
          sender: privateMessages.sender,
          receiver: privateMessages.receiver,
          content: privateMessages.content,
          is_read: privateMessages.isRead,
          created_at: privateMessages.createdAt,
        })
        .from(privateMessages)
        .where(eq(privateMessages.conversationId, conversationId))
        .orderBy(asc(privateMessages.createdAt));
    });
  }

  async sendMessage(data: {
    sender: string;
    receiver: string;
    content: string;
  }): Promise<{ conversationId: number; messageId: number }> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const receiverRows = await tx
        .select({ username: users.username })
        .from(users)
        .where(eq(users.username, data.receiver))
        .limit(1);

      if (!receiverRows[0]) {
        throw new ApiError(ErrorCode.USER_NOT_FOUND, "接收方不存在");
      }

      const normalizedUser1 = data.sender < data.receiver ? data.sender : data.receiver;
      const normalizedUser2 = data.sender < data.receiver ? data.receiver : data.sender;

      const existingConversation = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.user1, normalizedUser1),
            eq(conversations.user2, normalizedUser2)
          )
        )
        .limit(1);

      let conversationId = Number(existingConversation[0]?.id || 0);

      if (!conversationId) {
        const insertedConversation = await tx
          .insert(conversations)
          .values({
            user1: normalizedUser1,
            user2: normalizedUser2,
            lastMessage: "",
            lastTime: sql`now()`,
            unreadCountUser1: 0,
            unreadCountUser2: 0,
          })
          .returning({ id: conversations.id });

        conversationId = Number(insertedConversation[0]?.id || 0);
      }

      const conversationRows = await tx
        .select({
          id: conversations.id,
          user1: conversations.user1,
          user2: conversations.user2,
        })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const conversation = conversationRows[0];
      if (!conversation) {
        throw new ApiError(ErrorCode.NOT_FOUND, "conversation_not_found");
      }

      await tx
        .update(conversations)
        .set({
          lastMessage: data.content,
          lastTime: sql`now()`,
          unreadCountUser1:
            conversation.user1 === data.receiver
              ? sql`${conversations.unreadCountUser1} + 1`
              : conversations.unreadCountUser1,
          unreadCountUser2:
            conversation.user2 === data.receiver
              ? sql`${conversations.unreadCountUser2} + 1`
              : conversations.unreadCountUser2,
        })
        .where(eq(conversations.id, conversationId));

      const insertedMessage = await tx
        .insert(privateMessages)
        .values({
          conversationId,
          sender: data.sender,
          receiver: data.receiver,
          content: data.content,
          isRead: 0,
          createdAt: sql`now()`,
        })
        .returning({ id: privateMessages.id });

      return {
        conversationId,
        messageId: Number(insertedMessage[0]?.id || 0),
      };
    });
  }
}

export const drizzleMessageRepository = new DrizzleMessageRepository();
