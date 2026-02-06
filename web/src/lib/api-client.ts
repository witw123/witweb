import { ApiResponse, ErrorDetail } from "./api-response";

export interface FetchOptions extends RequestInit {
  skipErrorHandler?: boolean;
}

export interface ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

function createApiError(error: ErrorDetail, status: number): ApiClientError {
  const err = new Error(error.message) as ApiClientError;
  err.name = "ApiClientError";
  err.code = error.code;
  err.status = status;
  err.details = error.details;
  return err;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw createApiError(data.error, response.status);
  }

  return data.data;
}

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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  size?: number;
}

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

export function isApiClientError(error: unknown): error is ApiClientError {
  return (
    error instanceof Error &&
    error.name === "ApiClientError" &&
    "code" in error &&
    "status" in error
  );
}

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
