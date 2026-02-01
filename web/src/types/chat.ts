export type MessageStatus = "sending" | "sent" | "failed";
export type MessageType = "user" | "system";

export interface User {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: number;
  type: MessageType;
  status: MessageStatus;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: "text" | "voice";
  readOnly?: boolean;
  categoryId?: string;
  unreadCount?: number;
  lastReadMessageId?: string;
}

export interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

export interface ChatState {
  activeChannelId: string;
  channels: Channel[];
  messages: Record<string, Message[]>; // channelId -> messages
  drafts: Record<string, string>; // channelId -> draft content
  isLoading: boolean;
}
