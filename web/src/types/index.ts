/**
 * WitWeb type definitions unified export
 * 
 * @example
 * ```typescript
 * import type { User, Post, VideoTask } from '@/types';
 * ```
 */

// ============ 鐢ㄦ埛鐩稿叧 ============
export type {
  User,
  UserProfile,
  Follow,
  FollowCounts,
  FollowingItem,
  FollowerItem,
  FollowingListResponse,
  FollowerListResponse,
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  UpdateProfileRequest,
  UserCardProps,
  UserAvatarProps,
  UserProfilePageProps,
  UserRow,
  JWTPayload,
  AuthUser,
} from './user';

export type {
  PostStatus,
  Post,
  Category,
  Comment,
  Like,
  Dislike,
  CommentVote,
  Favorite,
  FriendLink,
  PostListItem,
  PostDetail,
  PostListResponse,
  FavoritesListResponse,
  CommentListItem,
  ActivityType,
  ActivityItem,
  ActivitiesResponse,
  NotificationItem,
  CreatePostRequest,
  UpdatePostRequest,
  AddCommentRequest,
  ToggleLikeResponse,
  ToggleFavoriteResponse,
  VoteCommentRequest,
  UpdateCommentRequest,
  OperationResponse,
  ReorderCategoriesRequest,
  CategoryRequest,
  FriendLinkRequest,
  PostCardProps,
  CommentProps,
  PaginationProps,
  PostFilters,
} from './blog';

// ============ Studio 瑙嗛鐩稿叧 ============
export type {
  VideoTaskStatus,
  VideoTaskType,
  VideoTask,
  VideoResult,
  VideoTaskWithResults,
  Character,
  StudioConfig,
  StudioConfigRow,
  StudioHistory,
  StudioTaskTime,
  StudioActiveTask,
  CreateVideoTaskRequest,
  VideoAPIResponse,
  VideoAPIResult,
  VideoTaskListResponse,
  FinalizeVideoResponse,
  UploadCharacterRequest,
  CreateCharacterRequest,
  UpdateStudioConfigRequest,
  LocalVideo,
  VideoTaskItemProps,
  VideoGalleryItemProps,
  CreateFormProps,
  CharacterLabProps,
  TaskListProps,
  VideoPlayerProps,
  VideoAPIHosts,
  VideoAPIPayload,
} from './studio';

// ============ 绉佷俊鐩稿叧 ============
export type {
  Conversation,
  PrivateMessage,
  ConversationOtherUser,
  ConversationListItem,
  MessageListItem,
  SendMessageRequest,
  SendMessageResponse,
  GetMessagesParams,
  UnreadCountResponse,
  ConversationListProps,
  MessageListProps,
  MessageInputProps,
  MessageBubbleProps,
  MessagesPageProps,
} from './message';

// ============ API 閫氱敤绫诲瀷 ============
export type {
  APIErrorResponse,
  APISuccessResponse,
  APIPaginatedResponse,
  APIOperationResponse,
  APIHandler,
  APIHandlerWithParams,
  PaginationParams,
  SearchParams,
  UploadResponse,
  UploadError,
  SiteStats,
  AdminStats,
  HTTPMethod,
  FetchOptions,
  APIClientConfig,
  UsernameParams,
  SlugParams,
  IdParams,
  WebSocketMessage,
  RealtimeNotification,
  Nullable,
  Optional,
  RequiredFields,
  APIResponse,
} from './api';

// ============ 閲嶆柊瀵煎嚭宸叉湁绫诲瀷澹版槑 ============

