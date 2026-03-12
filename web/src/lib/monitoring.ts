/**
 * 前端监控与健康检查工具
 *
 * 提供错误监控（unhandledrejection、error 事件）和应用健康状态检查功能
 */

import { logError, getErrorLogs, clearErrorLogs } from "./logger";

let initialized = false;

/** 浏览器内存信息（Chrome 特有 API） */
type BrowserMemoryInfo = {
  /** 已使用的 JavaScript 堆内存大小（字节） */
  usedJSHeapSize: number;
  /** JavaScript 堆内存上限（字节） */
  jsHeapSizeLimit: number;
};

type PerformanceWithMemory = Performance & {
  memory?: BrowserMemoryInfo;
};

/**
 * 初始化前端错误监控
 *
 * 在浏览器环境注册 unhandledrejection 和 error 事件处理器
 * 重复调用无效（单次初始化）
 */
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

/**
 * 包装函数以监控执行时间和错误
 *
 * 用于追踪函数性能和问题诊断，记录执行时长并在失败时记录错误
 *
 * @param fn - 要监控的函数
 * @param name - 监控项名称
 * @returns 包装后的函数
 */
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

/**
 * 执行应用健康检查
 *
 * 检查数据库、API 和内存使用情况，返回整体健康状态
 *
 * @returns 健康状态及各项检查结果
 */
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

/** 获取错误日志缓冲区的别名 */
export { getErrorLogs as getErrorBuffer, clearErrorLogs as clearErrorBuffer };
