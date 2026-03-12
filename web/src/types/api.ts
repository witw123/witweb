/**
 * API 通用类型定义
 *
 * 汇总前后端交互时复用频率最高的响应、参数和客户端配置类型，
 * 避免不同功能模块各自定义一份近似但不完全一致的接口契约。
 */

import type { UserProfile } from "./user";

/** API 错误响应。 */
export interface APIErrorResponse {
  detail?: string;
  error?: string;
  message?: string;
  status?: number;
}

/** API 成功响应。 */
export interface APISuccessResponse<T = unknown> {
  data: T;
  success: true;
}

/** 列表型 API 的分页响应。 */
export interface APIPaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  size: number;
  has_more?: boolean;
}

/** 通用操作结果响应，例如删除、收藏或状态切换。 */
export interface APIOperationResponse {
  ok: boolean;
  error?: string;
  message?: string;
}

/** 不带动态参数的 Next.js API 处理器。 */
export type APIHandler = (request: Request) => Promise<Response>;

/** 带动态参数的 Next.js API 处理器。 */
export type APIHandlerWithParams<P = Record<string, string>> = (
  request: Request,
  context: { params: P }
) => Promise<Response>;

/** 通用分页查询参数。 */
export interface PaginationParams {
  page?: number;
  size?: number;
  limit?: number;
}

/** 通用搜索查询参数。 */
export interface SearchParams extends PaginationParams {
  q?: string;
  query?: string;
}

/** 上传成功响应。 */
export interface UploadResponse {
  url: string;
  filename?: string;
  size?: number;
}

/** 上传失败响应。 */
export interface UploadError {
  error: string;
  field?: string;
}

/** 站点基础统计数据。 */
export interface SiteStats {
  total_users: number;
  total_posts: number;
  total_comments: number;
  total_likes: number;
}

/** 后台仪表盘聚合统计。 */
export interface AdminStats {
  overview: {
    total_users: number;
    total_posts: number;
    total_comments: number;
    total_likes: number;
    total_favorites: number;
  };
  recent_users: UserProfile[];
  recent_posts: {
    title: string;
    slug: string;
    author: string;
    created_at: string;
  }[];
}

/** 支持的 HTTP 方法。 */
export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

/** API 客户端请求选项。 */
export interface FetchOptions extends Omit<RequestInit, "method" | "body"> {
  method?: HTTPMethod;
  body?: Record<string, unknown> | FormData | string | null;
  params?: Record<string, string | number | boolean | undefined | null>;
}

/** API 客户端配置。 */
export interface APIClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}

/** 用户名动态路由参数。 */
export interface UsernameParams {
  params: {
    username: string;
  };
}

/** slug 动态路由参数。 */
export interface SlugParams {
  params: {
    slug: string;
  };
}

/** 数字或字符串 ID 动态路由参数。 */
export interface IdParams {
  params: {
    id: string;
  };
}

/** WebSocket 消息结构。 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp?: number;
}

/** 实时通知结构。 */
export interface RealtimeNotification {
  type: "message" | "like" | "comment" | "follow" | "system";
  title: string;
  content: string;
  link?: string;
  created_at: string;
}

/** 可空类型别名。 */
export type Nullable<T> = T | null;

/** 将指定字段改为可选。 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** 将指定字段改为必填。 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** 轻量 API 响应类型别名。 */
export type APIResponse<T> = Promise<{ data: T } | { error: string }>;
