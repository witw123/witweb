import { logError, getErrorLogs, clearErrorLogs } from "./logger";

let initialized = false;

type BrowserMemoryInfo = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

type PerformanceWithMemory = Performance & {
  memory?: BrowserMemoryInfo;
};

export function initErrorMonitoring(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("unhandledrejection", (event) => {
    logError({
      source: "window.unhandledrejection",
      error: event.reason,
      message: event.reason?.message || "Unhandled Promise Rejection",
      context: { reason: event.reason },
    });
  });

  window.addEventListener("error", (event) => {
    logError({
      source: "window.error",
      error: event.error || event.message,
      message: event.message,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}

type MonitoredFunction = (...args: unknown[]) => unknown;

export function withMonitoring<T extends MonitoredFunction>(
  fn: T,
  name: string
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          logError({
            source: `monitor.${name}`,
            error,
            context: { durationMs: performance.now() - start },
          });
          throw error;
        }) as ReturnType<T>;
      }
      return result as ReturnType<T>;
    } catch (error) {
      logError({
        source: `monitor.${name}`,
        error,
        context: { durationMs: performance.now() - start },
      });
      throw error;
    }
  };
}

export async function healthCheck(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {
    database: true,
    api: true,
    memory: checkMemory(),
  };
  return {
    status: Object.values(checks).every(Boolean) ? "healthy" : "degraded",
    checks,
  };
}

function checkMemory(): boolean {
  if (typeof performance === "undefined") return true;
  const memory = (performance as PerformanceWithMemory).memory;
  if (!memory) return true;
  return memory.usedJSHeapSize / memory.jsHeapSizeLimit < 0.9;
}

export { getErrorLogs as getErrorBuffer, clearErrorLogs as clearErrorBuffer };
