/**
 * Private message type definitions
 */


/**
 * Conversation entity
 */
export interface Conversation {
  id: number;
  user1: string;
  user2: string;
  last_message: string | null;
  last_time: string | null;
  unread_count_user1: number;
  unread_count_user2: number;
}

/**
 * Private message entity
 */
export interface PrivateMessage {
  id: number;
  conversation_id: number;
  sender: string;
  receiver: string;
  content: string;
  is_read: number;
  created_at: string;
}


/**
 * Other user info in conversation
 */
export interface ConversationOtherUser {
  username: string;
  nickname: string;
  avatar_url: string;
}

/**
 * Conversation list item with other user info
 */
export interface ConversationListItem {
  id: number;
  user1: string;
  user2: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  other_user: ConversationOtherUser;
}

/**
 * Message list item with sender info
 */
export interface MessageListItem extends PrivateMessage {
  sender_nickname?: string;
  sender_avatar?: string;
}


/**
 * Send message request
 */
export interface SendMessageRequest {
  receiver: string;
  content: string;
}

/**
 * Send message response
 */
export interface SendMessageResponse {
  conversation_id: number;
}

/**
 * Get messages params
 */
export interface GetMessagesParams {
  conversationId: number;
}

/**
 * Unread count response
 */
export interface UnreadCountResponse {
  count: number;
}


/**
 * Conversation list component props
 */
export interface ConversationListProps {
  conversations: ConversationListItem[];
  activeId?: number | null;
  onSelect: (conversation: ConversationListItem) => void;
  loading?: boolean;
}

/**
 * Message list component props
 */
export interface MessageListProps {
  messages: PrivateMessage[];
  currentUser: string;
  otherUser: ConversationOtherUser;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * Message input component props
 */
export interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Message bubble component props
 */
export interface MessageBubbleProps {
  message: PrivateMessage;
  isMe: boolean;
  showAvatar?: boolean;
  otherUser?: ConversationOtherUser;
}

/**
 * Messages page props
 */
export interface MessagesPageProps {
  initialConversations?: ConversationListItem[];
  initialUnreadCount?: number;
}
