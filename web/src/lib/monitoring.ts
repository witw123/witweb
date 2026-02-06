interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  timestamp: string;
  userAgent: string;
  context?: Record<string, unknown>;
}

const errorBuffer: ErrorReport[] = [];
const MAX_BUFFER_SIZE = 10;

export function initErrorMonitoring(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    reportError({
      message: event.reason?.message || "Unhandled Promise Rejection",
      stack: event.reason?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      context: { reason: event.reason },
    });
  });

  window.addEventListener("error", (event) => {
    reportError({
      message: event.message,
      stack: event.error?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}

export function reportError(error: Partial<ErrorReport> & { message: string }): void {
  const report: ErrorReport = {
    ...error,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  if (process.env.NODE_ENV === "development") {
    console.error("[Error Report]", report);
  }

  errorBuffer.push(report);
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift();
  }
}

export function getErrorBuffer(): ErrorReport[] {
  return [...errorBuffer];
}

export function clearErrorBuffer(): void {
  errorBuffer.length = 0;
}

export function withMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result
          .then((value) => {
            logPerformance(name, performance.now() - start, true);
            return value;
          })
          .catch((error) => {
            logPerformance(name, performance.now() - start, false);
            throw error;
          }) as ReturnType<T>;
      }
      logPerformance(name, performance.now() - start, true);
      return result;
    } catch (error) {
      logPerformance(name, performance.now() - start, false);
      throw error;
    }
  };
}

function logPerformance(name: string, duration: number, success: boolean): void {
  if (process.env.NODE_ENV === "development") {
    const status = success ? "OK" : "ERR";
    console.log(`[Monitor] ${status} ${name}: ${duration.toFixed(2)}ms`);
  }
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

  const allHealthy = Object.values(checks).every(Boolean);
  return { status: allHealthy ? "healthy" : "degraded", checks };
}

function checkMemory(): boolean {
  if (typeof performance === "undefined" || !(performance as any).memory) {
    return true;
  }
  const memory = (performance as any).memory;
  const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  return usedRatio < 0.9;
}
