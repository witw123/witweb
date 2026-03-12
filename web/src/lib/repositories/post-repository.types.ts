/**
 * 博客文章相关类型定义
 *
 * 包含文章创建/更新参数、列表查询参数、管理端类型等
 */

import type { Category, FriendLink, PostStatus } from "@/types";

/** 创建文章的数据参数 */
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

/** 更新文章的数据参数 */
export interface UpdatePostData {
  title?: string;
  content?: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  tags?: string;
  category_id?: number | null;
  status?: PostStatus;
}

/** 文章列表查询参数 */
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

/** 后台文章列表查询参数 */
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

/** 后台文章列表项 */
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

/** 后台文章详情 */
export interface AdminBlogDetail extends AdminBlogListItem {
  content: string;
  tags: string | null;
}

/** 站点地图文章项 */
export interface SitemapPostItem {
  slug: string;
  updated_at?: string | null;
  created_at?: string | null;
}

/** 用户活动动态项 */
export interface PostActivityItem {
  type: "post" | "like" | "comment";
  title: string;
  slug: string;
  created_at: string;
  content?: string;
  target_user?: string;
}

/** 收到的点赞通知项 */
export interface LikesToUserItem {
  sender: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

/** 分类创建/更新数据参数 */
export interface CategoryMutationData {
  name?: string;
  slug?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

/** 友链创建/更新数据参数 */
export interface FriendLinkMutationData {
  name?: string;
  url?: string;
  description?: string;
  avatar_url?: string;
  sort_order?: number;
  is_active?: boolean;
}

export type { Category, FriendLink };
