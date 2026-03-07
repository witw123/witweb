export interface Conversation {
  id: number;
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
  sender: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id?: number;
  sender: string;
  sender_nickname: string;
  sender_avatar: string;
  content?: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

export type PublicProfile = {
  username: string;
  nickname?: string;
  avatar_url?: string;
};

export type TabType = "chat" | "replies" | "at" | "likes" | "system";
