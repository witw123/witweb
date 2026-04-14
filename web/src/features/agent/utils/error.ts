import { isApiClientError } from "@/lib/api-client";
import type { AgentError, AgentErrorCategory } from "@/features/agent/types";

/**
 * Categorize an error for appropriate UI handling
 */
export function categorizeError(error: unknown): AgentErrorCategory {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (
    error.name === "TypeError" ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("aborterror") ||
    message.includes("connection")
  ) {
    return "network";
  }

  // Auth errors
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("unauthenticated")
  ) {
    return "auth";
  }

  // Validation errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("empty")
  ) {
    return "validation";
  }

  // Server errors
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("server") ||
    message.includes("internal")
  ) {
    return "server";
  }

  return "unknown";
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(category: AgentErrorCategory): boolean {
  return category === "network" || category === "server";
}

/**
 * Get user-friendly error message
 */
export function getAgentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Skip abort errors
    if (error.name === "AbortError") {
      return "";
    }
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "发生未知错误";
}

/**
 * Get user-friendly error title based on category
 */
export function getErrorTitle(category: AgentErrorCategory): string {
  switch (category) {
    case "network":
      return "网络连接问题";
    case "auth":
      return "认证失败";
    case "validation":
      return "输入验证失败";
    case "server":
      return "服务器错误";
    default:
      return "操作失败";
  }
}

/**
 * Get suggested action for error
 */
export function getErrorSuggestion(category: AgentErrorCategory): string {
  switch (category) {
    case "network":
      return "请检查网络连接后重试";
    case "auth":
      return "请重新登录后再试";
    case "validation":
      return "请检查输入内容";
    case "server":
      return "服务暂时不可用，请稍后再试";
    default:
      return "请稍后重试";
  }
}

/**
 * Normalize any error into AgentError
 */
export function normalizeAgentError(error: unknown): AgentError {
  // Check if already an AgentError
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    "category" in error &&
    "retryable" in error
  ) {
    return error as AgentError;
  }

  const category = categorizeError(error);
  const message = getAgentErrorMessage(error);

  return {
    message,
    category,
    retryable: isRetryableError(category),
    originalError: error,
  };
}

/**
 * Extract field-specific error from API error
 */
export function extractFieldError(error: unknown, field: string): string | null {
  if (isApiClientError(error) && error.details && typeof error.details === "object") {
    const details = error.details as Record<string, unknown>;
    if (field in details && typeof details[field] === "string") {
      return details[field] as string;
    }
  }
  return null;
}
