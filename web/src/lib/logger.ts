import type { ErrorInfo } from "react";

export interface ErrorLogRecord {
  source: string;
  message: string;
  stack?: string;
  timestamp: string;
  runtime: "browser" | "server";
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
}

const errorBuffer: ErrorLogRecord[] = [];
const MAX_BUFFER_SIZE = 50;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function toError(value: unknown): Error | null {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return null;
}

function pushRecord(record: ErrorLogRecord): void {
  errorBuffer.push(record);
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift();
  }
}

export function logError(input: {
  source: string;
  error: unknown;
  message?: string;
  context?: Record<string, unknown>;
}): ErrorLogRecord {
  const normalizedError = toError(input.error);
  const record: ErrorLogRecord = {
    source: input.source,
    message: input.message || normalizedError?.message || "Unknown error",
    stack: normalizedError?.stack,
    timestamp: new Date().toISOString(),
    runtime: isBrowser() ? "browser" : "server",
    url: isBrowser() ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    context: input.context,
  };

  pushRecord(record);

  if (process.env.NODE_ENV !== "test") {
    console.error(`[${record.source}] ${record.message}`, record);
  }

  return record;
}

export function logErrorBoundary(error: Error, errorInfo: ErrorInfo, context?: Record<string, unknown>): ErrorLogRecord {
  return logError({
    source: "ui.error-boundary",
    error,
    context: {
      componentStack: errorInfo.componentStack,
      ...context,
    },
  });
}

export function getErrorLogs(): ErrorLogRecord[] {
  return [...errorBuffer];
}

export function clearErrorLogs(): void {
  errorBuffer.length = 0;
}
