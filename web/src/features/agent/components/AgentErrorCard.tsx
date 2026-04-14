"use client";

import type { AgentError, AgentErrorCategory } from "@/features/agent/types";
import { getErrorTitle, getErrorSuggestion } from "@/features/agent/utils";

interface AgentErrorCardProps {
  error: AgentError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryable?: boolean;
  className?: string;
}

function normalizeErrorInput(error: AgentError | Error | string): AgentError {
  if (typeof error === "string") {
    return {
      message: error,
      category: "unknown" as AgentErrorCategory,
      retryable: false,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      category: "unknown" as AgentErrorCategory,
      retryable: false,
      originalError: error,
    };
  }
  return error;
}

function getErrorIcon(category: AgentErrorCategory) {
  switch (category) {
    case "network":
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
      );
    case "auth":
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      );
    case "validation":
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

export function AgentErrorCard({
  error: errorInput,
  onRetry,
  onDismiss,
  retryable,
  className = "",
}: AgentErrorCardProps) {
  const error = normalizeErrorInput(errorInput);
  const canRetry = retryable ?? error.retryable;
  const title = getErrorTitle(error.category);
  const suggestion = getErrorSuggestion(error.category);

  return (
    <div className={`agent-error-card ${className}`}>
      <div className="agent-error-icon">{getErrorIcon(error.category)}</div>
      <div className="agent-error-content">
        <h4 className="agent-error-title">{title}</h4>
        <p className="agent-error-message">{error.message}</p>
        {suggestion && <p className="agent-error-suggestion">{suggestion}</p>}
      </div>
      <div className="agent-error-actions">
        {canRetry && onRetry && (
          <button type="button" className="agent-error-retry" onClick={onRetry}>
            重试
          </button>
        )}
        {onDismiss && (
          <button type="button" className="agent-error-dismiss" onClick={onDismiss}>
            关闭
          </button>
        )}
      </div>
    </div>
  );
}

// Inline error for form inputs
interface AgentFieldErrorProps {
  error?: string;
  className?: string;
}

export function AgentFieldError({ error, className = "" }: AgentFieldErrorProps) {
  if (!error) return null;

  return (
    <div className={`agent-field-error ${className}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{error}</span>
    </div>
  );
}

// Toast-style error notification
interface AgentErrorToastProps {
  error: AgentError | Error | string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function AgentErrorToast({
  error: errorInput,
  onDismiss,
  onRetry,
}: AgentErrorToastProps) {
  const error = normalizeErrorInput(errorInput);

  // Auto-hide logic could be added here with useEffect
  // For now, keeping it simple

  return (
    <div className="agent-error-toast">
      <div className="agent-error-toast__content">
        <span className="agent-error-toast__message">{error.message}</span>
        {error.retryable && onRetry && (
          <button type="button" className="agent-error-toast__retry" onClick={onRetry}>
            重试
          </button>
        )}
      </div>
      <button type="button" className="agent-error-toast__dismiss" onClick={onDismiss} aria-label="关闭">
        ×
      </button>
    </div>
  );
}
