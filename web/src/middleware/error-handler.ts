import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  isApiError,
  ErrorCode,
  type ErrorCodeType,
  HttpStatus,
  errorResponse,
  apiErrorResponse,
  handleError,
} from "@/lib/api-response";

export type ApiHandler<T = unknown> = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string | string[]>> }
) => Promise<NextResponse<T>> | NextResponse<T>;

export type FlexibleApiHandler<TParams = any> = (
  req: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<NextResponse<any>> | NextResponse<any>;

export function withErrorHandler(handler: FlexibleApiHandler): FlexibleApiHandler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleError(error);
    }
  };
}

export function createApiRoute(handlers: {
  GET?: FlexibleApiHandler;
  POST?: FlexibleApiHandler;
  PUT?: FlexibleApiHandler;
  PATCH?: FlexibleApiHandler;
  DELETE?: FlexibleApiHandler;
}) {
  const wrappedHandlers: Record<string, FlexibleApiHandler> = {};
  for (const [method, handler] of Object.entries(handlers)) {
    if (handler) {
      wrappedHandlers[method] = withErrorHandler(handler as FlexibleApiHandler);
    }
  }
  return wrappedHandlers as {
    GET?: FlexibleApiHandler;
    POST?: FlexibleApiHandler;
    PUT?: FlexibleApiHandler;
    PATCH?: FlexibleApiHandler;
    DELETE?: FlexibleApiHandler;
  };
}

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

export function assertExists<T>(
  value: T | null | undefined,
  message?: string,
  errorCode: ErrorCodeType = ErrorCode.NOT_FOUND
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ApiError(errorCode, message);
  }
}

export function assertAuthenticated(
  user: string | null | undefined,
  message = "请先登录"
): asserts user is string {
  if (!user) {
    throw ApiError.unauthorized(message);
  }
}

export function assertAuthorized(
  condition: boolean,
  message = "权限不足"
): void {
  if (!condition) {
    throw ApiError.forbidden(message);
  }
}

export async function getOrThrow<T>(
  getter: () => Promise<T | null | undefined> | T | null | undefined,
  resourceName = "资源"
): Promise<T> {
  const result = await getter();
  if (result === null || result === undefined) {
    throw new ApiError(ErrorCode.NOT_FOUND, `${resourceName}不存在`);
  }
  return result;
}

export function handleDatabaseError(error: unknown): ApiError {
  if (error instanceof Error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      const field = error.message.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
      return ApiError.conflict("资源已存在", field ? { field: field[2] } : undefined);
    }

    if (error.message.includes("FOREIGN KEY constraint failed")) {
      return ApiError.badRequest("关联资源不存在");
    }

    if (error.message.includes("NOT NULL constraint failed")) {
      const field = error.message.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
      return ApiError.validation("必填字段不能为空", field ? { field: field[2] } : undefined);
    }

    console.error("Database Error:", error);
    return ApiError.internal("数据库操作失败");
  }

  return ApiError.internal("未知错误");
}

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
  isApiError,
  ErrorCode,
  HttpStatus,
  errorResponse,
  apiErrorResponse,
  handleError,
};
