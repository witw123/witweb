/**
 * API 错误定义
 *
 * 定义 HTTP 状态码、错误码和错误类
 */

/** HTTP 状态码 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/** API 错误码 */
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  NOT_FOUND: "NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  POST_NOT_FOUND: "POST_NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 错误码对应消息 */
export const ErrorCodeMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.UNAUTHORIZED]: "Unauthorized. Please log in first.",
  [ErrorCode.INVALID_TOKEN]: "Invalid authentication token.",
  [ErrorCode.TOKEN_EXPIRED]: "Authentication token has expired.",
  [ErrorCode.FORBIDDEN]: "Access forbidden.",
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: "Insufficient permissions.",
  [ErrorCode.BAD_REQUEST]: "Bad request.",
  [ErrorCode.VALIDATION_ERROR]: "Validation failed.",
  [ErrorCode.MISSING_FIELD]: "Missing required field.",
  [ErrorCode.INVALID_FORMAT]: "Invalid data format.",
  [ErrorCode.NOT_FOUND]: "Resource not found.",
  [ErrorCode.USER_NOT_FOUND]: "User not found.",
  [ErrorCode.POST_NOT_FOUND]: "Post not found.",
  [ErrorCode.RESOURCE_NOT_FOUND]: "Requested resource not found.",
  [ErrorCode.CONFLICT]: "Resource conflict.",
  [ErrorCode.ALREADY_EXISTS]: "Resource already exists.",
  [ErrorCode.DUPLICATE_ENTRY]: "Duplicate entry.",
  [ErrorCode.INTERNAL_ERROR]: "Internal server error.",
  [ErrorCode.DATABASE_ERROR]: "Database operation failed.",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "External service failed.",
  [ErrorCode.RATE_LIMITED]: "Too many requests.",
  [ErrorCode.TOO_MANY_REQUESTS]: "Request limit exceeded.",
};

export const ErrorCodeToHttpStatus: Record<ErrorCodeType, HttpStatusCode> = {
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: HttpStatus.FORBIDDEN,
  [ErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ErrorCode.VALIDATION_ERROR]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.MISSING_FIELD]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.POST_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.DUPLICATE_ENTRY]: HttpStatus.CONFLICT,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,
};

export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: HttpStatusCode;
  public readonly details?: unknown;

  constructor(code: ErrorCodeType, message?: string, details?: unknown) {
    super(message || ErrorCodeMessages[code]);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = ErrorCodeToHttpStatus[code];
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static unauthorized(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.UNAUTHORIZED, message, details);
  }

  static forbidden(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.FORBIDDEN, message, details);
  }

  static notFound(resource?: string, details?: unknown): ApiError {
    const code = resource ? (`${resource.toUpperCase()}_NOT_FOUND` as ErrorCodeType) : ErrorCode.NOT_FOUND;
    return new ApiError(code, undefined, details);
  }

  static validation(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.VALIDATION_ERROR, message, details);
  }

  static badRequest(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.BAD_REQUEST, message, details);
  }

  static conflict(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.CONFLICT, message, details);
  }

  static internal(message?: string, details?: unknown): ApiError {
    return new ApiError(ErrorCode.INTERNAL_ERROR, message, details);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

export function isApiError(error: unknown): error is ApiError {
  const maybeError = error as {
    code?: unknown;
    statusCode?: unknown;
    constructor?: { name?: unknown };
  } | null;
  return error instanceof ApiError || (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "statusCode" in error &&
    maybeError?.constructor?.name === "ApiError"
  );
}
