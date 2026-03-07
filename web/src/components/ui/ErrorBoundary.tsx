"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { logErrorBoundary } from "@/lib/logger";
import { cn } from "@/lib/utils/cn";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  className?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function DefaultFallback({
  error,
  resetError,
  className,
}: {
  error: Error;
  resetError: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8",
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-red-900">Something went wrong</h3>
      <p className="mb-4 max-w-md text-center text-sm text-red-700">
        An unexpected error interrupted rendering. Try again or reload the page.
      </p>

      {process.env.NODE_ENV === "development" ? (
        <div className="mb-4 w-full max-w-md overflow-auto rounded-lg bg-red-100 p-4">
          <p className="text-xs font-mono text-red-800">
            <strong>Error:</strong> {error.message}
          </p>
          {error.stack ? (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700">{error.stack}</pre>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={resetError}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logErrorBoundary(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }

      return (
        <DefaultFallback
          error={this.state.error}
          resetError={this.resetError}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
