// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  categorizeError,
  isRetryableError,
  getAgentErrorMessage,
  getErrorTitle,
  getErrorSuggestion,
  normalizeAgentError,
  extractFieldError,
} from "@/features/agent/utils/error";
import { isApiClientError } from "@/lib/api-client";

// Mock isApiClientError
vi.mock("@/lib/api-client", () => ({
  isApiClientError: vi.fn(),
}));

describe("categorizeError", () => {
  it("returns 'network' for TypeError", () => {
    const error = new TypeError("Failed to fetch");
    expect(categorizeError(error)).toBe("network");
  });

  it("returns 'network' for network-related messages", () => {
    const error = new Error("Network connection lost");
    expect(categorizeError(error)).toBe("network");
  });

  it("returns 'network' for timeout errors", () => {
    const error = new Error("Request timeout");
    expect(categorizeError(error)).toBe("network");
  });

  it("returns 'auth' for 401 errors", () => {
    const error = new Error("401 Unauthorized");
    expect(categorizeError(error)).toBe("auth");
  });

  it("returns 'auth' for 403 errors", () => {
    const error = new Error("403 Forbidden");
    expect(categorizeError(error)).toBe("auth");
  });

  it("returns 'validation' for validation errors", () => {
    const error = new Error("Validation failed: invalid input");
    expect(categorizeError(error)).toBe("validation");
  });

  it("returns 'server' for 500 errors", () => {
    const error = new Error("500 Internal Server Error");
    expect(categorizeError(error)).toBe("server");
  });

  it("returns 'unknown' for other errors", () => {
    const error = new Error("Something went wrong");
    expect(categorizeError(error)).toBe("unknown");
  });

  it("returns 'unknown' for non-Error inputs", () => {
    expect(categorizeError(null)).toBe("unknown");
    expect(categorizeError(undefined)).toBe("unknown");
    expect(categorizeError("error string")).toBe("unknown");
  });
});

describe("isRetryableError", () => {
  it("returns true for network errors", () => {
    expect(isRetryableError("network")).toBe(true);
  });

  it("returns true for server errors", () => {
    expect(isRetryableError("server")).toBe(true);
  });

  it("returns false for auth errors", () => {
    expect(isRetryableError("auth")).toBe(false);
  });

  it("returns false for validation errors", () => {
    expect(isRetryableError("validation")).toBe(false);
  });

  it("returns false for unknown errors", () => {
    expect(isRetryableError("unknown")).toBe(false);
  });
});

describe("getAgentErrorMessage", () => {
  it("returns empty string for AbortError", () => {
    const error = new Error("Aborted");
    error.name = "AbortError";
    expect(getAgentErrorMessage(error)).toBe("");
  });

  it("returns the message for Error instances", () => {
    const error = new Error("Custom error message");
    expect(getAgentErrorMessage(error)).toBe("Custom error message");
  });

  it("returns the string for string inputs", () => {
    expect(getAgentErrorMessage("String error")).toBe("String error");
  });

  it("returns default message for unknown types", () => {
    expect(getAgentErrorMessage(null)).toBe("发生未知错误");
    expect(getAgentErrorMessage(undefined)).toBe("发生未知错误");
  });
});

describe("getErrorTitle", () => {
  it("returns correct titles for each category", () => {
    expect(getErrorTitle("network")).toBe("网络连接问题");
    expect(getErrorTitle("auth")).toBe("认证失败");
    expect(getErrorTitle("validation")).toBe("输入验证失败");
    expect(getErrorTitle("server")).toBe("服务器错误");
    expect(getErrorTitle("unknown")).toBe("操作失败");
  });
});

describe("getErrorSuggestion", () => {
  it("returns correct suggestions for each category", () => {
    expect(getErrorSuggestion("network")).toBe("请检查网络连接后重试");
    expect(getErrorSuggestion("auth")).toBe("请重新登录后再试");
    expect(getErrorSuggestion("validation")).toBe("请检查输入内容");
    expect(getErrorSuggestion("server")).toBe("服务暂时不可用，请稍后再试");
    expect(getErrorSuggestion("unknown")).toBe("请稍后重试");
  });
});

describe("normalizeAgentError", () => {
  it("normalizes Error instances", () => {
    const error = new Error("Test error");
    const result = normalizeAgentError(error);

    expect(result.message).toBe("Test error");
    expect(result.retryable).toBe(false);
    expect(result.originalError).toBe(error);
  });

  it("normalizes string errors", () => {
    const result = normalizeAgentError("String error");

    expect(result.message).toBe("String error");
    expect(result.category).toBe("unknown");
    expect(result.retryable).toBe(false);
  });

  it("preserves existing AgentError objects", () => {
    const agentError = {
      message: "Custom message",
      category: "network" as const,
      retryable: true,
    };
    const result = normalizeAgentError(agentError);

    expect(result.message).toBe("Custom message");
    expect(result.category).toBe("network");
    expect(result.retryable).toBe(true);
  });
});

describe("extractFieldError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts field error from API error", () => {
    vi.mocked(isApiClientError).mockReturnValue(true);
    vi.mocked(isApiClientError).mockImplementation(() => true);

    const error = {
      message: "Validation failed",
      details: { goal: "Goal is required", content: "Content is too short" },
    };

    expect(extractFieldError(error, "goal")).toBe("Goal is required");
    expect(extractFieldError(error, "content")).toBe("Content is too short");
  });

  it("returns null for non-API errors", () => {
    vi.mocked(isApiClientError).mockReturnValue(false);

    expect(extractFieldError(new Error("test"), "field")).toBe(null);
  });

  it("returns null when field is not in details", () => {
    vi.mocked(isApiClientError).mockReturnValue(true);

    const error = {
      message: "Validation failed",
      details: { otherField: "Error message" },
    };

    expect(extractFieldError(error, "missingField")).toBe(null);
  });
});
