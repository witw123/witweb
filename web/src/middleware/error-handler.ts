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

export type ApiHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> | Response;

export type FlexibleApiHandler<TParams = Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<Response> | Response;

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

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type FlexibleHandlerMap = Partial<Record<ApiMethod, FlexibleApiHandler>>;

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
  message = "Please log in first"
): asserts user is string {
  if (!user) {
    throw ApiError.unauthorized(message);
  }
}

export function assertAuthorized(
  condition: boolean,
  message = "Insufficient permissions"
): void {
  if (!condition) {
    throw ApiError.forbidden(message);
  }
}

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
  ErrorCode,
  HttpStatus,
  apiErrorResponse,
  errorResponse,
  handleError,
  isApiError,
};
