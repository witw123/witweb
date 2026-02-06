/**
 * 类型定义验证文件
 */

import type {
  // User types
  User,
  UserProfile,
  Follow,
  LoginRequest,
  LoginResponse,
  // Blog types
  Post,
  PostStatus,
  Category,
  Comment,
  PostListItem,
  PostListResponse,
  CreatePostRequest,
  // Studio types
  VideoTask,
  VideoTaskStatus,
  VideoTaskType,
  Character,
  StudioConfig,
  CreateVideoTaskRequest,
  VideoTaskListResponse,
  // Message types
  Conversation,
  PrivateMessage,
  ConversationListItem,
  SendMessageRequest,
  // API types
  APIErrorResponse,
  APIPaginatedResponse,
  PaginationParams,
  FetchOptions,
} from './index';

// ============ 楠岃瘉 User 绫诲瀷 ============
const sampleUser: User = {
  id: 1,
  username: 'testuser',
  password: 'hashedpassword',
  nickname: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  cover_url: null,
  bio: 'Hello world',
  balance: 100.0,
  created_at: new Date().toISOString(),
};

const sampleProfile: UserProfile = {
  username: 'testuser',
  nickname: 'Test User',
  avatar_url: null,
  cover_url: null,
  bio: null,
  created_at: new Date().toISOString(),
  following_count: 10,
  follower_count: 20,
  post_count: 5,
  activity_count: 15,
  like_received_count: 100,
  is_following: false,
};

// ============ 楠岃瘉 Blog 绫诲瀷 ============
const samplePost: Post = {
  id: 1,
  title: 'Sample Post',
  slug: 'sample-post',
  content: 'This is a sample post content.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author: 'testuser',
  tags: 'sample,test',
  status: 'published' as PostStatus,
  category_id: 1,
  view_count: 100,
};

const samplePostListItem: PostListItem = {
  title: 'Sample Post',
  slug: 'sample-post',
  content: 'Content preview...',
  created_at: new Date().toISOString(),
  author: 'testuser',
  tags: 'sample',
  category_id: 1,
  view_count: 100,
  category_name: 'Tech',
  category_slug: 'tech',
  like_count: 10,
  dislike_count: 0,
  comment_count: 5,
  favorite_count: 3,
  favorited_by_me: false,
  author_name: 'Test User',
  author_avatar: '',
};

const samplePostListResponse: PostListResponse = {
  items: [samplePostListItem],
  total: 1,
  page: 1,
  size: 10,
};

const sampleCreatePostRequest: CreatePostRequest = {
  title: 'New Post',
  content: 'Post content',
  tags: 'tag1,tag2',
  category_id: 1,
};

const sampleCategory: Category = {
  id: 1,
  name: 'Technology',
  slug: 'technology',
  description: 'Tech articles',
  sort_order: 0,
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const sampleComment: Comment = {
  id: 1,
  post_id: 1,
  author: 'commenter',
  content: 'Nice post!',
  created_at: new Date().toISOString(),
  parent_id: null,
  ip_address: '127.0.0.1',
};

// ============ 楠岃瘉 Studio 绫诲瀷 ============
const sampleVideoTask: VideoTask = {
  id: 'task-123',
  username: 'testuser',
  task_type: 'text2video' as VideoTaskType,
  status: 'running' as VideoTaskStatus,
  progress: 50,
  prompt: 'A beautiful sunset',
  model: 'sora-1.0',
  url: null,
  aspect_ratio: '16:9',
  duration: 5,
  remix_target_id: null,
  size: '1080p',
  pid: null,
  timestamps: null,
  result_json: null,
  failure_reason: null,
  error: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const sampleCreateVideoRequest: CreateVideoTaskRequest = {
  prompt: 'A cat playing piano',
  model: 'sora-1.0',
  aspect_ratio: '16:9',
  duration: 5,
};

const sampleVideoTaskListResponse: VideoTaskListResponse = {
  tasks: [sampleVideoTask],
  total: 1,
  page: 1,
  limit: 20,
};

const sampleCharacter: Character = {
  id: 1,
  username: 'testuser',
  character_id: 'char-123',
  name: 'My Character',
  source_task_id: 'task-123',
  created_at: new Date().toISOString(),
};

const sampleStudioConfig: StudioConfig = {
  api_key: 'sk-xxx',
  token: 'token-xxx',
  host_mode: 'auto',
  query_defaults: {
    model: 'sora-1.0',
  },
};

// ============ 楠岃瘉 Message 绫诲瀷 ============
const sampleConversation: Conversation = {
  id: 1,
  user1: 'user1',
  user2: 'user2',
  last_message: 'Hello!',
  last_time: new Date().toISOString(),
  unread_count_user1: 0,
  unread_count_user2: 1,
};

const samplePrivateMessage: PrivateMessage = {
  id: 1,
  conversation_id: 1,
  sender: 'user1',
  receiver: 'user2',
  content: 'Hello there!',
  is_read: 0,
  created_at: new Date().toISOString(),
};

const sampleConversationListItem: ConversationListItem = {
  id: 1,
  user1: 'user1',
  user2: 'user2',
  last_message: 'Hello!',
  last_time: new Date().toISOString(),
  unread_count: 1,
  other_user: {
    username: 'user2',
    nickname: 'User Two',
    avatar_url: '',
  },
};

const sampleSendMessageRequest: SendMessageRequest = {
  receiver: 'user2',
  content: 'Hi!',
};

// ============ 楠岃瘉 API 绫诲瀷 ============
const sampleAPIError: APIErrorResponse = {
  detail: 'Not found',
  error: 'Resource not found',
  status: 404,
};

const samplePaginatedResponse: APIPaginatedResponse<PostListItem> = {
  items: [samplePostListItem],
  total: 1,
  page: 1,
  size: 10,
  has_more: false,
};

const samplePaginationParams: PaginationParams = {
  page: 1,
  size: 10,
};

const sampleFetchOptions: FetchOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: { test: 'data' },
};

// 楠岃瘉瀵煎嚭
export {
  sampleUser,
  sampleProfile,
  samplePost,
  samplePostListResponse,
  sampleVideoTask,
  sampleConversation,
  samplePrivateMessage,
};


// Keep additional fixtures referenced so lint can verify type coverage without exports.
void [
  sampleCategory,
  sampleComment,
  sampleCreatePostRequest,
  sampleCreateVideoRequest,
  sampleVideoTaskListResponse,
  sampleCharacter,
  sampleStudioConfig,
  sampleConversationListItem,
  sampleSendMessageRequest,
  sampleAPIError,
  samplePaginatedResponse,
  samplePaginationParams,
  sampleFetchOptions,
];
type _VerifyUserTypes = [Follow, LoginRequest, LoginResponse];
void (0 as unknown as _VerifyUserTypes);
export type VerificationPassed = true;


