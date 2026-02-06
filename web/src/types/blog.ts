/**
 * Blog-related type definitions
 */


/**
 * 鏂囩珷鐘舵€?
 * Post status
 */
export type PostStatus = 'published' | 'draft' | 'deleted';

/**
 * 鏁版嵁搴撴枃绔犲疄浣?
 * Database Post Entity
 */
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
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
 * 璇勮瀹炰綋
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
 * 鐐硅禐瀹炰綋
 * Like entity
 */
export interface Like {
  id: number;
  post_id: number;
  username: string;
  created_at: string;
}

/**
 * 韪╁疄浣?
 * Dislike entity
 */
export interface Dislike {
  id: number;
  post_id: number;
  username: string;
  created_at: string;
}

/**
 * 璇勮鎶曠エ瀹炰綋
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
 * 鏀惰棌瀹炰綋
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
 * 鐢ㄦ埛娲诲姩椤?
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
 * 閫氱煡椤?
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
}

/**
 * 鏇存柊鏂囩珷璇锋眰
 * Update post request
 */
export interface UpdatePostRequest {
  title: string;
  content: string;
  tags: string;
  category_id?: number | null;
}

/**
 * 娣诲姞璇勮璇锋眰
 * Add comment request
 */
export interface AddCommentRequest {
  content: string;
  parent_id?: number | null;
}

/**
 * 鐐硅禐/韪╁搷搴?
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
 * 璇勮鎶曠エ璇锋眰
 * Comment vote request
 */
export interface VoteCommentRequest {
  value: 1 | -1;
}

/**
 * 鏇存柊璇勮璇锋眰
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
