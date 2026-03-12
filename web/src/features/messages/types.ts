/**
 * 消息模块类型定义
 *
 * 本文件定义了消息系统相关的核心数据类型，包括会话、私信、通知等
 * 用于前端组件和 API 之间的数据交互
 */

/**
 * 对话会话
 *
 * 表示用户与另一个用户之间的聊天会话，包含最后一条消息和未读数
 */
export interface Conversation {
  /** 会话唯一标识 ID */
  id: number;
  /** 会话中最后一条消息的内容 */
  last_message: string;
  /** 最后一条消息的发送时间 */
  last_time: string;
  /** 当前用户未读消息数量 */
  unread_count: number;
  /** 对话另一方的用户信息 */
  other_user: {
    /** 用户唯一标识名 */
    username: string;
    /** 用户昵称 */
    nickname: string;
    /** 用户头像 URL */
    avatar_url: string;
  };
}

/**
 * 私信消息
 *
 * 表示会话中的单条消息记录
 */
export interface PrivateMessage {
  /** 消息唯一标识 ID */
  id: number;
  /** 发送者用户名 */
  sender: string;
  /** 消息正文内容 */
  content: string;
  /** 消息创建时间 */
  created_at: string;
}

/**
 * 通知消息
 *
 * 表示用户收到的各类通知（回复、@、点赞、系统消息等）
 */
export interface Notification {
  /** 通知唯一标识 ID（可选，系统通知可能没有） */
  id?: number;
  /** 通知发送者用户名 */
  sender: string;
  /** 发送者昵称 */
  sender_nickname: string;
  /** 发送者头像 URL */
  sender_avatar: string;
  /** 通知正文内容（如评论内容） */
  content?: string;
  /** 通知创建时间 */
  created_at: string;
  /** 相关帖子标题 */
  post_title: string;
  /** 相关帖子 slug，用于构建链接 */
  post_slug: string;
}

/**
 * 公开用户资料
 *
 * 用于展示用户基本信息（不包含敏感信息）
 */
export type PublicProfile = {
  /** 用户唯一标识名 */
  username: string;
  /** 用户昵称（可选） */
  nickname?: string;
  /** 用户头像 URL（可选） */
  avatar_url?: string;
};

/**
 * 消息中心标签页类型
 *
 * 定义消息中心不同功能区域的切换类型
 */
export type TabType = "chat" | "replies" | "at" | "likes" | "system";
