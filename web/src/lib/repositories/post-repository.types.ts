import type { Category, FriendLink, PostStatus } from "@/types";

export interface CreatePostData {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  author: string;
  tags?: string;
  category_id?: number | null;
  status?: PostStatus;
}

export interface UpdatePostData {
  title?: string;
  content?: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  tags?: string;
  category_id?: number | null;
  status?: PostStatus;
}

export interface ListPostsParams {
  page?: number;
  size?: number;
  query?: string;
  author?: string;
  authorAliases?: string[];
  tag?: string;
  category?: string;
  username?: string;
}

export interface AdminListBlogsParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  username?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export interface AdminBlogListItem {
  id: number;
  username: string;
  title: string;
  status: string;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminBlogDetail extends AdminBlogListItem {
  content: string;
  tags: string | null;
}

export interface SitemapPostItem {
  slug: string;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface PostActivityItem {
  type: "post" | "like" | "comment";
  title: string;
  slug: string;
  created_at: string;
  content?: string;
  target_user?: string;
}

export interface LikesToUserItem {
  sender: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

export interface CategoryMutationData {
  name?: string;
  slug?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface FriendLinkMutationData {
  name?: string;
  url?: string;
  description?: string;
  avatar_url?: string;
  sort_order?: number;
  is_active?: boolean;
}

export type { Category, FriendLink };
