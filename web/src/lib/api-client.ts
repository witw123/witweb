/**
 * API 客户端
 *
 * 提供统一的 HTTP 请求方法，支持 GET、POST、PUT、DELETE 等操作
 * 自动处理错误、认证令牌和响应格式化
 */

import { ApiResponse, ErrorDetail } from "./api-response";

/**
 * API 请求选项
 *
 * 扩展了标准的 Fetch 请求选项
 */
export interface FetchOptions extends RequestInit {
  /** 是否跳过默认错误处理 */
  skipErrorHandler?: boolean;
}

/**
 * API 客户端错误
 *
 * 在 API 请求失败时抛出，包含错误码、状态码和详细信息
 */
export interface ApiClientError extends Error {
  /** 错误代码 */
  code: string;
  /** HTTP 状态码 */
  status: number;
  /** 错误详细信息 */
  details?: unknown;
}

/**
 * 创建 API 客户端错误
 *
 * @param {ErrorDetail} error - 错误详情对象
 * @param {number} status - HTTP 状态码
 * @returns {ApiClientError} API 客户端错误对象
 */
function createApiError(error: ErrorDetail, status: number): ApiClientError {
  const err = new Error(error.message) as ApiClientError;
  err.name = "ApiClientError";
  err.code = error.code;
  err.status = status;
  err.details = error.details;
  return err;
}

/**
 * 解析 API 响应
 *
 * 检查响应是否成功，失败时抛出 API 错误
 *
 * @template T - 响应数据类型
 * @param {Response} response - Fetch Response 对象
 * @returns {Promise<T>} 解析后的数据
 * @throws {ApiClientError} API 返回错误时抛出
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw createApiError(data.error, response.status);
  }

  return data.data;
}

/**
 * GET 请求
 *
 * @template T - 响应数据类型
 * @param {string} url - 请求 URL
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<T>} 响应数据
 */
export async function get<T>(url: string, options?: FetchOptions): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  return parseResponse<T>(response);
}

/**
 * POST 请求
 *
 * @template T - 响应数据类型
 * @param {string} url - 请求 URL
 * @param {unknown} [body] - 请求体数据
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<T>} 响应数据
 */
export async function post<T>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(response);
}

/**
 * PUT 请求
 *
 * @template T - 响应数据类型
 * @param {string} url - 请求 URL
 * @param {unknown} [body] - 请求体数据
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<T>} 响应数据
 */
export async function put<T>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(response);
}

/**
 * PATCH 请求
 *
 * @template T - 响应数据类型
 * @param {string} url - 请求 URL
 * @param {unknown} [body] - 请求体数据
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<T>} 响应数据
 */
export async function patch<T>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(response);
}

/**
 * DELETE 请求
 *
 * @template T - 响应数据类型
 * @param {string} url - 请求 URL
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<T>} 响应数据
 */
export async function del<T>(url: string, options?: FetchOptions): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  return parseResponse<T>(response);
}

/**
 * 分页结果
 *
 * @template T - 数据项类型
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  size?: number;
}

/**
 * 分页 GET 请求
 *
 * 自动将分页参数转换为 URL 查询字符串
 *
 * @template T - 响应数据项类型
 * @param {string} url - 请求 URL
 * @param {PaginationParams & Record<string, string|number|undefined>} [params={}] - 查询参数
 * @param {FetchOptions} [options] - 请求选项
 * @returns {Promise<PaginatedResult<T>>} 分页结果
 */
export async function getPaginated<T>(
  url: string,
  params: PaginationParams & Record<string, string | number | undefined> = {},
  options?: FetchOptions
): Promise<PaginatedResult<T>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  return get<PaginatedResult<T>>(fullUrl, options);
}

/**
 * 类型守卫：检查是否为 API 客户端错误
 *
 * @param {unknown} error - 待检查的错误对象
 * @returns {boolean} 是否为 ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return (
    error instanceof Error &&
    error.name === "ApiClientError" &&
    "code" in error &&
    "status" in error
  );
}

/**
 * 获取错误消息
 *
 * 统一处理不同类型错误，返回用户友好的消息
 *
 * @param {unknown} error - 错误对象
 * @returns {string} 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (isApiClientError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

export type {
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
  ErrorDetail,
} from "./api-response";
