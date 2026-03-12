/**
 * API 错误处理中间件
 *
 * 封装路由异常处理、断言工具和数据库错误翻译。
 * 目标是在 API 边界统一输出响应结构，避免业务代码里反复手写 try/catch
 * 和数据库错误字符串匹配。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  ErrorCode,
  HttpStatus,
  apiErrorResponse,
  errorResponse,
  handleError,
  isApiError,
  type ErrorCodeType,
} from "@/lib/api-response";
import { logError } from "@/lib/logger";

/** 标准 API 处理器类型，适用于没有或无需精确定义动态参数的路由。 */
export type ApiHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> | Response;

/** 支持动态参数类型的 API 处理器类型。 */
export type FlexibleApiHandler<TParams = Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<Response> | Response;

/**
 * 错误处理包装器
 *
 * 为 API 处理器统一兜底异常，将未捕获错误转换为标准 API 响应。
 * 业务处理器可以直接抛出 `ApiError` 或普通异常，而不必关心最终响应组装。
 *
 * @template TParams - 参数类型
 * @param {FlexibleApiHandler<TParams>} handler - 原始处理器
 * @returns {FlexibleApiHandler<TParams>} 包装后的处理器
 */
export function withErrorHandler<TParams = Record<string, string>>(
  handler: FlexibleApiHandler<TParams>
): FlexibleApiHandler<TParams> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleError(error);
    }
  };
}

/** HTTP 方法类型。 */
type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** 处理器映射表类型。 */
type FlexibleHandlerMap = Partial<Record<ApiMethod, FlexibleApiHandler>>;

/**
 * 创建 API 路由
 *
 * 批量包装同一路径下的多个 HTTP 方法，减少重复样板代码。
 *
 * @template THandlers - 处理器映射表类型
 * @param {THandlers} handlers - 处理器映射表
 * @returns {THandlers} 包装后的处理器映射表
 */
export function createApiRoute<THandlers extends FlexibleHandlerMap>(
  handlers: THandlers
): THandlers {
  const wrappedHandlers: FlexibleHandlerMap = {};

  for (const [method, handler] of Object.entries(handlers)) {
    if (handler) {
      const apiMethod = method as ApiMethod;
      wrappedHandlers[apiMethod] = withErrorHandler(handler as FlexibleApiHandler);
    }
  }

  return wrappedHandlers as THandlers;
}

/**
 * 断言条件成立，否则抛出指定 API 错误
 *
 * @param {boolean} condition - 待断言条件
 * @param {ErrorCodeType} errorCode - 失败时抛出的错误码
 * @param {string} [message] - 可选错误消息
 * @param {unknown} [details] - 附带错误详情
 */
export function assertCondition(
  condition: boolean,
  errorCode: ErrorCodeType,
  message?: string,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new ApiError(errorCode, message, details);
  }
}

/**
 * 断言值存在，否则抛出“资源不存在”类错误
 *
 * @template T - 目标值类型
 * @param {T | null | undefined} value - 待检查值
 * @param {string} [message] - 自定义错误信息
 * @param {ErrorCodeType} [errorCode=ErrorCode.NOT_FOUND] - 错误码
 */
export function assertExists<T>(
  value: T | null | undefined,
  message?: string,
  errorCode: ErrorCodeType = ErrorCode.NOT_FOUND
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ApiError(errorCode, message);
  }
}

/**
 * 断言当前用户已登录
 *
 * @param {string | null | undefined} user - 当前用户名
 * @param {string} [message="Please log in first"] - 错误信息
 */
export function assertAuthenticated(
  user: string | null | undefined,
  message = "Please log in first"
): asserts user is string {
  if (!user) {
    throw ApiError.unauthorized(message);
  }
}

/**
 * 断言当前用户具备操作权限
 *
 * @param {boolean} condition - 是否满足授权条件
 * @param {string} [message="Insufficient permissions"] - 错误信息
 */
export function assertAuthorized(
  condition: boolean,
  message = "Insufficient permissions"
): void {
  if (!condition) {
    throw ApiError.forbidden(message);
  }
}

/**
 * 执行获取逻辑并在值不存在时抛出标准 404 错误
 *
 * 适合把“先查再判空”的模板逻辑压缩成单个调用。
 *
 * @template T - 返回值类型
 * @param {() => Promise<T | null | undefined> | T | null | undefined} getter - 获取函数
 * @param {string} [resourceName="Resource"] - 资源名称
 * @returns {Promise<T>} 已确认存在的结果
 */
export async function getOrThrow<T>(
  getter: () => Promise<T | null | undefined> | T | null | undefined,
  resourceName = "Resource"
): Promise<T> {
  const result = await getter();

  if (result === null || result === undefined) {
    throw new ApiError(ErrorCode.NOT_FOUND, `${resourceName} not found`);
  }

  return result;
}

/**
 * 将底层数据库异常翻译为面向 API 的错误对象
 *
 * 这里按常见约束错误做有限映射，其余异常统一记录日志后返回 500，
 * 避免数据库原始错误暴露给客户端。
 *
 * @param {unknown} error - 原始数据库异常
 * @returns {ApiError} 标准化后的 API 错误
 */
export function handleDatabaseError(error: unknown): ApiError {
  if (error instanceof Error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      const field = error.message.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
      return ApiError.conflict("Resource already exists", field ? { field: field[2] } : undefined);
    }

    if (error.message.includes("FOREIGN KEY constraint failed")) {
      return ApiError.badRequest("Related resource does not exist");
    }

    if (error.message.includes("NOT NULL constraint failed")) {
      const field = error.message.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
      return ApiError.validation("Required field cannot be empty", field ? { field: field[2] } : undefined);
    }

    logError({
      source: "api.database",
      error,
    });

    return ApiError.internal("Database operation failed");
  }

  return ApiError.internal("Unknown database error");
}

/**
 * 用数据库错误翻译器包装异步操作
 *
 * @template T - 操作返回值类型
 * @param {() => Promise<T>} operation - 数据库操作
 * @returns {Promise<T>} 操作结果
 */
export async function withDbHandler<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export interface ErrorMiddlewareOptions {
  onError?: (error: unknown, req: NextRequest) => void;
  includeStack?: boolean;
}

/**
 * 创建 Next.js 中间件级错误处理器
 *
 * @param {ErrorMiddlewareOptions} [options={}] - 中间件错误处理选项
 * @returns {(req: NextRequest) => Promise<Response>} 中间件处理函数
 */
export function createErrorMiddleware(options: ErrorMiddlewareOptions = {}) {
  return async function errorMiddleware(req: NextRequest) {
    try {
      return NextResponse.next();
    } catch (error) {
      options.onError?.(error, req);

      if (isApiError(error)) {
        return apiErrorResponse(error);
      }

      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        options.includeStack && error instanceof Error ? error.message : undefined
      );
    }
  };
}

export {
  ApiError,
  ErrorCode,
  HttpStatus,
  apiErrorResponse,
  errorResponse,
  handleError,
  isApiError,
};
