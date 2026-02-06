/**
 * 鐢ㄦ埛鐩稿叧绫诲瀷瀹氫箟
 * User-related type definitions
 */


/**
 * 鏁版嵁搴撶敤鎴峰疄浣?
 * Database User Entity
 */
export interface User {
  id: number;
  username: string;
  password: string;
  nickname: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  balance: number;
  created_at: string;
  last_read_notifications_at?: string;
  is_bot?: number;
}

/**
 * Public user profile (without sensitive information)
 */
export interface UserProfile {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  created_at: string;
  following_count: number;
  follower_count: number;
  post_count: number;
  activity_count: number;
  like_received_count: number;
  is_following?: boolean;
  balance?: number;
}

/**
 * Follow relationship entity
 */
export interface Follow {
  id: number;
  follower: string;
  following: string;
  created_at: string;
}

/**
 * Follow counts
 */
export interface FollowCounts {
  following_count: number;
  follower_count: number;
}

/**
 * Following list item
 */
export interface FollowingItem {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  is_mutual: boolean;
}

/**
 * Follower list item
 */
export interface FollowerItem {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  is_following: boolean;
}

/**
 * Following list response
 */
export interface FollowingListResponse {
  items: FollowingItem[];
  total: number;
  page: number;
  size: number;
}

/**
 * Follower list response
 */
export interface FollowerListResponse {
  items: FollowerItem[];
  total: number;
  page: number;
  size: number;
}


/**
 * 鐢ㄦ埛娉ㄥ唽璇锋眰
 * User registration request
 */
export interface RegisterRequest {
  username: string;
  password: string;
  nickname?: string;
}

/**
 * 鐢ㄦ埛鐧诲綍璇锋眰
 * User login request
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string;
  profile: UserProfile;
}

/**
 * 鏇存柊鐢ㄦ埛璧勬枡璇锋眰
 * Update profile request
 */
export interface UpdateProfileRequest {
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
}


/**
 * User card component props
 */
export interface UserCardProps {
  user: Pick<UserProfile, 'username' | 'nickname' | 'avatar_url' | 'bio'>;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollowToggle?: (username: string) => void;
}

/**
 * User avatar component props
 */
export interface UserAvatarProps {
  username: string;
  avatar_url: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * 鐢ㄦ埛璧勬枡椤甸潰 Props
 * User profile page props
 */
export interface UserProfilePageProps {
  params: {
    username: string;
  };
}

// ============ 宸ュ叿绫诲瀷 ============

/**
 * User row for joins
 */
export interface UserRow {
  username: string;
  nickname?: string;
  avatar_url?: string;
}

/**
 * JWT Payload
 */
export interface JWTPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

/**
 * 璁よ瘉鐢ㄦ埛淇℃伅
 * Authenticated user info
 */
export interface AuthUser {
  username: string;
}
