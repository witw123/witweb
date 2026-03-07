/**
 * Blog-related type definitions
 */


/**
 * Post status
 */
export type PostStatus = 'published' | 'draft' | 'deleted';

/**
 * Database Post Entity
 */
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  author: string;
  tags: string | null;
  status: PostStatus;
  category_id: number | null;
  view_count: number;
}

/**
 * Category entity
 */
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  post_count?: number;
}

/**
 * Comment entity
 */
export interface Comment {
  id: number;
  post_id: number;
  author: string;
  content: string;
  created_at: string;
  parent_id: number | null;
  ip_address: string | null;
  like_count?: number;
  dislike_count?: number;
  author_name?: string;
  author_avatar?: string;
}

/**
 * Like entity
 */
export interface Like {
  id: number;
  post_id: number;
  username: string;
  created_at: string;
}

/**
 * Dislike entity
 */
export interface Dislike {
  id: number;
  post_id: number;
  username: string;
  created_at: string;
}

/**
 * Comment vote entity
 */
export interface CommentVote {
  id: number;
  comment_id: number;
  username: string;
  value: 1 | -1;
  created_at: string;
}

/**
 * Favorite entity
 */
export interface Favorite {
  id: number;
  post_id: number;
  username: string;
  created_at: string;
}

/**
 * Friend link entity
 */
export interface FriendLink {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}


/**
 * Post list item with statistics
 */
export interface PostListItem {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  author: string;
  tags: string | null;
  category_id: number | null;
  view_count: number;
  category_name: string | null;
  category_slug: string | null;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  favorite_count: number;
  favorited_by_me: boolean;
  author_name: string;
  author_avatar: string;
}

/**
 * Post detail with user interaction status
 */
export interface PostDetail extends Post {
  category_name: string | null;
  category_slug: string | null;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  favorite_count: number;
  liked_by_me: boolean;
  favorited_by_me: boolean;
  author_name: string;
  author_avatar: string;
}

/**
 * Post list response
 */
export interface PostListResponse {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
}

/**
 * Favorites list response
 */
export interface FavoritesListResponse {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
}

/**
 * Comment list item with author info
 */
export interface CommentListItem extends Comment {
  like_count: number;
  dislike_count: number;
  author_name: string;
  author_avatar: string;
}

/**
 * Activity item type
 */
export type ActivityType = 'post' | 'like' | 'comment';

/**
 * User activity item
 */
export interface ActivityItem {
  type: ActivityType;
  title: string;
  slug: string;
  created_at: string;
  content?: string;
  target_user?: string;
}

/**
 * User activities response
 */
export interface ActivitiesResponse {
  items: ActivityItem[];
  total: number;
}

/**
 * Notification item
 */
export interface NotificationItem {
  sender: string;
  sender_nickname: string;
  sender_avatar: string;
  content: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}


/**
 * Create post request
 */
export interface CreatePostRequest {
  title: string;
  slug?: string;
  content: string;
  tags?: string;
  category_id?: number | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
}

/**
 * Update post request
 */
export interface UpdatePostRequest {
  title: string;
  content: string;
  tags: string;
  category_id?: number | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
}

/**
 * Add comment request
 */
export interface AddCommentRequest {
  content: string;
  parent_id?: number | null;
}

/**
 * Like/dislike response
 */
export interface ToggleLikeResponse {
  ok: boolean;
  liked?: boolean;
  disliked?: boolean;
  error?: string;
}

/**
 * Favorite response
 */
export interface ToggleFavoriteResponse {
  ok: boolean;
  favorited?: boolean;
  error?: string;
}

/**
 * Comment vote request
 */
export interface VoteCommentRequest {
  value: 1 | -1;
}

/**
 * Update comment request
 */
export interface UpdateCommentRequest {
  content: string;
}

/**
 * Operation response
 */
export interface OperationResponse {
  ok: boolean;
  error?: string;
}

/**
 * Category reorder request
 */
export interface ReorderCategoriesRequest {
  ids: number[];
}

/**
 * Create/update category request
 */
export interface CategoryRequest {
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * Create/update friend link request
 */
export interface FriendLinkRequest {
  name: string;
  url: string;
  description?: string;
  avatar_url?: string;
  sort_order?: number;
  is_active?: boolean;
}


/**
 * Post card component props
 */
export interface PostCardProps {
  post: PostListItem;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Comment component props
 */
export interface CommentProps {
  comment: CommentListItem;
  currentUser?: string | null;
  onReply?: (commentId: number) => void;
  onVote?: (commentId: number, value: 1 | -1) => void;
}

/**
 * Pagination props
 */
export interface PaginationProps {
  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Post filters
 */
export interface PostFilters {
  query?: string;
  author?: string;
  tag?: string;
  category?: string;
}
