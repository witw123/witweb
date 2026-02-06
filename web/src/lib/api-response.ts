import { NextResponse } from "next/server";
import {
  ApiError,
  ErrorCode,
  ErrorCodeMessages,
  ErrorCodeToHttpStatus,
  type ErrorCodeType,
  HttpStatus,
  type HttpStatusCode,
  isApiError,
} from "./api-error";

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorDetail {
  code: ErrorCodeType;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends SuccessResponse<PaginatedData<T>> {
  success: true;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function successResponse<T>(
  data: T,
  status: HttpStatusCode = HttpStatus.OK
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function createdResponse<T>(data: T): NextResponse<SuccessResponse<T>> {
  return successResponse(data, HttpStatus.CREATED);
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  size: number
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / size);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return successResponse({
    items,
    total,
    page,
    size,
    totalPages,
    hasNext,
    hasPrev,
  });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(
  code: ErrorCodeType,
  message?: string,
  details?: unknown,
  status?: HttpStatusCode
): NextResponse<ErrorResponse> {
  const httpStatus = status || ErrorCodeToHttpStatus[code] || HttpStatus.INTERNAL_SERVER_ERROR;
  const errorMessage = message || ErrorCodeMessages[code] || "Unknown error";

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message: errorMessage,
        ...(details !== undefined && { details }),
      },
    },
    { status: httpStatus }
  );
}

export function apiErrorResponse(error: ApiError): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: error.toJSON(),
    },
    { status: error.statusCode }
  );
}

export const errorResponses = {
  unauthorized: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.UNAUTHORIZED, message, details),

  forbidden: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.FORBIDDEN, message, details),

  notFound: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.NOT_FOUND, message, details),

  badRequest: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.BAD_REQUEST, message, details),

  validation: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.VALIDATION_ERROR, message, details),

  conflict: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.CONFLICT, message, details),

  internal: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.INTERNAL_ERROR, message, details),

  rateLimited: (message?: string, details?: unknown) =>
    errorResponse(ErrorCode.RATE_LIMITED, message, details),
};

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  if (isApiError(error)) {
    return apiErrorResponse(error);
  }

  if (error instanceof Error) {
    console.error("API Error:", error);
    return errorResponses.internal(
      process.env.NODE_ENV === "development" ? error.message : undefined
    );
  }

  console.error("Unknown Error:", error);
  return errorResponses.internal();
}

export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ErrorResponse {
  return response.success === false;
}

export {
  ApiError,
  ErrorCode,
  ErrorCodeMessages,
  ErrorCodeToHttpStatus,
  HttpStatus,
  isApiError,
};
export type {
  ErrorCodeType,
  HttpStatusCode,
};
