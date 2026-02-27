/**
 * API common type definitions
 */

import type { UserProfile } from './user';


/**
 * API error response
 */
export interface APIErrorResponse {
  detail?: string;
  error?: string;
  message?: string;
  status?: number;
}

/**
 * API success response
 */
export interface APISuccessResponse<T = unknown> {
  data: T;
  success: true;
}

/**
 * API paginated response
 */
export interface APIPaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  size: number;
  has_more?: boolean;
}

/**
 * Generic operation response
 */
export interface APIOperationResponse {
  ok: boolean;
  error?: string;
  message?: string;
}


/**
 * Next.js API handler type
 */
export type APIHandler = (request: Request) => Promise<Response>;

/**
 * Next.js API handler with params
 */
export type APIHandlerWithParams<P = Record<string, string>> = (
  request: Request,
  context: { params: P }
) => Promise<Response>;


/**
 * Pagination query params
 */
export interface PaginationParams {
  page?: number;
  size?: number;
  limit?: number;
}

/**
 * Search query params
 */
export interface SearchParams extends PaginationParams {
  q?: string;
  query?: string;
}


/**
 * Upload response
 */
export interface UploadResponse {
  url: string;
  filename?: string;
  size?: number;
}

/**
 * Upload error
 */
export interface UploadError {
  error: string;
  field?: string;
}


/**
 * Site statistics
 */
export interface SiteStats {
  total_users: number;
  total_posts: number;
  total_comments: number;
  total_likes: number;
}

/**
 * Admin dashboard stats
 */
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


/**
 * HTTP methods
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Fetch options
 */
export interface FetchOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: HTTPMethod;
  body?: Record<string, unknown> | FormData | string | null;
  params?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * API client config
 */
export interface APIClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}


/**
 * Dynamic route params - username
 */
export interface UsernameParams {
  params: {
    username: string;
  };
}

/**
 * Dynamic route params - slug
 */
export interface SlugParams {
  params: {
    slug: string;
  };
}

/**
 * Dynamic route params - id
 */
export interface IdParams {
  params: {
    id: string;
  };
}


/**
 * WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp?: number;
}

/**
 * Real-time notification
 */
export interface RealtimeNotification {
  type: 'message' | 'like' | 'comment' | 'follow' | 'system';
  title: string;
  content: string;
  link?: string;
  created_at: string;
}


/**
 * Nullable type
 */
export type Nullable<T> = T | null;

/**
 * Optional fields type
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required fields type
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * API response type
 */
export type APIResponse<T> = Promise<{ data: T } | { error: string }>;
